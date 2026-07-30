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

Two alert tiers (added 2026-07-29 after a BBC request sat unread for two days
and its deadline passed): a message whose BODY matches FIT_RE — our angle:
Dubai / UAE / Middle East / expat / golden visa / international property buyers
— is promoted to a "ФИТ" block carrying the matched quote and the deadline line;
everything else from a watched domain is listed under it for context. ~90% of
these digests are US-market queries (FHA loans, Ohio landlords) we cannot answer,
so the body scan is what separates one actionable request per week from seventy
notifications. Deliberately NOT a widening of RELEVANT_DOMAINS (rejected
2026-07-12) — it narrows the noise inside the same platforms.

**Telegram fires ONLY when there is at least one ФИТ** (2026-07-30, at the
user's request): a run whose platform mail matched nothing is written to the log
and nothing else. Pushing "📬 Вахта: 2 письма" several times a day for digests
with nothing in them trained the user to ignore the alert, which defeats the
point of having one. The no-fit tier still reaches a human — the session pass
re-reads both mailboxes and triages every digest by hand — so a FIT_RE false
negative costs a delay, not the request. That is also why a silent run still
advances the state cursor: the log line, not Telegram, is the record.

Flags: --dry-run (print, no state write, no Telegram), --test (send one test
Telegram message and exit).
"""
import imaplib
import json
import os
import re
import sys
import email
import html
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


# Our angle. Generic words are deliberately absent: "relocation", "overseas" and
# "foreign" on their own matched US corporate-relocation queries and an overseas
# hiking piece in the 27-29 July digests, so they only count when bound to
# property/buyer vocabulary.
FIT_PATTERNS = (
    r"\bdubai\b",
    r"\bu\.?a\.?e\b",
    r"\bunited arab emirates\b",
    r"\bemirati?s?\b",
    r"\babu dhabi\b",
    r"\bsharjah\b",
    r"\bras al khaimah\b",
    r"\bmiddle east\b",
    r"\bpersian gulf\b",
    r"\bgcc\b",
    r"\bexpat(riate)?s?\b",
    r"\bgolden visa\b",
    r"\b(international|foreign|overseas|non-?resident|cross-?border)\s+"
    r"(\w+\s+){0,2}(propert|real estate|buyer|investor|investment|home\b|house\b|mortgage)",
    r"\b(buy|buying|purchas\w+|own|owning|invest\w*)\s+(\w+\s+){0,3}(abroad|overseas)\b",
    r"\bsecond home\s+(abroad|overseas)\b",
)
FIT_RE = re.compile("|".join(FIT_PATTERNS), re.I)

DEADLINE_RE = re.compile(
    r"(?:submit by|deadline|respond by|responses? due)\s*:?\s*[^\n]{3,60}"
    r"|\d{1,2}:\d{2}\s*(?:am|pm)\s*(?:et|pt|est|pst|cst|gmt|msk)\s*[-–]\s*\d{1,2}\s+\w+",
    re.I,
)

CONTEXT_LINES = 2   # lines of context kept around a match, each side
MAX_FITS = 3        # quotes per email — a digest can carry several matches
QUOTE_CHARS = 320
SHORT_LINE = 160    # below this the matched line alone reads as a fragment
LEAD_CHARS = 120    # text kept before the match when centring a long line
DEADLINE_WINDOW = 12  # lines around the match searched for a deadline line


TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")  # markup, not a stray "<" in prose


def strip_html(raw):
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    return html.unescape(re.sub(r"<[^>]+>", "\n", raw))


def body_text(msg):
    """Plain text of a message. text/plain preferred, HTML stripped as fallback.

    The plain part is not automatically plain: Qwoted's reporter-message mails
    embed real <a href> tags in it (live mail 2026-07-31), and trusting it
    verbatim put a 500-char tracking URL into the alert quote where the request
    should have been. So markup is stripped wherever it appears — TAG_RE, not a
    bare "<", decides, or prose like "units < AED 2M" would lose its tail.
    """
    plain, htm = [], []
    for part in msg.walk():
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            payload = part.get_payload(decode=True)
        except Exception:
            continue
        if not payload:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", "replace")
        (plain if ctype == "text/plain" else htm).append(text)
    if plain:
        text = "\n".join(plain)
        return strip_html(text) if TAG_RE.search(text) else text
    return strip_html("\n".join(htm))


def quote_for(lines, i):
    """Quote that always contains the matched words.

    A digest paragraph can be 600 chars with "Middle East" at the very end, so a
    plain head-slice would show a quote with nothing matching in it and read as a
    false alarm. Long lines are centred on the match; short ones borrow their
    neighbours, which is where a one-line request keeps its meaning.
    """
    line = lines[i]
    if len(line) <= SHORT_LINE:
        # Centre the window on the match too. Slicing the joined block from its
        # start looks safe only while the neighbours are short: the WSJ alert of
        # 2026-07-31 borrowed a 400-char line above and the cut landed before the
        # matching words, so the quote showed boilerplate and read as noise.
        before = lines[max(0, i - CONTEXT_LINES): i]
        window = " ".join(before + lines[i: i + CONTEXT_LINES + 1])
        pos = sum(len(l) + 1 for l in before) + FIT_RE.search(line).start()
        start = max(0, pos - LEAD_CHARS)
        return ("…" if start else "") + window[start:start + QUOTE_CHARS]
    start = max(0, FIT_RE.search(line).start() - LEAD_CHARS)
    return ("…" if start else "") + line[start:start + QUOTE_CHARS]


def nearest_deadline(lines, i):
    """Deadline line closest to the match, ties going to the one above it.

    A Qwoted round-up holds several requests, each with its own "Submit By"; the
    first one inside the window usually belongs to a different request, so
    distance decides. Ties prefer the earlier line because these digests print
    the deadline above the request text.
    """
    best, best_dist = None, None
    lo, hi = max(0, i - DEADLINE_WINDOW), min(len(lines), i + DEADLINE_WINDOW + 1)
    for j in range(lo, hi):
        found = DEADLINE_RE.search(lines[j])
        if not found:
            continue
        dist = abs(j - i)
        if best_dist is None or dist < best_dist:
            best, best_dist = found.group(0).strip(), dist
    return best


def find_fits(text, max_hits=MAX_FITS):
    """Quotes from `text` that match our angle, each with a deadline if nearby.

    Returns a list of {"quote", "deadline"} dicts. Dedup keys on the MATCHED line,
    not on the quote: a digest repeats the same request in its plain and HTML
    parts, and the surrounding context differs between the two, so a quote-based
    key would report it twice.
    """
    lines = [re.sub(r"\s+", " ", l).strip() for l in text.splitlines()]
    lines = [l for l in lines if l]
    hits, seen = [], set()
    for i, line in enumerate(lines):
        if not FIT_RE.search(line):
            continue
        key = line.lower()[:80]
        if key in seen:
            continue
        seen.add(key)
        hits.append({"quote": quote_for(lines, i), "deadline": nearest_deadline(lines, i)})
        if len(hits) >= max_hits:
            break
    return hits


def load_env():
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


# Telegram rejects messages over 4096 chars. Chunk below that with headroom, the
# same way competitor-gap.mjs does — a backlog after downtime easily exceeds it.
TG_CHUNK = 3900


def chunk_lines(lines, limit=TG_CHUNK):
    """Group lines into messages under `limit` chars, never splitting a line."""
    chunks, cur, cur_len = [], [], 0
    for line in lines:
        add = len(line) + 1
        if cur and cur_len + add > limit:
            chunks.append("\n".join(cur))
            cur, cur_len = [], 0
        cur.append(line)
        cur_len += add
    if cur:
        chunks.append("\n".join(cur))
    return chunks


def telegram_send(text):
    """Send one alert. Returns True only if EVERY chunk was delivered.

    LOAD-BEARING (audit 2026-07-27): the return value gates the state cursor in
    main(). Previously this swallowed the error and the cursor advanced anyway,
    so a failed send meant those emails were never re-checked — and this is the
    only channel that catches PR/link-building requests between sessions.
    """
    # First chat ID only (the admin's bot DM) — mail alerts must not hit the
    # group chat that may follow in the comma-separated TELEGRAM_CHAT_ID.
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_ids = [c.strip() for c in os.environ.get("TELEGRAM_CHAT_ID", "").split(",") if c.strip()]
    if not token or not chat_ids:
        print("mail-watch: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set, alert skipped")
        return False
    chat_id = chat_ids[0]
    for part in chunk_lines(text.split("\n")):
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": part}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
        try:
            urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:  # alert failure must not crash the run — but must be reported
            print(f"mail-watch: telegram send failed for {chat_id}: {type(e).__name__}: {e}")
            return False
    return True


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


def fetch_fits(M, uid):
    """Body scan for one message. Never fatal: a failed fetch just means no quote."""
    try:
        typ, data = M.uid("fetch", str(uid), "(BODY.PEEK[])")
        if not data or data[0] is None:
            return []
        return find_fits(body_text(email.message_from_bytes(data[0][1])))
    except Exception as e:
        print(f"mail-watch: body fetch failed for UID {uid}: {type(e).__name__}: {e}")
        return []


def check_account(user, password, prev, dry_run):
    """Returns (new_state_entry, relevant list of {from, subject, date, fits})."""
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
                relevant.append({
                    "from": frm,
                    "subject": decode(msg.get("Subject")),
                    "date": msg.get("Date", ""),
                    "fits": fetch_fits(M, u),
                })
    M.logout()
    return {"last_uid": max_uid, "uidvalidity": uidvalidity}, relevant


def format_alert(items):
    """Telegram text for the run: fits first (with quote + deadline), rest listed."""
    fits = [i for i in items if i.get("fits")]
    rest = [i for i in items if not i.get("fits")]
    lines = []
    if fits:
        lines.append(f"🔥 ФИТ: {len(fits)} письмо(а) под наш профиль — ответить сегодня")
        for item in fits:
            box = item["account"].split("@")[0]
            lines.append(f"\n• [{box}] {item['from']}\n  {item['subject']}")
            for hit in item["fits"]:
                if hit["deadline"]:
                    lines.append(f"  ⏰ {hit['deadline']}")
                lines.append(f"  «{hit['quote']}»")
    if rest:
        if fits:
            lines.append(f"\n📬 Остальное ({len(rest)}) — без совпадений:")
        else:
            lines.append(f"📬 Вахта: {len(rest)} письмо(а) по площадкам:")
        for item in rest:
            box = item["account"].split("@")[0]
            lines.append(f"• [{box}] {item['from']}\n  {item['subject']}")
    return "\n".join(lines)


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
        for item in relevant:
            item["account"] = user
        all_relevant.extend(relevant)

    delivered = True
    fits = [i for i in all_relevant if i.get("fits")]
    if fits:
        # The no-fit items ride along inside the same message: we are already
        # interrupting for the fit, so listing them costs no extra notification.
        text = format_alert(all_relevant)
        if dry_run:
            print("mail-watch: DRY RUN, would send:\n" + text)
        else:
            delivered = telegram_send(text)
            if delivered:
                # A receipt, so a delivered ФИТ is not indistinguishable from a
                # crash: the WSJ alert of 2026-07-31 left no trace here and the
                # empty log tail was the only hint that anything had been sent.
                print(f"mail-watch: 🔥 ФИТ отправлен ({len(fits)} из {len(all_relevant)} писем)")
    elif all_relevant:
        # Log-only tier — no push without a fit (see module docstring).
        print(f"mail-watch: {len(all_relevant)} письмо(а) без совпадений, в Telegram не ушло:")
        for item in all_relevant:
            box = item["account"].split("@")[0]
            print(f"mail-watch:   [{box}] {item['from']} | {item['subject']}")
    else:
        print("mail-watch: тихо")

    # Advance the cursor ONLY when the alert actually reached Telegram. Otherwise
    # keep the old state so the next run re-reports these emails instead of
    # skipping past them forever (audit 2026-07-27).
    if dry_run:
        return
    if not delivered:
        print("mail-watch: alert NOT delivered — cursor left untouched, will retry next run")
        sys.exit(1)
    write_state(new_state)


if __name__ == "__main__":
    main()
