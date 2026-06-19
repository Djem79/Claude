export interface Developer {
  slug: string
  name: string
  aliases?: string[]
  blurb: string
  logo?: string // path under /public, e.g. /images/developers/emaar.png
  // Optional SEO content for high-demand developer pages: a richer on-page intro
  // paragraph + FAQ (rendered + emitted as FAQPage JSON-LD). Pages without these
  // keep the lean hero+grid layout.
  intro?: string
  faqs?: { q: string; a: string }[]
}

// Curated canonical developers with >=2 properties in the catalog (after merging
// the messy free-text variants below). Aliases cover the live distinct values in
// data/properties.json. Mirrors the lib/areas.ts aliases pattern.
export const developers: Developer[] = [
  { slug: 'emaar', name: 'Emaar Properties', aliases: ['EMAAR', 'Emaar'], logo: '/images/developers/emaar.png',
    blurb: "Dubai's largest master-developer — behind Downtown Dubai, Dubai Marina, Emaar Beachfront and Dubai Hills Estate. A byword for on-time delivery and strong resale liquidity.",
    intro: "Emaar Properties is Dubai's largest master-developer and the name behind the city's most recognisable addresses — Downtown Dubai and the Burj Khalifa, Dubai Marina, Dubai Hills Estate, Emaar Beachfront and Dubai Creek Harbour. For international investors, Emaar projects in Dubai are a byword for on-time handover, institutional-grade build quality and the deepest resale and rental liquidity in the market. New off-plan launches typically open with 80/20 or 90/10 payment plans and DLD-registered escrow, while completed Emaar communities consistently hold premium occupancy and price-per-square-foot.",
    faqs: [
      { q: 'Where are Emaar’s main projects in Dubai?', a: 'Emaar’s flagship communities include Downtown Dubai, Dubai Marina, Dubai Hills Estate, Emaar Beachfront, Dubai Creek Harbour, Arabian Ranches and The Valley — spanning city-centre apartments to family villa districts.' },
      { q: 'Are Emaar properties a good investment?', a: 'Emaar is favoured by investors for reliable on-time delivery, the strongest secondary-market liquidity in Dubai, and durable rental demand in its master-planned communities, which supports both capital growth and yield.' },
      { q: 'What payment plans does Emaar offer?', a: 'Off-plan Emaar launches commonly use 80/20 or 90/10 plans (instalments during construction, balance on handover), with buyer funds protected in a DLD-registered escrow account. Exact terms vary by project.' },
    ] },
  { slug: 'damac', name: 'DAMAC Properties', aliases: ['DAMAC'], logo: '/images/developers/damac.png',
    blurb: 'A leading luxury developer known for branded residences and large lifestyle communities such as DAMAC Hills and DAMAC Islands, often with flexible payment plans.',
    intro: 'DAMAC Properties is one of Dubai’s leading luxury developers, known for branded residences and large lifestyle communities such as DAMAC Hills, DAMAC Hills 2, DAMAC Lagoons and DAMAC Islands. DAMAC projects in Dubai pair statement design — including collaborations with brands like Cavalli and de GRISOGONO — with investor-friendly payment plans that often extend past handover. The range runs from accessible apartments to signature villas, making DAMAC a frequent entry point for first-time Dubai investors chasing capital growth and rental yield.',
    faqs: [
      { q: 'What are DAMAC’s main communities in Dubai?', a: 'DAMAC’s best-known communities include DAMAC Hills, DAMAC Hills 2, DAMAC Lagoons and DAMAC Islands, alongside branded apartment towers in Business Bay and along Dubai Canal.' },
      { q: 'Does DAMAC offer post-handover payment plans?', a: 'Yes — many DAMAC off-plan projects offer flexible plans, frequently with instalments continuing after handover, which lowers the upfront cash needed to enter. Terms differ per launch.' },
      { q: 'Are DAMAC properties freehold and visa-eligible?', a: 'DAMAC sells in Dubai freehold areas, so international buyers own outright. A purchase from AED 2 million can qualify for the 10-year Golden Visa, subject to DLD and ICA conditions.' },
    ] },
  { slug: 'ellington', name: 'Ellington Properties', aliases: ['ELLINGTON', 'Ellington Properties', 'Ellington'], logo: '/images/developers/ellington.png',
    blurb: "A design-led boutique developer focused on architecture and finish quality across Dubai's most sought-after districts." },
  { slug: 'danube', name: 'Danube Properties', aliases: ['Danube Properties', 'Danube'],
    blurb: 'A high-volume developer popular with investors for accessible entry prices and 1% monthly payment plans.' },
  { slug: 'samana', name: 'Samana Developers', aliases: ['Samana'],
    blurb: 'A fast-growing developer known for resort-style residences with private pools and investor-friendly payment plans.' },
  { slug: 'sobha', name: 'Sobha Realty', aliases: ['SOBHA REALTY', 'Sobha', 'Sobha Group'], logo: '/images/developers/sobha.svg',
    blurb: 'A premium developer with full in-house construction (backward integration), known for Sobha Hartland and exceptional build quality.' },
  { slug: 'dar-global', name: 'DarGlobal', aliases: ['DarGlobal', 'DAR GLOBAL'],
    blurb: 'The international arm of Dar Al Arkan, delivering luxury branded residences in partnership with global names.' },
  { slug: 'prestige-one', name: 'Prestige One Developments', aliases: ['Prestige One'],
    blurb: 'A boutique Dubai developer focused on contemporary mid- and high-rise residences.' },
  { slug: 'expo-city', name: 'Expo City Dubai', aliases: ['Expo City Dubai', 'Expo Dubai Group', 'Expo City'],
    blurb: 'Master-developer of Expo City Dubai — a sustainable, mixed-use district built on the legacy of Expo 2020.' },
  { slug: 'igo', name: 'Invest Group Overseas (IGO)', aliases: ['IGO', 'Invest Group Overseas (IGO)', 'Invest Group Overseas'],
    blurb: 'A developer of premium villa and apartment communities with a focus on craftsmanship.' },
  { slug: 'mag', name: 'MAG', aliases: ['MAG Properties', 'MAG Property', 'Mag Properties', 'Mag Lifestyle', 'MAG'],
    blurb: 'The real-estate arm of the MAG Group, delivering accessible and wellness-focused residences across Dubai.' },
  { slug: 'meraas', name: 'Meraas', aliases: ['Meraas', 'MERAAS'], logo: '/images/developers/meraas.png',
    blurb: 'A Dubai master-developer behind landmark waterfront and lifestyle destinations such as Bluewaters and City Walk.' },
  { slug: 'aqua-properties', name: 'Aqua Properties', aliases: ['Aqua Properties', 'Aqua properties'],
    blurb: 'A Dubai developer delivering contemporary residential projects.' },
]

export const developerSlugs = developers.map(d => d.slug)

export function getDeveloper(slug: string): Developer | undefined {
  return developers.find(d => d.slug === slug)
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Exact normalized match against the canonical name or any alias (NOT substring,
// so "Prestige One" never catches "Prestige Harbour").
export function propertyMatchesDeveloper(propDeveloper: string, dev: Developer): boolean {
  if (!propDeveloper) return false
  const p = norm(propDeveloper)
  if (p === norm(dev.name)) return true
  return (dev.aliases ?? []).some(a => norm(a) === p)
}
