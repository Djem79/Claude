#!/usr/bin/env python3
"""Проверка здоровья серверных агентов (кронов) — часть сессионной рутины.

Запускается ЛОКАЛЬНО, ходит на сервер по SSH одним заходом. Деплой не нужен.

    python3 scripts/agents-health.py

Что проверяет:
  * каждую строку crontab: есть ли её лог и не протух ли он относительно
    собственного расписания (интервал выводится из cron-выражения, поэтому
    добавление/правка крона не требует правки этого скрипта);
  * хвосты логов на признаки ошибок (строки вида "0 errors" не считаются);
  * PM2 (процесс должен быть online);
  * месячные контент-планы: сколько постов осталось и нет ли разрыва на стыке
    месяцев (июньский план однажды кончился молча — канал молчал 4 дня);
  * висит ли черновик статьи, ждущий аппрува в Telegram.

Коды выхода: 0 — всё чисто, 1 — есть WARN/FAIL (удобно для глаза, не для CI).
"""

import re
import subprocess
import sys
from datetime import datetime, timezone

HOST = "root@62.238.35.20"
KEY = "~/.ssh/id_ed25519"

REMOTE = r"""
echo "###DATE###"; date -u '+%s'
echo "###CRONTAB###"; crontab -l 2>/dev/null | grep -vE '^\s*#|^\s*$'
echo "###LOGS###"
for f in /var/log/worldwise-*.log /root/backup.log; do
  [ -f "$f" ] && echo "$(stat -c '%Y' "$f") $f"
done
echo "###TAILS###"
for f in /var/log/worldwise-*.log; do
  [ -f "$f" ] && { echo "--$f"; tail -12 "$f"; }
done
echo "###PM2###"
pm2 jlist 2>/dev/null > /tmp/_pm2.json
python3 - <<'PY'
import json
try:
    for p in json.load(open('/tmp/_pm2.json')):
        print(f"{p['name']}|{p['pm2_env']['status']}|{p['pm2_env']['restart_time']}")
except Exception as e:
    print(f"ERR|{e}|-")
PY
rm -f /tmp/_pm2.json
echo "###PLANS###"
cd /var/www/worldwise 2>/dev/null && python3 - <<'PY'
import json, glob, os
for p in sorted(glob.glob('data/content-plan-*.json')):
    try:
        posts = json.load(open(p)).get('posts', [])
        un = [x for x in posts if not x.get('sent')]
        print(f"{os.path.basename(p)}|{len(posts)}|{len(un)}|"
              f"{un[0]['date'] if un else '-'}|{un[-1]['date'] if un else '-'}")
    except Exception as e:
        print(f"{os.path.basename(p)}|ERR|{e}|-|-")
PY
echo "###DRAFT###"
python3 - <<'PY'
import json, os
p = '/var/www/worldwise/data/article-draft.json'
if not os.path.exists(p):
    print('none')
else:
    try:
        d = json.load(open(p))
        print(d.get('title', '(без заголовка)') if d else 'none')
    except Exception as e:
        print(f'ERR {e}')
PY
"""

# Строки, которые выглядят как ошибка. "0 errors"/"0 ошибок" — это норма отчёта.
ERR_RE = re.compile(
    r"\b(error|failed|failure|exception|traceback|invalid_grant|ECONN|ETIMEDOUT|"
    r"unauthoriz|forbidden|не найден|ошибк)", re.IGNORECASE)
ERR_OK_RE = re.compile(r"\b0\s+(errors?|ошиб)", re.IGNORECASE)

HOUR = 3600
DAY = 24 * HOUR


def fetch():
    out = subprocess.run(
        ["ssh", "-i", KEY.replace("~", subprocess.os.path.expanduser("~")), HOST, "bash -s"],
        input=REMOTE, capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        sys.exit(f"SSH упал: {out.stderr.strip()[:300]}")
    return out.stdout


def split_sections(raw):
    sections, cur = {}, None
    for line in raw.splitlines():
        m = re.fullmatch(r"###(\w+)###", line.strip())
        if m:
            cur = m.group(1)
            sections[cur] = []
        elif cur:
            sections[cur].append(line)
    return sections


def tolerance(minute, hour, dom, dow):
    """Допустимый возраст лога, выведенный из cron-выражения (с запасом)."""
    if dom != "*":                      # раз в месяц
        return 32 * DAY, "1-го числа"
    if dow != "*":                      # раз в неделю
        days = {"0": "вс", "1": "пн", "2": "вт", "3": "ср",
                "4": "чт", "5": "пт", "6": "сб"}
        return 8 * DAY, f"еженед {days.get(dow, dow)}"
    if "/" in hour:                     # каждые N часов
        n = int(hour.split("/")[-1])
        return (n + 2) * HOUR, f"кажд. {n}ч"
    if hour != "*":                     # ежедневно
        return 2 * DAY, f"ежедн {hour.zfill(2)}:{minute.zfill(2)}"
    return 2 * HOUR, "ежечасно"


def human(sec):
    if sec < HOUR:
        return f"{int(sec // 60)} мин"
    if sec < DAY:
        return f"{sec / HOUR:.0f} ч"
    return f"{sec / DAY:.1f} дн"


def main():
    sec = split_sections(fetch())
    now = int(sec["DATE"][0].strip())

    mtimes = {}
    for line in sec["LOGS"]:
        if line.strip():
            ts, path = line.split(None, 1)
            mtimes[path.strip()] = int(ts)

    tails, cur = {}, None
    for line in sec["TAILS"]:
        if line.startswith("--/var/log/"):
            cur = line[2:]
            tails[cur] = []
        elif cur:
            tails[cur].append(line)

    print(f"АГЕНТЫ · {HOST} · UTC "
          f"{datetime.fromtimestamp(now, timezone.utc):%Y-%m-%d %H:%M}\n")

    problems = 0
    seen_logs = set()
    for line in sec["CRONTAB"]:
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        minute, hour, dom, _mon, dow, cmd = parts
        log = (re.search(r">>\s*(\S+\.log)", cmd) or [None, None])[1]
        name = (re.search(r"scripts/([\w.-]+)", cmd) or
                re.search(r"/([\w.-]+\.sh)", cmd) or [None, "?"])[1]
        tol, sched = tolerance(minute, hour, dom, dow)

        if not log:
            continue
        seen_logs.add(log)
        if log not in mtimes:
            print(f"  WARN  {name:<26} {sched:<14} лога нет — ни разу не писал")
            problems += 1
            continue
        age = now - mtimes[log]
        status = "OK  " if age <= tol else "WARN"
        if age > tol:
            problems += 1
        print(f"  {status}  {name:<26} {sched:<14} лог {human(age)} назад")

    # Ошибки в хвостах. Повторы схлопываем (13 одинаковых «SERP failed» — это
    # один инцидент, а не 13), и подписываем возрастом лога: строка недельной
    # давности из еженедельного агента — уже разобранная история, не новость.
    groups = {}
    for log, lines in tails.items():
        for ln in lines:
            if not ERR_RE.search(ln) or ERR_OK_RE.search(ln):
                continue
            short = log.split("worldwise-")[-1].replace(".log", "")
            body = re.sub(r"^\[[^\]]+\]\s*", "", ln.strip())      # убрать timestamp
            key = (short, re.sub(r'"[^"]*"', '"…"', body)[:100])  # нормализовать
            groups[key] = groups.get(key, 0) + 1
    if groups:
        print("\n  Похоже на ошибки в логах:")
        for (short, body), cnt in sorted(groups.items(), key=lambda x: -x[1])[:6]:
            log_path = next((p for p in mtimes if short in p), None)
            age = human(now - mtimes[log_path]) if log_path else "?"
            times = f" ×{cnt}" if cnt > 1 else ""
            print(f"    [{short}, {age} назад]{times} {body}")
        problems += 1

    print()
    for line in sec.get("PM2", []):
        if "|" in line:
            nm, st, rs = line.split("|")[:3]
            mark = "OK  " if st == "online" else "FAIL"
            if st != "online":
                problems += 1
            print(f"  {mark}  PM2 {nm}: {st} (restarts {rs})")

    print()
    for line in sec.get("PLANS", []):
        if "|" not in line:
            continue
        f, total, left, first, last = (line.split("|") + ["-"] * 5)[:5]
        month = f.replace("content-plan-", "").replace(".json", "")
        if left == "ERR":
            print(f"  FAIL  план {month}: не читается")
            problems += 1
        elif int(left) == 0:
            print(f"  ...   план {month}: выбран полностью ({total} постов)")
        else:
            print(f"  OK    план {month}: осталось {left}/{total} "
                  f"({first} → {last})")

    draft = "\n".join(sec.get("DRAFT", [])).strip()
    if draft and draft != "none":
        print(f"\n  ЖДЁТ  черновик статьи на аппрув в TG: «{draft[:70]}»")

    print(f"\n{'Всё чисто.' if not problems else f'Требует внимания: {problems}.'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
