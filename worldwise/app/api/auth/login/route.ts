import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'
import { verifyPassword, createUser, getUserByUsername, updateUser } from '@/lib/users'

// 5 attempts per IP per 15 minutes
const loginRateMap = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
    'unknown'
  )
}

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = loginRateMap.get(ip)
  if (!rec || rec.resetAt < now) {
    loginRateMap.set(ip, { count: 1, resetAt: now + 15 * 60_000 })
    return false
  }
  if (rec.count >= 5) return true
  rec.count++
  return false
}

export async function POST(req: NextRequest) {
  if (isLoginRateLimited(getIp(req))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  let user = await verifyPassword(username, password)

  // First-run bootstrap: if no users exist and the password matches ADMIN_PASSWORD,
  // auto-create the owner account.
  if (!user && !getUserByUsername(username)) {
    const envPassword = process.env.ADMIN_PASSWORD
    if (envPassword && password === envPassword) {
      const name = username.charAt(0).toUpperCase() + username.slice(1)
      user = await createUser({ name, username, password, role: 'owner' })
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  await updateUser(user.id, { lastLoginAt: new Date().toISOString() })

  const token = await createSessionToken({
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  })

  const res = NextResponse.json({ success: true, name: user.name, role: user.role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
