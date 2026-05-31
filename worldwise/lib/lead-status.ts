import { LeadStatus } from '@/types'

/**
 * The canonical list of lead statuses, in pipeline/display order. Single source
 * of truth (pure module — no fs/next imports) shared by the API validation
 * (app/api/leads/[id]) and the CRM board (LeadsClient). Add a status here once;
 * don't hand-maintain parallel arrays. Order doubles as the Kanban column order.
 */
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'in-progress', 'won', 'lost']
