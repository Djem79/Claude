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
  /** Used to filter the featured grid. Matching is tolerant (case-insensitive,
   *  normalized substring — see `propertyMatchesArea`), so "Dubai Hills" also
   *  catches "Dubai Hills Estate". Add `aliases` for spellings that don't share
   *  a substring (e.g. JLT ↔ "Jumeirah Lake Towers"). */
  name: string
  /** Extra free-text area spellings (from CRM/imports) that belong to this area. */
  aliases?: string[]
  /** Spellings that must NOT match this area, e.g. "Damac Hills 2" must not fall
   *  under "Damac Hills". Checked before name/aliases. */
  excludeAliases?: string[]
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
      roi: '6–7%',
      typicalSize: '650–1,400 sqft',
      handover: 'Mostly secondary; select off-plan 2026–2028',
    },
    whyInvest: [
      "Dubai Marina has been one of the city's most established investor districts for over a decade. The combination of waterfront views, walkable promenades, and direct access to Jumeirah Beach Residence keeps short-term rental occupancy among the highest in Dubai — typically 85–95% year-round.",
      "Yields remain healthy even after years of price appreciation. Studios and one-bedrooms typically return around 6–7% gross on long-term leases, with substantially more on holiday-let platforms. Larger three-bedroom units perform strongly as family residences for relocating executives, particularly those working in JLT and Media City next door.",
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
        a: 'With population growth continuing and limited new Marina supply, rental yields are expected to hold around the 6–7% range through 2027, with stronger performance on furnished and serviced units.',
      },
    ],
    metaDescription: 'Buy investment property in Dubai Marina — average AED 1,850/sqft, 6–7% rental yields. Browse current listings and get expert guidance from Worldwise Real Estate.',
  },
  {
    slug: 'downtown-dubai',
    name: 'Downtown Dubai',
    heroImage: '/images/areas/downtown-dubai.jpg',
    tagline: 'Live next to Burj Khalifa — the most prestigious address in the city.',
    metrics: {
      avgPrice: 'AED 2,200/sqft',
      roi: '5–6%',
      typicalSize: '700–1,800 sqft',
      handover: 'Mature secondary + select Emaar off-plan 2026–2027',
    },
    whyInvest: [
      "Downtown Dubai is the city's flagship district — home to Burj Khalifa, Dubai Mall, Dubai Opera and the Dubai Fountain. Capital values here have historically led the rest of the city in upcycles and held more value in correction phases, making it a foundational asset for long-term investors.",
      "The tenant pool skews towards senior executives, family offices and brand-conscious tenants who pay a premium for the address itself. That premium translates to consistently strong rental rates — one-bedroom units in The Address Residences or Burj Vista regularly secure AED 130,000–160,000 per year on long-term leases.",
      "Yields are lower than Marina (5–6% vs 6–7%) because purchase prices are higher — Downtown is more a capital-growth and liquidity play than a yield play. The combination of brand strength, scarce supply, and proximity to the city's main attractions means resale liquidity is among the best in Dubai, with properties typically transacting within 60–90 days of going to market.",
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
    metaDescription: 'Buy property in Downtown Dubai — AED 2,200/sqft average, 5–6% yields, Burj Khalifa views. Expert investment guidance from Worldwise Real Estate.',
  },
  {
    slug: 'palm-jumeirah',
    name: 'Palm Jumeirah',
    heroImage: '/images/areas/palm-jumeirah.jpg',
    tagline: "Dubai's signature waterfront island — beachfront living with global brand recognition.",
    metrics: {
      avgPrice: 'AED 2,800/sqft',
      roi: '5–6%',
      typicalSize: '800–4,500 sqft',
      handover: 'Mature secondary + premium off-plan towers 2026–2028',
    },
    whyInvest: [
      "Palm Jumeirah is one of the most recognisable real estate addresses in the world. The combination of private beach access, restricted island supply and brand association with luxury hospitality (Atlantis, One&Only, Waldorf Astoria) gives properties here a global tenant and buyer pool that very few Dubai districts can match.",
      "The market splits into three distinct segments: trunk apartments (typically AED 2.0–4.0M for one and two-bedrooms with marina or skyline views), frond villas (AED 15–50M for beachfront family homes) and ultra-luxury penthouses at branded residences (AED 40M and above). Each segment has its own demand profile but all benefit from the Palm address premium.",
      "Yields vary widely by tower and unit. Trunk apartments typically run around 5–6% on long-term leases, with substantially higher returns on short-term lets — a furnished Palm trunk apartment can generate AED 350,000+ in gross holiday-let revenue per year. Frond villas trade on capital appreciation rather than yield.",
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
      roi: '7–8%',
      typicalSize: '500–1,200 sqft',
      handover: 'Heavy off-plan pipeline 2026–2029',
    },
    whyInvest: [
      "Business Bay is Dubai's central business district, sitting on the Dubai Water Canal directly adjacent to Downtown. It combines the proximity premium of the city centre with substantially lower entry prices — typically 25–30% cheaper per square foot than Downtown itself.",
      "The combination of price point and location drives the highest gross yields in the city core: studios and one-bedrooms regularly clear 7–8% on long-term leases — ahead of Marina now that Marina prices have appreciated. Tenant demand is dominated by young professionals working in DIFC, Downtown and the canal-side hotels, who value short commutes over space.",
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
    metaDescription: 'Buy investment property in Business Bay — AED 1,600/sqft, 7–8% yields, biggest off-plan pipeline in central Dubai. Worldwise Real Estate.',
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
      "Yields sit in a solid 6–7% range, in line with established waterfront districts, but capital growth has been among the strongest in Dubai — villa prices in Sidra, Maple and Golf Place have appreciated 40–60% since 2021. Apartments in Park Heights, Mulberry and Collective offer a more accessible entry point at AED 1.5–3.5M.",
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
    aliases: ['Jumeirah Lake Towers', 'Jumeirah Lakes Towers'],
    heroImage: '/images/areas/jlt.jpg',
    tagline: 'Marina-adjacent and metro-served — the highest-yielding established district in Dubai.',
    metrics: {
      avgPrice: 'AED 1,200/sqft',
      roi: '7–8%',
      typicalSize: '500–1,400 sqft',
      handover: 'Primarily secondary; select off-plan 2026–2027',
    },
    whyInvest: [
      "Jumeirah Lake Towers (JLT) sits directly across Sheikh Zayed Road from Dubai Marina, offering many of the same advantages — metro access, lakeside promenades, dense F&B — at substantially lower entry prices. The price-per-square-foot gap to Marina has historically been 30–40%, while yields run around a point higher.",
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
    metaDescription: 'Buy property in JLT (Jumeirah Lake Towers) — AED 1,200/sqft, 7–8% yields, Metro-served alternative to Dubai Marina. Worldwise Real Estate.',
  },
  {
    slug: 'mbr-city',
    name: 'MBR City',
    aliases: ['Mohammed Bin Rashid City', 'Sobha Hartland'],
    heroImage: '/images/areas/mbr-city.jpg',
    tagline: "Canal-side central Dubai between Downtown and Meydan — the city's strongest capital-appreciation play.",
    metrics: {
      avgPrice: 'AED 2,000/sqft',
      roi: '6–7%',
      typicalSize: '700–1,500 sqft',
      handover: 'Active off-plan pipeline 2026–2028 (Sobha-led)',
    },
    whyInvest: [
      "Mohammed Bin Rashid City (MBR City) is a master-planned central district wrapped around a swimmable lagoon and the Hartland greenways, sitting minutes from Downtown, DIFC and Meydan. Its flagship community, Sobha Hartland, has become one of Dubai's most reliable capital-growth stories — apartment values are up roughly 40–70% since 2021, with District One villas appreciating even faster.",
      "The investment thesis here is appreciation first, yield second. Gross rental yields run a healthy 6–7% on Sobha Hartland apartments, supported by waterfront layouts and international-school proximity, but the bigger driver is sustained price growth as a central, low-rise, green district with finite land. Tenant demand skews towards families and executives who want Downtown access without high-rise density.",
      "Supply is developer-led and quality-controlled — Sobha builds, manages and finishes the bulk of the district, which keeps construction standards and service levels consistent. An active off-plan pipeline through 2026–2028 lets investors enter on staged payment plans and ride the handover curve as the master plan completes.",
    ],
    whatsNearby: [
      'Direct access to Al Khail Road and Ras Al Khor Road — 10 minutes to Downtown and DIFC',
      'Hartland International School and North London Collegiate School within the community',
      'Swimmable crystal lagoon and landscaped Hartland greenways',
      'Ras Al Khor Wildlife Sanctuary and the Meydan racecourse nearby',
      'Dubai International Airport reachable in around 15 minutes',
    ],
    faq: [
      {
        q: 'Is MBR City a yield play or a capital-appreciation play?',
        a: 'Primarily capital appreciation. Sobha Hartland apartments are up roughly 40–70% since 2021 while still returning a solid 6–7% gross yield — investors here typically prioritise central-Dubai price growth over pure cash flow.',
      },
      {
        q: 'Can foreigners buy property in MBR City?',
        a: 'Yes — MBR City, including Sobha Hartland and District One, is freehold, so non-UAE nationals can buy with full ownership and no local sponsor required.',
      },
      {
        q: 'Why is Sobha Hartland priced above neighbouring districts?',
        a: 'Single-developer quality control, a swimmable lagoon, low-rise green master planning and two international schools inside the community command a premium — and underpin the area’s resale liquidity and appreciation.',
      },
      {
        q: 'How central is MBR City really?',
        a: 'Very — it borders Downtown, Business Bay and Meydan, with Al Khail and Ras Al Khor roads putting DIFC and Dubai Mall about 10 minutes away and the airport around 15.',
      },
    ],
    metaDescription: 'Buy investment property in MBR City (Sobha Hartland) — AED 2,000/sqft, 6–7% yields and central-Dubai capital growth. Worldwise Real Estate.',
  },
  {
    slug: 'creek-harbour',
    name: 'Creek Harbour',
    heroImage: '/images/areas/creek-harbour.jpg',
    tagline: "Emaar's next Downtown — a master-planned waterfront city around the future Dubai Creek Tower.",
    metrics: {
      avgPrice: 'AED 1,700/sqft',
      roi: '6–7%',
      typicalSize: '600–2,200 sqft',
      handover: 'Active off-plan pipeline 2026–2030',
    },
    whyInvest: [
      "Dubai Creek Harbour is Emaar's most ambitious current masterplan: a 6 sq km waterfront city built around the planned Dubai Creek Tower, set to be the world's tallest. It's positioned as the next Downtown — same developer pedigree, similar walkable urbanism, but at earlier-cycle prices around AED 1,700/sqft against Downtown's AED 2,200+.",
      "Entry is dominated by off-plan, which suits investors who want the longest payment plans, lowest entry capital and longest runway to handover-to-rental conversion. Most launches sit on 50/50 or 60/40 plans with 1% monthly post-handover terms available on select towers.",
      "The catch is timing — much of the masterplan still has 3–5 years of construction ahead. Yields are projected at around 6–7% for completed towers (Creek Beach, Creek Edge, Address Harbour Point are now handed over and renting), but each new tower carries delivery and infrastructure-pace risk that mature districts don't have.",
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
    metaDescription: 'Buy property in Dubai Creek Harbour — Emaar masterplan, AED 1,700/sqft, 6–7% projected yields, future Dubai Creek Tower. Worldwise Real Estate.',
  },
  {
    slug: 'emaar-beachfront',
    name: 'Emaar Beachfront',
    heroImage: '/images/areas/emaar-beachfront.jpg',
    tagline: 'Private island living next to Dubai Marina — beachfront residences with global resale appeal.',
    metrics: {
      avgPrice: 'AED 2,500/sqft',
      roi: '6–7%',
      typicalSize: '700–3,500 sqft',
      handover: 'Multiple towers handing over 2026–2028',
    },
    whyInvest: [
      "Emaar Beachfront is a gated island development in Dubai Harbour, sitting between Dubai Marina and Palm Jumeirah. Every tower has direct beach access, marina views or both — the entire masterplan is designed around 1.5 km of private beach and a 1,400-berth super-yacht harbour next door.",
      "The combination of Emaar developer pedigree, private beach access and waterfront positioning gives properties here a strong global resale story. The buyer mix includes a high proportion of overseas investors from the UK, Russia, India and China who pay premium prices for the brand association — particularly on penthouses and beachfront-line apartments.",
      "Long-let yields are estimated at around 6–7% for mid-tower one and two-bedroom units, with short-term let returns substantially higher given the beach access — premium furnished units on Emaar Beachfront regularly achieve average daily rates 30–60% above comparable Marina inventory.",
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
    metaDescription: 'Buy property at Emaar Beachfront — private beach access, AED 2,500/sqft, 6–7% yields. Premium investment guidance from Worldwise Real Estate.',
  },
  {
    slug: 'damac-hills',
    name: 'Damac Hills',
    excludeAliases: ['Damac Hills 2'],
    heroImage: '/images/areas/damac-hills.jpg',
    tagline: "An established golf community of villas and apartments wrapped in parks and lagoons.",
    metrics: {
      avgPrice: 'AED 1,300/sqft',
      roi: '6–7%',
      typicalSize: '1–6 BR / 700–6,000 sqft',
      handover: 'Ready, plus select off-plan 2026–2027',
    },
    whyInvest: [
      "Damac Hills is one of Dubai's most established master communities — a green, gated district built around the Trump International Golf Club Dubai. Its mix of branded villas, townhouses and mid-rise apartments has a proven resale and rental track record, which makes it a lower-risk entry point for first-time Dubai investors.",
      "Families drive demand here. Sweeping parks, a skate park, stables, lakes and community retail keep occupancy high and tenant turnover low, supporting steady 6–7% gross yields on apartments and reliable long-term leases on villas. Green, low-density communities have consistently outperformed on tenant retention since 2021.",
      "Because the community is largely handed over, buyers can inspect real service charges, finished units and live rental data before committing — and still access off-plan inventory in newer clusters at attractive entry prices and payment plans.",
    ],
    whatsNearby: [
      'Trump International Golf Club Dubai — 18-hole championship course',
      'Carrefour and community retail inside the development',
      'Jebel Ali School and nurseries within the community',
      '~20 minutes to Mall of the Emirates via Hessa Street / Al Khail Road',
      'Dubai Hills Mall and Global Village within a 15–20 minute drive',
    ],
    faq: [
      { q: 'Is Damac Hills a freehold area?', a: 'Yes — Damac Hills is a designated freehold community, so non-UAE nationals can buy apartments, townhouses and villas with full ownership.' },
      { q: 'What returns can I expect in Damac Hills?', a: 'Apartments typically return around 6–7% gross on long-term leases; villas yield slightly less but offer stronger capital appreciation as a family-home segment.' },
      { q: 'Is Damac Hills the same as Damac Hills 2?', a: 'No. Damac Hills is the original golf-course community closer to the city; Damac Hills 2 (formerly Akoya) is a separate, more affordable community further out. We track them as distinct areas.' },
      { q: 'Is it a good area for families?', a: "Yes — low-density layout, schools, nurseries, parks and sports facilities make it one of Dubai's most family-oriented gated communities." },
    ],
    metaDescription: 'Invest in Damac Hills, Dubai — an established golf community of villas and apartments. ~AED 1,300/sqft, 6–7% yields. Browse listings with Worldwise Real Estate.',
  },
  {
    slug: 'damac-hills-2',
    name: 'Damac Hills 2',
    heroImage: '/images/areas/damac-hills-2.jpg',
    tagline: "A value-led master community built around water features, sports and green amenities.",
    metrics: {
      avgPrice: 'AED 900/sqft',
      roi: '7–9%',
      typicalSize: '1–5 BR / 600–3,500 sqft',
      handover: 'Ready, plus off-plan 2026–2027',
    },
    whyInvest: [
      "Damac Hills 2 (formerly Akoya) is one of Dubai's most affordable freehold master communities, which is exactly what makes it a strong income play. Lower entry prices push gross rental yields into the 7–9% range — among the highest for townhouse and apartment stock in Dubai.",
      "The community is themed around amenities: a wave pool and lazy river, sports fields, a paintball arena, fishing lake and extensive green spaces. That experiential, family-first positioning keeps long-term tenant demand resilient even as the wider area matures and new infrastructure arrives.",
      "It suits investors who prioritise cash flow over prestige addresses. Affordable villas and townhouses rent quickly to families priced out of central Dubai, and the developer's staged payment plans let buyers enter off-plan with modest upfront capital.",
    ],
    whatsNearby: [
      'Community sports complex, wave pool and lazy river on-site',
      'Carrefour and Spinneys community retail',
      'Jebel Ali School and several nurseries in the wider community',
      '~35 minutes to Downtown Dubai via Emirates Road',
      'Close to the Emaar South / Al Maktoum Airport growth corridor',
    ],
    faq: [
      { q: 'Why are yields higher in Damac Hills 2?', a: 'Lower purchase prices relative to rents push gross yields to roughly 7–9% — higher than most central Dubai districts, which is the main reason investors choose it.' },
      { q: 'Is Damac Hills 2 freehold?', a: 'Yes — it is a designated freehold community open to foreign buyers with full ownership.' },
      { q: 'How far is it from the city?', a: 'Around 30–40 minutes to Downtown and Dubai Marina via Emirates Road; it trades distance for affordability and amenities.' },
      { q: 'What property types are available?', a: 'Mainly townhouses and villas, plus a growing number of apartments in newer clusters — typically 1 to 5 bedrooms.' },
    ],
    metaDescription: 'Invest in Damac Hills 2 (Akoya), Dubai — affordable freehold homes with 7–9% rental yields. Browse current listings with Worldwise Real Estate.',
  },
  {
    slug: 'the-valley',
    name: 'The Valley',
    heroImage: '/images/areas/the-valley.jpg',
    tagline: "Emaar's master-planned town of townhouses and villas on the Dubai–Al Ain corridor.",
    metrics: {
      avgPrice: 'AED 1,150/sqft',
      roi: '6–7%',
      typicalSize: '3–4 BR townhouses / 2,000–3,500 sqft',
      handover: 'Off-plan, 2026–2028',
    },
    whyInvest: [
      "The Valley is one of Emaar's fastest-selling new towns — a family-focused community of townhouses and villas along the Dubai–Al Ain road. Backing from Emaar gives it the delivery credibility and resale liquidity that newer developers can't always match, which lowers off-plan risk.",
      "Its appeal is lifestyle and price. Town Centre retail, a Golden Beach, a sports village, schools and sprawling parkland target end-user families rather than speculators — the buyer base that underpins durable rental demand. Entry prices remain below comparable Emaar communities closer to the city, leaving room for capital growth as the master plan completes.",
      "For investors, the combination of Emaar payment plans, a townhouse-heavy mix and a maturing location on a key growth corridor makes The Valley a balanced off-plan hold: moderate 6–7% yields with meaningful appreciation potential through handover.",
    ],
    whatsNearby: [
      'Town Centre retail, dining and community market',
      'Golden Beach and Kids Dale play areas within the community',
      'Sports Village with cycling and running tracks',
      'Direct access to Sheikh Mohammed Bin Zayed Road (Dubai–Al Ain)',
      '~25 minutes to Downtown Dubai and Dubai International Airport',
    ],
    faq: [
      { q: 'Who develops The Valley?', a: 'The Valley is an Emaar master community, which gives buyers strong delivery and resale confidence compared with less-established developers.' },
      { q: 'Is The Valley mainly off-plan?', a: 'Yes — most inventory is off-plan with handovers through 2026–2028 on Emaar staged payment plans. Early phases are already completing.' },
      { q: 'What yields does The Valley offer?', a: 'As a townhouse-led family community it offers moderate gross yields around 6–7%, with the main upside in capital appreciation as the master plan matures.' },
      { q: 'Is The Valley freehold?', a: 'Yes — it is a freehold community open to international buyers with full ownership.' },
    ],
    metaDescription: 'Invest in The Valley by Emaar, Dubai — family townhouses and villas with 6–7% yields and strong growth potential. Browse listings with Worldwise Real Estate.',
  },
]

export const areaSlugs = areas.map(a => a.slug)

export function getArea(slug: string): Area | undefined {
  return areas.find(a => a.slug === slug)
}

function normalizeArea(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Whether a property's free-text `area` belongs to a given area page.
 * Property.area comes from CRM/imports as free text ("Dubai Hills Estate",
 * "DUBAI HILLS ESTATE", "Jumeirah Lake Towers"), so an exact match drops
 * obvious variants. Match case-insensitively on WORD BOUNDARIES — so multi-word
 * names like "Dubai Hills" still match "Dubai Hills Estate", but a short name like
 * "JLT" matches "JLT Cluster D" without false-positiving on "jltower" / substrings
 * inside an unrelated word (audit M5).
 */
export function propertyMatchesArea(propertyArea: string | undefined, area: Area): boolean {
  if (!propertyArea) return false
  const normalized = normalizeArea(propertyArea)
  const hit = (name: string): boolean => {
    const candidate = normalizeArea(name)
    if (!candidate) return false
    const re = new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return re.test(normalized)
  }
  if ((area.excludeAliases ?? []).some(hit)) return false
  return [area.name, ...(area.aliases ?? [])].some(hit)
}
