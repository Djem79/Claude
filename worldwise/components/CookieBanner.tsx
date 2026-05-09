'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'ww_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(COOKIE_KEY)) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-navy-dark/95 backdrop-blur-md border-t border-gold/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
        <div className="flex-1 text-sm text-white/80 leading-relaxed">
          <p>
            We use cookies to improve your experience, analyze site traffic and personalize content.
            By clicking <span className="text-gold">"Accept All"</span> you agree to our use of cookies.{' '}
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
