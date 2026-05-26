# Area Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 8 SSG area landing pages at flat URLs (`/dubai-marina`, `/downtown-dubai`, …) to capture high-intent district search queries and convert them into leads.

**Architecture:** Single dynamic route `app/[area]/page.tsx` with `generateStaticParams` whitelisting 8 slugs. Per-area data + unique copy in `lib/areas.ts` (single source of truth). Three new presentational components (`AreaHero`, `AreaFeaturedProperties`, `AreaFAQ`) compose the template. `LeadCaptureSection` gains an optional `source` prop. Homepage `AreasSection` switches its card links from filtered `/properties?area=...` to the new flat URLs.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · file-based JSON data (no database) · server-rendered SSG.

**Verification model:** This project has no test suite (per CLAUDE.md). Each task ends with `npm run build` (catches TypeScript + route errors) and, where it makes sense, a manual `curl`/browser smoke check. Final task includes the full deploy + GSC submission.

**Working directory for all `npm` commands:** `worldwise/`. If `npm` is missing, run `source ~/.nvm/nvm.sh && nvm use 24` first.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `worldwise/types/index.ts` | Modify (lines 89–96) | Remove unused `Area` stub; type now lives in `lib/areas.ts`. |
| `worldwise/lib/areas.ts` | Create | `Area` type, helpers (`getArea`, `areaSlugs`), data + copy for 8 districts. |
| `worldwise/components/AreaHero.tsx` | Create | Full-width hero block: image, H1, tagline, metric chips, primary CTA. |
| `worldwise/components/AreaFeaturedProperties.tsx` | Create | Server-rendered 6-card grid filtered by `property.area`. Hides if 0 matches. |
| `worldwise/components/AreaFAQ.tsx` | Create | Native `<details>`-based accordion. |
| `worldwise/components/LeadCaptureSection.tsx` | Modify | Accept optional `source` prop (default keeps existing behaviour). |
| `worldwise/app/[area]/page.tsx` | Create | Route handler, `generateStaticParams`, `generateMetadata`, JSON-LD, page composition. |
| `worldwise/components/AreasSection.tsx` | Modify | Switch homepage cards from `/properties?area=...` to `/<slug>`. |
| `worldwise/app/sitemap.ts` | Modify | Add 8 area URLs. |
| `CLAUDE.md` (repo root) | Modify | Add new `area_*` lead sources to the source list; add "Area landing pages" subsection under Architecture. |

---

## Task 1: Data Foundation (`lib/areas.ts`)

**Files:**
- Modify: `worldwise/types/index.ts` (lines 89–96 — remove dead `Area` stub)
- Create: `worldwise/lib/areas.ts`

- [ ] **Step 1.1 — Remove the unused `Area` stub from `worldwise/types/index.ts`**

Find the block (lines 89–96):

```ts
export interface Area {
  name: string
  slug: string
  image: string
  avgPricePerSqft: string
  avgRoi: string
  description: string
}
```

Delete it (including the blank line above if it leaves two consecutive blanks). No other file imports this — verified by `grep -rn "from '@/types'" | grep Area` returning nothing.

- [ ] **Step 1.2 — Create `worldwise/lib/areas.ts` with type, helpers, and all 8 areas**

```ts
export type AreaMetrics = {
  avgPrice: string
  roi: string
  typicalSize: string
  handover: string
}

export type AreaFaqItem = {
  q: string
  a: string
}

export type Area = {
  slug: string
  /** Must match Property.area exactly (used to filter the featured grid). */
  name: string
  heroImage: string
  tagline: string
  metrics: AreaMetrics
  whyInvest: string[]
  whatsNearby: string[]
  faq: AreaFaqItem[]
  metaDescription: string
}

export const areas: Area[] = [
  {
    slug: 'dubai-marina',
    name: 'Dubai Marina',
    heroImage: '/images/areas/dubai-marina.jpg',
    tagline: "Dubai's iconic waterfront skyline — and one of the city's deepest rental markets.",
    metrics: {
      avgPrice: 'AED 1,850/sqft',
      roi: '7–8%',
      typicalSize: '650–1,400 sqft',
      handover: 'Mostly secondary; select off-plan 2026–2028',
    },
    whyInvest: [
      "Dubai Marina has been one of the city's most established investor districts for over a decade. The combination of waterfront views, walkable promenades, and direct access to Jumeirah Beach Residence keeps short-term rental occupancy among the highest in Dubai — typically 85–95% year-round.",
      "Yields are competitive without sacrificing capital growth. Studios and one-bedrooms regularly clear 8% gross on long-term leases and substantially more on holiday-let platforms. Larger three-bedroom units perform strongly as family residences for relocating executives, particularly those working in JLT and Media City next door.",
      "The supply pipeline is mature, which means new launches sit alongside resale stock with established service charges and rental track records — making due diligence faster than in less-tested districts. Marina towers from developers like Emaar, Damac and Select Group continue to trade actively in the secondary market.",
    ],
    whatsNearby: [
      'Two Dubai Metro stations (DMCC and Sobha Realty) on the Red Line',
      'Jumeirah Beach Residence (JBR) walking distance — public beach, dining, retail',
      '7-minute drive to Palm Jumeirah and Bluewaters Island (Ain Dubai)',
      'Marina Walk: 7 km waterfront promenade with cafes, gyms and yacht clubs',
      'Major schools within 15 minutes: GEMS Wellington, Dubai British School',
    ],
    faq: [
      {
        q: 'Is Dubai Marina a good area for short-term rentals?',
        a: 'Yes — Marina consistently ranks among the top three Dubai districts for holiday-let occupancy, with average daily rates 30–50% higher than annual lease equivalents. A DET holiday-home permit is required.',
      },
      {
        q: 'What is the typical service charge in Dubai Marina?',
        a: 'Service charges in Marina towers typically run AED 14–22/sqft per year, depending on the building age and amenity set. Newer Emaar towers tend to sit at the higher end of that range.',
      },
      {
        q: 'Can foreigners buy property in Dubai Marina?',
        a: 'Yes — Dubai Marina is a designated freehold area, which means non-UAE nationals can purchase apartments with full ownership, no local sponsor required.',
      },
      {
        q: 'What is the rental yield outlook for the next few years?',
        a: 'With population growth continuing and limited new Marina supply, rental yields are expected to remain in the 7–8% range through 2027, with stronger performance on furnished and serviced units.',
      },
    ],
    metaDescription: 'Buy investment property in Dubai Marina — average AED 1,850/sqft, 7–8% rental yields. Browse current listings and get expert guidance from Worldwise Real Estate.',
  },
  {
    slug: 'downtown-dubai',
    name: 'Downtown Dubai',
    heroImage: '/images/areas/downtown-dubai.jpg',
    tagline: 'Live next to Burj Khalifa — the most prestigious address in the city.',
    metrics: {
      avgPrice: 'AED 2,200/sqft',
      roi: '6–7%',
      typicalSize: '700–1,800 sqft',
      handover: 'Mature secondary + select Emaar off-plan 2026–2027',
    },
    whyInvest: [
      "Downtown Dubai is the city's flagship district — home to Burj Khalifa, Dubai Mall, Dubai Opera and the Dubai Fountain. Capital values here have historically led the rest of the city in upcycles and held more value in correction phases, making it a foundational asset for long-term investors.",
      "The tenant pool skews towards senior executives, family offices and brand-conscious tenants who pay a premium for the address itself. That premium translates to consistently strong rental rates — one-bedroom units in The Address Residences or Burj Vista regularly secure AED 130,000–160,000 per year on long-term leases.",
      "Yields are slightly lower than Marina (6–7% vs 7–8%) because purchase prices are higher, but the combination of brand strength, scarce supply, and proximity to the city's main attractions means resale liquidity is among the best in Dubai. Properties typically transact within 60–90 days of going to market.",
    ],
    whatsNearby: [
      'Burj Khalifa and Dubai Mall — direct walking access from most towers',
      'Burj Khalifa/Dubai Mall Metro station (Red Line)',
      'Dubai Opera and Souk Al Bahar dining district',
      '10 minutes to DIFC business district',
      'Schools within 15 minutes: Citizens School, Hartland International',
    ],
    faq: [
      {
        q: 'Is Downtown Dubai worth the premium over Marina?',
        a: 'For investors prioritising capital preservation and tenant quality, yes. Downtown has lower yield but stronger resale liquidity and tenant covenant. For pure cash-flow investors, Marina or Business Bay typically score better.',
      },
      {
        q: 'How tight is supply in Downtown Dubai?',
        a: 'Very tight. Emaar controls most of the new development pipeline, and only a handful of major launches arrive each year. Resale dominates the market — around 75% of 2025 transactions were existing-build.',
      },
      {
        q: "Can I get a Golden Visa from a Downtown apartment purchase?",
        a: 'Yes — properties priced at AED 2M or above qualify for the 10-year UAE Golden Visa, and most Downtown one-bedrooms clear that threshold comfortably.',
      },
      {
        q: 'What are the average service charges?',
        a: 'Downtown service charges typically run AED 18–28/sqft per year. Address Residences and Burj Khalifa itself sit at the higher end; older Old Town low-rise buildings are at the lower end.',
      },
    ],
    metaDescription: 'Buy property in Downtown Dubai — AED 2,200/sqft average, 6–7% yields, Burj Khalifa views. Expert investment guidance from Worldwise Real Estate.',
  },
  {
    slug: 'palm-jumeirah',
    name: 'Palm Jumeirah',
    heroImage: '/images/areas/palm-jumeirah.jpg',
    tagline: "Dubai's signature waterfront island — beachfront living with global brand recognition.",
    metrics: {
      avgPrice: 'AED 2,800/sqft',
      roi: '6–8%',
      typicalSize: '800–4,500 sqft',
      handover: 'Mature secondary + premium off-plan towers 2026–2028',
    },
    whyInvest: [
      "Palm Jumeirah is one of the most recognisable real estate addresses in the world. The combination of private beach access, restricted island supply and brand association with luxury hospitality (Atlantis, One&Only, Waldorf Astoria) gives properties here a global tenant and buyer pool that very few Dubai districts can match.",
      "The market splits into three distinct segments: trunk apartments (typically AED 2.0–4.0M for one and two-bedrooms with marina or skyline views), frond villas (AED 15–50M for beachfront family homes) and ultra-luxury penthouses at branded residences (AED 40M and above). Each segment has its own demand profile but all benefit from the Palm address premium.",
      "Yields on apartments in the trunk run 6–8% on long-term leases, with substantially higher returns on short-term lets — a furnished Palm trunk apartment can generate AED 350,000+ in gross holiday-let revenue per year. Frond villas trade more on capital appreciation than yield.",
    ],
    whatsNearby: [
      'Private residents-only and public beaches on the island',
      "Atlantis The Palm, The Royal Atlantis, Aquaventure waterpark",
      "Palm Monorail connects to the Gateway tram station",
      "10 minutes to Dubai Marina, 15 minutes to Mall of the Emirates",
      'Beach clubs: Nikki Beach, Cove Beach, FIVE Palm Jumeirah',
    ],
    faq: [
      {
        q: 'Are Palm Jumeirah apartments freehold?',
        a: 'Yes — the entire island is a designated freehold area, open to foreign buyers with full ownership.',
      },
      {
        q: 'What is the difference between trunk and frond properties?',
        a: 'The trunk is the central spine of the island, dominated by mid-rise and high-rise apartment buildings. The fronds (16 of them) are residential streets of beachfront villas only. Trunk apartments are the investor entry point; frond villas are end-user family homes.',
      },
      {
        q: 'How is short-term rental performance on the Palm?',
        a: 'Among the strongest in Dubai. Furnished trunk apartments achieve average daily rates of AED 1,200–2,500 depending on size and view, with 80–90% occupancy in peak season (October–April).',
      },
      {
        q: 'What about service charges on Palm towers?',
        a: 'Palm service charges are higher than mainland Dubai — typically AED 22–35/sqft per year — due to the island infrastructure, beach maintenance and private access roads.',
      },
    ],
    metaDescription: 'Buy property on Palm Jumeirah — beachfront living from AED 2.0M. Expert guidance on trunk apartments, frond villas and branded residences. Worldwise Real Estate.',
  },
  {
    slug: 'business-bay',
    name: 'Business Bay',
    heroImage: '/images/areas/business-bay.jpg',
    tagline: "Dubai's CBD next to Downtown — and the city's highest-yielding investment district.",
    metrics: {
      avgPrice: 'AED 1,600/sqft',
      roi: '7–9%',
      typicalSize: '500–1,200 sqft',
      handover: 'Heavy off-plan pipeline 2026–2029',
    },
    whyInvest: [
      "Business Bay is Dubai's central business district, sitting on the Dubai Water Canal directly adjacent to Downtown. It combines the proximity premium of the city centre with substantially lower entry prices — typically 25–30% cheaper per square foot than Downtown itself.",
      "The combination of price point and location drives the highest gross yields in the city core: studios and one-bedrooms regularly clear 8–9% on long-term leases. Tenant demand is dominated by young professionals working in DIFC, Downtown and the canal-side hotels, who value short commutes over space.",
      "The off-plan pipeline is the largest among Dubai's core districts — Damac, Omniyat, Binghatti and Sobha all have active launches. This creates a layered entry strategy: investors can buy during construction at favourable payment plans, hold through handover and ride the yield curve as the district matures.",
    ],
    whatsNearby: [
      'Business Bay Metro station (Red Line) and Burj Khalifa/Dubai Mall station',
      'Dubai Water Canal — pedestrian and cycling promenade',
      'Direct access to Sheikh Zayed Road and Al Khail Road',
      '5 minutes to Downtown Dubai and Dubai Mall',
      'DIFC business district 10 minutes away',
    ],
    faq: [
      {
        q: 'Why is Business Bay yielding more than Marina?',
        a: 'Lower entry price per square foot combined with consistent professional-tenant demand. Marina prices have appreciated faster, compressing yields, while Business Bay still has off-plan stock entering at competitive rates.',
      },
      {
        q: 'Is Business Bay good for off-plan investment?',
        a: 'Yes — it has one of the largest active pipelines in Dubai. Payment plans typically run 60/40 or 50/50 during construction with 1–3% monthly post-handover schedules now common from major developers.',
      },
      {
        q: 'What is the typical apartment size?',
        a: 'Business Bay leans towards efficient layouts — studios from 350 sqft and one-bedrooms from 550 sqft are common. Larger three-bedroom apartments exist but are less common than in family-oriented districts.',
      },
      {
        q: 'Is the area family-friendly?',
        a: 'Less so than Dubai Hills or Arabian Ranches. Business Bay is designed around professional tenants — limited schools and parks within the district itself, though families do live here for proximity to Downtown amenities.',
      },
    ],
    metaDescription: 'Buy investment property in Business Bay — AED 1,600/sqft, 7–9% yields, biggest off-plan pipeline in central Dubai. Worldwise Real Estate.',
  },
  {
    slug: 'dubai-hills',
    name: 'Dubai Hills',
    heroImage: '/images/areas/dubai-hills.jpg',
    tagline: "Dubai's green-belt family district — schools, golf, and one of Emaar's flagship masterplans.",
    metrics: {
      avgPrice: 'AED 1,400/sqft',
      roi: '6–7%',
      typicalSize: '800–4,500 sqft',
      handover: 'Active off-plan villas and apartments 2026–2028',
    },
    whyInvest: [
      "Dubai Hills Estate is Emaar's flagship family-oriented masterplan — 11 million square metres anchored by an 18-hole championship golf course, parks, schools and the Dubai Hills Mall. Unlike older districts that grew organically, Dubai Hills was master-planned from day one with family residents in mind.",
      "The tenant and buyer profile is distinctive: long-stay families, often with school-age children, who place a premium on green space, walkability and access to international schools. This produces lower turnover than transient districts like Marina, and rental contracts of 2–3 years are common rather than annual.",
      "Yields are slightly lower (6–7%) than waterfront districts, but capital growth has been among the strongest in Dubai — villa prices in Sidra, Maple and Golf Place have appreciated 40–60% since 2021. Apartments in Park Heights, Mulberry and Collective offer a more accessible entry point at AED 1.5–3.5M.",
    ],
    whatsNearby: [
      'Dubai Hills Mall — 750+ shops, cinemas, F&B',
      'Dubai Hills Golf Club — 18-hole championship course',
      'Three major schools on-site: GEMS Wellington Academy, Kings’ School, Repton School',
      'Direct access to Al Khail Road — 15 minutes to Downtown',
      'Parks and walking trails throughout the estate',
    ],
    faq: [
      {
        q: 'Is Dubai Hills a good choice for first-time investors?',
        a: 'Yes — particularly for those targeting family tenants. The combination of Emaar developer reputation, established demand and lower volatility makes it a defensive position. Apartments at AED 1.5M+ also qualify the buyer for the Golden Visa.',
      },
      {
        q: 'What is the difference between villas and apartments here?',
        a: 'Villas (Sidra, Maple, Golf Place, Park Hills) cluster around AED 5–25M and trade primarily on capital appreciation. Apartments (Park Heights, Mulberry, Collective) start around AED 1.5M and produce stronger yields.',
      },
      {
        q: 'Is the metro accessible from Dubai Hills?',
        a: "Not directly within the estate — the nearest metro stations are about 10–15 minutes' drive. The district is car-oriented; this suits its family demographic but is a factor to consider for tenant pool.",
      },
      {
        q: 'How active is the rental market?',
        a: 'Active but slower-moving than Marina or Business Bay — properties typically rent within 30–60 days, and tenants stay longer. Vacancy risk is lower; void periods between tenants are correspondingly shorter.',
      },
    ],
    metaDescription: 'Buy investment property in Dubai Hills — AED 1,400/sqft, family-oriented Emaar masterplan with golf, schools and parks. Worldwise Real Estate.',
  },
  {
    slug: 'jlt',
    name: 'JLT',
    heroImage: '/images/areas/jlt.jpg',
    tagline: 'Marina-adjacent and metro-served — the highest-yielding established district in Dubai.',
    metrics: {
      avgPrice: 'AED 1,200/sqft',
      roi: '7–9%',
      typicalSize: '500–1,400 sqft',
      handover: 'Primarily secondary; select off-plan 2026–2027',
    },
    whyInvest: [
      "Jumeirah Lake Towers (JLT) sits directly across Sheikh Zayed Road from Dubai Marina, offering many of the same advantages — metro access, lakeside promenades, dense F&B — at substantially lower entry prices. The price-per-square-foot gap to Marina has historically been 30–40%, while yields run a full 1–2 percentage points higher.",
      "JLT is also home to DMCC, the free zone that hosts over 25,000 companies in the precious metals, commodities and tech sectors. This creates a built-in professional tenant base who work in JLT and want to live within walking distance, supporting consistent demand for studios and one-bedrooms.",
      "Most of the supply is mature — the district was largely completed by 2015 — which means investors can buy with full visibility on service charges, rental history and building reputations. New off-plan launches are rare but high-quality (e.g. Sobha and Damac tower additions).",
    ],
    whatsNearby: [
      'Two Metro stations on the Red Line (DMCC and Sobha Realty)',
      "JLT cluster lakes and promenades for jogging, dog walking",
      "Dubai Marina across SZR — 5-minute drive or walk via underpass",
      'Direct access to Sheikh Zayed Road north and south',
      'Affordable F&B scene: Cluster Y, Cluster D, Cluster O',
    ],
    faq: [
      {
        q: 'How does JLT compare to Dubai Marina for investors?',
        a: 'JLT is the value play. Same metro line, similar amenities, lower prices and higher yields — but less prestige and slightly older building stock. For pure cash-flow investors, JLT often wins; for branded resale liquidity, Marina is stronger.',
      },
      {
        q: 'Are all 26 clusters equal?',
        a: "No — clusters vary in tower quality and lake views. Y, V, T, X and D are commonly preferred. Some early-cycle clusters have older finishes; due diligence on specific buildings matters more in JLT than in newer districts.",
      },
      {
        q: 'What is the tenant profile in JLT?',
        a: 'Heavily skewed towards professionals working in DMCC and nearby Media City / Internet City. Typical tenants are 25–40 single professionals or young couples on 1–2 year contracts.',
      },
      {
        q: "What are JLT service charges like?",
        a: 'Generally lower than Marina — AED 12–18/sqft per year for most towers, which combined with lower purchase prices is the main driver of JLT’s yield premium.',
      },
    ],
    metaDescription: 'Buy property in JLT (Jumeirah Lake Towers) — AED 1,200/sqft, 7–9% yields, Metro-served alternative to Dubai Marina. Worldwise Real Estate.',
  },
  {
    slug: 'creek-harbour',
    name: 'Creek Harbour',
    heroImage: '/images/areas/creek-harbour.jpg',
    tagline: "Emaar's next Downtown — a master-planned waterfront city around the future Dubai Creek Tower.",
    metrics: {
      avgPrice: 'AED 1,700/sqft',
      roi: '7–8%',
      typicalSize: '600–2,200 sqft',
      handover: 'Active off-plan pipeline 2026–2030',
    },
    whyInvest: [
      "Dubai Creek Harbour is Emaar's most ambitious current masterplan: a 6 sq km waterfront city built around the planned Dubai Creek Tower, set to be the world's tallest. It's positioned as the next Downtown — same developer pedigree, similar walkable urbanism, but at earlier-cycle prices around AED 1,700/sqft against Downtown's AED 2,200+.",
      "Entry is dominated by off-plan, which suits investors who want the longest payment plans, lowest entry capital and longest runway to handover-to-rental conversion. Most launches sit on 50/50 or 60/40 plans with 1% monthly post-handover terms available on select towers.",
      "The catch is timing — much of the masterplan still has 3–5 years of construction ahead. Yields are projected at 7–8% based on Emaar's modelling for completed towers (Creek Beach, Creek Edge, Address Harbour Point are now handed over and renting), but each new tower carries delivery and infrastructure-pace risk that mature districts don't have.",
    ],
    whatsNearby: [
      "Direct access to Dubai-Al Ain Road and Ras Al Khor",
      "15 minutes to Downtown Dubai; 5 minutes to Dubai International Airport",
      "Creek Marina, beach, parks and boardwalks (Creek Beach district)",
      "Future Dubai Creek Tower (under construction) and observation deck",
      "Ras Al Khor wildlife sanctuary — flamingos visible from many towers",
    ],
    faq: [
      {
        q: 'Is Creek Harbour ready to live in today?',
        a: 'Partially. The Island District (Creek Edge, Creek Beach, Address Residences) is built and active. The wider masterplan including Dubai Square and the Creek Tower is still under construction — full delivery is staged through to around 2030.',
      },
      {
        q: 'How does Creek Harbour compare to Downtown?',
        a: 'Same developer (Emaar), similar walkable design and waterfront framing. Creek is earlier-cycle: lower prices, larger pipeline, more off-plan, and the marquee tower is still years from completion. Downtown is mature and proven; Creek is a 5–10 year bet on the masterplan executing as designed.',
      },
      {
        q: "Can I rent out a Creek Harbour apartment after handover?",
        a: 'Yes — handed-over towers like Creek Edge and Creek Beach are already on the rental market. Holiday-let permits are available for owners through DET, same as Marina and Downtown.',
      },
      {
        q: 'What are the risks for off-plan buyers?',
        a: 'Construction-delay risk (mitigated by Emaar’s delivery record), masterplan-pace risk (some amenity launches depend on adjacent phases completing) and exit-liquidity risk (resale activity is thinner for off-plan units than handed-over stock).',
      },
    ],
    metaDescription: 'Buy property in Dubai Creek Harbour — Emaar masterplan, AED 1,700/sqft, 7–8% projected yields, future Dubai Creek Tower. Worldwise Real Estate.',
  },
  {
    slug: 'emaar-beachfront',
    name: 'Emaar Beachfront',
    heroImage: '/images/areas/emaar-beachfront.jpg',
    tagline: 'Private island living next to Dubai Marina — beachfront residences with global resale appeal.',
    metrics: {
      avgPrice: 'AED 2,500/sqft',
      roi: '7–8%',
      typicalSize: '700–3,500 sqft',
      handover: 'Multiple towers handing over 2026–2028',
    },
    whyInvest: [
      "Emaar Beachfront is a gated island development in Dubai Harbour, sitting between Dubai Marina and Palm Jumeirah. Every tower has direct beach access, marina views or both — the entire masterplan is designed around 1.5 km of private beach and a 1,400-berth super-yacht harbour next door.",
      "The combination of Emaar developer pedigree, private beach access and waterfront positioning gives properties here a strong global resale story. The buyer mix includes a high proportion of overseas investors from the UK, Russia, India and China who pay premium prices for the brand association — particularly on penthouses and beachfront-line apartments.",
      "Yields run 7–8% on long-term leases for mid-tower one and two-bedroom units, with short-term let returns substantially higher given the beach access — premium furnished units on Emaar Beachfront regularly achieve average daily rates 30–60% above comparable Marina inventory.",
    ],
    whatsNearby: [
      'Private 1.5 km beach exclusive to residents',
      "Dubai Harbour cruise terminal and super-yacht marina",
      "5 minutes to Dubai Marina and JBR",
      "Skydive Dubai drop zone and beach club adjacent",
      'Direct Sheikh Zayed Road access; 25 minutes to DIFC',
    ],
    faq: [
      {
        q: 'How is Emaar Beachfront different from Palm Jumeirah?',
        a: 'Emaar Beachfront is denser and more apartment-focused — there are no villas. Prices per square foot are lower than Palm trunk apartments but you give up the iconic Palm address. The beach quality is comparable; the resale market is somewhat earlier-cycle than the mature Palm market.',
      },
      {
        q: 'Are these apartments freehold?',
        a: 'Yes — Emaar Beachfront is a designated freehold area, open to foreign buyers with full ownership.',
      },
      {
        q: 'What is the off-plan vs handed-over split?',
        a: 'A mix — Beach Isle and Sunrise Bay have handed over; Beach Vista, Address Beach Resort and several newer towers are in handover phase through 2028. New launches still come to market regularly.',
      },
      {
        q: 'What service charges should I expect?',
        a: 'Emaar Beachfront service charges run AED 18–28/sqft per year, with beach maintenance and pool/gym facilities included. Premium towers like Address Beach Resort are at the higher end.',
      },
    ],
    metaDescription: 'Buy property at Emaar Beachfront — private beach access, AED 2,500/sqft, 7–8% yields. Premium investment guidance from Worldwise Real Estate.',
  },
]

export const areaSlugs = areas.map(a => a.slug)

export function getArea(slug: string): Area | undefined {
  return areas.find(a => a.slug === slug)
}
```

- [ ] **Step 1.3 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds, no TypeScript errors. The new file is library-only and not yet routed.

- [ ] **Step 1.4 — Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/areas.ts
git commit -m "feat(areas): add Area type, helpers, and content for 8 Dubai districts"
```

---

## Task 2: AreaHero Component

**Files:**
- Create: `worldwise/components/AreaHero.tsx`

- [ ] **Step 2.1 — Create the hero component**

This is a client component because it opens `LeadModal` from a button click. It receives the area object and the modal-open handler.

```tsx
'use client'

import { Area } from '@/lib/areas'

type Props = {
  area: Area
  listingCount: number
  onCtaClick: () => void
}

export default function AreaHero({ area, listingCount, onCtaClick }: Props) {
  return (
    <section
      className="relative h-[70vh] min-h-[520px] w-full flex items-end overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${area.heroImage}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/20" />

      <div className="relative max-w-7xl mx-auto px-6 pb-16 md:pb-24 w-full">
        <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
          Dubai · Investment Area
        </p>
        <h1 className="font-serif text-white text-4xl md:text-6xl leading-tight max-w-3xl">
          {area.name}
        </h1>
        <p className="text-white/80 text-lg md:text-xl mt-4 max-w-2xl leading-relaxed">
          {area.tagline}
        </p>

        <div className="flex flex-wrap gap-4 md:gap-6 mt-8">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Avg price</p>
            <p className="text-white font-serif text-lg mt-1">{area.metrics.avgPrice}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Rental yield</p>
            <p className="text-gold font-serif text-lg mt-1">{area.metrics.roi}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Current listings</p>
            <p className="text-white font-serif text-lg mt-1">{listingCount}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button onClick={onCtaClick} className="btn-primary">
            Get Free Consultation
          </button>
          <a href="#featured" className="btn-outline-gold">
            See Properties
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2.2 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds. The component is unused so far — only the type checker exercises it.

- [ ] **Step 2.3 — Commit**

```bash
git add worldwise/components/AreaHero.tsx
git commit -m "feat(areas): add AreaHero component with metric chips and CTA"
```

---

## Task 3: AreaFeaturedProperties Component

**Files:**
- Create: `worldwise/components/AreaFeaturedProperties.tsx`

- [ ] **Step 3.1 — Create the featured-properties block**

Server component (no `'use client'`). Receives filtered properties already; the page does the filtering so this component stays presentational and easy to reason about.

```tsx
import Link from 'next/link'
import { Property } from '@/types'
import PropertyCard from './PropertyCard'

type Props = {
  areaName: string
  properties: Property[]
}

export default function AreaFeaturedProperties({ areaName, properties }: Props) {
  if (properties.length === 0) {
    return (
      <section id="featured" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Listings
          </p>
          <h2 className="section-title">Currently Sourcing {areaName} Inventory</h2>
          <p className="section-subtitle">
            We&apos;re between active listings in {areaName} right now. Browse the wider catalogue
            or contact us for off-market opportunities.
          </p>
          <Link href="/properties" className="btn-outline inline-block mt-6">
            Browse all properties
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section id="featured" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Available Now
          </p>
          <h2 className="section-title">Featured Properties in {areaName}</h2>
          <p className="section-subtitle">
            Curated by our investment team. Updated weekly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(p => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href={`/properties?area=${encodeURIComponent(areaName)}`}
            className="btn-outline inline-block"
          >
            View all in {areaName}
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3.2 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds.

- [ ] **Step 3.3 — Commit**

```bash
git add worldwise/components/AreaFeaturedProperties.tsx
git commit -m "feat(areas): add featured-properties block with empty-state fallback"
```

---

## Task 4: AreaFAQ Component

**Files:**
- Create: `worldwise/components/AreaFAQ.tsx`

- [ ] **Step 4.1 — Create the FAQ accordion**

Uses native `<details>` — no JS, accessible by default, lightweight. No `'use client'` needed.

```tsx
import { AreaFaqItem } from '@/lib/areas'

type Props = {
  areaName: string
  items: AreaFaqItem[]
}

export default function AreaFAQ({ areaName, items }: Props) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            FAQ
          </p>
          <h2 className="section-title">Investing in {areaName}</h2>
          <p className="section-subtitle">
            The questions investors most often ask our team.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <details
              key={i}
              className="group border border-gray-200 rounded-sm bg-white open:shadow-sm"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-serif text-navy text-lg leading-snug">{item.q}</span>
                <span className="text-gold text-2xl leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-1">
                <p className="text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4.2 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds.

- [ ] **Step 4.3 — Commit**

```bash
git add worldwise/components/AreaFAQ.tsx
git commit -m "feat(areas): add FAQ accordion (native details, no JS)"
```

---

## Task 5: Make LeadCaptureSection Accept a Source Prop

**Files:**
- Modify: `worldwise/components/LeadCaptureSection.tsx`

- [ ] **Step 5.1 — Read the current file**

```bash
cat worldwise/components/LeadCaptureSection.tsx
```

Note the two hardcoded source values:
- `source: 'main_cta_section'` in the POST body
- `source: 'lead_capture_section'` in the GA4 track call

(These two strings are inconsistent in the existing code. Keep both defaults to preserve existing analytics history, but allow overrides for both via one prop.)

- [ ] **Step 5.2 — Add optional `source` prop with defaults preserving existing behaviour**

Change the component signature and the two usages:

```tsx
// Before:
export default function LeadCaptureSection() {

// After:
type Props = {
  /** Source string for both the lead record and the GA4 event. Defaults preserve existing homepage behaviour. */
  source?: string
}

export default function LeadCaptureSection({ source = 'lead_capture_section' }: Props = {}) {
```

In the POST body, replace:

```ts
body: JSON.stringify({ name, phone, budget, source: 'main_cta_section', _hp: hpRef.current?.value ?? '' }),
```

with:

```ts
body: JSON.stringify({ name, phone, budget, source, _hp: hpRef.current?.value ?? '' }),
```

In the GA4 track call, replace:

```ts
track('lead_form_submit', { source: 'lead_capture_section' })
```

with:

```ts
track('lead_form_submit', { source })
```

**Note on default value:** Before this change, the homepage instance recorded the lead with `source: 'main_cta_section'` but the GA event with `source: 'lead_capture_section'`. After this change both will use `'lead_capture_section'` — a small consistency fix. Mention this in the commit message.

- [ ] **Step 5.3 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds. The homepage usage `<LeadCaptureSection />` still compiles because the prop is optional.

- [ ] **Step 5.4 — Commit**

```bash
git add worldwise/components/LeadCaptureSection.tsx
git commit -m "refactor(lead-capture): accept optional source prop for per-page tracking

Default reconciles the prior inconsistency (POST used 'main_cta_section',
GA used 'lead_capture_section') — both now use 'lead_capture_section'."
```

---

## Task 6: Area Route — `app/[area]/page.tsx`

**Files:**
- Create: `worldwise/app/[area]/page.tsx`

This task composes everything: the route handler, `generateStaticParams`, `generateMetadata`, JSON-LD (Place + BreadcrumbList + FAQPage), the modal state, and the page layout.

- [ ] **Step 6.1 — Create the page**

```tsx
'use client'

// We need client-state for the LeadModal. The metadata is exported from a separate
// file pattern in App Router, but Next 14 supports re-exporting metadata only from
// server components. To keep both, we split: the page itself stays client, and the
// SEO bits live in a sibling server route below. For now, mark the page client and
// generate metadata via `generateMetadata` placed inside this same file using the
// `export const generateMetadata` pattern only-allowed in server components.
//
// CORRECTION: this file must be a server component for generateStaticParams and
// generateMetadata to work. We extract the interactive shell into a Client wrapper.
```

That comment block is intentionally instructive — **delete it before saving** and replace this whole file with the implementation below. It's a reminder of the constraint Next.js imposes: server component for SSG/metadata, client wrapper for state.

**Final file content:**

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import AreaFeaturedProperties from '@/components/AreaFeaturedProperties'
import AreaFAQ from '@/components/AreaFAQ'
import AreaPageClient from './AreaPageClient'
import { getArea, areaSlugs } from '@/lib/areas'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
const FEATURED_LIMIT = 6

export function generateStaticParams() {
  return areaSlugs.map(slug => ({ area: slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { area: string }
}): Promise<Metadata> {
  const area = getArea(params.area)
  if (!area) return {}

  const title = `${area.name} Apartments & Investment Properties | Worldwise Real Estate`
  const url = `${BASE}/${area.slug}`
  const image = `${BASE}${area.heroImage}`

  return {
    title,
    description: area.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: area.metaDescription,
      url,
      type: 'website',
      images: [{ url: image, width: 1200, height: 800, alt: area.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: area.metaDescription,
      images: [image],
    },
  }
}

export default function AreaPage({ params }: { params: { area: string } }) {
  const area = getArea(params.area)
  if (!area) notFound()

  const allProperties = getProperties()
  const inArea = allProperties.filter(p => p.area === area.name)
  const featured = inArea.slice(0, FEATURED_LIMIT)
  const listingCount = inArea.length

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: area.name,
    description: area.metaDescription,
    image: `${BASE}${area.heroImage}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: area.name,
      addressRegion: 'Dubai',
      addressCountry: 'AE',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: area.name, item: `${BASE}/${area.slug}` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const leadSource = `area_${area.slug.replace(/-/g, '_')}`

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <AreaPageClient area={area} listingCount={listingCount}>
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
              Why Invest
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-navy mb-8 leading-tight">
              Why {area.name} works for investors
            </h2>
            <div className="space-y-5 text-gray-700 leading-relaxed text-lg">
              {area.whyInvest.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
                Key Stats
              </p>
              <h2 className="section-title">{area.name} at a glance</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Average price" value={area.metrics.avgPrice} />
              <StatCard label="Rental yield" value={area.metrics.roi} accent />
              <StatCard label="Typical size" value={area.metrics.typicalSize} />
              <StatCard label="Handover" value={area.metrics.handover} small />
            </div>
          </div>
        </section>

        <AreaFeaturedProperties areaName={area.name} properties={featured} />

        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
              The Neighbourhood
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-navy mb-8 leading-tight">
              What&apos;s nearby
            </h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed text-lg list-none">
              {area.whatsNearby.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gold mt-2 shrink-0">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <AreaFAQ areaName={area.name} items={area.faq} />

        <LeadCaptureSection source={leadSource} />
      </AreaPageClient>

      <FloatingCTA />
      <Footer />
    </>
  )
}

function StatCard({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: string
  value: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm p-5 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-widest">{label}</p>
      <p
        className={`font-serif mt-2 ${accent ? 'text-gold' : 'text-navy'} ${
          small ? 'text-base leading-snug' : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
```

- [ ] **Step 6.2 — Create the client wrapper that owns LeadModal state**

The route is a server component (for `generateMetadata`/`generateStaticParams`); the wrapper is a client component that owns the modal open state and renders `AreaHero` + children.

Create `worldwise/app/[area]/AreaPageClient.tsx`:

```tsx
'use client'

import { useState, ReactNode } from 'react'
import AreaHero from '@/components/AreaHero'
import LeadModal from '@/components/LeadModal'
import type { Area } from '@/lib/areas'

type Props = {
  area: Area
  listingCount: number
  children: ReactNode
}

export default function AreaPageClient({ area, listingCount, children }: Props) {
  const [open, setOpen] = useState(false)
  const leadSource = `area_${area.slug.replace(/-/g, '_')}`

  return (
    <>
      <AreaHero area={area} listingCount={listingCount} onCtaClick={() => setOpen(true)} />
      {children}
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={leadSource}
        title={`Investing in ${area.name}?`}
        subtitle="Tell us what you're looking for — we'll send curated options within 24 hours."
      />
    </>
  )
}
```

- [ ] **Step 6.3 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds. Output should include 8 prerendered routes under `[area]`:

```
● /[area]
  ├ /dubai-marina
  ├ /downtown-dubai
  ├ /palm-jumeirah
  ├ /business-bay
  ├ /dubai-hills
  ├ /jlt
  ├ /creek-harbour
  └ /emaar-beachfront
```

- [ ] **Step 6.4 — Local smoke test**

```bash
cd worldwise && npm run dev
```

In a browser at `http://localhost:3000/dubai-marina`, verify:
- Hero shows correct image, H1, tagline, three metric chips, two CTAs
- "Get Free Consultation" opens `LeadModal` with the correct title
- Why-invest paragraphs render
- Key Stats card row shows 4 cards
- Featured Properties shows real cards from the data (or empty-state if no matches)
- What's Nearby bullets render
- FAQ accordion opens/closes
- LeadCaptureSection submits with source `area_dubai_marina` (check Network tab → `/api/leads` POST body)
- FloatingCTA + Footer present

Then check `view-source:http://localhost:3000/dubai-marina` for:
- `<link rel="canonical" href="https://worldwise.pro/dubai-marina"/>`
- Three `<script type="application/ld+json">` blocks (Place, BreadcrumbList, FAQPage)

Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 6.5 — Commit**

```bash
git add worldwise/app/[area]/page.tsx worldwise/app/[area]/AreaPageClient.tsx
git commit -m "feat(areas): add /<area> route with SSG, metadata, and JSON-LD"
```

---

## Task 7: Update AreasSection — Switch to Flat URLs

**Files:**
- Modify: `worldwise/components/AreasSection.tsx`

- [ ] **Step 7.1 — Replace the filter-based URL with the flat slug**

The current component has its own local `areas` array with `name`, `avgPrice`, `roi`, `img` — none of which include a slug. Import the slug map from `lib/areas.ts` and look up the matching slug by name.

**Replace** the entire file with:

```tsx
import Link from 'next/link'
import { areas as areaData } from '@/lib/areas'

type AreaCard = {
  name: string
  avgPrice: string
  roi: string
  img: string
  slug: string
}

const slugByName = new Map(areaData.map(a => [a.name, a.slug]))

const homepageAreas: AreaCard[] = [
  { name: 'Dubai Marina',     avgPrice: 'AED 1,850/sqft', roi: '7–8%', img: '/images/areas/dubai-marina.jpg',     slug: slugByName.get('Dubai Marina')! },
  { name: 'Downtown Dubai',   avgPrice: 'AED 2,200/sqft', roi: '6–7%', img: '/images/areas/downtown-dubai.jpg',   slug: slugByName.get('Downtown Dubai')! },
  { name: 'Palm Jumeirah',    avgPrice: 'AED 2,800/sqft', roi: '6–8%', img: '/images/areas/palm-jumeirah.jpg',    slug: slugByName.get('Palm Jumeirah')! },
  { name: 'Business Bay',     avgPrice: 'AED 1,600/sqft', roi: '7–9%', img: '/images/areas/business-bay.jpg',     slug: slugByName.get('Business Bay')! },
  { name: 'Dubai Hills',      avgPrice: 'AED 1,400/sqft', roi: '6–7%', img: '/images/areas/dubai-hills.jpg',      slug: slugByName.get('Dubai Hills')! },
  { name: 'JLT',              avgPrice: 'AED 1,200/sqft', roi: '7–9%', img: '/images/areas/jlt.jpg',              slug: slugByName.get('JLT')! },
  { name: 'Creek Harbour',    avgPrice: 'AED 1,700/sqft', roi: '7–8%', img: '/images/areas/creek-harbour.jpg',    slug: slugByName.get('Creek Harbour')! },
  { name: 'Emaar Beachfront', avgPrice: 'AED 2,500/sqft', roi: '7–8%', img: '/images/areas/emaar-beachfront.jpg', slug: slugByName.get('Emaar Beachfront')! },
]

export default function AreasSection() {
  return (
    <section id="areas" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Dubai Locations
          </p>
          <h2 className="section-title">Explore Dubai&apos;s Best<br />Investment Areas</h2>
          <p className="section-subtitle">Market data updated regularly based on DLD transactions</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {homepageAreas.map(area => (
            <Link
              key={area.name}
              href={`/${area.slug}`}
              className="group relative overflow-hidden rounded-sm aspect-[4/3] cursor-pointer"
            >
              <div
                className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                style={{ backgroundImage: `url('${area.img}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-serif text-lg leading-tight">{area.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-white/60 text-xs">{area.avgPrice}</span>
                  <span className="text-gold text-xs font-medium">{area.roi} ROI</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Why keep the local `homepageAreas` array** instead of mapping directly over `lib/areas`? The homepage card visuals depend on a stable order chosen for visual balance, and we may want to display different subsets here vs the data file (e.g. promote a featured area). Keeping the homepage list separate but slug-linked preserves that flexibility.

- [ ] **Step 7.2 — Verify build**

```bash
cd worldwise && npm run build
```

Expected: build succeeds. Homepage still prerenders.

- [ ] **Step 7.3 — Smoke test (optional, can do once at end)**

`npm run dev` → `http://localhost:3000` → scroll to Areas section → click "Dubai Marina" → should navigate to `/dubai-marina`.

- [ ] **Step 7.4 — Commit**

```bash
git add worldwise/components/AreasSection.tsx
git commit -m "feat(areas): switch homepage area cards from filter URL to flat slug routes"
```

---

## Task 8: Update Sitemap

**Files:**
- Modify: `worldwise/app/sitemap.ts`

- [ ] **Step 8.1 — Add the 8 area URLs**

In `worldwise/app/sitemap.ts`, add the import and append `areaPages` to the returned array.

Add to the imports at the top:

```ts
import { areaSlugs } from '@/lib/areas'
```

Just before `return [...staticPages, ...propertyPages, ...blogPages]`, insert:

```ts
  const areaPages: MetadataRoute.Sitemap = areaSlugs.map(slug => ({
    url: `${BASE}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
```

And change the return to include it:

```ts
  return [...staticPages, ...areaPages, ...propertyPages, ...blogPages]
```

- [ ] **Step 8.2 — Verify build and inspect sitemap output**

```bash
cd worldwise && npm run build
npm run start &
sleep 3
curl -s http://localhost:3000/sitemap.xml | grep -E 'dubai-marina|downtown-dubai|palm-jumeirah|business-bay|dubai-hills|/jlt<|creek-harbour|emaar-beachfront'
kill %1
```

Expected: 8 `<url>` entries — one per area slug.

- [ ] **Step 8.3 — Commit**

```bash
git add worldwise/app/sitemap.ts
git commit -m "feat(areas): add 8 area URLs to sitemap"
```

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 9.1 — Add new `area_*` sources to the Lead source list**

In CLAUDE.md, find the line that starts with:

```
`hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other`
```

Replace it with (just adds the 8 area sources, keeps the rest exactly as is):

```
`hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other`, `area_dubai_marina`, `area_downtown_dubai`, `area_palm_jumeirah`, `area_business_bay`, `area_dubai_hills`, `area_jlt`, `area_creek_harbour`, `area_emaar_beachfront`
```

- [ ] **Step 9.2 — Add Area landing pages subsection under Architecture**

Find the subsection that ends "### SEO / crawler layer" and **before** it, insert a new subsection:

```markdown
### Area landing pages

8 flat-URL SSG pages target Dubai districts: `/dubai-marina`, `/downtown-dubai`, `/palm-jumeirah`, `/business-bay`, `/dubai-hills`, `/jlt`, `/creek-harbour`, `/emaar-beachfront`. All content (metrics, copy, FAQ) lives in `lib/areas.ts` — the single source of truth, edited via PR like `lib/articles.ts`.

Route `app/[area]/page.tsx` is a server component (handles `generateStaticParams` + `generateMetadata` + JSON-LD). It composes a client wrapper `app/[area]/AreaPageClient.tsx` that owns the `LeadModal` state. Adding a new district = adding one entry to `areas` in `lib/areas.ts` (no new route file needed) plus ensuring `public/images/areas/<slug>.jpg` exists. `generateStaticParams` whitelists `areaSlugs`; any other slug on this route returns 404.

Leads from these pages carry `source: area_<slug_underscored>` (e.g. `area_dubai_marina`). Each page emits three JSON-LD blocks: `Place`, `BreadcrumbList`, and `FAQPage`. The homepage `AreasSection` links to these flat URLs as the main internal-link hub.

When you change `Property.area` values in the admin, the featured-properties grid on the area page filters by exact-string match — keep the spelling identical to `Area.name` in `lib/areas.ts`.
```

- [ ] **Step 9.3 — Verify the doc renders correctly**

```bash
grep -n "Area landing pages\|area_dubai_marina" CLAUDE.md
```

Expected: shows both — the new section header and the lead source list including `area_dubai_marina`.

- [ ] **Step 9.4 — Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document area landing pages architecture and lead sources"
```

---

## Task 10: Final Build, Deploy, GSC

**Files:** none (operational task)

- [ ] **Step 10.1 — Final local build**

```bash
cd worldwise && npm run build
```

Expected: build passes; output shows 8 area SSG routes plus the existing routes intact.

- [ ] **Step 10.2 — Backup data on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

Expected: prints the new backup directory path.

- [ ] **Step 10.3 — Rsync to production**

```bash
rsync -avz \
  --exclude='.git' --exclude='node_modules' --exclude='.next' \
  --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' \
  --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  worldwise/ root@62.238.35.20:/var/www/worldwise/
```

- [ ] **Step 10.4 — Build and restart on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

Expected: PM2 status shows `worldwise` online.

- [ ] **Step 10.5 — Production smoke test (all 8 URLs)**

```bash
for slug in dubai-marina downtown-dubai palm-jumeirah business-bay dubai-hills jlt creek-harbour emaar-beachfront; do
  status=$(curl -sI "https://worldwise.pro/$slug" | head -1)
  canonical=$(curl -s "https://worldwise.pro/$slug" | grep -oE '<link rel="canonical"[^>]*>' | head -1)
  echo "$slug -> $status | $canonical"
done
```

Expected: every line shows `HTTP/2 200` and a canonical pointing to `https://worldwise.pro/<slug>`.

- [ ] **Step 10.6 — Verify sitemap on production**

```bash
curl -s https://worldwise.pro/sitemap.xml | grep -oE 'https://worldwise\.pro/(dubai-marina|downtown-dubai|palm-jumeirah|business-bay|dubai-hills|jlt|creek-harbour|emaar-beachfront)' | sort -u
```

Expected: prints all 8 URLs.

- [ ] **Step 10.7 — Push to remote**

```bash
git push claude main
```

- [ ] **Step 10.8 — Submit URLs to Google Search Console**

Manual step for the user (not the agent):

1. Open Google Search Console for worldwise.pro.
2. For each of the 8 area URLs, paste into the top URL Inspection bar → wait for indexing data → click "Request Indexing".
3. Submit the updated `sitemap.xml` for re-fetch in the Sitemaps section.

- [ ] **Step 10.9 — Update memory**

The plan completed; mark it in memory so future sessions know this is done.

Edit `/Users/dzhambulat/.claude/projects/-Users-dzhambulat-Documents-Claude/memory/project_area_landing_pages.md` — change the project memory body to reflect completion, or remove the file and remove its line from `MEMORY.md`. Author's call.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Scope: 8 districts | Task 1 (lib/areas.ts) |
| Flat URLs | Task 6 (`app/[area]/page.tsx`) |
| `generateStaticParams` whitelisting 8 slugs | Task 6, Step 6.1 |
| Hero with image, H1, metrics, primary CTA | Task 2 + Task 6 (`AreaHero` used inside `AreaPageClient`) |
| Why-invest paragraphs | Task 6, page composition |
| Key stats card row | Task 6, page composition (`StatCard` helper) |
| Featured properties block with empty state | Task 3 |
| What's nearby bullets | Task 6, page composition |
| FAQ accordion | Task 4 + Task 6 |
| LeadCaptureSection with per-area source | Task 5 (prop), Task 6 (usage) |
| FloatingCTA + Footer | Task 6, page composition |
| `<title>`, `metaDescription`, canonical, OG, Twitter | Task 6, `generateMetadata` |
| JSON-LD Place + BreadcrumbList + FAQPage | Task 6, page composition |
| Sitemap with 8 URLs | Task 8 |
| Homepage `AreasSection` switched to flat URLs | Task 7 |
| New lead source values documented | Task 9 |
| Architecture docs updated | Task 9 |
| Verification checklist | Task 6, Step 6.4 + Task 10 |

All spec requirements have a task.

**Placeholder scan:** No "TBD", no "implement later", no "similar to Task N" without code. The block-comment in Task 6 Step 6.1 is explicitly marked as instructive ("delete it before saving") and followed by the final file content — that is not a placeholder.

**Type consistency:**

- `Area` defined in Task 1 (`lib/areas.ts`) — fields `slug`, `name`, `heroImage`, `tagline`, `metrics`, `whyInvest`, `whatsNearby`, `faq`, `metaDescription`. Same names used in Tasks 2, 4, 6, 7.
- `AreaFaqItem` (`{ q, a }`) — used identically in Task 1, Task 4, Task 6 JSON-LD.
- `AreaMetrics` — used identically in Task 1, Task 2, Task 6.
- `getArea(slug)` — defined Task 1, used Task 6.
- `areaSlugs` — defined Task 1, used Task 6 (`generateStaticParams`) and Task 8 (sitemap).
- `LeadCaptureSection`'s new `source` prop — defined Task 5, consumed Task 6.
- Lead source string format `area_<slug_underscored>` — defined identically in Task 6 (`page.tsx` and `AreaPageClient.tsx`) and Task 9 (CLAUDE.md list).

No inconsistencies.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-area-landing-pages.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for catching mistakes early without polluting the main context with 8 areas of generated content.

**2. Inline Execution** — Execute tasks here using executing-plans, batch with checkpoints.

Which approach?
