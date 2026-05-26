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
        a: "Generally lower than Marina — AED 12–18/sqft per year for most towers, which combined with lower purchase prices is the main driver of JLT’s yield premium.",
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
