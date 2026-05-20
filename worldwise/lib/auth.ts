import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/session'
import { getUserById } from '@/lib/users'

export { SESSION_COOKIE }

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  if (!payload) return null
  const user = getUserById(payload.uid)
  if (!user || !user.active) return null
  // Use role/name from the DB, not the (up to 7-day-old) token, so a demoted or
  // renamed user can't keep stale privileges until expiry. See audit M1.
  return { ...payload, name: user.name, role: user.role }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}
