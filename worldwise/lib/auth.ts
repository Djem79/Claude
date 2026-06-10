import { cookies, headers } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/session'
import { getUserById } from '@/lib/users'
import { AdminSection } from '@/types'
import { canAccess, effectiveSections } from '@/lib/permissions'

export { SESSION_COOKIE }

/** Session payload enriched with the user's effective sections (read fresh from DB). */
export type Session = SessionPayload & { sections: AdminSection[] }

/**
 * CSRF defence-in-depth on top of SameSite=Lax: when a browser sends an Origin
 * header (always on POST/PUT/DELETE, never on top-level GET navigations), it must
 * match the request host. Cross-site requests that somehow carry the cookie are
 * rejected before any session is granted. Same-origin admin fetches always match.
 */
function originAllowed(): boolean {
  const h = headers()
  const origin = h.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === h.get('host')
  } catch {
    return false // malformed or "null" Origin — never grant a session to it
  }
}

export async function getSession(): Promise<Session | null> {
  if (!originAllowed()) return null
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
