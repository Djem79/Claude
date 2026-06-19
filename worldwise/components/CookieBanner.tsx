'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'ww_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // localStorage can throw in Safari Private Mode / when storage is disabled —
    // fall back to showing the banner rather than crashing the render path.
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem(COOKIE_KEY)) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  // Consent Mode v2: flip gtag's consent state. Accept → granted (cookies on);
  // Decline → explicit denied so the cookieless tags fire now instead of waiting
  // out wait_for_update. gtag is bootstrapped denied-by-default in Analytics.tsx.
  function updateConsent(state: 'granted' | 'denied') {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: state,
        ad_user_data: state,
        ad_personalization: state,
        analytics_storage: state,
      })
    }
  }

  function accept() {
    try { localStorage.setItem(COOKIE_KEY, 'accepted') } catch { /* storage disabled */ }
    setVisible(false)
    updateConsent('granted')
    window.dispatchEvent(new Event('ww_consent_accepted'))
  }

  function decline() {
    try { localStorage.setItem(COOKIE_KEY, 'declined') } catch { /* storage disabled */ }
    setVisible(false)
    updateConsent('denied')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-navy-dark/95 backdrop-blur-md border-t border-gold/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
        <div className="flex-1 text-sm text-white/80 leading-relaxed">
          <p>
            We use cookies to improve your experience, analyze site traffic and personalize content.
            By clicking <span className="text-gold">&ldquo;Accept All&rdquo;</span> you agree to our use of cookies.{' '}
            <Link href="/privacy" className="underline text-gold hover:text-gold-light">
              Read our Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-5 py-2.5 text-sm text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-sm transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="btn-primary text-sm px-6 py-2.5"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}
