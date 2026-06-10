import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUsers, createUser } from '@/lib/users'
import { AdminUser, AdminSection } from '@/types'
import { ALL_SECTIONS, DEFAULT_SECTIONS } from '@/lib/permissions'

function sanitizeSections(input: unknown): AdminSection[] {
  if (!Array.isArray(input)) return DEFAULT_SECTIONS
  return ALL_SECTIONS.filter(s => input.includes(s))
}

function safeUser(u: AdminUser) {
  const { passwordHash, ...rest } = u
  return rest
}

export async function GET() {
  const session = await getSession()
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(getUsers().map(safeUser))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, username, password, role, sections } = await req.json()
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  // Owner always has every section; managers get the validated subset.
  const userSections = role === 'owner' ? ALL_SECTIONS : sanitizeSections(sections)
  try {
    // Length caps — users.json is re-read on every getSession() call.
    const user = await createUser({
      name: String(name).slice(0, 120),
      username: String(username).slice(0, 60),
      password,
      role,
      sections: userSections,
    })
    return NextResponse.json(safeUser(user), { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 409 })
  }
}
