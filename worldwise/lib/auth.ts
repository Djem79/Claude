import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/session'
import { getUserById } from '@/lib/users'
import { AdminSection } from '@/types'
import { canAccess, effectiveSections } from '@/lib/permissions'

export { SESSION_COOKIE }

/** Session payload enriched with the user's effective sections (read fresh from DB). */
export type Session = SessionPayload & { sections: AdminSection[] }

export async function getSession(): Promise<Session | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  if (!payload) return null
  const user = getUserById(payload.uid)
  if (!user || !user.active) return null
  // Use role/name/sections from the DB, not the (up to 7-day-old) token, so a demoted,
  // renamed, or section-restricted user can't keep stale privileges until expiry. See audit M1.
  return {
    ...payload,
    name: user.name,
    role: user.role,
    sections: effectiveSections(user),
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}

/**
 * For API route handlers: returns the session if it can access `section`, else null.
 * Owner always passes. Caller returns 403 on null.
 */
export async function requireSection(section: AdminSection): Promise<Session | null> {
  const session = await getSession()
  if (!session) return null
  return canAccess(session, section) ? session : null
}
