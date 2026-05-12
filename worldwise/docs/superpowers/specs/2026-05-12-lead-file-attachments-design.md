# Lead File Attachments Design

## Goal

Allow admin users to upload files (brochures, floor plans, contracts) directly inside a lead card, send them to the lead via WhatsApp (link) or email (SMTP attachment), and track the full sent history per file.

## Architecture

Three new API routes handle file CRUD and email dispatch. File binaries are stored in `public/files/leads/[leadId]/` so they are publicly accessible by URL (required for WhatsApp link sharing). Attachment metadata and sent history live inside the lead record in `leads.json` as a new `attachments` field. The UI is an extension of the existing expanded-row panel in `LeadsClient.tsx`.

## Data Model

Add to `types/index.ts`:

```typescript
export interface SentEntry {
  via: 'whatsapp' | 'email'
  sentAt: string   // ISO 8601
  sentBy: string   // username
}

export interface FileAttachment {
  id: string           // nanoid(10)
  name: string         // original filename, sanitised
  size: number         // bytes
  url: string          // /files/leads/[leadId]/[sanitised-name]
  uploadedAt: string   // ISO 8601
  uploadedBy: string   // username
  sentLog: SentEntry[]
}
```

Add to `Lead` interface:

```typescript
attachments?: FileAttachment[]
```

## File Storage

- Directory: `public/files/leads/[leadId]/[fileId]/[filename]`
- Public URL: `https://worldwise.pro/files/leads/[leadId]/[fileId]/[filename]`
- Filename sanitisation: lowercase, spaces → hyphens, strip special chars
- The `[fileId]` subdirectory ensures no collisions between files with the same name
- Max file size: 10 MB
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Deploy note:** add `--exclude='public/files/'` to the rsync command in `CLAUDE.md` and the deploy script to prevent server-uploaded files from being deleted on deploy.

## API Routes

### `POST /api/leads/[id]/files`
- Auth: any admin
- Body: `multipart/form-data` with field `file`
- Validates size (≤ 10 MB) and MIME type
- Writes binary to `public/files/leads/[id]/[sanitised-name]`
- Appends `FileAttachment` to `lead.attachments[]` via `updateLead()`
- Returns updated `Lead`

### `DELETE /api/leads/[id]/files/[fileId]`
- Auth: any admin
- Removes file from disk
- Removes entry from `lead.attachments[]` via `updateLead()`
- Returns updated `Lead`

### `POST /api/leads/[id]/files/[fileId]/send`
- Auth: any admin
- Body: `{ via: 'email' }`  (WhatsApp is client-side only)
- For `email`: sends via existing nodemailer SMTP with file as attachment; requires lead to have `email` field
- Appends `SentEntry` to `attachment.sentLog[]` via `updateLead()`
- Returns updated `Lead`

WhatsApp send is handled entirely client-side: opens `wa.me/[digits]?text=[pre-filled message]` in a new tab, then calls `PATCH /api/leads/[id]/files/[fileId]/log` to record the send (see below).

### `POST /api/leads/[id]/files/[fileId]/log`
- Auth: any admin
- Body: `{ via: 'whatsapp' | 'email' }`
- Appends `SentEntry` to `attachment.sentLog[]`
- Returns updated `Lead`
- Used by client after opening WhatsApp link

## UI — LeadsClient.tsx

The "Files" section is added inside the expanded-row detail panel, after the activity log.

### Layout

```
┌─ Files ──────────────────────────────────────────────────┐
│  [+ Upload file]                                         │
│                                                          │
│  📄 Marina_Vista_Brochure.pdf  2.4 MB  12 May · Alex     │
│     [WhatsApp]  [Email]  [×]                             │
│     ▾ Sent log                                           │
│       WhatsApp · 12 May 14:32 · Alex                     │
│       Email · 13 May 09:11 · Alex                        │
│                                                          │
│  📄 Floor_Plan_2BR.pdf  1.1 MB  13 May · Alex            │
│     [WhatsApp]  [Email ✕ no email]  [×]                  │
│     ▾ Sent log  (none yet)                               │
└──────────────────────────────────────────────────────────┘
```

### Behaviour

- **Upload:** hidden `<input type="file">` triggered by "+ Upload file" button. Sends `multipart/form-data` to `POST /api/leads/[id]/files`. Shows inline upload progress (optimistic UI: file appears immediately with spinner, replaced by real data on response).
- **WhatsApp button:** always enabled if lead has a phone number. Opens `wa.me/[digitsOnly(phone)]?text=[encoded message]`. Message template: `"Здравствуйте, [lead.name]! Высылаем вам материал: [file.name]\n\nСкачать: [siteUrl][file.url]"`. Simultaneously calls `/log` endpoint to record the send.
- **Email button:** disabled (greyed out with tooltip "No email") if `lead.email` is absent. On click, calls `POST .../send` with `{ via: 'email' }`. Shows loading state, then success/error toast.
- **Delete (×):** visible to any admin. Calls `DELETE` route. No confirmation dialog — accidental deletes are low-risk since files can be re-uploaded.
- **Sent log toggle:** collapsed by default. Click "▾ Sent log" to expand inline list. Each entry shows `via`, `sentAt` (formatted), `sentBy`.
- **File size display:** `< 1 MB` shows KB, `≥ 1 MB` shows MB with one decimal.

## Email Template

Subject: `[lead.name] — [file.name]`

Body (plain text):
```
Здравствуйте, [lead.name]!

Пожалуйста, найдите прикреплённый файл: [file.name]

С уважением,
Worldwise Real Estate
+971 50 696 0435
info@worldwise.pro
```

## CLAUDE.md Update

Add `--exclude='public/files/'` to the rsync command in the "Production deployment" section.

## Files Changed

| File | Change |
|------|--------|
| `types/index.ts` | Add `SentEntry`, `FileAttachment`, extend `Lead` |
| `lib/leads.ts` | `updateLead()` already handles partial updates — no change needed |
| `app/api/leads/[id]/files/route.ts` | NEW: POST (upload), list |
| `app/api/leads/[id]/files/[fileId]/route.ts` | NEW: DELETE |
| `app/api/leads/[id]/files/[fileId]/send/route.ts` | NEW: POST email send |
| `app/api/leads/[id]/files/[fileId]/log/route.ts` | NEW: POST log WhatsApp send |
| `app/admin/leads/LeadsClient.tsx` | Add Files section to expanded row |
| `CLAUDE.md` | Add rsync exclude for `public/files/` |
