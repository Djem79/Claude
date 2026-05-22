import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, deleteUser, getUserById } from '@/lib/users'
import { AdminUser } from '@/types'
import { ALL_SECTIONS } from '@/lib/permissions'

function safeUser(u: AdminUser) {
  const { passwordHash, ...rest } = u
  return rest
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, role, active, password, sections } = await req.json()
  const patch: Parameters<typeof updateUser>[1] = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role
  if (active !== undefined) patch.active = active
  if (password) patch.password = password
  if (Array.isArray(sections)) {
    patch.sections = ALL_SECTIONS.filter(s => sections.includes(s))
  }
  const updated = await updateUser(params.id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(safeUser(updated))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Prevent deleting yourself
  const target = getUserById(params.id)
  if (target?.username === session.username) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }
  const ok = deleteUser(params.id)
  return NextResponse.json({ success: ok })
}
