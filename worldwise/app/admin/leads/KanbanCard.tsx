'use client'

import { Lead } from '@/types'
import { digitsOnly, isTgLead, tgHandle } from './lead-ui'

// One kanban lead card — used by both the desktop 5-column grid and the mobile
// single-column view (the markup used to be copy-pasted in LeadsClient).
export default function KanbanCard({
  lead: l,
  borderClass,
  onOpen,
}: {
  lead: Lead
  borderClass: string
  onOpen: () => void
}) {
  return (
    <div
      onClick={onOpen}
      className={`border-l-[3px] ${borderClass} bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm transition-shadow`}
    >
      <p className="font-semibold text-navy text-sm leading-tight">{l.name}</p>
      <p className="text-gray-500 text-xs mt-0.5">{l.phone}</p>
      {l.email && <p className="text-gray-500 text-xs">{l.email}</p>}
      <span className="bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1">
        {l.source}
      </span>
      {(l.propertyTitle || l.budget) && (
        <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-0.5">
          {l.propertyTitle && (
            <p className="text-gray-400 text-[10px]">{l.propertyTitle}</p>
          )}
          {l.budget && (
            <p className="text-gray-400 text-[10px]">Budget: {l.budget}</p>
          )}
        </div>
      )}
      <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
        {isTgLead(l.phone) ? (
          tgHandle(l.email) && (
            <a
              href={`https://t.me/${tgHandle(l.email)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in Telegram"
              className="w-6 h-6 bg-[#229ED9] rounded flex items-center justify-center text-white text-xs"
            >
              T
            </a>
          )
        ) : (
          <>
            <a
              href={`https://wa.me/${digitsOnly(l.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="w-6 h-6 bg-[#25D366] rounded flex items-center justify-center text-white text-xs"
            >
              W
            </a>
            {l.email && (
              <a
                href={`mailto:${l.email}`}
                aria-label="Send email"
                className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs"
              >
                ✉
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
