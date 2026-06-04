export interface Developer {
  slug: string
  name: string
  aliases?: string[]
  blurb: string
  logo?: string // path under /public, e.g. /images/developers/emaar.png
}

// Curated canonical developers with >=2 properties in the catalog (after merging
// the messy free-text variants below). Aliases cover the live distinct values in
// data/properties.json. Mirrors the lib/areas.ts aliases pattern.
export const developers: Developer[] = [
  { slug: 'emaar', name: 'Emaar Properties', aliases: ['EMAAR', 'Emaar'], logo: '/images/developers/emaar.png',
    blurb: "Dubai's largest master-developer — behind Downtown Dubai, Dubai Marina, Emaar Beachfront and Dubai Hills Estate. A byword for on-time delivery and strong resale liquidity." },
  { slug: 'damac', name: 'DAMAC Properties', aliases: ['DAMAC'], logo: '/images/developers/damac.png',
    blurb: 'A leading luxury developer known for branded residences and large lifestyle communities such as DAMAC Hills and DAMAC Islands, often with flexible payment plans.' },
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
