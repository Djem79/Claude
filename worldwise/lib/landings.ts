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
          ['Dubai Marina', 'AED 900K – AED 3M', '5.5–6.5%'],
          ['Downtown Dubai', 'AED 1.2M – AED 5M', '5–6%'],
          ['Business Bay', 'AED 700K – AED 2.5M', '6–7%'],
          ['Dubai Hills', 'AED 800K – AED 2.8M', '5.5–6.5%'],
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

  // ---------------------------------------------------------------------------
  // buy-villa-in-dubai
  // ---------------------------------------------------------------------------
  {
    slug: 'buy-villa-in-dubai',
    h1: 'Buy a Villa in Dubai',
    metaTitle: 'Buy a Villa in Dubai: 2026 Buyer\'s Guide',
    metaDescription:
      'Complete guide to buying a villa in Dubai in 2026. Freehold communities, price ranges, gross yields, family lifestyle, Golden Visa eligibility, off-plan vs ready. Speak to a licensed advisor.',
    intro:
      'Dubai\'s freehold villa market offers international buyers direct access to spacious family ' +
      'homes in master-planned communities — with no annual property tax and a clear path to a ' +
      '10-year UAE Golden Visa. This guide covers the key communities, price ranges, and the buying process.',

    sections: [
      {
        h2: 'Freehold Villa Communities in Dubai',
        body:
          'Since the 2002 freehold legislation, non-residents and foreign nationals can purchase villas ' +
          'in designated zones with full title deed ownership. Dubai\'s leading freehold villa communities ' +
          'span a wide range of price points and lifestyle profiles:\n\n' +
          'Dubai Hills Estate — Emaar\'s flagship master plan, with villa plots and completed homes ' +
          'surrounding a championship golf course. Strong capital appreciation track record and high ' +
          'connectivity via Al Khail Road.\n\n' +
          'Palm Jumeirah — signature frond villas on reclaimed land, with private beach access and ' +
          'some of the highest per-square-foot prices in the emirate.\n\n' +
          'Damac Hills and Damac Hills 2 — two large-scale communities from Damac Properties, ' +
          'ranging from townhouses to standalone villas. Damac Hills 2 (formerly Akoya Oxygen) ' +
          'offers more affordable entry points and a green, low-density environment.\n\n' +
          'The Valley — Emaar\'s family-focused community along Dubai–Al Ain Road, with a range of ' +
          'townhouse and villa clusters at accessible price points for first-time villa buyers.\n\n' +
          'Arabian Ranches — Emaar\'s established community that set the benchmark for villa living ' +
          'in Dubai; Arabian Ranches 3 is the current off-plan phase.\n\n' +
          'Tilal Al Ghaf — Majid Al Futtaim\'s lakeside community in Hessa Street, one of the ' +
          'most sought-after recent launches, with lagoon access and strong resale demand.',
      },
      {
        h2: 'Villa Price Ranges and Rental Yields by Community',
        body:
          'Villa prices vary considerably by community, plot size, bedrooms, and view. Gross rental ' +
          'yields on villas are typically 4–6% per annum — somewhat lower than apartments because ' +
          'entry prices are higher and long-term tenants negotiate harder on rent. However, the ' +
          'capital appreciation potential in master-planned communities has historically been strong.',
        table: [
          ['Community', 'Typical price range', 'Avg. gross yield'],
          ['Dubai Hills Estate', 'AED 3.5M – AED 15M+', '4–5%'],
          ['Palm Jumeirah', 'AED 12M – AED 60M+', '4–5%'],
          ['Damac Hills', 'AED 2.5M – AED 8M', '5–6%'],
          ['Damac Hills 2', 'AED 1.4M – AED 4M', '5–6%'],
          ['The Valley', 'AED 2M – AED 5M', '5–6%'],
          ['Arabian Ranches', 'AED 3M – AED 10M', '4–5%'],
          ['Tilal Al Ghaf', 'AED 4M – AED 18M', '4–5%'],
        ],
      },
      {
        h2: 'Off-Plan Villas vs Ready Properties',
        body:
          'Both off-plan and secondary-market villas are available in most freehold communities.\n\n' +
          'Off-plan advantages: developers typically offer structured payment plans (40/60, 50/50, or ' +
          '1% monthly), lower entry prices than comparable ready units, and the option to customise ' +
          'finishes. Handover timelines are usually 2–4 years from launch. Off-plan villas are generally ' +
          'not mortgageable until the property is ready and a title deed is issued.\n\n' +
          'Ready property advantages: immediate rental income, mortgage financing available from day one, ' +
          'and the ability to inspect the exact unit. Secondary-market transactions go through the standard ' +
          'DLD transfer process with a Memorandum of Understanding (MOU), NOC from the developer, and ' +
          'title deed transfer — typically completed in 4–8 weeks.\n\n' +
          'Which to choose depends on your horizon. Investors seeking rental income from the start, ' +
          'or buyers who want to move in promptly, will favour ready properties. Buyers with a longer ' +
          'horizon who want to maximise capital appreciation at a competitive entry price often prefer off-plan.',
      },
      {
        h2: 'Buying Process and Fees',
        body:
          'The buying process for a villa mirrors the apartment process with one important difference: ' +
          'for a villa with a plot, DLD charges a higher admin fee (AED 580 rather than AED 540 for ' +
          'an apartment). The core costs remain the same:\n\n' +
          '1. Reservation and deposit (5–10% for secondary, 5–20% for off-plan).\n\n' +
          '2. MOU/SPA signing.\n\n' +
          '3. NOC from the developer (confirming no outstanding service charges).\n\n' +
          '4. DLD transfer: 4% transfer fee + admin fee + Title Deed issuance (AED 250). ' +
          'Agency commission is typically 2%. If financing, add 0.25% mortgage registration fee.\n\n' +
          'Total transaction costs are typically 6–7% of the purchase price, the same as for apartments.',
      },
      {
        h2: 'UAE Golden Visa Through Villa Ownership',
        body:
          'Most freehold villas in Dubai — particularly in the communities listed above — are priced ' +
          'above AED 2,000,000, which is the threshold for the 10-year UAE Golden Visa. The property ' +
          'must be fully paid (not under a payment plan) at the time of the visa application, or the ' +
          'equity held must meet the AED 2M threshold in the case of a mortgaged property.\n\n' +
          'The Golden Visa covers the holder\'s spouse and children and permits absences from the UAE ' +
          'of up to 6 consecutive months without the visa lapsing. It is renewable indefinitely while ' +
          'the qualifying property is held. Buyers purchasing for the first time who meet the threshold ' +
          'with a single villa effectively unlock long-term UAE residency as part of the transaction.',
      },
      {
        h2: 'Financing a Villa Purchase',
        body:
          'Non-resident buyers can access mortgage financing for ready villas through UAE banks ' +
          'including Emirates NBD, ADCB, Mashreq, and HSBC UAE. The maximum loan-to-value for ' +
          'non-residents is 75%, requiring a minimum 25% cash deposit on the purchase price. ' +
          'UAE residents qualify for up to 80% LTV.\n\n' +
          'Given that most freehold villas exceed AED 2M, non-resident buyers should budget for a ' +
          'deposit of AED 500,000 or more, plus 6–7% in transaction costs. Interest rates in 2026 ' +
          'are broadly in the 4.5–6% per annum range. A mortgage pre-approval is advisable before ' +
          'making an offer, as it strengthens negotiating position and shortens the time to close.',
      },
    ],

    faq: [
      {
        q: 'Can foreigners buy a villa in Dubai?',
        a: 'Yes. Non-residents and foreign nationals of any nationality can purchase freehold villas in designated zones, including Dubai Hills Estate, Palm Jumeirah, Damac Hills, The Valley, Arabian Ranches, and Tilal Al Ghaf. Full ownership rights with a UAE title deed are granted to the buyer.',
      },
      {
        q: 'What are the best villa communities in Dubai for investment?',
        a: 'Dubai Hills Estate and Damac Hills 2 consistently attract investor interest for their balance of price and yield. Palm Jumeirah commands the highest prices and strongest brand recognition globally. The Valley and Arabian Ranches offer family-oriented environments at relatively accessible entry points. The best community depends on your budget, yield target, and lifestyle preferences.',
      },
      {
        q: 'What is the typical price range for a villa in Dubai?',
        a: 'Entry-level townhouses and compact villas in communities such as Damac Hills 2 and The Valley start from around AED 1.4M–2M. Mid-range 3–4 bedroom villas in Dubai Hills Estate or Damac Hills typically range from AED 3.5M–8M. Prime frond villas on Palm Jumeirah begin at AED 12M and can exceed AED 60M for signature waterfront properties.',
      },
      {
        q: 'What is the difference between freehold and leasehold in Dubai?',
        a: 'Freehold means you own the property and the land outright in perpetuity — you can sell, lease, or mortgage it at will. Leasehold means you hold the right to use the property for a fixed term (often 99 years) but do not own the underlying land. All the major villa communities in Dubai (Dubai Hills, Palm Jumeirah, Damac Hills, Arabian Ranches, Tilal Al Ghaf) are freehold zones. Non-residents can only purchase in freehold zones.',
      },
      {
        q: 'Does buying a villa in Dubai qualify me for the Golden Visa?',
        a: 'Yes, provided the villa is valued at AED 2,000,000 or above and is fully paid at the time of visa application. Most freehold villas in Dubai\'s established communities exceed this threshold. The 10-year UAE Golden Visa covers your spouse and children and is renewable indefinitely while the property is held. For off-plan purchases, the visa can generally only be applied for once the property is ready and the title deed is issued.',
      },
    ],

    propertyFilter: {
      type: 'villa',
    },
    gridHeading: 'Featured Villas in Dubai',
    leadSource: 'landing_buy_villa_in_dubai',
  },

  // ---------------------------------------------------------------------------
  // dubai-off-plan-payment-plans
  // ---------------------------------------------------------------------------
  {
    slug: 'dubai-off-plan-payment-plans',
    h1: 'Dubai Off-Plan Payment Plans Explained',
    metaTitle: 'Dubai Off-Plan Payment Plans Explained (2026)',
    metaDescription:
      'Understand every off-plan payment plan structure used in Dubai in 2026: 40/60, 50/50, 60/40, 80/20, 1% monthly, and post-handover plans. RERA escrow protection, pros, cons, and how to choose.',
    intro:
      'Off-plan payment plans are the primary financing tool for buyers in Dubai\'s new-launch market. ' +
      'Instead of a mortgage, you pay the developer in instalments linked to construction milestones — ' +
      'typically spreading the cost over 2–4 years. This guide explains every major structure and ' +
      'how to evaluate them.',

    sections: [
      {
        h2: 'How Off-Plan Payment Plans Work',
        body:
          'When you purchase a property before it is built (off-plan), the developer collects the ' +
          'purchase price in stages rather than at once. Payments are usually tied to either ' +
          'construction milestones (the slab is poured, the shell is complete, handover) or a ' +
          'fixed calendar (1% per month regardless of progress). Some plans extend payments beyond ' +
          'handover — allowing you to move in or rent out the property while still paying the ' +
          'remaining balance to the developer.\n\n' +
          'For most buyers, an off-plan payment plan replaces the need for a mortgage during construction. ' +
          'Banks typically do not disburse a mortgage on an off-plan unit until the property is ready ' +
          'and a title deed is issued. If you intend to finance with a mortgage at handover, you will ' +
          'need to arrange the mortgage at that point; the developer payment plan covers the period before.',
      },
      {
        h2: 'Common Payment Plan Structures',
        body:
          'Dubai developers use several standard structures. The split figures (e.g. 40/60) refer to ' +
          'the percentage of the purchase price paid during construction versus at or after handover.',
        table: [
          ['Structure', 'What it means', 'Who it suits', 'Key consideration'],
          ['40/60', '40% during construction; 60% at handover', 'Buyers who plan to finance at handover via mortgage', 'Requires a mortgage or large lump sum at handover'],
          ['50/50', '50% during construction; 50% at handover', 'Balanced buyers — reduces exposure at handover vs 40/60', 'Popular with owner-occupiers who want a manageable handover payment'],
          ['60/40', '60% during construction; 40% at handover', 'Buyers who prefer smaller residual at handover', 'More cash tied up during construction; lower financing need at end'],
          ['80/20', '80% during construction; 20% at handover', 'Cash-rich buyers or those who want minimal handover obligation', 'Highest capital outlay before receiving the keys'],
          ['1% monthly', '~1% of purchase price per month; no single large milestone', 'Buyers who want a simple, predictable monthly payment', 'Typically 24–48 months; easy to budget; some plans extend post-handover'],
          ['Post-handover', 'A portion (often 30–50%) paid over 2–5 years after keys are received', 'Investors who want to generate rental income to cover instalments', 'Developer carries more risk; usually on select projects; read the SPA carefully'],
        ],
      },
      {
        h2: 'RERA Escrow Protection',
        body:
          'The Real Estate Regulatory Agency (RERA), the regulatory arm of the Dubai Land Department, ' +
          'requires all off-plan developers to hold buyer payments in a dedicated escrow account for ' +
          'each project. Funds in the escrow account can only be released to the developer in stages, ' +
          'proportional to verified construction progress. A registered escrow trustee — an independent ' +
          'financial institution approved by RERA — oversees the account and confirms milestone completion ' +
          'before releasing funds.\n\n' +
          'This means your instalments are not sitting in the developer\'s general operating account — ' +
          'they are ring-fenced for construction of the specific building you are buying into. If a ' +
          'developer defaults or a project is cancelled, RERA coordinates the refund of escrow funds ' +
          'to buyers. When evaluating any off-plan purchase, verify that the project is RERA-registered ' +
          'and has an active escrow account (the developer is required to provide the escrow account ' +
          'number in the SPA).',
      },
      {
        h2: 'Off-Plan vs Mortgage Financing',
        body:
          'Off-plan payment plans and mortgages serve different purposes and are often used together ' +
          'in sequence rather than as alternatives:\n\n' +
          'During construction: the payment plan is your financing mechanism. You pay the developer ' +
          'in instalments. No UAE bank mortgage is active at this stage (with rare exceptions from ' +
          'certain banks on projects by their developer partners).\n\n' +
          'At handover: if the plan requires a final lump sum (e.g. the 60% in a 40/60 plan), many ' +
          'buyers arrange a UAE mortgage at this point. Non-residents qualify for up to 75% LTV; ' +
          'UAE residents up to 80%. The mortgage is registered with the DLD at 0.25% of the loan ' +
          'amount. If the post-handover amount is small enough to pay in cash, some buyers skip the ' +
          'mortgage entirely.\n\n' +
          'For buyers using post-handover plans, rental income from the completed unit can help service ' +
          'the ongoing developer instalments, reducing the net cash requirement during the payoff period.',
      },
      {
        h2: 'How to Choose the Right Plan',
        body:
          'The best payment plan depends on three variables: your available cash flow, your exit ' +
          'or hold strategy, and the developer\'s track record.\n\n' +
          'If you plan to mortgage at handover: a 40/60 or 50/50 plan minimises capital tied up ' +
          'during construction. Arrange your mortgage pre-approval 6–12 months before the expected ' +
          'handover date.\n\n' +
          'If you are buying purely in cash: a 60/40 or 80/20 plan — or a 1% monthly plan that ' +
          'completes by handover — keeps things simple with no post-handover obligation.\n\n' +
          'If you are an investor seeking rental income to fund remaining payments: a post-handover ' +
          'plan can work well, but study the plan terms carefully. Some post-handover plans carry ' +
          'penalty clauses for late payment that can offset the income benefit.\n\n' +
          'In all cases, read the Sales and Purchase Agreement (SPA) in full. The SPA is the binding ' +
          'document — it governs payment schedules, handover timelines, penalty clauses, and dispute ' +
          'resolution. A licensed property advisor can help you compare plan structures across projects ' +
          'before you commit.',
      },
    ],

    faq: [
      {
        q: 'What is an off-plan payment plan in Dubai?',
        a: 'An off-plan payment plan is an instalment schedule set by the developer, allowing you to pay the purchase price in stages over the construction period rather than in full upfront. Payments are typically tied to construction milestones or a monthly calendar. Because UAE banks generally do not mortgage unbuilt properties, payment plans are the primary financing tool for off-plan buyers.',
      },
      {
        q: 'Which off-plan payment plan structure is best?',
        a: 'There is no universally best structure — it depends on your cash flow and strategy. Buyers who intend to arrange a bank mortgage at handover often prefer 40/60 or 50/50 plans (lower construction-phase outlay). Cash buyers who want no residual at handover may prefer 80/20 or 1% monthly plans that complete by handover. Investors who want rental income to fund remaining payments may consider post-handover plans, provided the project and developer are credible.',
      },
      {
        q: 'Is off-plan property in Dubai safe to buy?',
        a: 'RERA requires all off-plan developers to hold buyer payments in a ring-fenced escrow account per project, released to the developer only upon verified construction milestones. This substantially reduces the risk compared to unregulated markets. Additional protection comes from ensuring the developer is RERA-registered, the project has an active escrow account, and the SPA is reviewed before signing. Working with a licensed broker who can verify the developer\'s track record adds another layer of diligence.',
      },
      {
        q: 'Can I get a mortgage on an off-plan property in Dubai?',
        a: 'Generally, UAE banks do not mortgage off-plan units during construction. The mortgage is arranged at or near handover, once the property is complete and a title deed can be issued. Some banks offer off-plan mortgage products in partnership with specific developers, but these are exceptions. The standard approach is to use the developer payment plan during construction and convert to a mortgage at handover if needed — non-residents qualify for up to 75% LTV, UAE residents up to 80%.',
      },
      {
        q: 'What is a post-handover payment plan?',
        a: 'A post-handover payment plan allows you to continue paying a portion of the purchase price — typically 30–50% — after you receive the keys, spread over 2–5 years. This means you can move into or rent out the property while still making payments to the developer. Post-handover plans are offered by some developers on select projects; they are typically priced at a premium compared to standard construction-phase-only plans. Verify the penalty structure for late payments before committing.',
      },
    ],

    propertyFilter: {},
    gridHeading: 'Featured Off-Plan Properties',
    leadSource: 'landing_dubai_off_plan_payment_plans',
  },

  // ---------------------------------------------------------------------------
  // dubai-mortgage-for-non-residents
  // ---------------------------------------------------------------------------
  {
    slug: 'dubai-mortgage-for-non-residents',
    h1: 'Dubai Mortgage for Non-Residents',
    metaTitle: 'Dubai Mortgage for Non-Residents (2026 Guide)',
    metaDescription:
      'Full guide to getting a Dubai mortgage as a non-resident in 2026. Eligibility, LTV limits, deposit, interest rates, required documents, banks, and the mortgage registration fee. Talk to an advisor.',
    intro:
      'Non-residents can obtain a mortgage in Dubai from several UAE banks and are subject to a ' +
      '75% maximum loan-to-value — meaning a minimum 25% cash deposit on the purchase price. ' +
      'This guide covers eligibility, rates, documentation, and how to navigate the process from abroad.',

    sections: [
      {
        h2: 'Can Non-Residents Get a Mortgage in Dubai?',
        body:
          'Yes. UAE law does not restrict mortgage lending to residents. Several major banks — including ' +
          'Emirates NBD, ADCB, Mashreq, and HSBC UAE — actively offer mortgage products to non-resident ' +
          'foreign nationals purchasing in Dubai\'s freehold zones. The key difference versus UAE residents ' +
          'is the loan-to-value limit: non-residents are capped at 75% LTV, compared to 80% for residents.\n\n' +
          'In practice, this means a non-resident buying a property at AED 2,000,000 can borrow up to ' +
          'AED 1,500,000 and must provide at least AED 500,000 (25%) as a cash deposit, plus transaction ' +
          'costs (approximately 6–7% of the purchase price).',
      },
      {
        h2: 'Loan-to-Value Limits by Buyer Type',
        body:
          'The Central Bank of the UAE sets maximum LTV ratios that all licensed banks must observe. ' +
          'These apply to the first property purchase and vary by buyer residency status and property price.',
        table: [
          ['Buyer type', 'Max LTV (property ≤ AED 5M)', 'Min deposit'],
          ['UAE resident (salary/employed)', '80%', '20% of purchase price'],
          ['UAE resident (self-employed)', '65–75%', '25–35% of purchase price'],
          ['Non-resident (any employment type)', '75%', '25% of purchase price'],
        ],
      },
      {
        h2: 'Interest Rates and Loan Terms',
        body:
          'Mortgage rates in Dubai in 2026 are broadly in the 4.5–6% per annum range, depending on ' +
          'the bank, the loan term, and whether you choose a fixed or variable rate product.\n\n' +
          'Fixed-rate mortgages — typically 1, 3, or 5 years fixed, then reverting to a variable ' +
          'rate — give certainty on monthly payments during the fixed period. Variable-rate mortgages ' +
          'are priced at a margin over EIBOR (the Emirates Interbank Offered Rate) and move with ' +
          'market rates.\n\n' +
          'Maximum mortgage terms are typically 25 years for non-residents, and the loan must be ' +
          'repaid by age 65–70 (depending on the bank). For non-residents who are employees, banks ' +
          'will normally lend against income documented in any major currency. For self-employed ' +
          'non-residents, underwriting is more conservative and typically requires 2 years of audited ' +
          'financial statements.',
      },
      {
        h2: 'Required Documents for Non-Resident Mortgage Applications',
        body:
          'While each bank has slightly different requirements, the standard document pack for a ' +
          'non-resident mortgage application typically includes:\n\n' +
          '- Valid passport (all pages)\n\n' +
          '- Last 6 months\' personal bank statements (showing salary credits or business income)\n\n' +
          '- Salary certificate or employment contract (for employed applicants)\n\n' +
          '- Last 2 years\' audited accounts or tax returns (for self-employed applicants)\n\n' +
          '- Credit report from your home country (some banks require it; others run their own ' +
          'international credit checks)\n\n' +
          '- Details of the property being purchased (title deed or developer SPA for off-plan)\n\n' +
          'Applications can usually be submitted to the bank remotely; however, signing the mortgage ' +
          'agreement typically requires the buyer to be present in the UAE or to use a Power of ' +
          'Attorney signed before a UAE-accredited notary in the buyer\'s home country.',
      },
      {
        h2: 'Banks Offering Non-Resident Mortgages in Dubai',
        body:
          'The following banks are among those that offer mortgage products to non-resident buyers ' +
          'in Dubai\'s freehold market. Each has different appetite, rate structures, and application ' +
          'processes — it is worth comparing offers across at least two banks before deciding.\n\n' +
          'Emirates NBD — the UAE\'s largest bank by assets; competitive rates and a dedicated ' +
          'home finance team.\n\n' +
          'ADCB (Abu Dhabi Commercial Bank) — strong track record with international buyers; ' +
          'offers fixed-rate periods of up to 5 years.\n\n' +
          'Mashreq Bank — known for a faster approval process; good option for buyers who need ' +
          'to move quickly.\n\n' +
          'HSBC UAE — well-suited to internationally mobile buyers who already bank with HSBC ' +
          'globally; pre-existing relationship may streamline underwriting.\n\n' +
          'A licensed mortgage broker can submit your application to multiple banks simultaneously ' +
          'and negotiate rates on your behalf, which is often more efficient than applying directly.',
      },
      {
        h2: 'Mortgage Registration Fee and Total Costs',
        body:
          'In addition to the standard DLD transfer fee of 4% of the purchase price, mortgaged ' +
          'buyers pay a mortgage registration fee of 0.25% of the loan amount, payable to the DLD ' +
          'at the time of transfer. This fee is capped at AED 10,000.\n\n' +
          'For a non-resident buying at AED 2,000,000 with a 75% LTV mortgage (AED 1,500,000 loan):\n\n' +
          '- DLD transfer fee: AED 80,000 (4%)\n\n' +
          '- DLD admin fee: AED 540 (apartment) / AED 580 (villa)\n\n' +
          '- Mortgage registration fee: AED 3,750 (0.25% of AED 1,500,000)\n\n' +
          '- Agency commission: approximately AED 40,000 (2%)\n\n' +
          '- Title Deed: AED 250\n\n' +
          'Total transaction costs: approximately AED 124,540 — roughly 6.2% of the purchase price. ' +
          'Some banks also charge a processing or arrangement fee (typically AED 2,500–AED 10,000) ' +
          'for the mortgage itself.',
      },
      {
        h2: 'Bank Financing vs Developer Payment Plans',
        body:
          'For ready (secondary market) properties, a bank mortgage is typically the only structured ' +
          'financing option available. For off-plan properties, developer payment plans are an ' +
          'alternative that requires no bank involvement during the construction period — the buyer ' +
          'pays the developer in stages, and may optionally arrange a bank mortgage at handover to ' +
          'fund the remaining balance.\n\n' +
          'Developer payment plans on competitive launches often offer 40/60 or even post-handover ' +
          'structures, which can be more flexible than a standard mortgage — especially for buyers ' +
          'who want to spread payments without committing to a long-term loan. The trade-off is that ' +
          'the AED is pegged at 3.67 per USD, so currency risk is minimal for USD-base investors, ' +
          'but buyers earning in weaker currencies should factor in exchange rate movements over a ' +
          'multi-year payment period.',
      },
    ],

    faq: [
      {
        q: 'Can non-residents get a mortgage in Dubai?',
        a: 'Yes. Several UAE banks — including Emirates NBD, ADCB, Mashreq, and HSBC UAE — offer mortgage products to non-resident foreign nationals. The maximum loan-to-value for non-residents is 75%, so a minimum 25% cash deposit is required. UAE residency is not a prerequisite for mortgage eligibility.',
      },
      {
        q: 'How much deposit does a non-resident need for a Dubai mortgage?',
        a: 'A minimum of 25% of the purchase price as a cash deposit, since non-residents are capped at 75% LTV by Central Bank regulations. On top of the deposit, budget for approximately 6–7% in transaction costs (DLD transfer fee of 4%, agency commission of ~2%, DLD admin fee, mortgage registration fee of 0.25% of the loan amount, and Title Deed fee).',
      },
      {
        q: 'What mortgage rates are available to non-residents in Dubai?',
        a: 'Mortgage rates in Dubai in 2026 are broadly in the 4.5–6% per annum range, depending on the bank, loan term, and whether you opt for a fixed or variable rate. Fixed-rate periods of 1–5 years are common, after which the rate reverts to a variable rate linked to EIBOR. Comparing offers from multiple banks — or using a mortgage broker — will help you secure a competitive rate.',
      },
      {
        q: 'What documents are required for a non-resident mortgage in Dubai?',
        a: 'The typical document pack includes a valid passport, last 6 months\' bank statements showing income, a salary certificate or employment contract (for employees), or 2 years of audited accounts (for self-employed applicants), and details of the property to be purchased. Some banks also request a credit report from your home country. Applications can usually be initiated remotely.',
      },
      {
        q: 'Can I finance an off-plan property with a mortgage?',
        a: 'Generally, UAE banks do not mortgage off-plan properties during the construction period. The mortgage is arranged at or near handover, once the property is complete and a title deed can be issued. During construction, the developer\'s payment plan serves as the financing mechanism. Some banks offer off-plan mortgage products with specific developers as exceptions, but these are not standard. If you plan to mortgage at handover, arrange pre-approval 6–12 months ahead of the expected completion date.',
      },
    ],

    propertyFilter: {},
    gridHeading: 'Featured Properties in Dubai',
    leadSource: 'landing_dubai_mortgage_non_residents',
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
