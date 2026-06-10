import { useEffect, RefObject } from 'react'

/**
 * Accessibility helper for modal dialogs: while `active`, trap Tab focus inside
 * `panelRef`, close on Escape, and focus the first real form field on open (and
 * whenever `extraDeps` change — e.g. a multi-step modal advancing a step).
 * Shared by LeadModal and QualifyingModal so the a11y behavior can't drift.
 */
export function useFocusTrap(
  // React 19: useRef<T>(null) yields RefObject<T | null> — accept the nullable form.
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
  extraDeps: unknown[] = []
): void {
  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    if (!panel) return
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea')
      ).filter(el => el.tabIndex !== -1 && el.offsetParent !== null)
    // First real field, not the ✕ Close button (which is first in DOM).
    const firstField =
      panel.querySelector<HTMLElement>('input:not([tabindex="-1"]), select, textarea')
      ?? panel.querySelector<HTMLElement>('button:not([disabled])')
    firstField?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onClose, ...extraDeps])
}
