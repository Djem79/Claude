import { cookies } from 'next/headers'

const SESSION_COOKIE = 'ww_admin_session'
const SESSION_VALUE = 'authenticated'

export function isAuthenticated(): boolean {
  const cookieStore = cookies()
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE
}

export function checkPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'worldwise2026'
  return password === adminPassword
}

export { SESSION_COOKIE, SESSION_VALUE }
