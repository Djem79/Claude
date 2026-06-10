// Google Ads Offline Conversion Import (OCI) file builder — spec:
// docs/superpowers/specs/2026-06-10-google-ads-oci-export-design.md
//
// PURE module (no fs/next/@-imports) so it stays `node --test
// --experimental-strip-types`-runnable, like lib/lead-parse.ts. Input is a
// structural subset of Lead — the CRM passes Lead[] as-is.

export interface OciActivityEntry {
  at: string
  action: string
}

export interface OciLead {
  gclid?: string
  createdAt: string
  status?: string
  updatedAt?: string
  activityLog?: OciActivityEntry[]
}

// Conversion-action names — must match the actions created in Google Ads
// (Goals → Conversions → Import → CRMs/files → Track conversions from clicks).
export const OCI_ACTIONS = {
  lead: 'CRM Lead',
  qualified: 'CRM Qualified',
  deal: 'CRM Deal',
} as const

const WINDOW_MS = 90 * 24 * 3600 * 1000 // Google's gclid click window
const DUBAI_OFFSET_MS = 4 * 3600 * 1000 // Asia/Dubai is fixed +04:00, no DST

/** UTC ISO → `yyyy-MM-dd HH:mm:ss` wall-clock time in Dubai (+04:00). */
export function formatDubaiTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  )
}

// First activityLog entry recording a transition INTO `status`
// (updateLead writes action strings like "Status: new → in-progress, Notes updated").
function transitionAt(lead: OciLead, status: string): string | undefined {
  return lead.activityLog?.find(e => e.action.includes(`→ ${status}`))?.at
}

// A conversion can't precede the ad click (≈ lead creation) — clamp up to createdAt.
function stageTime(iso: string | undefined, lead: OciLead): string {
  const t = iso ?? lead.updatedAt ?? lead.createdAt
  return new Date(t).getTime() < new Date(lead.createdAt).getTime() ? lead.createdAt : t
}

export function buildOciCsv(
  leads: OciLead[],
  now: Date
): { csv: string; counts: { lead: number; qualified: number; deal: number } } {
  const counts = { lead: 0, qualified: 0, deal: 0 }
  const rows: string[] = []
  const minCreated = now.getTime() - WINDOW_MS

  for (const l of leads) {
    // gclid is URL-safe by spec; strip commas defensively so columns can't shift.
    const gclid = (l.gclid ?? '').trim().replace(/,/g, '')
    if (!gclid) continue
    const created = new Date(l.createdAt).getTime()
    if (!Number.isFinite(created) || created < minCreated || created > now.getTime()) continue

    const push = (name: string, timeIso: string) =>
      rows.push(`${gclid},${name},${formatDubaiTime(timeIso)},0,AED`)

    push(OCI_ACTIONS.lead, l.createdAt)
    counts.lead++

    // "Ever reached" qualified: current status OR a recorded transition —
    // history matters (in-progress → lost still earned the Qualified signal).
    const qualifiedAt = transitionAt(l, 'in-progress') ?? transitionAt(l, 'won')
    if (qualifiedAt !== undefined || l.status === 'in-progress' || l.status === 'won') {
      push(OCI_ACTIONS.qualified, stageTime(qualifiedAt, l))
      counts.qualified++
    }

    if (l.status === 'won') {
      push(OCI_ACTIONS.deal, stageTime(transitionAt(l, 'won'), l))
      counts.deal++
    }
  }

  const csv =
    [
      'Parameters:TimeZone=+0400',
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
      ...rows,
    ].join('\n') + '\n'
  return { csv, counts }
}
