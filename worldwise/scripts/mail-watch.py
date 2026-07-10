#!/usr/bin/env python3
"""Mail watch: IMAP monitor for link-building platform emails -> Telegram alerts.

Runs on the server from cron every 2 hours (see CLAUDE.md "Scheduled jobs"):

    23 */2 * * * cd /var/www/worldwise && python3 scripts/mail-watch.py >> /var/log/worldwise-mail-watch.log 2>&1

Python (not .mjs) deliberately: Node has no stdlib IMAP client and the data
layer stays dependency-free; python3 + imaplib ships with Ubuntu. Same
precedent as poppler/ImageMagick being system tools.

Watched mailboxes (both on mail.hosting.reg.ru, password per account in
.env.local; an account with no password set is skipped silently, like the
VK/OK env pattern):
  - info@worldwise.pro        INFO_IMAP_PASSWORD   (Qwoted, expat validation, HARO copy)
  - dzhambulat@worldwise.pro  DZH_IMAP_PASSWORD    (Gmail forwards: HARO/SOS/Featured/HiDubai)

Alerts only on RELEVANT_DOMAINS senders. State in data/mail-watch-state.json
(server-only, like other stores): last seen UID + UIDVALIDITY per account.
STRICT state read: missing file -> baseline pass (no alerts, record current
max UID); corrupt file -> Telegram error + exit 1, never silently reset.

Flags: --dry-run (print, no state write, no Telegram), --test (send one test
Telegram message and exit).
"""
import imaplib
import json
import os
import sys
import email
import urllib.request
import urllib.parse
from email.header import decode_header, make_header

ENV_FILE = ".env.local"
STATE_FILE = "data/mail-watch-state.json"
IMAP_HOST = "mail.hosting.reg.ru"

ACCOUNTS = [
    ("info@worldwise.pro", "INFO_IMAP_PASSWORD"),
    ("dzhambulat@worldwise.pro", "DZH_IMAP_PASSWORD"),
]

RELEVANT_DOMAINS = (
    "qwoted.com",
    "intercom-mail",          # qwoted support threads (intercom-mail-NNN.com)
    "helpareporter.com",
    "sourceofsources.com",
    "featured.com",
    "expat.com",
    "hidubai.com",
)


def load_env():
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


def telegram_send(text):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_ids = [c.strip() for c in os.environ.get("TELEGRAM_CHAT_ID", "").split(",") if c.strip()]
    if not token or not chat_ids:
        print("mail-watch: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set, alert skipped")
        return
    for chat_id in chat_ids:
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
        try:
            urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:  # alert failure is loggable but must not crash the run
            print(f"mail-watch: telegram send failed for {chat_id}: {e}")


def read_state():
    if not os.path.exists(STATE_FILE):
        return None  # baseline pass
    with open(STATE_FILE) as f:
        return json.load(f)  # corrupt -> ValueError propagates (strict)


def write_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, STATE_FILE)


def decode(value):
    try:
        return str(make_header(decode_header(value or "")))
    except Exception:
        return value or ""


def check_account(user, password, prev, dry_run):
    """Returns (new_state_entry, relevant list of (frm, subj, date))."""
    M = imaplib.IMAP4_SSL(IMAP_HOST, 993)
    M.login(user, password)
    typ, data = M.select("INBOX", readonly=True)
    uidvalidity = M.response("UIDVALIDITY")[1][0]
    uidvalidity = uidvalidity.decode() if uidvalidity else "0"

    typ, data = M.uid("search", None, "ALL")
    uids = [int(u) for u in data[0].split()] or [0]
    max_uid = max(uids)

    relevant = []
    if prev is None or prev.get("uidvalidity") != uidvalidity:
        # baseline (first run or mailbox reindexed): no alerts, just record
        print(f"mail-watch: {user}: baseline at UID {max_uid} (uidvalidity {uidvalidity})")
    else:
        last = int(prev.get("last_uid", 0))
        new = [u for u in uids if u > last]
        print(f"mail-watch: {user}: {len(new)} new since UID {last}")
        for u in new:
            typ, msg_data = M.uid("fetch", str(u), "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            if not msg_data or msg_data[0] is None:
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            frm = decode(msg.get("From"))
            if any(d in frm.lower() for d in RELEVANT_DOMAINS):
                relevant.append((frm, decode(msg.get("Subject")), msg.get("Date", "")))
    M.logout()
    return {"last_uid": max_uid, "uidvalidity": uidvalidity}, relevant


def main():
    dry_run = "--dry-run" in sys.argv
    load_env()

    if "--test" in sys.argv:
        telegram_send("📬 mail-watch: тестовый алерт — серверная вахта подключена")
        print("mail-watch: test alert sent")
        return

    try:
        state = read_state()
    except Exception as e:
        telegram_send(f"⚠️ mail-watch: state file corrupt ({e}) — вахта остановлена, нужен разбор")
        print(f"mail-watch: FATAL corrupt state: {e}")
        sys.exit(1)

    new_state = {"accounts": {}}
    all_relevant = []
    for user, pw_env in ACCOUNTS:
        password = os.environ.get(pw_env)
        if not password:
            print(f"mail-watch: {user}: no {pw_env}, skipped")
            continue
        prev = (state or {}).get("accounts", {}).get(user)
        try:
            entry, relevant = check_account(user, password, prev, dry_run)
        except Exception as e:
            print(f"mail-watch: {user}: check failed: {e}")
            if prev is not None:
                new_state["accounts"][user] = prev  # keep old cursor, retry next run
            continue
        new_state["accounts"][user] = entry
        all_relevant.extend((user, *r) for r in relevant)

    if all_relevant:
        lines = [f"📬 Вахта: {len(all_relevant)} письмо(а) по площадкам:"]
        for acct, frm, subj, date in all_relevant:
            box = acct.split("@")[0]
            lines.append(f"• [{box}] {frm}\n  {subj}")
        text = "\n".join(lines)
        if dry_run:
            print("mail-watch: DRY RUN, would send:\n" + text)
        else:
            telegram_send(text)
    else:
        print("mail-watch: тихо")

    if not dry_run:
        write_state(new_state)


if __name__ == "__main__":
    main()
