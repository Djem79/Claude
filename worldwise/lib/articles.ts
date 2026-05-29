import { getDynamicArticles, DynamicArticle } from './dynamic-articles'

export interface Article {
  slug: string
  tag: string
  title: string
  excerpt: string
  readTime: string
  content: string
}

export const articles: Article[] = [
  {
    slug: 'off-plan-investment-guide',
    tag: 'Investment Guide',
    title: "Off-Plan Property Investment in Dubai: A Beginner's Guide",
    excerpt:
      'A step-by-step walkthrough for first-time investors: setting goals, selecting a trusted agent, booking your unit, managing payment milestones and receiving handover.',
    readTime: '7 min read',
    content: `
## What Is Off-Plan Property?

Off-plan property is real estate sold before construction is complete — sometimes before a single brick is laid. You purchase based on floor plans, renderings and a developer's track record. In Dubai, off-plan is the dominant way international investors enter the market, and for good reason: prices are lower, payment plans are flexible, and capital appreciation by handover can be significant.

## Why Dubai Off-Plan Stands Out

Dubai's off-plan market is regulated by the Real Estate Regulatory Authority (RERA), which requires developers to hold buyer funds in escrow accounts. This protects investors if a project stalls. The UAE has no property tax, no capital gains tax and no inheritance tax — making the net return on investment considerably higher than comparable markets in Europe or North America.

Typical payment plans split the purchase price across construction milestones — 10% on booking, 40% during construction, 50% on handover — though many developers now offer post-handover plans stretching payments 2–3 years beyond completion.

## Step 1: Define Your Goal

Before looking at projects, answer three questions:

- **Rental income or capital gain?** Studio and 1-bed units in high-demand areas (JVC, Dubai Marina, Business Bay) yield 7–10% annually. Larger units appreciate faster but rent slower.
- **Off-plan or ready?** Off-plan ties up capital for 1–3 years but offers lower entry prices and flexible payments. Ready property generates rental income from day one.
- **Budget and currency risk.** The AED is pegged to the USD at 3.67. If you hold EUR, GBP or INR, account for exchange rate movement over your investment horizon.

## Step 2: Choose a RERA-Registered Agent

Any agent you work with must be registered with RERA and hold a valid BRN (Broker Registration Number). Ask to see it. A good agent will not pressure you into a decision — they will show you comparable transactions (available on the DLD's official REST app), explain service charge history and give you an honest view of the developer's track record.

## Step 3: Select the Project and Unit

Key factors to evaluate:

- **Developer reputation.** Emaar, Nakheel, Aldar and DAMAC have long track records. Newer developers may offer higher returns but carry more risk.
- **Location fundamentals.** Proximity to Metro, beaches, malls and free zones drives rental demand. Check the master plan — what will be built around the project in 5 years?
- **Floor plan efficiency.** A lower price per sqft is meaningless if 30% of the unit is corridor. Look at usable area, balcony size and view.
- **Service charge estimate.** Published by RERA for each community. High service charges (above AED 20/sqft/year) compress net yield significantly.

## Step 4: Reserve and Sign the SPA

Once you choose a unit, you pay a reservation fee (typically 5–10% of the purchase price). The developer will issue a Sales Purchase Agreement (SPA) within a few days. Read it carefully — or have a UAE-based property lawyer review it. Key clauses to check: handover date, penalty for developer delay, snag rectification period and termination conditions.

The SPA must be registered with the Dubai Land Department (DLD) within 60 days. The DLD charges a 4% registration fee, paid by the buyer.

## Step 5: Manage Payment Milestones

Off-plan payment schedules are tied to construction milestones verified by RERA. You will receive notices from the developer — respond on time. Late payments attract penalties (typically 1% per month). Keep a calendar with all due dates from day one.

## Step 6: Snag and Handover

When the project reaches completion, the developer will invite you for a handover inspection. Bring a professional snagging company (cost: AED 1,000–2,500) to document defects. The developer is obliged to fix structural defects for 10 years and finishing defects for 1 year under UAE law. Do not accept the keys until the snagging list is agreed in writing.

## Step 7: Set Up the Property for Rental

After handover, register with DEWA (Dubai Electricity and Water Authority) and obtain your Ejari (rental contract registration). If you plan to short-let, you will need a DTCM holiday home licence. A property management company can handle all of this for 5–8% of annual rental income.

## Common Mistakes to Avoid

- Buying without visiting Dubai at least once
- Ignoring service charges in yield calculations
- Choosing a developer with no completed projects
- Not registering the SPA with DLD (your ownership is unprotected until registration)
- Overextending across multiple off-plan units simultaneously

## Final Thought

Off-plan investing in Dubai rewards patience and preparation. The investors who do best are those who define their goal first, pick a reputable developer in a high-demand location, and resist the urge to flip before handover. Done right, it is one of the most tax-efficient property investments available to international buyers.
    `.trim(),
  },
  {
    slug: 'legal-process-secondary-market',
    tag: 'Legal Guide',
    title: 'Step-by-Step Legal Process for Buying Property on the Secondary Market',
    excerpt:
      'Everything you need to know about the four key legal stages of a resale transaction — including cost estimates for cash buyers and mortgage buyers.',
    readTime: '6 min read',
    content: `
## Secondary Market vs Off-Plan

The secondary market — also called resale — means buying a property that already has an existing owner. Unlike off-plan, you can inspect the unit before you commit, rental income starts immediately after transfer, and there is no construction risk. The trade-off is a higher entry price and a more involved legal process.

## Who Can Buy?

The UAE allows foreigners to purchase freehold property in designated zones (Dubai Marina, Downtown, Palm Jumeirah, JVC, Business Bay and dozens more). There are no restrictions on nationality, and you do not need a UAE residency visa to own property — though ownership of property worth AED 750,000+ makes you eligible to apply for a 2-year investor visa.

## Stage 1: Agree Terms and Sign the MOU

Once you and the seller agree on price, your agent prepares a Memorandum of Understanding (MOU) — also called Form F in Dubai. This document sets out:

- Purchase price
- Completion timeline (typically 30–60 days for cash, 60–90 days for mortgage)
- Who pays the agent commission (usually buyer and seller each pay 2%)
- NOC (No Objection Certificate) responsibility

You pay a 10% deposit (held by the agent or a conveyancer) upon signing the MOU. If you back out without valid reason, you forfeit the deposit. If the seller backs out, they return double the deposit.

## Stage 2: Obtain the NOC

The seller must obtain a No Objection Certificate from the master developer (e.g. Emaar, Nakheel) confirming there are no outstanding service charges or mortgages on the property. This typically takes 5–10 working days and costs AED 500–5,000 depending on the developer.

If the seller has a mortgage on the property, it must be cleared before or at the time of transfer. This is coordinated between the two banks (if both parties have mortgages) or settled from the sale proceeds.

## Stage 3: Transfer at the Dubai Land Department

The actual ownership transfer happens at a DLD Trustee Office (there are around 30 across Dubai, no appointment needed for cash transactions). Both buyer and seller — or their Power of Attorney holders — must be present.

**Documents required:**
- Original passports (or Emirates IDs for UAE residents)
- NOC from the developer
- Original title deed (seller)
- MOU / Form F
- Manager's cheques made payable to the seller and DLD

**Costs at transfer (cash buyer):**
| Item | Amount |
|------|--------|
| DLD registration fee | 4% of purchase price |
| DLD admin fee | AED 580 (apartments/offices) |
| Title deed issuance | AED 250 |
| Trustee office fee | AED 4,000 + VAT |
| Agent commission | ~2% + VAT |

Transfer takes 1–2 hours. You leave with a new title deed in your name.

## Stage 4: Mortgage Buyers — Additional Steps

If you are financing the purchase, the process has additional layers:

1. **Pre-approval.** Get a mortgage pre-approval from a UAE bank before signing the MOU. Banks typically offer 75–80% LTV for non-residents on properties up to AED 5M.
2. **Property valuation.** The bank commissions an independent valuer (cost: AED 2,500–3,500). The bank lends against the lower of purchase price or valuation.
3. **Liability letter.** If the seller has a mortgage, their bank issues a liability letter with the exact payoff amount. Your bank coordinates the clearance.
4. **Mortgage registration.** After the DLD transfer, the mortgage is registered with DLD for a fee of 0.25% of the loan amount + AED 290.

**Total additional mortgage costs:**
| Item | Amount |
|------|--------|
| Bank arrangement fee | 0.5–1% of loan |
| Mortgage registration | 0.25% of loan + AED 290 |
| Valuation fee | AED 2,500–3,500 |
| Life insurance (annual) | 0.3–0.5% of outstanding balance |

## Timeline Summary

| Buyer type | Typical timeline |
|-----------|-----------------|
| Cash | 30–45 days from MOU to transfer |
| Mortgage | 60–90 days from MOU to transfer |

## Tips for a Smooth Transaction

- Use a registered conveyancer alongside your agent — they manage the paperwork flow between all parties for a flat fee of AED 5,000–8,000.
- Always use manager's cheques (not bank transfers) for the purchase price — DLD requires them.
- If buying from overseas, a notarised Power of Attorney allows a trusted representative to sign on your behalf at the DLD.
- Check the service charge balance on the DLD's REST app before signing the MOU — outstanding charges transfer with the property.
    `.trim(),
  },
  {
    slug: 'uae-property-residence-visa',
    tag: 'Visa & Residency',
    title: 'Does Buying Property in the UAE Grant a Residence Visa?',
    excerpt:
      'An overview of the three investor visa types — 2-year, 5-year Green Visa and 10-year Golden Visa — with minimum investment thresholds and required documentation.',
    readTime: '5 min read',
    content: `
## The Short Answer

Yes — owning property in the UAE can qualify you for a UAE residence visa, but the rules depend on the value of the property and how it is financed. There are three main visa categories linked to property ownership: the 2-year Investor Visa, the 5-year Green Visa and the 10-year Golden Visa.

## 2-Year Property Investor Visa

**Minimum property value:** AED 750,000
**Eligibility:** Property must be fully paid (no mortgage balance above 50% of value). Off-plan units under construction usually do not qualify until handover.

This is the entry-level investor visa. It allows you to live in the UAE, sponsor your spouse and children, open a UAE bank account and obtain a UAE driving licence. It must be renewed every 2 years and requires a medical test and Emirates ID on first application.

**Process:**
1. Apply through the General Directorate of Residency and Foreigners Affairs (GDRFA) in Dubai, or ICA in Abu Dhabi.
2. Submit title deed, passport copy, property valuation certificate (from a RERA-certified valuer), and passport-size photos.
3. Undergo a medical fitness test and biometrics.
4. Receive your residence visa and Emirates ID.

Processing time is typically 3–5 working days once all documents are submitted. Total cost including fees and typing: approximately AED 3,000–5,000.

## 5-Year Green Visa

**Minimum property value:** AED 2,000,000
**Key difference from 2-year:** The Green Visa does not require an employer or sponsor — you are self-sponsored. This makes it attractive for freelancers, remote workers and investors who do not plan to be employed in the UAE.

The Green Visa also allows you to sponsor your spouse, children and parents, and it provides a 6-month grace period after the visa expires (versus 30 days for most other visa types).

**Property conditions:** The property must be fully paid and valued at AED 2M or above. Multiple properties can be combined to reach the threshold if registered in the same individual's name.

## 10-Year Golden Visa

**Minimum property value:** AED 2,000,000
**Key difference from Green Visa:** The Golden Visa offers a 10-year renewable residency without the need for a sponsor, and it is not affected by job loss or business changes. It is the most prestigious tier and includes priority processing at government offices.

Golden Visa holders can sponsor an unlimited number of domestic staff without the usual national quota restrictions, and their dependents receive the same 10-year validity.

**Mortgage properties:** If the property is mortgaged, the bank must confirm that the equity (paid amount) meets or exceeds AED 2,000,000. The Dubai Land Department and ICA assess this case by case.

## Comparing the Three Visa Types

| Feature | 2-Year Visa | 5-Year Green Visa | 10-Year Golden Visa |
|---------|------------|-------------------|---------------------|
| Min. property value | AED 750K | AED 2M | AED 2M |
| Sponsor required | No | No | No |
| Validity | 2 years | 5 years | 10 years |
| Sponsor family | Yes | Yes (+ parents) | Yes (+ unlimited staff) |
| Grace period on expiry | 30 days | 6 months | 6 months |
| Off-plan eligible | After handover | After handover | After handover |

## Frequently Asked Questions

**Can I get a visa on a jointly-owned property?**
Each co-owner can apply for a visa based on their share of the property value, provided their individual share meets the minimum threshold.

**Does the visa grant the right to work?**
The investor visa and Green Visa grant residence but not an automatic work permit. To work in the UAE you must obtain a work permit separately through an employer or by setting up a company.

**Can I include multiple properties?**
Yes, multiple Dubai properties in your name can be combined. Properties in different emirates (Abu Dhabi, Sharjah) may be counted separately by their respective authorities.

**What if my property value drops below the threshold?**
Your existing visa remains valid until its expiry date. At renewal, the property must still meet the threshold — a fresh valuation is required.

## Our Recommendation

For investors purchasing at AED 2M+, we recommend applying directly for the 10-year Golden Visa — the additional cost over the 2-year visa is modest, and the stability of a decade-long residency has significant practical and lifestyle value. For investors below AED 2M, the 2-year visa is a straightforward and affordable entry point that can be upgraded later as your portfolio grows.
    `.trim(),
  },
]

/**
 * Collapse articles sharing a slug, keeping the richest version (longest
 * content) per slug while preserving first-seen order. Guards against AI-
 * generated articles that collided on a slug — without this, the listing
 * shows duplicate cards and getArticleBySlug serves whichever happens to be
 * first (often a thin/empty draft that shadows the real article).
 */
function bestBySlug(list: (Article | DynamicArticle)[]): (Article | DynamicArticle)[] {
  const bySlug = new Map<string, Article | DynamicArticle>()
  const order: string[] = []
  for (const a of list) {
    const current = bySlug.get(a.slug)
    if (!current) {
      bySlug.set(a.slug, a)
      order.push(a.slug)
    } else if (a.content.length > current.content.length) {
      bySlug.set(a.slug, a)
    }
  }
  return order.map(slug => bySlug.get(slug)!)
}

export function getAllArticles(): (Article | DynamicArticle)[] {
  const dynamic = getDynamicArticles()
  return bestBySlug([...dynamic, ...articles])
}

export function getArticleBySlug(slug: string): Article | DynamicArticle | null {
  return getAllArticles().find(a => a.slug === slug) ?? null
}
