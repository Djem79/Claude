import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'
import { verifyPassword, createUser, getUserByUsername, updateUser } from '@/lib/users'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  let user = await verifyPassword(username, password)

  // First-run bootstrap: if no user exists with this username and the password
  // matches ADMIN_PASSWORD, auto-create the owner account.
  if (!user && !getUserByUsername(username)) {
    const envPassword = process.env.ADMIN_PASSWORD ?? 'worldwise2026'
    if (password === envPassword) {
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
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
