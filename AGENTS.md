# AGENTS.md — Multi-Agent Coordination

This repo is sometimes worked on by **multiple Claude (or other AI) sessions
in parallel**. Without coordination they will duplicate work, conflict on
files, or violate project rules. This document is the coordination contract.
Read it BEFORE making any non-trivial change.

> First read **`CLAUDE.md`** for the project rules — they take precedence
> over anything here, except where this file is stricter.

---

## Coordination protocol

### Who is "lead"
The session that the human says is "lead" / "главный" coordinates and has the
final say on what gets committed/deployed. Other sessions are **executors**:
they may scout, draft, and implement specific tasks, but they MUST NOT push
to `main` or deploy to production without the lead's explicit sign-off in the
human's chat.

If the human hasn't named a lead, **the session that started first on a given
feature is the lead** until told otherwise. When in doubt — ask the human.

### Before touching code

1. **Run `git status` and `git log --since='24 hours' --oneline main`.** If you
   see uncommitted changes you didn't make, or recent commits you haven't read,
   **another session is on it** — read the diffs first.
2. **Read `tasks/lessons.md`.** Every "do not repeat this mistake" entry from
   prior sessions lives there.
3. **Check `docs/superpowers/specs/` and `docs/superpowers/plans/`** for any
   active spec/plan covering what the human just asked for. If one exists, use
   it instead of inventing a parallel one.

### Before pushing or deploying

- Only the lead session pushes to `claude/main` and runs the production deploy
  (rsync + `pm2 restart`).
- If you are an executor and your work is ready, **leave a small commit on a
  feature branch** (`feat/<topic>`) and report the SHA back to the human; the
  lead will merge.
- **Never** push to `claude/main` with uncommitted work from another session
  still on disk — it will get either lost or accidentally shipped.

### Branch hygiene

- One feature → one branch. Branch from up-to-date `main`.
- Stage files by **name** only — `git add -A` / `git add .` is forbidden in
  this repo (see `CLAUDE.md`); it has shipped secrets and stray `data/` files
  in the past.
- End commit messages with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

### Communication with other sessions

You can't talk to other Claude sessions live. When you make a decision another
session needs to know about, record it in one of:

- **`/home/claude/ops-journal.md` on the VPS — the cross-machine ops journal**
  (Mac sessions ↔ the server instance; since 2026-08-01). This is the ONLY
  medium both machines see instantly — the repo needs a pull/PR round-trip.
  `tail -60` it at session start and BEFORE any outward marketing/PR action
  (a journalist reply, a pitch, a directory submission, trashing a thread) —
  the other instance may have already done it. Append an entry after every
  outward action or hand-off: `## YYYY-MM-DD HH:MM MSK [mac|server] — title`
  plus 1–5 lines of facts. Append-only; full rules live in the file header.
  From a Mac: `ssh root@62.238.35.20 "tail -60 /home/claude/ops-journal.md"`.
- `tasks/lessons.md` — for "do not repeat this" rules
- `docs/superpowers/specs/` — for design that another session might extend
- `tasks/todo.md` — for in-flight work the human is tracking
- Commit message — for *why* (not just what)

Never assume another session "already knows" something. It doesn't share your
context window.

---

## Hard rules (violating these is a regression, no exceptions)

These are the issues we've already had to fix from multi-session work. Don't
re-introduce them.

### 1. Never write to `worldwise/data/` locally
`data/` exists only on the production server. `leads.json`, `users.json`,
`properties.json`, `articles.json`, etc. are **live business data**. If you
create a file there locally, it stays untracked (`data/` is rsync-excluded on
deploy) but pollutes the working tree and confuses other sessions. If you
need test fixtures, put them under `tasks/` or `docs/`.

If your task naturally needs a data file on the **server** (e.g. a content
plan for the autoposter), `scp` it directly to `/var/www/worldwise/data/`
— do NOT put it in the local repo.

### 2. No absolute paths in committed scripts
Shell wrappers like `/Users/dzhambulat/.../node` only work on one machine. If
the script must run on the server, write it server-relative
(`/var/www/worldwise/...` or relative to `process.cwd()`). If it's a personal
local helper, leave it untracked.

### 3. All user-facing copy on `worldwise.pro` is English
Russian text in components shipped to the public site is a violation of
`CLAUDE.md → UX rules`. The only exception is a proper-noun product name
(e.g. the Telegram channel name «Смотрим Дубай») kept inside quotes.

### 4. Honeypot on every lead-capture form
Any new `<form>` that posts to `/api/leads` MUST include the hidden honeypot
input and send `_hp` in the body. See existing forms for the pattern.

### 5. Section guard on every admin route
Any new page under `app/admin/**` or API under `app/api/**` that touches
properties / leads / dashboard data must use `requireSection(...)` (API) and
`canAccess(...)` + `redirect(landingPath(session) ?? '/admin')` (page).
A section is only as protected as its least-guarded sibling route. See
`CLAUDE.md → Per-section access control` and the entry in `tasks/lessons.md`
about the lead-attachment routes that were missed once.

### 6. Verify before claiming done
- `npm run build` must pass before any commit.
- For UI/route changes: also state how you verified (curl, dry-run, etc.).
- Don't write "should work" — write what you ran and what came back.

### 7. Production changes require backup
Any deploy that touches code that *reads or writes* `data/` must be preceded
by `cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date ...)`
on the server. See `CLAUDE.md → Production deployment` for the full
sequence. Don't skip it because "this change doesn't touch data" — sequence
discipline catches the surprises.

---

## Standing participant: the server Claude instance (since 2026-07-29)

Besides ad-hoc Mac sessions, a **permanent Claude Code instance runs on the
production VPS** (user `claude`, tmux `claude-main`, reachable by the human via
Telegram bot `@worldwise_claude_bot`). It works this same repo from its own
clone at `/home/claude/Claude` (deploy key, read-write) and follows this
contract like any other session: branches → PRs, never a direct push to
`main`. It has **no sudo and no `data/` read access** and does not deploy —
its production role is read-only ops (mail triage over IMAP/Gmail, cron-log
health checks) driven by the human's Telegram requests. Its standing orders
live in `/home/claude/CLAUDE.md` on the server (edited from a Mac session via
scp). It shares state with Mac sessions through the ops journal
(`/home/claude/ops-journal.md`, see *Communication with other sessions*) —
both sides read it before acting and append after acting. If you see recent branches authored by `Claude Server
<claude-server@worldwise.pro>` — that's who it is; coordinate per this file.

---

## Current open work (as of 2026-05-24)

If you're a session picking up work here, the lead session has these threads
in flight; coordinate before stepping on them:

- **Telegram channel growth** — fully shipped across two commits:
  - `93ef997` — CTA-on-success in all three lead forms; bot CTA-keyword handler
    (СПИСОК / ГАЙД / ВИЗА / РАССРОЧКА / MARINA / HILLS / DOWNTOWN / JLT);
    `publish_plan` / `skip_plan` webhook callbacks.
  - `38b6a72` — CRM Telegram link for `tg_*` leads; `/api/roi-table-image`
    route (1080×1350 branded PNG, 8 districts); `scripts/post-from-plan.mjs`
    autoposter; cron installed on server `0 6 * * *` (10:00 Dubai).
  - `data/content-plan-june-2026.json` is on the server at
    `/var/www/worldwise/data/` (38 KB, scp'd 2026-05-24). Do NOT put it in
    the local repo — it is a live data file (AGENTS.md Rule #1).
  - No open follow-ups on this thread.

- Spec/plan history for prior features in `worldwise/docs/superpowers/`.

When you finish a thread, update this section so the next session has fresh
context.
