import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'

const NOINDEX_PARAMS = ['_rsc', 'gtm_latency']

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Auth gates run FIRST — an early return for the noindex header would let
  // `?_rsc=1` skip every guard below (latent bypass for statically-served paths).

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const session = token ? await verifySessionToken(token) : null

    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (pathname.startsWith('/admin/users') && session.role !== 'owner') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // Legacy lead-attachment path — DEAD since attachments moved to lead-files/
  // (outside public/, served only via the section-guarded download API). The
  // server holds zero files here (verified 2026-06-10), so the path is closed
  // unconditionally: the old token-only gate let a deactivated user's still-valid
  // cookie read lead PII for up to 7 days (audit finding).
  if (pathname.startsWith('/files/leads/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const response = NextResponse.next()
  // Internal Next.js RSC params and GTM test params must not be indexed
  if (NOINDEX_PARAMS.some(p => searchParams.has(p))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}

export const config = {
  // Exclude Next.js internals and static files; run on all other requests
  // so query-param checks (_rsc, gtm_latency) can fire on any URL
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
