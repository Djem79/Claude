'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function Analytics() {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('ww_cookie_consent') === 'accepted') {
        setConsented(true)
      }
    } catch {
      // localStorage blocked (Safari Private Mode) — stay off until explicit consent event
    }
    const handler = () => setConsented(true)
    window.addEventListener('ww_consent_accepted', handler)
    return () => window.removeEventListener('ww_consent_accepted', handler)
  }, [])

  if (!consented || !GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}');
      `}</Script>
    </>
  )
}
