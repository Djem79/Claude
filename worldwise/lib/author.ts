// Single source of truth for the author entity — the E-E-A-T layer.
//
// 2026 practice (see docs/marketing/2026-08-04-promotion-plan-vs-best-practices.md):
// AI Overviews overwhelmingly cite pages with a verifiable HUMAN author —
// Person schema, credentials, cross-platform sameAs — over faceless
// organisations. This module feeds the /about page, the blog bylines and the
// Person JSON-LD; edit facts here, never inline in components.
//
// Pure module: no fs/next imports (importable from client and server alike).

export const AUTHOR = {
  name: 'Dzhambulat Tkhazaplizhev',
  jobTitle: 'Founder & Managing Director',
  url: 'https://worldwise.pro/about',
  image: 'https://worldwise.pro/images/author/dzhambulat-tkhazaplizhev.jpg',
  // Cross-platform identity trail. The personal LinkedIn profile should be
  // added here as soon as the URL is confirmed — it is the strongest sameAs.
  sameAs: [
    'https://app.qwoted.com/pr_users/dzhambulat-tkhazaplizhev',
    'https://www.linkedin.com/company/worldwise-real-estate-llc',
    'https://www.instagram.com/worldwiseofficial',
    'https://www.youtube.com/@worldwiserealestate',
  ],
  knowsLanguage: ['en', 'ru'],
} as const

/** Person node for JSON-LD — embed in author / reviewedBy fields or standalone. */
export function personJsonLd() {
  return {
    '@type': 'Person',
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    url: AUTHOR.url,
    image: AUTHOR.image,
    sameAs: [...AUTHOR.sameAs],
    knowsLanguage: [...AUTHOR.knowsLanguage],
    worksFor: {
      '@type': 'Organization',
      name: 'Worldwise Real Estate',
      url: 'https://worldwise.pro',
    },
  }
}
