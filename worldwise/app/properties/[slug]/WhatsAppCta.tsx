'use client'

import { waLink, waPropertyMessage } from '@/lib/whatsapp'
import { track } from '@/lib/analytics'

/** Bottom-of-page WhatsApp CTA on the property detail page — client component
 *  so the click fires the whatsapp_click GA4 event (same params as PropertyCard). */
export default function WhatsAppCta({ title }: { title: string }) {
  return (
    <a
      href={waLink(waPropertyMessage(title))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('whatsapp_click', { source: 'property_enquiry', property: title })}
      className="btn-primary"
    >
      WhatsApp Now
    </a>
  )
}
