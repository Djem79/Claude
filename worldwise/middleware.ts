import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

  // Lead files are stored in public/ but must not be accessible without auth
  if (pathname.startsWith('/files/leads/')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const session = token ? await verifySessionToken(token) : null
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/files/leads/:path*'],
}
