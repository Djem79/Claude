import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'
import { verifyPassword, createUser, getUsers, updateUser } from '@/lib/users'
import { getClientIp } from '@/lib/ip'
import { landingPath } from '@/lib/permissions'

// 5 attempts per IP per 15 minutes
const LOGIN_WINDOW_MS = 15 * 60_000
const loginRateMap = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

// Drop expired entries at most once per window so the map can't grow unbounded
// (one entry per distinct IP forever, only reclaimed on PM2 restart otherwise).
function sweepExpired(now: number): void {
  if (now - lastSweep < LOGIN_WINDOW_MS) return
  lastSweep = now
  loginRateMap.forEach((rec, ip) => {
    if (rec.resetAt < now) loginRateMap.delete(ip)
  })
}

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now()
  sweepExpired(now)
  const rec = loginRateMap.get(ip)
  if (!rec || rec.resetAt < now) {
    loginRateMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }
  if (rec.count >= 5) return true
  rec.count++
  return false
}

export async function POST(req: NextRequest) {
  if (isLoginRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  let user = await verifyPassword(username, password)

  // First-run bootstrap: ONLY when no users exist at all and the password matches
  // ADMIN_PASSWORD, auto-create the owner account. Gating on an empty table (not just
  // a free username) prevents ADMIN_PASSWORD from minting owners later. See audit H2.
  if (!user && getUsers().length === 0) {
    const envPassword = process.env.ADMIN_PASSWORD
    if (envPassword && password === envPassword) {
      const name = username.charAt(0).toUpperCase() + username.slice(1)
      user = await createUser({ name, username, password, role: 'owner' })
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Successful login should not consume the failed-attempt budget — otherwise a
  // busy shared-NAT office locks itself out of the 5/15-min window.
  loginRateMap.delete(getClientIp(req))

  await updateUser(user.id, { lastLoginAt: new Date().toISOString() })

  const token = await createSessionToken({
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })

  const redirectTo = landingPath(user) ?? '/admin'
  const res = NextResponse.json({ success: true, name: user.name, role: user.role, redirect: redirectTo })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
