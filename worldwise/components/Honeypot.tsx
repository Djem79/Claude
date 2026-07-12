import type { RefObject } from 'react'

/**
 * The canonical anti-spam honeypot input — render inside every lead form and
 * send its value as `_hp` (useLeadSubmit does both halves automatically).
 *
 * LOAD-BEARING STYLE: must stay clip-hidden, never `left:-9999px` — the
 * off-screen pattern made pages horizontally scrollable on iOS Safari
 * (a real shipped bug; Chrome clamps it so headless tests won't catch it).
 *
 * LOAD-BEARING NAME + IGNORE ATTRS: the field used to be `name="website"`, which is
 * exactly what password managers and browser autofill DO fill — for real people. A
 * filled honeypot made POST /api/leads answer a fake 201 and bin the submission, so
 * the visitor saw "thanks" and the lead vanished (GA4 proved it: successful /guide
 * submits, zero leads in the CRM). Never give this input an autofill-attractive name
 * (`website`, `url`, `company`, `address`…), and keep the vendor opt-outs below.
 * The submitted value comes from `hpRef`, never from `name`, so the name is free to
 * be meaningless. The API is now fail-safe too (a human-looking payload is kept and
 * flagged), but that is the safety net — this is the actual fix.
 */
export default function Honeypot({ hpRef }: { hpRef: RefObject<HTMLInputElement | null> }) {
  return (
    <input
      ref={hpRef}
      type="text"
      name="ww-leave-empty"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      data-1p-ignore=""           /* 1Password */
      data-lpignore="true"         /* LastPass */
      data-bwignore="true"         /* Bitwarden */
      data-form-type="other"       /* Dashlane */
      style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
    />
  )
}
