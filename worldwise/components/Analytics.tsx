'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

// Google Consent Mode v2. Unlike the old "load GA only after Accept" gate, gtag now
// loads for everyone but starts in a fully DENIED state: no cookies, no ad identifiers
// — only cookieless pings that let GA4/Google Ads model conversions and keep campaign
// attribution (gclid/utm) even before consent. CookieBanner upgrades consent to GRANTED
// on "Accept All". This is what stops paid leads from being mis-attributed to Direct and
// fixes the GA4 conversion undercount. The cookie banner still governs actual cookies.
export default function Analytics() {
  const pathname = usePathname()
  const isAdmin = !!pathname?.startsWith('/admin')

  // Back-office is not the site. Not rendering the scripts on /admin is NOT enough:
  // gtag stays loaded from the public page the staffer navigated FROM, so it kept
  // reporting admin activity for the rest of the session. That edge was assumed
  // harmless ("staff open /admin directly") — the data says otherwise: 35% of all
  // page views (849/2434) and 48 of 59 `form_start` events were staff working in
  // the CRM, which made the visitor funnel unreadable.
  //
  // `ga-disable-<ID>` is Google's official kill switch: an ALREADY-loaded gtag
  // sends nothing while it is true. Flipped back off when the staffer returns to a
  // public page, so real visits still count.
  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined') return
    ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = isAdmin
  }, [isAdmin])

  if (!GA_ID) return null
  if (isAdmin) return null

  return (
    <>
      {/* MUST run before gtag.js so the default consent state is in the dataLayer
          first. Returning visitors who already accepted are upgraded immediately. */}
      <Script id="consent-default" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
          functionality_storage: 'granted',
          security_storage: 'granted',
          wait_for_update: 500
        });
        gtag('set', 'ads_data_redaction', true);
        gtag('set', 'url_passthrough', true);
        try {
          if (localStorage.getItem('ww_cookie_consent') === 'accepted') {
            gtag('consent', 'update', {
              ad_storage: 'granted',
              ad_user_data: 'granted',
              ad_personalization: 'granted',
              analytics_storage: 'granted'
            });
          }
        } catch (e) { /* storage blocked — stay on cookieless defaults */ }
      `}</Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        gtag('js', new Date());
        gtag('config', '${GA_ID}');
      `}</Script>
    </>
  )
}
