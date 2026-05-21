# Telegram Bot Lead Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent add a CRM lead by pasting free text to the existing Telegram bot, which parses it, saves it, and tags the source via inline buttons (with a duplicate-phone warning).

**Architecture:** A pure parser (`lib/lead-parse.ts`) extracts name/phone/email from pasted text. The existing Telegram webhook (`app/api/telegram-webhook/route.ts`) gains a lead-intake path on `message.text` (save immediately via `saveLead`, reply with source buttons) and callback handling for `leadsrc:*` / `leaddel:*`. `lib/leads.ts` gains `findLeadByPhone` and a `source` field on `updateLead`. No third-party APIs; builds on existing infrastructure.

**Tech Stack:** Next.js 14 (Node runtime route), TypeScript, file-based JSON store, Telegram Bot API. Tests: Node built-in test runner (`node --test`) on local Node 24 (type stripping); the rest verified via `npm run build` + manual integration (project has no app-test suite).

**Spec:** `worldwise/docs/superpowers/specs/2026-05-21-telegram-lead-intake-design.md`

**Note on commands:** all run from `worldwise/`. If `node`/`npm` not found, first run `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

---

### Task 1: Pure lead-text parser

**Files:**
- Create: `lib/lead-parse.ts`
- Create: `lib/lead-parse.test.ts`
- Modify: `tsconfig.json:19` (exclude test files from the build)

- [ ] **Step 1: Write the failing tests**

Create `lib/lead-parse.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLeadText, normalizePhone } from './lead-parse.ts'

test('normalizePhone strips non-digits', () => {
  assert.equal(normalizePhone('+971 50 (123)-45-67'), '971501234567')
})

test('parses a labelled Property Finder block', () => {
  const r = parseLeadText(
    'Name: John Smith\nPhone: +971 50 123 4567\nEmail: john@example.com\nProperty: Marina Apt'
  )
  assert.equal(r.name, 'John Smith')
  assert.equal(r.phone, '+971 50 123 4567')
  assert.equal(r.email, 'john@example.com')
  assert.ok(r.note.includes('Marina Apt'))
})

test('parses an unlabelled paste (name / phone / email lines)', () => {
  const r = parseLeadText('Jane Doe\n+971501112233\njane@mail.ae')
  assert.equal(r.name, 'Jane Doe')
  assert.equal(r.phone, '+971501112233')
  assert.equal(r.email, 'jane@mail.ae')
})

test('returns no phone when none is valid', () => {
  const r = parseLeadText('Hi, please call me back, John')
  assert.equal(r.phone, undefined)
  assert.ok(r.note.length > 0)
})

test('takes the first valid phone and email when several exist', () => {
  const r = parseLeadText('Ali\n+97150 000 1111\nalt: +97152 222 3333\nali@x.com, ali2@y.com')
  assert.equal(normalizePhone(r.phone ?? ''), '971500001111')
  assert.equal(r.email, 'ali@x.com')
})

test('Russian labels are recognised', () => {
  const r = parseLeadText('Имя: Пётр\nТелефон: 8 916 123 45 67\nБюджет: 2M AED')
  assert.equal(r.name, 'Пётр')
  assert.equal(normalizePhone(r.phone ?? ''), '89161234567')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test lib/lead-parse.test.ts`
Expected: FAIL — `Cannot find module './lead-parse.ts'` (file not created yet).

- [ ] **Step 3: Implement the parser**

Create `lib/lead-parse.ts`:

```ts
export interface ParsedLead {
  name?: string
  phone?: string
  email?: string
  note: string
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /[+\d][\d\s().-]{6,}/g

const NAME_LABELS = ['name', 'имя', 'client', 'клиент', 'contact', 'фио']
const PHONE_LABELS = ['phone', 'tel', 'telephone', 'mobile', 'тел', 'телефон', 'номер']
const EMAIL_LABELS = ['email', 'e-mail', 'почта', 'mail']

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function isValidPhone(raw: string): boolean {
  const d = normalizePhone(raw)
  return d.length >= 7 && d.length <= 15
}

function firstValidPhone(text: string): string | undefined {
  for (const c of text.match(PHONE_RE) ?? []) {
    if (isValidPhone(c)) return c.trim()
  }
  return undefined
}

function labelValue(text: string, labels: string[]): string | undefined {
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([^:]{1,30}):\s*(.+?)\s*$/)
    if (!m) continue
    if (labels.includes(m[1].trim().toLowerCase())) {
      const v = m[2].trim()
      if (v) return v
    }
  }
  return undefined
}

export function parseLeadText(text: string): ParsedLead {
  const note = text.trim()

  const labelEmail = labelValue(text, EMAIL_LABELS)
  const email = labelEmail?.match(EMAIL_RE)?.[0] ?? text.match(EMAIL_RE)?.[0]

  const labelPhone = labelValue(text, PHONE_LABELS)
  let phone: string | undefined
  if (labelPhone && isValidPhone(labelPhone)) phone = labelPhone.trim()
  if (!phone) phone = firstValidPhone(text)

  let name = labelValue(text, NAME_LABELS)
  if (!name) {
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (email && t.includes(email)) continue
      if (phone && t.includes(phone)) continue
      if (EMAIL_RE.test(t)) continue
      if (/^[\d\s+().-]+$/.test(t) && isValidPhone(t)) continue
      name = t
      break
    }
  }

  return {
    name: name?.slice(0, 120),
    phone,
    email: email?.slice(0, 160),
    note,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test lib/lead-parse.test.ts`
Expected: PASS — `# pass 6  # fail 0`.

- [ ] **Step 5: Exclude test files from the Next build**

Modify `tsconfig.json` line 19. Before:

```json
  "exclude": ["node_modules"]
```

After:

```json
  "exclude": ["node_modules", "**/*.test.ts"]
```

- [ ] **Step 6: Verify the build still passes**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully` and no type errors for `lib/lead-parse.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/lead-parse.ts lib/lead-parse.test.ts tsconfig.json
git commit -m "feat(crm): pure lead-text parser for Telegram intake"
```

---

### Task 2: Lead lookup-by-phone + source on updateLead

**Files:**
- Modify: `lib/leads.ts` (add `findLeadByPhone`; add `source` to `updateLead`)

- [ ] **Step 1: Add the import and `findLeadByPhone`**

In `lib/leads.ts`, add to the imports at the top (after the existing `@/types` import):

```ts
import { normalizePhone } from '@/lib/lead-parse'
```

Add this function below `getLeadById`:

```ts
export function findLeadByPhone(phone: string): Lead | null {
  const norm = normalizePhone(phone)
  if (!norm) return null
  return getLeads().find(l => normalizePhone(l.phone) === norm) ?? null
}
```

- [ ] **Step 2: Allow `source` on `updateLead`**

In `lib/leads.ts`, change the `updateLead` signature data type. Before:

```ts
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments'>>,
```

After:

```ts
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source'>>,
```

- [ ] **Step 3: Log source changes in the activity log**

In `updateLead`, inside the `if (actor) {` block, after the `if ('notes' in data ...)` block and before the `if ('attachments' in data)` block, add:

```ts
    if (data.source && data.source !== prev.source) {
      parts.push(`Source: ${data.source}`)
    }
```

(The existing `...data` spread already applies the new `source` to the updated lead; this only records it in the activity log.)

- [ ] **Step 4: Verify the build passes**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/leads.ts
git commit -m "feat(crm): findLeadByPhone + allow source on updateLead"
```

---

### Task 3: Webhook — lead intake on pasted text

**Files:**
- Modify: `app/api/telegram-webhook/route.ts`

- [ ] **Step 1: Add imports**

At the top of `app/api/telegram-webhook/route.ts`, after the existing `dynamic-articles` / `atomic-write` imports, add:

```ts
import { saveLead, findLeadByPhone, updateLead, deleteLead } from '@/lib/leads'
import { parseLeadText } from '@/lib/lead-parse'
```

- [ ] **Step 2: Extend `sendMessage` to support an inline keyboard**

Replace the existing `sendMessage` function with:

```ts
async function sendMessage(chatId: number | string, text: string, inlineKeyboard?: unknown[][]) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const body: Record<string, unknown> = { chat_id: chatId, text }
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error('[telegram-webhook] sendMessage failed', await res.text())
  } catch (e) {
    console.error('[telegram-webhook] sendMessage network error', e)
  }
}
```

- [ ] **Step 3: Add source maps, keyboard builder, and the intake handler**

Add near the top of the module (after the `TAG_EMOJI` constant):

```ts
const LEAD_SOURCE_LABEL: Record<string, string> = {
  property_finder: 'Property Finder',
  bayut: 'Bayut',
  instagram_dm: 'Instagram',
  whatsapp: 'WhatsApp',
  other: 'Other',
}

function leadSourceKeyboard(id: string) {
  return [
    [
      { text: 'Property Finder', callback_data: `leadsrc:${id}:property_finder` },
      { text: 'Bayut', callback_data: `leadsrc:${id}:bayut` },
    ],
    [
      { text: 'Instagram', callback_data: `leadsrc:${id}:instagram_dm` },
      { text: 'WhatsApp', callback_data: `leadsrc:${id}:whatsapp` },
      { text: 'Other', callback_data: `leadsrc:${id}:other` },
    ],
    [{ text: '🗑 Удалить', callback_data: `leaddel:${id}` }],
  ]
}

async function handleLeadIntake(chatId: number | string, text: string) {
  const parsed = parseLeadText(text)
  if (!parsed.phone) {
    await sendMessage(chatId, '❌ Не нашёл телефон. Вставьте текст лида с номером (7–15 цифр).')
    return
  }
  const dup = findLeadByPhone(parsed.phone)
  const lead = saveLead({
    name: (parsed.name ?? 'Без имени').slice(0, 120),
    phone: parsed.phone.slice(0, 40),
    email: parsed.email?.slice(0, 160),
    message: parsed.note.slice(0, 2000),
    source: 'telegram',
  })
  const reply = [
    dup ? `⚠️ Возможный дубль: ${dup.name} (${new Date(dup.createdAt).toLocaleDateString('ru-RU')})` : null,
    '🆕 Лид сохранён в CRM',
    `👤 ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.email ? `✉️ ${lead.email}` : null,
    '',
    'Источник?',
  ].filter(Boolean).join('\n')
  await sendMessage(chatId, reply, leadSourceKeyboard(lead.id))
}
```

- [ ] **Step 4: Route pasted text to the intake handler**

In `POST`, replace the existing `message.text` block (from `const message = body.message as any` down to its closing `return NextResponse.json({ ok: true })` that follows the `/add_keyword` handling) with:

```ts
  const message = body.message as any
  if (message?.text) {
    const chatId = String(message.chat?.id ?? '')
    const allowed = (process.env.TELEGRAM_CHAT_ID ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!allowed.includes(chatId)) return NextResponse.json({ ok: true })

    const text: string = message.text

    // /add_keyword — first chat id only (unchanged)
    if (text.toLowerCase().startsWith('/add_keyword')) {
      if (chatId !== allowed[0]) return NextResponse.json({ ok: true })
      const query = text.replace(/^\/add_keyword\s*/i, '').trim()
      if (!query) {
        await sendMessage(message.chat.id, '❌ Usage: /add_keyword <search query>')
        return NextResponse.json({ ok: true })
      }
      const keywordsPath = path.join(process.cwd(), 'data', 'article-keywords.json')
      let data: { keywords: string[]; index: number } = { keywords: [], index: 0 }
      try {
        data = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'))
      } catch (e) {
        console.error('[telegram-webhook] Failed to read keywords file, starting fresh', e)
      }
      data.keywords.push(query)
      writeFileAtomic(keywordsPath, JSON.stringify(data, null, 2))
      await sendMessage(message.chat.id, `✅ Добавлено: "${query}"\nВсего в банке: ${data.keywords.length} запросов`)
      return NextResponse.json({ ok: true })
    }

    // Ignore other slash commands; everything else from the team is a lead paste
    if (text.startsWith('/')) return NextResponse.json({ ok: true })
    await handleLeadIntake(message.chat.id, text)
    return NextResponse.json({ ok: true })
  }
```

- [ ] **Step 5: Verify the build passes**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/telegram-webhook/route.ts
git commit -m "feat(crm): Telegram lead intake on pasted text with source buttons"
```

---

### Task 4: Webhook — source / delete callbacks

**Files:**
- Modify: `app/api/telegram-webhook/route.ts` (the `callback_query` section of `POST`)

- [ ] **Step 1: Handle `leadsrc:*` and `leaddel:*` before the article callbacks**

In `POST`, locate the callback section that computes `answerText` (the `if (data === 'publish_article') { ... } else if (data === 'skip_article') { ... } else { return ... }` block followed by the `Promise.all([...])`). Replace that whole block (from the first `let answerText` through the `Promise.all([...])` call) with:

```ts
  let answerText: string

  if (typeof data === 'string' && data.startsWith('leadsrc:')) {
    const [, id, src] = data.split(':')
    const updated = updateLead(id, { source: src }, { uid: 'telegram', username: 'telegram-bot', name: 'Telegram' })
    answerText = updated ? `✅ ${LEAD_SOURCE_LABEL[src] ?? src}` : '⚠️ Лид не найден'
    const newText = updated
      ? `✅ Добавлено в CRM — источник: ${LEAD_SOURCE_LABEL[src] ?? src}\n👤 ${updated.name} · 📞 ${updated.phone}`
      : '⚠️ Лид не найден'
    await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
      }),
      fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: newText, reply_markup: { inline_keyboard: [] } }),
      }),
    ])
    return NextResponse.json({ ok: true })
  }

  if (typeof data === 'string' && data.startsWith('leaddel:')) {
    const [, id] = data.split(':')
    const removed = deleteLead(id)
    answerText = removed ? '🗑 Удалён' : '⚠️ Не найден'
    await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
      }),
      fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: removed ? '🗑 Лид удалён' : '⚠️ Лид не найден', reply_markup: { inline_keyboard: [] } }),
      }),
    ])
    return NextResponse.json({ ok: true })
  }

  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
    if (published) postToChannel(published)
  } else if (data === 'skip_article') {
    deleteDraft()
    answerText = '❌ Пропущено'
  } else {
    return NextResponse.json({ ok: true })
  }

  await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
    }),
    fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    }),
  ])

  return NextResponse.json({ ok: true })
```

- [ ] **Step 2: Verify the build passes**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/telegram-webhook/route.ts
git commit -m "feat(crm): handle lead source/delete callbacks in webhook"
```

---

### Task 5: Documentation — lead source strings

**Files:**
- Modify: `CLAUDE.md` (lead `source` strings list)
- Modify: `.claude/skills/worldwise-context/SKILL.md` (lead source strings list)

- [ ] **Step 1: Update CLAUDE.md**

Find the line listing lead source strings (under "Conversion & UX logic"):

```
`hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`
```

Replace with:

```
`hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other`
```

Then add one sentence after that line:

```
The last six are set by the Telegram bot lead intake (agent pastes a lead → bot saves it and the source is chosen via inline buttons; default `telegram` until a button is tapped).
```

- [ ] **Step 2: Update the worldwise-context skill**

In `.claude/skills/worldwise-context/SKILL.md`, find the line:

```
Lead source strings: `hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`
```

Replace with:

```
Lead source strings: `hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other` (last six = Telegram bot lead intake)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .claude/skills/worldwise-context/SKILL.md
git commit -m "docs: document Telegram lead-intake source strings"
```

---

### Task 6: Build gate + manual verification + deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Final build**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 2: Run the parser tests once more**

Run: `node --test lib/lead-parse.test.ts`
Expected: `# pass 6  # fail 0`.

- [ ] **Step 3: Deploy (per CLAUDE.md, with data backup first)**

```bash
# backup
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
# sync
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  --exclude='public/files/' --exclude='lead-files/' --exclude='.env.local' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
# build + restart
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm run build && pm2 restart worldwise --update-env"
```

- [ ] **Step 4: Manual integration test (from an allowed Telegram chat)**

1. Paste into the bot:
   ```
   Name: Test Buyer
   Phone: +971 50 999 8877
   Email: test@buyer.ae
   Property: Dubai Marina 2BR
   ```
   Expected: bot replies "🆕 Лид сохранён в CRM" with the parsed preview and source buttons.
2. Open `/admin/leads` → confirm the lead appears with status `new`.
3. Tap `Property Finder` → bot edits the message to "✅ Добавлено в CRM — источник: Property Finder"; confirm the lead's source updates in `/admin/leads`.
4. Paste the same phone again → confirm the reply includes "⚠️ Возможный дубль".
5. On that duplicate, tap `🗑 Удалить` → bot replies "🗑 Лид удалён"; confirm it's gone from `/admin/leads`.
6. Paste text with no phone → confirm the bot replies with the "❌ Не нашёл телефон" hint and no lead is created.

- [ ] **Step 5: Confirm no regression to existing bot features**

- Trigger an article generation (or wait for the daily run) and confirm Publish/Skip buttons still work.
- From the first chat id, send `/add_keyword test query` → confirm it still appends and replies.
```
