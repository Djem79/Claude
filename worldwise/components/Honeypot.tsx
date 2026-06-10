import type { RefObject } from 'react'

/**
 * The canonical anti-spam honeypot input — render inside every lead form and
 * send its value as `_hp` (useLeadSubmit does both halves automatically).
 *
 * LOAD-BEARING STYLE: must stay clip-hidden, never `left:-9999px` — the
 * off-screen pattern made pages horizontally scrollable on iOS Safari
 * (a real shipped bug; Chrome clamps it so headless tests won't catch it).
 */
export default function Honeypot({ hpRef }: { hpRef: RefObject<HTMLInputElement | null> }) {
  return (
    <input
      ref={hpRef}
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
    />
  )
}
