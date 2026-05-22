import { AdminRole, AdminSection } from '@/types'

export const ALL_SECTIONS: AdminSection[] = ['properties', 'leads', 'dashboard']

/** Default sections granted to a newly-created manager. */
export const DEFAULT_SECTIONS: AdminSection[] = ['properties']

/** Section → its admin route. Used for nav rendering and redirects. */
export const SECTION_PATH: Record<AdminSection, string> = {
  properties: '/admin',
  leads: '/admin/leads',
  dashboard: '/admin/dashboard',
}

type Principal = { role: AdminRole; sections?: AdminSection[] }

/** Legacy users (no `sections`) are treated as having every section. */
export function effectiveSections(user: Principal): AdminSection[] {
  if (user.role === 'owner') return ALL_SECTIONS
  return user.sections ?? ALL_SECTIONS
}

export function canAccess(user: Principal, section: AdminSection): boolean {
  if (user.role === 'owner') return true
  return effectiveSections(user).includes(section)
}

/** First accessible section's path (in ALL_SECTIONS order), or null if none. */
export function landingPath(user: Principal): string | null {
  const first = ALL_SECTIONS.find(s => canAccess(user, s))
  return first ? SECTION_PATH[first] : null
}
