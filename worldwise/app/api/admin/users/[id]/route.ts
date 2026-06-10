import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, deleteUser, getUserById, getUsers } from '@/lib/users'
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
  const target = getUserById(params.id)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, role, active, password, sections } = await req.json()
  const patch: Parameters<typeof updateUser>[1] = {}
  if (name !== undefined) patch.name = String(name).slice(0, 120)
  if (role !== undefined) {
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    patch.role = role
  }
  // Only accept a real boolean — a non-boolean (e.g. the string "false") must not be
  // stored verbatim, and must not slip past the strict `=== false` deactivation guards.
  if (typeof active === 'boolean') patch.active = active
  if (password) {
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    patch.password = password
  }
  if (Array.isArray(sections)) {
    patch.sections = ALL_SECTIONS.filter(s => sections.includes(s))
  }
  // Owners always have every section; keep stored data consistent on role change.
  if (patch.role === 'owner') patch.sections = ALL_SECTIONS

  const demoting = patch.role !== undefined && patch.role !== 'owner' && target.role === 'owner'
  const deactivating = patch.active === false && target.active !== false

  // Can't demote or deactivate your own account (mirrors the DELETE self-guard) —
  // prevents an owner locking themselves out of the owner-only Users section.
  if (params.id === session.uid && (demoting || deactivating)) {
    return NextResponse.json({ error: 'Cannot demote or deactivate your own account' }, { status: 400 })
  }

  // Never leave the system with zero active owners.
  if ((demoting || deactivating) && target.role === 'owner' && target.active !== false) {
    const otherActiveOwners = getUsers().filter(u => u.id !== target.id && u.role === 'owner' && u.active !== false)
    if (otherActiveOwners.length === 0) {
      return NextResponse.json({ error: 'Cannot remove the last active owner' }, { status: 400 })
    }
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
  // Prevent deleting yourself (compare by stable uid, not the mutable username)
  if (params.id === session.uid) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }
  // Never delete the last active owner.
  const target = getUserById(params.id)
  if (target?.role === 'owner' && target.active !== false) {
    const otherActiveOwners = getUsers().filter(u => u.id !== target.id && u.role === 'owner' && u.active !== false)
    if (otherActiveOwners.length === 0) {
      return NextResponse.json({ error: 'Cannot delete the last active owner' }, { status: 400 })
    }
  }
  const ok = deleteUser(params.id)
  return NextResponse.json({ success: ok })
}
