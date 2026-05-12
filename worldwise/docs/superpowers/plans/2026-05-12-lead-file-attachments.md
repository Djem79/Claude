# Lead File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to upload files inside a lead card, send them via WhatsApp (link) or email (SMTP attachment), and track the full sent history per file.

**Architecture:** File binaries are stored in `public/files/leads/[leadId]/[fileId]/[filename]` (publicly accessible for WhatsApp link sharing). Attachment metadata and sent history live in the lead record (`leads.json`) as a new `attachments` field. Four new API routes handle upload, delete, email send, and WhatsApp log. The UI is a new "Files" section appended to the existing expanded-row panel in `LeadsClient.tsx`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, nodemailer (already installed), Node.js `fs` (no new packages needed).

---

## Files

| File | Change |
|------|--------|
| `worldwise/types/index.ts` | Add `SentEntry`, `FileAttachment` interfaces; add `attachments?` to `Lead` |
| `worldwise/lib/leads.ts` | Widen `updateLead` data type to include `attachments` |
| `worldwise/app/api/leads/[id]/files/route.ts` | NEW — `POST` upload |
| `worldwise/app/api/leads/[id]/files/[fileId]/route.ts` | NEW — `DELETE` file |
| `worldwise/app/api/leads/[id]/files/[fileId]/send/route.ts` | NEW — `POST` email send |
| `worldwise/app/api/leads/[id]/files/[fileId]/log/route.ts` | NEW — `POST` log WhatsApp send |
| `worldwise/app/admin/leads/LeadsClient.tsx` | Add `FilesSection` component and wire into expanded row |
| `CLAUDE.md` | Add `--exclude='public/files/'` to rsync command |

---

### Task 1: Extend types and lib/leads.ts

**Files:**
- Modify: `worldwise/types/index.ts`
- Modify: `worldwise/lib/leads.ts:33-36`

- [ ] **Step 1: Add SentEntry and FileAttachment to types/index.ts**

Open `worldwise/types/index.ts`. After the `ActivityEntry` interface (line 34), insert:

```typescript
export interface SentEntry {
  via: 'whatsapp' | 'email'
  sentAt: string
  sentBy: string
}

export interface FileAttachment {
  id: string
  name: string
  size: number
  url: string
  uploadedAt: string
  uploadedBy: string
  sentLog: SentEntry[]
}
```

- [ ] **Step 2: Add attachments field to Lead interface**

In the `Lead` interface (currently ending at `activityLog?`), add after `activityLog`:

```typescript
  attachments?: FileAttachment[]
```

- [ ] **Step 3: Widen updateLead data type in lib/leads.ts**

Open `worldwise/lib/leads.ts`. Change line 35 from:

```typescript
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt'>>,
```

to:

```typescript
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments'>>,
```

- [ ] **Step 4: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/leads.ts
git commit -m "feat: add FileAttachment types and widen updateLead signature"
```

---

### Task 2: POST /api/leads/[id]/files — upload endpoint

**Files:**
- Create: `worldwise/app/api/leads/[id]/files/route.ts`

- [ ] **Step 1: Create the upload route**

Create `worldwise/app/api/leads/[id]/files/route.ts` with this content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { FileAttachment } from '@/types'
import fs from 'fs'
import path from 'path'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 100) || 'file'
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
  }

  const fileId = makeId()
  const safeName = sanitizeName(file.name)
  const dir = path.join(process.cwd(), 'public', 'files', 'leads', params.id, fileId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, safeName), Buffer.from(await file.arrayBuffer()))

  const attachment: FileAttachment = {
    id: fileId,
    name: safeName,
    size: file.size,
    url: `/files/leads/${params.id}/${fileId}/${safeName}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.username,
    sentLog: [],
  }

  const updated = updateLead(params.id, {
    attachments: [...(lead.attachments ?? []), attachment],
  })

  return NextResponse.json(updated, { status: 201 })
}
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add 'worldwise/app/api/leads/[id]/files/route.ts'
git commit -m "feat: POST /api/leads/[id]/files — upload file to lead"
```

---

### Task 3: DELETE /api/leads/[id]/files/[fileId] — delete endpoint

**Files:**
- Create: `worldwise/app/api/leads/[id]/files/[fileId]/route.ts`

- [ ] **Step 1: Create the delete route**

Create `worldwise/app/api/leads/[id]/files/[fileId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Remove from disk (entire [fileId] subdirectory)
  const dir = path.join(process.cwd(), 'public', 'files', 'leads', params.id, params.fileId)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })

  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).filter(a => a.id !== params.fileId),
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled`.

- [ ] **Step 3: Commit**

```bash
git add 'worldwise/app/api/leads/[id]/files/[fileId]/route.ts'
git commit -m "feat: DELETE /api/leads/[id]/files/[fileId] — remove lead file"
```

---

### Task 4: POST /api/leads/[id]/files/[fileId]/send — email send

**Files:**
- Create: `worldwise/app/api/leads/[id]/files/[fileId]/send/route.ts`

- [ ] **Step 1: Create the email send route**

Create `worldwise/app/api/leads/[id]/files/[fileId]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { SentEntry } from '@/types'
import fs from 'fs'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 503 })
  }

  const filePath = path.join(
    process.cwd(), 'public', 'files', 'leads', params.id, params.fileId, attachment.name
  )
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: lead.email,
      subject: `${lead.name} — ${attachment.name}`,
      text: `Здравствуйте, ${lead.name}!\n\nПожалуйста, найдите прикреплённый файл: ${attachment.name}\n\nС уважением,\nWorldwise Real Estate\n+971 50 696 0435\ninfo@worldwise.pro`,
      attachments: [{ filename: attachment.name, path: filePath }],
    })
  } catch (e) {
    console.error('[files/send] email error', e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  const entry: SentEntry = {
    via: 'email',
    sentAt: new Date().toISOString(),
    sentBy: session.username,
  }

  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).map(a =>
      a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a
    ),
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled`.

- [ ] **Step 3: Commit**

```bash
git add 'worldwise/app/api/leads/[id]/files/[fileId]/send/route.ts'
git commit -m "feat: POST /api/leads/[id]/files/[fileId]/send — email file to lead"
```

---

### Task 5: POST /api/leads/[id]/files/[fileId]/log — WhatsApp tracking

**Files:**
- Create: `worldwise/app/api/leads/[id]/files/[fileId]/log/route.ts`

- [ ] **Step 1: Create the log route**

Create `worldwise/app/api/leads/[id]/files/[fileId]/log/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { SentEntry } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const body = await req.json()
  const via = body.via === 'email' ? 'email' : 'whatsapp'

  const entry: SentEntry = {
    via,
    sentAt: new Date().toISOString(),
    sentBy: session.username,
  }

  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).map(a =>
      a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a
    ),
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled`.

- [ ] **Step 3: Commit**

```bash
git add 'worldwise/app/api/leads/[id]/files/[fileId]/log/route.ts'
git commit -m "feat: POST /api/leads/[id]/files/[fileId]/log — record WhatsApp send"
```

---

### Task 6: UI — FilesSection in LeadsClient.tsx

**Files:**
- Modify: `worldwise/app/admin/leads/LeadsClient.tsx`

- [ ] **Step 1: Add FilesSection component and wire it into LeadsClient.tsx**

Open `worldwise/app/admin/leads/LeadsClient.tsx`.

**6a — Update imports at the top of the file**

Change the existing React import (line 3) from:
```typescript
import { useMemo, useState } from 'react'
```
to:
```typescript
import { useMemo, useState, useRef } from 'react'
```

Change the existing `@/types` import (line 4) from:
```typescript
import { Lead, LeadStatus, ActivityEntry } from '@/types'
```
to:
```typescript
import { Lead, LeadStatus, ActivityEntry, FileAttachment } from '@/types'
```

**6b — Add helper functions** after the `digitsOnly` function (after line 25):

```typescript
function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) return '🖼️'
  if (['doc', 'docx'].includes(ext ?? '')) return '📝'
  return '📎'
}
```

**6c — Add FilesSection component** before the `export default function LeadsClient` line:

```typescript
function FilesSection({ lead, onUpdate }: { lead: Lead; onUpdate: (updated: Lead) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [openLogId, setOpenLogId] = useState<string | null>(null)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro'

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/leads/${lead.id}/files`, { method: 'POST', body: form })
    if (res.ok) onUpdate(await res.json())
    else alert((await res.json()).error ?? 'Upload failed')
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(fileId: string) {
    const res = await fetch(`/api/leads/${lead.id}/files/${fileId}`, { method: 'DELETE' })
    if (res.ok) onUpdate(await res.json())
  }

  async function handleEmail(fileId: string) {
    setSendingId(fileId)
    const res = await fetch(`/api/leads/${lead.id}/files/${fileId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via: 'email' }),
    })
    if (res.ok) onUpdate(await res.json())
    else alert((await res.json()).error ?? 'Email failed')
    setSendingId(null)
  }

  function handleWhatsApp(att: FileAttachment) {
    const phone = digitsOnly(lead.phone)
    const msg = encodeURIComponent(
      `Здравствуйте, ${lead.name}! Высылаем вам материал: ${att.name}\n\nСкачать: ${siteUrl}${att.url}`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    fetch(`/api/leads/${lead.id}/files/${att.id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via: 'whatsapp' }),
    }).then(r => r.ok && r.json()).then(updated => updated && onUpdate(updated))
  }

  const attachments = lead.attachments ?? []

  return (
    <div className="pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-medium">Files</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-navy border border-gray-200 px-2 py-1 rounded-sm hover:border-gold disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Upload file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleUpload}
        />
      </div>

      {attachments.length === 0 && (
        <p className="text-xs text-gray-300 italic">No files uploaded yet.</p>
      )}

      <div className="space-y-2">
        {attachments.map(att => (
          <div key={att.id} className="border border-gray-100 rounded-sm p-2 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base">{fileIcon(att.name)}</span>
                <div className="min-w-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-navy font-medium hover:underline truncate block max-w-xs"
                  >
                    {att.name}
                  </a>
                  <span className="text-xs text-gray-400">
                    {fmtSize(att.size)} · {fmt(att.uploadedAt)} · {att.uploadedBy}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleWhatsApp(att)}
                  className="text-xs px-2 py-1 rounded-sm border border-green-200 text-green-700 hover:border-green-400"
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => handleEmail(att.id)}
                  disabled={!lead.email || sendingId === att.id}
                  title={!lead.email ? 'Lead has no email' : ''}
                  className="text-xs px-2 py-1 rounded-sm border border-blue-200 text-blue-700 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendingId === att.id ? 'Sending…' : 'Email'}
                </button>
                <button
                  onClick={() => handleDelete(att.id)}
                  className="text-xs px-2 py-1 rounded-sm border border-gray-200 text-red-500 hover:border-red-300"
                >
                  ×
                </button>
              </div>
            </div>

            <button
              onClick={() => setOpenLogId(openLogId === att.id ? null : att.id)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              {openLogId === att.id ? '▴' : '▾'} Sent log ({att.sentLog.length})
            </button>

            {openLogId === att.id && (
              <div className="mt-1.5 space-y-0.5 pl-2 border-l-2 border-gray-100">
                {att.sentLog.length === 0 && (
                  <p className="text-xs text-gray-300 italic">Not sent yet.</p>
                )}
                {att.sentLog.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-500">
                    <span className={entry.via === 'whatsapp' ? 'text-green-600' : 'text-blue-600'}>
                      {entry.via === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </span>
                    <span className="text-gray-300">{fmt(entry.sentAt)}</span>
                    <span>{entry.sentBy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**6d — Wire FilesSection into the expanded row**

In the expanded row detail panel, find the end of the activity log block (around line 260 in the current file, just before the `isOwner` delete button block):

```typescript
              {l.activityLog && l.activityLog.length > 0 && (
```

After the closing `)}` of that entire activity log block and before the `{isOwner && (` block, add:

```typescript
                              <FilesSection
                                lead={l}
                                onUpdate={updated => setLeads(prev => prev.map(x => x.id === updated.id ? updated : x))}
                              />
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /Users/dzhambulat/Documents/Claude/worldwise && npm run build 2>&1 | grep -E "error TS|Error:|✓ Compiled"
```

Expected: `✓ Compiled` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/admin/leads/LeadsClient.tsx
git commit -m "feat: add FilesSection to lead card — upload, WhatsApp, email, sent log"
```

---

### Task 7: Update CLAUDE.md rsync command

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add public/files/ exclude to rsync**

Open `CLAUDE.md`. Find the rsync command in "Production deployment":

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
```

Change to:

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' \
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: exclude public/files/ from rsync to preserve server-uploaded files"
```

---

### Task 8: Deploy and smoke test

- [ ] **Step 1: Backup server data**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

- [ ] **Step 2: Create public/files directory on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "mkdir -p /var/www/worldwise/public/files"
```

- [ ] **Step 3: Sync and build**

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  worldwise/ root@62.238.35.20:/var/www/worldwise/

ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build 2>&1 | tail -10 && pm2 restart worldwise"
```

Expected: build succeeds, PM2 shows `online`.

- [ ] **Step 4: Smoke test**

1. Open `https://worldwise.pro/admin/leads`
2. Click a lead to expand it
3. Scroll to "Files" section at the bottom
4. Click "+ Upload file" and upload a PDF
5. Verify file appears with name, size, upload date
6. Click "WhatsApp" — verify `wa.me` link opens with pre-filled message containing download URL
7. Click "Email" (if lead has email) — verify email is received with attachment
8. Click "▾ Sent log" — verify sent entries appear
9. Click "×" to delete — verify file disappears
