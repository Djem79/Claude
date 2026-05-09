import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUsers, createUser } from '@/lib/users'
import { AdminUser } from '@/types'

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
  const { name, username, password, role } = await req.json()
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  try {
    const user = await createUser({ name, username, password, role })
    return NextResponse.json(safeUser(user), { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 409 })
  }
}
