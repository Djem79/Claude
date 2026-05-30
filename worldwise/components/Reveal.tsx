'use client'

import { useEffect, useRef, useState } from 'react'

type RevealProps = {
  children: React.ReactNode
  className?: string
  delay?: number
}

/**
 * Fades + rises its children into view once when scrolled into the viewport,
 * using only compositor-only properties (opacity + transform) so it never
 * causes layout shift (zero CLS). The wrapper always occupies its normal
 * layout box.
 *
 * SSR/hydration: the server renders the hidden-but-laid-out state. On mount
 * we attach an IntersectionObserver. If the user prefers reduced motion, or
 * the browser lacks IntersectionObserver (so JS can't reveal it), we set
 * visible immediately — content is never permanently hidden. If JS doesn't
 * run at all, the `noscript` fallback forces full opacity.
 */
export default function Reveal({ children, className, delay }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        }
      },
      // Reveal early: trigger on the first pixel (threshold 0) and pre-empt by
      // 300px below the viewport (positive bottom rootMargin), so each section
      // has finished fading in by the time the user actually scrolls to it —
      // no blank/empty-looking blocks.
      { threshold: 0, rootMargin: '0px 0px 300px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`ww-reveal transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${className ?? ''}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {/* No-JS fallback: if JS never runs the reveal stays at opacity-0,
          so force it fully visible. The browser only applies <noscript>
          contents when scripting is disabled. */}
      <noscript>
        <style>{`.ww-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      {children}
    </div>
  )
}
