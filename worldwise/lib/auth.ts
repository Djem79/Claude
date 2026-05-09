import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/session'

export { SESSION_COOKIE }

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}
