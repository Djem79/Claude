import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isValidBrochureId, brochureBasename } from '@/lib/brochure'

// Soft-gated brochure download. The UI reveals the link only after a lead is
// captured (BrochureGate); this route just serves the file. Reads from disk at
// runtime because files written to public/ after `next build` 404 as static
// assets (same reason app/api/media/properties/.../route.ts exists). Node runtime
// (fs) — never Edge.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params
  if (!isValidBrochureId(id)) {
    return new NextResponse('Bad request', { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'files', 'brochures', brochureBasename(id))
  let data: Buffer
  try {
    data = fs.readFileSync(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="brochure-${id}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
