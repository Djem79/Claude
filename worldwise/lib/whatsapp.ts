// Builds a prefilled WhatsApp deep link. Number falls back to the same default
// used by FloatingCTA. Keep messages short and URL-encoded.
const DEFAULT_WA = '971506960435'

export function waNumber(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP ?? DEFAULT_WA
}

export function waLink(message: string): string {
  return `https://wa.me/${waNumber()}?text=${encodeURIComponent(message)}`
}

/** Prefilled message for a specific property enquiry. */
export function waPropertyMessage(title: string): string {
  return `Hi Worldwise, I'm interested in "${title}". Please send details.`
}
