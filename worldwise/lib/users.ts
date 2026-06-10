import path from 'path'
import bcrypt from 'bcryptjs'
import { AdminUser, AdminRole, AdminSection } from '@/types'
import { readJsonFile, mutateJsonFile } from '@/lib/json-store'
import { DEFAULT_SECTIONS } from '@/lib/permissions'

const DATA_FILE = path.join(process.cwd(), 'data', 'users.json')

export function getUsers(): AdminUser[] {
  return readJsonFile<AdminUser[]>(DATA_FILE, [])
}

// All mutations run inside mutateJsonFile's synchronous critical section.
// Anything async (bcrypt hashing) MUST be computed before calling this.
function mutateUsers(mutate: (current: AdminUser[]) => AdminUser[]): void {
  mutateJsonFile<AdminUser[]>(DATA_FILE, [], mutate)
}

export function getUserById(id: string): AdminUser | null {
  return getUsers().find(u => u.id === id) ?? null
}

export function getUserByUsername(username: string): AdminUser | null {
  return getUsers().find(u => u.username === username) ?? null
}

export async function createUser(data: {
  name: string
  username: string
  password: string
  role: AdminRole
  sections?: AdminSection[]
}): Promise<AdminUser> {
  // Hash BEFORE the critical section — the ~100ms bcrypt await must never sit
  // inside the read-modify-write window (and mutateUsers' sync callback can't hold it).
  const passwordHash = await bcrypt.hash(data.password, 10)
  let user: AdminUser | null = null
  mutateUsers(users => {
    if (users.some(u => u.username === data.username)) {
      throw new Error('Username already taken')
    }
    user = {
      id: String(Date.now()),
      name: data.name,
      username: data.username,
      passwordHash,
      role: data.role,
      active: true,
      sections: data.sections ?? DEFAULT_SECTIONS,
      createdAt: new Date().toISOString(),
    }
    return [...users, user]
  })
  return user!
}

export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: AdminRole; active: boolean; password: string; lastLoginAt: string; sections: AdminSection[] }>
): Promise<AdminUser | null> {
  // Hash BEFORE the critical section — keeps the read-modify-write fully synchronous.
  const { password, ...rest } = patch
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined
  let updated: AdminUser | null = null
  mutateUsers(users => {
    const idx = users.findIndex(u => u.id === id)
    if (idx === -1) return users
    updated = { ...users[idx], ...rest }
    if (passwordHash) {
      updated.passwordHash = passwordHash
    }
    return users.map((u, i) => (i === idx ? updated! : u))
  })
  return updated
}

export function deleteUser(id: string): boolean {
  let removed = false
  mutateUsers(users => {
    const filtered = users.filter(u => u.id !== id)
    removed = filtered.length !== users.length
    return filtered
  })
  return removed
}

export async function verifyPassword(username: string, password: string): Promise<AdminUser | null> {
  const user = getUserByUsername(username)
  if (!user || !user.active) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}
