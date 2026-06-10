import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLeads } from '@/lib/leads'
import { buildOciCsv } from '@/lib/oci-export'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Offline-conversion feed for Google Ads **scheduled imports** (Goals →
// Conversions → Uploads → Schedules → HTTPS): Ads fetches this URL weekly with
// the Basic Auth credentials configured there, so conversions upload themselves.
// Same file as the CRM's "Export Google Ads" button (lib/oci-export.ts).
// Contains NO PII — only gclid, conversion-action name, time, value/currency.

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function authorized(req: NextRequest): boolean {
  const user = process.env.OCI_FEED_USER
  const pass = process.env.OCI_FEED_PASS
  if (!user || !pass) return false // feed disabled until credentials are configured
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  let decoded: string
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8')
  } catch {
    return false
  }
  const sep = decoded.indexOf(':')
  if (sep === -1) return false
  // Compare both halves timing-safe; & (not &&) avoids an early-exit timing signal.
  return timingSafeEq(decoded.slice(0, sep), user) && timingSafeEq(decoded.slice(sep + 1), pass)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="google-ads-oci"' },
    })
  }
  const { csv } = buildOciCsv(getLeads(), new Date())
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
