'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'
import LeadModal from '@/components/LeadModal'

// Exit-intent popup — spec: docs/superpowers/specs/2026-08-04-exit-intent-popup-design.md
// Desktop: cursor leaves through the top edge (≥5 s dwell). Mobile (coarse pointer):
// ≥50% max scroll depth + rapid upward scroll. Caps: once per session, 30-day
// cooldown after dismissal, never again after a successful submit.

const STORAGE_KEY = 'ww_exit_popup'
const SESSION_KEY = 'ww_exit_shown'
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
const MIN_DWELL_MS = 5000
const SCROLL_DEPTH_THRESHOLD = 0.5
const SCROLL_UP_PX = 300
const SCROLL_UP_WINDOW_MS = 700

type ExitState = { dismissedAt?: number; submitted?: boolean }

function readState(): ExitState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ExitState
  } catch {
    return {}
  }
}

function writeState(patch: ExitState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readState(), ...patch }))
  } catch {
    // Storage unavailable (private mode) — degrade to per-pageview capping.
  }
}

export default function ExitIntentTrigger() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const submittedRef = useRef(false)
  const disabled =
    pathname.startsWith('/admin') || pathname === '/ru' || pathname.startsWith('/ru/')

  useEffect(() => {
    if (disabled) return
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {
      // No sessionStorage — fall through, the localStorage checks still apply.
    }
    const state = readState()
    if (state.submitted) return
    if (state.dismissedAt && Date.now() - state.dismissedAt < DISMISS_COOLDOWN_MS) return

    const mountedAt = Date.now()
    let fired = false
    let maxDepth = 0
    let lastY = window.scrollY
    let lastT = Date.now()
    let upDistance = 0

    function cleanup() {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onMouseOut)
    }

    function fire() {
      if (fired) return
      fired = true
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Session capping degrades gracefully without sessionStorage.
      }
      track('exit_popup_shown', { page: window.location.pathname })
      setOpen(true)
      cleanup()
    }

    function onMouseOut(e: MouseEvent) {
      if (e.relatedTarget !== null || e.clientY > 0) return
      if (Date.now() - mountedAt < MIN_DWELL_MS) return
      if (document.body.style.overflow === 'hidden') return // another modal is open
      fire()
    }

    function onScroll() {
      const y = window.scrollY
      if (y < 0) return // iOS overscroll bounce
      const depth = (y + window.innerHeight) / document.documentElement.scrollHeight
      if (depth > maxDepth) maxDepth = depth
      const now = Date.now()
      if (y < lastY) {
        upDistance = now - lastT <= SCROLL_UP_WINDOW_MS ? upDistance + (lastY - y) : lastY - y
        if (
          maxDepth >= SCROLL_DEPTH_THRESHOLD &&
          upDistance >= SCROLL_UP_PX &&
          document.body.style.overflow !== 'hidden'
        ) {
          fire()
        }
      } else {
        upDistance = 0
      }
      lastY = y
      lastT = now
    }

    if (window.matchMedia('(pointer: coarse)').matches) {
      window.addEventListener('scroll', onScroll, { passive: true })
    } else {
      document.addEventListener('mouseout', onMouseOut)
    }
    return cleanup
  }, [disabled])

  if (disabled) return null

  function handleClose() {
    setOpen(false)
    if (!submittedRef.current) writeState({ dismissedAt: Date.now() })
  }

  function handleSuccess() {
    submittedRef.current = true
    writeState({ submitted: true })
  }

  return (
    <LeadModal
      isOpen={open}
      onClose={handleClose}
      source="exit_intent"
      title="Before You Go — Get a Free Shortlist"
      subtitle="Tell us your budget and our advisors will send you five hand-picked Dubai properties within 24 hours. No mailing lists — just your shortlist."
      ctaLabel="Send My Shortlist"
      onSuccess={handleSuccess}
    />
  )
}
