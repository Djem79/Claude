// Pure mapper: Property Finder `lead.created` webhook payload → our Lead fields.
// No fs/net/`@/` imports — keep it node:test-runnable like lib/lead-parse.ts.

export interface PfLeadFields {
  pfLeadId: string
  name: string
  phone: string
  email?: string
  message: string
  source: 'property_finder'
}

interface PfContact { type?: string; value?: string }
interface PfLeadEvent {
  entity?: { id?: string }
  payload?: {
    channel?: string
    listing?: { reference?: string }
    sender?: { name?: string; contacts?: PfContact[] }
  }
}

export function mapPfLead(event: PfLeadEvent): PfLeadFields {
  const contacts = event.payload?.sender?.contacts ?? []
  const phone = contacts.find((c) => c?.type === 'phone')?.value ?? ''
  const email = contacts.find((c) => c?.type === 'email')?.value
  const channel = event.payload?.channel ?? 'unknown'
  const ref = event.payload?.listing?.reference
  const message = `Property Finder · ${channel}` + (ref ? ` · listing ${ref}` : '')
  return {
    pfLeadId: String(event.entity?.id ?? ''),
    name: event.payload?.sender?.name?.trim() || 'Property Finder lead',
    phone: String(phone).trim(),
    email: email ? String(email).trim() : undefined,
    message,
    source: 'property_finder',
  }
}
