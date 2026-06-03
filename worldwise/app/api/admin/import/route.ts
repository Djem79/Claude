import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { extractPropertyFromPdf } from '@/lib/property-extract'
import { extractImagesFromPdf } from '@/lib/pdf-images'
import { addDraft, listDrafts } from '@/lib/property-drafts'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export async function GET() {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(listDrafts())
}

export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  // Magic-bytes check — never trust the upload's declared type (mirrors /api/upload).
  if (buf.length < 5 || buf.toString('ascii', 0, 5) !== '%PDF-') {
    return NextResponse.json({ error: 'Not a PDF file' }, { status: 400 })
  }

  const draftId = String(Date.now())
  let fields
  let renderPages: number[] = []
  try {
    const extracted = await extractPropertyFromPdf(buf)
    fields = extracted.fields
    renderPages = extracted.renderPages
  } catch (e) {
    return NextResponse.json({ error: `Extraction failed: ${(e as Error).message}` }, { status: 502 })
  }

  let imageCandidates: string[] = []
  try {
    imageCandidates = await extractImagesFromPdf(buf, draftId, renderPages)
  } catch (e) {
    console.error('[import] image extraction failed:', e) // non-fatal — fields still usable
  }
  if (imageCandidates.length) fields.images = imageCandidates

  addDraft({
    draftId,
    fields,
    imageCandidates,
    sourcePdf: file.name.slice(0, 200),
    extractedAt: new Date().toISOString(),
    status: 'pending',
  })
  return NextResponse.json({ draftId }, { status: 201 })
}
