import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { AdminUser, AdminRole, AdminSection } from '@/types'
import { writeFileAtomic } from '@/lib/atomic-write'
import { DEFAULT_SECTIONS } from '@/lib/permissions'

const DATA_FILE = path.join(process.cwd(), 'data', 'users.json')

export function getUsers(): AdminUser[] {
  if (!fs.existsSync(DATA_FILE)) return []
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as AdminUser[]
}

function saveUsers(users: AdminUser[]): void {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  writeFileAtomic(DATA_FILE, JSON.stringify(users, null, 2))
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
  const users = getUsers()
  if (users.some(u => u.username === data.username)) {
    throw new Error('Username already taken')
  }
  const passwordHash = await bcrypt.hash(data.password, 10)
  const user: AdminUser = {
    id: String(Date.now()),
    name: data.name,
    username: data.username,
    passwordHash,
    role: data.role,
    active: true,
    sections: data.sections ?? DEFAULT_SECTIONS,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}

export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: AdminRole; active: boolean; password: string; lastLoginAt: string; sections: AdminSection[] }>
): Promise<AdminUser | null> {
  const users = getUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return null
  const { password, ...rest } = patch
  const updated: AdminUser = { ...users[idx], ...rest }
  if (password) {
    updated.passwordHash = await bcrypt.hash(password, 10)
  }
  users[idx] = updated
  saveUsers(users)
  return updated
}

export function deleteUser(id: string): boolean {
  const users = getUsers()
  const filtered = users.filter(u => u.id !== id)
  if (filtered.length === users.length) return false
  saveUsers(filtered)
  return true
}

export async function verifyPassword(username: string, password: string): Promise<AdminUser | null> {
  const user = getUserByUsername(username)
  if (!user || !user.active) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}
