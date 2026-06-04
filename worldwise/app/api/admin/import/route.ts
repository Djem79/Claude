import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { extractPropertyFromPdf } from '@/lib/property-extract'
import { canonicalizeArea } from '@/lib/dubai-areas'
import { extractImagesFromPdf } from '@/lib/pdf-images'
import { addDraft, listDrafts } from '@/lib/property-drafts'
import fs from 'fs'
import path from 'path'

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
  try {
    fields = await extractPropertyFromPdf(buf)
  } catch (e) {
    return NextResponse.json({ error: `Extraction failed: ${(e as Error).message}` }, { status: 502 })
  }
  if (fields.area) fields.area = canonicalizeArea(fields.area)

  let imageCandidates: string[] = []
  try {
    const extracted = await extractImagesFromPdf(buf, draftId)
    if (extracted.gallery.length) fields.images = extracted.gallery
    if (extracted.floorPlans.length) fields.floorPlans = extracted.floorPlans
    imageCandidates = [...extracted.gallery, ...extracted.floorPlans]
  } catch (e) {
    console.error('[import] image extraction failed:', e) // non-fatal — fields still usable
  }

  // Persist the source brochure so the published property can gate it (Wave 3/E).
  // draftId becomes the property id on publish, so the file is already correctly named.
  try {
    const brDir = path.join(process.cwd(), 'public', 'files', 'brochures')
    fs.mkdirSync(brDir, { recursive: true })
    fs.writeFileSync(path.join(brDir, `${draftId}.pdf`), buf)
    fields.brochure = `${draftId}.pdf`
  } catch (e) {
    console.error('[import] brochure persist failed:', e) // non-fatal — fields still usable
  }

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
