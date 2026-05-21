# Telegram bot lead intake — design

Date: 2026-05-21
Status: approved (pending implementation plan)

## Problem

Leads from Property Finder / Bayut currently live only in the portal cabinet (no
email alerts, no API access), and leads from other channels (calls, WhatsApp,
Instagram) never reach the CRM. We need a low-friction way for an agent to push
any lead into the CRM without portal configuration or third-party services.

Chosen approach (**A**): the agent pastes/forwards the lead text to the existing
Telegram bot; the bot parses it, saves it to the CRM, and asks for the source via
inline buttons. Universal across channels, no external APIs, builds on the
existing Telegram webhook. (Phase 2, out of scope: automated portal ingestion via
email alerts + inbound email parsing.)

## Goals

- An agent in an allowed Telegram chat can add a CRM lead by pasting free text.
- The bot extracts name, phone, email and keeps the full text as a note.
- The lead is attributed to a channel (Property Finder / Bayut / Instagram /
  WhatsApp / Other) chosen via inline buttons.
- Warn the agent if the phone already exists in the CRM (possible duplicate).
- No regression to existing webhook behaviour (`/add_keyword`, article publish/skip).

## Non-goals (YAGNI)

- Mapping a Telegram account to a specific CRM manager (per-agent attribution).
- Guided step-by-step Q&A intake.
- Auto-pulling from the portal, Meta Lead Ads / Instagram DM API, email parsing
  (these are phase 2).

## End-to-end flow

1. Agent sends a text message to the bot (pasted lead, or typed).
2. Webhook (`POST /api/telegram-webhook`) receives `message.text`. Existing command
   checks run first. If the text is **not** a known command and the chat id is in
   the allowed set → treat as lead intake.
3. `parseLeadText(text)` → `{ name?, phone?, email?, note }`.
   - If no valid phone (7–15 digits) → reply with a short usage hint; **do not** save.
4. Save immediately via `saveLead({ name, phone, email, message: note, source: 'telegram' })`
   (status defaults to `new`). The lead exists right away and is never lost.
5. Duplicate check: if another lead has the same normalised phone, prepend a
   warning line to the reply (`⚠️ Возможный дубль: <name> от <date>`). Still saved.
6. Bot replies with a parsed preview + inline keyboard:
   - Row 1: `[Property Finder] [Bayut]`
   - Row 2: `[Instagram] [WhatsApp] [Other]`
   - Row 3: `[🗑 Удалить]`
   - `callback_data`: `leadsrc:<leadId>:<sourceKey>` and `leaddel:<leadId>`.
7. On a source tap → set the lead's `source`, edit the message to
   `✅ Добавлено в CRM — источник: <label>`, remove the buttons.
8. On `🗑 Удалить` → delete the lead, edit the message to `🗑 Удалён`.

### Why save-then-tag (not a draft store)

Telegram `callback_data` is limited to 64 bytes — the parsed lead can't be carried
in it. The real `leadId` (≈13-digit timestamp) fits trivially, so we save first and
reference the lead by id in the buttons. The lead persists even if the agent never
taps a button (it keeps the default `source: 'telegram'`), and a PM2 restart between
paste and tap doesn't break the buttons. No separate draft file/state is needed.

## Components

### `lib/lead-parse.ts` (new) — pure, unit-testable
`parseLeadText(text: string): { name?: string; phone?: string; email?: string; note: string }`
- **email**: first match of an email regex.
- **phone**: scan for phone-like substrings (`[+\d][\d\s().\-]{6,}`), strip to digits,
  take the first with 7–15 digits; store the cleaned original string.
- **labels**: when present, prefer `Name:`/`Имя:`, `Phone:`/`Тел:`, `Email:`,
  `Budget:`/`Бюджет:` (Property Finder copy/emails are usually labelled).
- **name**: from label, else the first non-empty line that isn't the phone/email line.
- **note**: always the full original text (capped, see below) — nothing is lost.
- Returns `phone: undefined` when none is valid; the caller rejects intake.

### `lib/leads.ts` (extend)
- `updateLead` accepts an optional `source` field (currently limited to
  status/notes/contactedAt/attachments), so the source button can set it and append
  an activity-log entry (`Источник: <label>`) with a synthetic actor
  `{ uid: 'telegram', username: 'telegram-bot', name: 'Telegram' }`.
- Add a helper to find an existing lead by normalised phone (digits-only) for the
  duplicate check, reusing `getLeads()`.

### `app/api/telegram-webhook/route.ts` (extend)
- `message.text` branch: keep `/add_keyword` (first chat id only). Add: non-command
  text from an allowed chat → parse + save + reply with source buttons.
- `callback_query` branch: keep `publish_article`/`skip_article`. Add `leadsrc:*`
  and `leaddel:*` handling (answerCallbackQuery + editMessageReplyMarkup, matching
  the existing pattern).

## Access control

- Allowed chats = ids in `TELEGRAM_CHAT_ID` (comma-separated team list). Messages
  from other chats are ignored (bot stays silent, returns `{ ok: true }`).
- `/add_keyword` remains restricted to the first chat id (unchanged).
- The webhook stays gated by the `WEBHOOK_SECRET` header (unchanged).

## Source mapping

| Button | CRM `source` |
|--------|--------------|
| Property Finder | `property_finder` |
| Bayut | `bayut` |
| Instagram | `instagram_dm` |
| WhatsApp | `whatsapp` |
| Other | `other` |
| (default, no tap) | `telegram` |

These are added to the documented lead-source list (CLAUDE.md + worldwise-context).

## Edge cases & error handling

- No valid phone → short usage hint, no save.
- Oversized paste → cap fields (reuse the M4 limits: name ≤120, note ≤2000, etc.).
- Multiple phones/emails → take the first; full text preserved in the note.
- Duplicate phone in CRM → warning line in the reply; lead still saved.
- Unknown `callback_data` or missing lead on tap → reply "lead not found", remove buttons.
- Restart between paste and tap → lead already saved with default source; buttons remain valid.
- Bot never re-sends Telegram/email lead notifications for these (agent-initiated).

## Verification

- Unit-test `parseLeadText` against real Property Finder lead blocks (labelled and
  unlabelled), WhatsApp-style pastes, and no-phone input.
- `npm run build` passes.
- Manual: from an allowed chat, paste a lead → confirm it appears in `/admin/leads`
  with the chosen source; tap `🗑 Удалить` → confirm it's removed; paste the same
  phone again → confirm the duplicate warning shows.
