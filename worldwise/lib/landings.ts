import type { Property } from '@/types'

export type LandingSection = {
  h2: string
  /** Paragraphs separated by blank lines, or a single block. */
  body: string
  /** Optional comparison table: first row = headers, rest = data rows. */
  table?: string[][]
}

export type LandingFaqItem = {
  q: string
  a: string
}

export type LandingPropertyFilter = {
  /** Match p.type exactly. Omit to include all types. */
  type?: Property['type']
  /** Case-insensitive substring match on p.area. Omit to include all areas. */
  area?: string
  /** Inclusive upper bound on p.priceAed. Omit for no cap. */
  maxPriceAed?: number
}

export type Landing = {
  slug: string
  h1: string
  metaTitle: string
  metaDescription: string
  /** One or two sentences shown directly below the H1. */
  intro: string
  sections: LandingSection[]
  faq: LandingFaqItem[]
  propertyFilter: LandingPropertyFilter
  /** Heading shown above the property grid (e.g. "Featured apartments in Dubai"). */
  gridHeading: string
  /** Source string saved with the lead (CRM analytics). */
  leadSource: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const landings: Landing[] = [
  {
    slug: 'buy-apartment-in-dubai',
    h1: 'Buy an Apartment in Dubai',
    metaTitle: 'Buy an Apartment in Dubai: 2026 Buyer\'s Guide',
    metaDescription:
      'Complete guide to buying an apartment in Dubai in 2026. Freehold ownership for foreigners, price ranges, process, fees, mortgages, and visa eligibility. Talk to a licensed advisor.',
    intro:
      'Dubai\'s freehold apartment market is open to international buyers — no residency required. ' +
      'This guide covers everything you need to know before you buy, from choosing a community to ' +
      'completing the DLD transfer.',

    sections: [
      {
        h2: 'Can Foreigners Buy an Apartment in Dubai?',
        body:
          'Yes. The UAE government designated freehold zones across Dubai in 2002, allowing non-residents ' +
          'and foreigners of any nationality to purchase real property with full ownership rights. ' +
          'You do not need UAE residency to buy, and there is no restriction on repatriating rental ' +
          'income or sale proceeds.\n\n' +
          'Popular freehold communities include Dubai Marina, Downtown Dubai, Palm Jumeirah, ' +
          'Business Bay, Dubai Hills, and Jumeirah Lake Towers — all areas where Worldwise maintains ' +
          'an active portfolio of listings.',
      },
      {
        h2: 'How Much Does an Apartment in Dubai Cost?',
        body:
          'Entry prices vary widely by district, size, and finish. Studios in emerging communities ' +
          'start from around AED 400,000, while one-bedroom apartments in established waterfront ' +
          'districts typically range from AED 900,000 to AED 2,500,000. Prime penthouses in ' +
          'Downtown Dubai or Palm Jumeirah reach AED 20,000,000 and above.\n\n' +
          'Off-plan projects from Emaar, Damac, Nakheel, and Sobha often carry 40–80% post-handover ' +
          'payment plans, reducing the upfront capital requirement significantly.',
        table: [
          ['Community', 'Typical price range', 'Avg. yield'],
          ['Dubai Marina', 'AED 900K – AED 3M', '6–7%'],
          ['Downtown Dubai', 'AED 1.2M – AED 5M', '5–6%'],
          ['Business Bay', 'AED 700K – AED 2.5M', '6–7%'],
          ['Dubai Hills', 'AED 800K – AED 2.8M', '6–8%'],
          ['Palm Jumeirah', 'AED 2M – AED 15M+', '5–6%'],
          ['JLT', 'AED 550K – AED 1.8M', '7–8%'],
        ],
      },
      {
        h2: 'The Buying Process Step by Step',
        body:
          'The Dubai property purchase is straightforward once you know the sequence:\n\n' +
          '1. Reserve — sign a Reservation Form and pay a booking deposit (typically 5–10% for ready ' +
          'properties, 5–20% for off-plan).\n\n' +
          '2. Sales & Purchase Agreement (SPA) — the SPA is signed by both parties and witnessed. ' +
          'For secondary-market transactions, a Memorandum of Understanding (MOU/Form F) precedes the SPA.\n\n' +
          '3. No-Objection Certificate (NOC) — the seller obtains an NOC from the developer confirming ' +
          'no outstanding service charges.\n\n' +
          '4. DLD Transfer — buyer and seller (or their representatives with a Power of Attorney) attend ' +
          'the Dubai Land Department. The DLD collects the 4% transfer fee and issues the new Title Deed ' +
          'in the buyer\'s name on the same day.\n\n' +
          'The entire process from reservation to Title Deed typically takes 4–8 weeks for secondary ' +
          'properties and is managed by the developer for off-plan purchases.',
      },
      {
        h2: 'Fees and Costs of Buying',
        body:
          'Budget for the following transaction costs on top of the purchase price:',
        table: [
          ['Cost', 'Rate', 'Payable by'],
          ['DLD transfer fee', '4% of purchase price', 'Buyer'],
          ['DLD admin fee', 'AED 540 (apartment)', 'Buyer'],
          ['Agency commission', '~2% of purchase price', 'Buyer'],
          ['Mortgage registration fee', '0.25% of loan amount', 'Buyer (if financing)'],
          ['NOC fee', 'AED 500 – AED 5,000', 'Seller (passed on in negotiation)'],
          ['Title Deed issuance', 'AED 250', 'Buyer'],
        ],
      },
      {
        h2: 'Mortgage Options for International Buyers',
        body:
          'Non-residents can obtain mortgages in Dubai from major local banks including Emirates NBD, ' +
          'ADCB, Mashreq, and HSBC UAE. The standard maximum loan-to-value (LTV) for non-residents is ' +
          '75% for properties priced under AED 5M, meaning a 25% down payment is required.\n\n' +
          'UAE residents (with a valid visa and salary certificate) typically qualify for up to 80% LTV. ' +
          'Interest rates in 2026 are broadly in the 4.5–6% per annum range depending on the bank, ' +
          'term, and whether you choose a fixed or variable rate.\n\n' +
          'Off-plan properties are generally not eligible for mortgage drawdown until handover, though ' +
          'some banks offer off-plan mortgage products from certain developers. Developer payment plans ' +
          'are often a more attractive alternative to a mortgage for off-plan buyers.',
      },
      {
        h2: 'Rental Yields and Investment Returns',
        body:
          'Dubai apartments generate gross rental yields averaging 6–8% per annum, which is ' +
          'significantly higher than comparable freehold cities such as London (3–4%), Paris (3–4%), ' +
          'or Singapore (2–3%). There is no annual property tax and no capital gains tax in Dubai, ' +
          'so net yields are substantially higher than in most other markets.\n\n' +
          'Short-term (holiday home) rentals via Airbnb and Booking.com are legal and widely used ' +
          'in communities like Dubai Marina, Downtown, and JBR, where furnished apartments can yield ' +
          '10–14% gross depending on occupancy.',
      },
      {
        h2: 'Does Buying an Apartment Qualify You for Residency?',
        body:
          'Yes — Dubai property ownership is linked to two UAE investor visa categories:\n\n' +
          '- AED 750,000 minimum property value: qualifies for a 2-year UAE Investor Visa, ' +
          'renewable while the property is held.\n\n' +
          '- AED 2,000,000 minimum property value: qualifies for the 10-year UAE Golden Visa ' +
          '(also known as the long-term residency visa). The property must be fully paid — ' +
          'mortgaged properties count toward the threshold only up to the equity held.\n\n' +
          'Both visas allow the holder to sponsor immediate family members (spouse and children). ' +
          'The Golden Visa additionally permits the holder to stay outside the UAE for up to ' +
          '6 consecutive months without the visa becoming inactive.',
      },
    ],

    faq: [
      {
        q: 'Can foreigners buy an apartment in Dubai?',
        a: 'Yes. Non-residents and foreigners of any nationality can purchase freehold property in designated zones across Dubai, with full ownership rights. No UAE residency is required to buy.',
      },
      {
        q: 'What is the minimum budget to buy an apartment in Dubai?',
        a: 'Entry-level studios in emerging areas start from around AED 400,000 (approximately USD 109,000). One-bedroom apartments in established districts typically begin from AED 800,000–900,000. The minimum to qualify for a UAE investor visa is AED 750,000; for the 10-year Golden Visa, AED 2,000,000.',
      },
      {
        q: 'What fees apply when buying an apartment in Dubai?',
        a: 'The main costs are: Dubai Land Department (DLD) transfer fee of 4% of the purchase price, agency commission of approximately 2%, a DLD admin fee of AED 540, and Title Deed issuance of AED 250. If financing, add 0.25% mortgage registration fee on the loan amount. Total transaction costs are typically 6–7% of the purchase price.',
      },
      {
        q: 'Can I get a mortgage as a non-resident buying in Dubai?',
        a: 'Yes. Several UAE banks — including Emirates NBD, ADCB, Mashreq, and HSBC UAE — offer mortgages to non-residents. The maximum loan-to-value for non-residents is typically 75%, so a minimum 25% cash deposit is required. Interest rates in 2026 range from approximately 4.5% to 6% per annum.',
      },
      {
        q: 'Does buying an apartment in Dubai qualify me for residency?',
        a: 'Yes. Purchasing a property valued at AED 750,000 or above qualifies you for a 2-year UAE Investor Visa. A purchase of AED 2,000,000 or above (in a fully paid property) qualifies for the 10-year UAE Golden Visa, which also covers your spouse and children.',
      },
    ],

    propertyFilter: {
      type: 'apartment',
    },
    gridHeading: 'Featured Apartments in Dubai',
    leadSource: 'landing_buy_apartment_in_dubai',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const landingSlugs = landings.map(l => l.slug)

export function getLanding(slug: string): Landing | undefined {
  return landings.find(l => l.slug === slug)
}

/**
 * Pure filter — no fs or Next imports.
 * Returns up to 6 properties matching the landing's propertyFilter.
 */
export function propertiesForLanding(
  landing: Landing,
  properties: Property[],
): Property[] {
  const { type, area, maxPriceAed } = landing.propertyFilter
  const filtered = properties.filter(p => {
    if (type && p.type !== type) return false
    if (area && !p.area.toLowerCase().includes(area.toLowerCase())) return false
    if (maxPriceAed != null && p.priceAed > maxPriceAed) return false
    return true
  })
  return filtered.slice(0, 6)
}
