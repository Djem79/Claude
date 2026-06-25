# Backlink Gap Analysis — 2026-06-25

**Source:** DataForSEO Backlinks API (live index), pulled 2026-06-25 on a **14-day trial**
(activated 2026-06-25 → **cancel by ~2026-07-09**, calendar reminder set for 2026-07-05;
direct activation otherwise carries a $100/mo minimum commitment). Companion data:
[`backlink-targets-2026-06.csv`](./backlink-targets-2026-06.csv).

## TL;DR

- worldwise.pro has **0 real editorial backlinks.** The 8 referring domains DataForSEO sees
  are all nofollow URL-shortener junk (`urls-shortener.eu`, `screenshots.wiki`, `bye.fyi`…),
  rank 0. Downside: we start from zero. Upside: nothing toxic to disavow, and the *first*
  genuine link already moves the needle.
- Link building is our single most under-used SEO lever — the answer to "is the link-mass
  advice relevant to us?" is **yes, more than for most.**
- But Dubai real estate is a hard, link-heavy niche. The "competitors do nothing, minimal
  effort wins" claim only holds for **our long tail** (blog pages already at pos 6–15), not
  against the portals on head terms. We don't need to match Bayut — even **+20–40 relevant
  referring domains** materially lifts our striking-distance pages.

## Authority snapshot (DataForSEO, live)

| Domain | rank | referring domains | backlinks |
|---|---|---|---|
| **worldwise.pro** | **0** | **8 (all junk)** | **9** |
| bayut.com | 514 | 19,175 | 837,342 |
| propertyfinder.ae | 584 | 6,590 | 4,582,179 |
| famproperties.com | 394 | 2,935 | 216,653 |
| bhomes.com (Betterhomes) | 335 | 2,117 | 19,220 |
| drivenproperties.com | 377 | 1,321 | 51,749 |

> Note: `betterhomes.ae` is a near-empty parked domain — the real Betterhomes site is **bhomes.com**.

## The gap

564 domains link to Bayut **and** Property Finder **and** Betterhomes but **not** to us.
After removing giants (google/youtube/facebook…) and throwaway hosting (`*.web.app`,
`*.firebaseapp.com`, `*.vercel.app`), **480 candidate domains** remain in the CSV — sorted by
referring-domain rank, with backlink counts to each competitor and a heuristic category.

> ⚠️ DataForSEO "rank" is inflated by link networks. Many high-rank rows are Farsi/Iranian
> property sites or auto-generated junk. **Always qualify a domain before pursuing it.**

## Qualified top-30 (live recon, 2026-06-25)

**PURSUE** — English, relevant, alive:

| Domain | What it is | Channel |
|---|---|---|
| arabianbusiness.com | Major UAE business publication (bot-blocked to scrapers, obviously real) | Digital PR |
| economymiddleeast.com | Middle East business news | Digital PR |
| investdubaitoday.com | Dubai real-estate news | Guest / PR |
| expat.com | Expat community + country guides | Business listing |
| expatlivingguide.com | Expat guide | Listing / guest |
| bso.ae | Dubai property-management agency (**dofollow confirmed**, spam 15) | Partnership / listing |
| rd-dubai.com | RE agency ("#1 in Real Estate in Dubai") | Listing |
| aigentsrealty.com | Dubai property platform (has a "submit/contribute" path) | Listing / guest |
| fcrealestate.ae | RE agency (Cloudflare-blocked to bot — check manually) | Listing |
| deluxehomes.com | RE site (Cloudflare-blocked to bot — check manually) | Listing |

**QUALIFY MANUALLY** — alive but uncertain or temporarily down:
`sandytimes.ae` (likely Dubai lifestyle mag, timed out → PR) · `emirates-online.net` (UAE portal) ·
`sandsofwealth.com` (investment content) · `ritukant.com` (Dubai RE journalist Ritu Kant Ojha → PR) ·
`dbamc.com` / `dubaibusinessadvisors.com` (business advisory; one returned 502) ·
`properita.com` (heavy linker but errored → recheck) · `grovy.ae`, `nextlevelrealestate.ae` (RE agencies).

**SKIP:**
- Farsi/Iranian audience (wrong market): `soalit.com`, `hamrahestate.com`, `emaratkhoone.com`, `dubaisland.com`
- Irrelevant: `decoupage-paper.com`, `gcu.edu.pk` (Pakistani university), `airial.travel`, `grokipedia.com` (AI wiki), `homelerss.org`
- Dead: `emiratesbd.ae` ("Account Suspended")
- Low value: `invest-with-ammar.com` (competing solo agent)

## Action plan

1. **RE portals / agencies** — submit a company/agency profile. Fastest, often free, frequently
   dofollow. Run the `directory-submissions` skill across the CSV.
2. **Expat / community** — business listing on `expat.com` + `expatlivingguide.com`; contribute
   genuinely useful answers/guides (no spam).
3. **Digital PR** — pitch a data-led story using assets we already own (district yields in
   `lib/areas.ts`; the DLD cost breakdown in the dld-fees article) to `arabianbusiness.com` /
   `economymiddleeast.com` / `investdubaitoday.com` for a quoted citation with a link.

**First sprint:** qualify + submit the ~10 PURSUE targets, draft one PR pitch on our yield data,
and set up the two expat listings.

## Files

- [`backlink-targets-2026-06.csv`](./backlink-targets-2026-06.csv) — full 480-domain candidate list.
  Columns: `domain, rank, backlinks_to_bayut, backlinks_to_propertyfinder, backlinks_to_betterhomes, category`.
  Categories are heuristic (`media_pr` 17, `re_portal_agency` 26, `expat_community` 4, `developer` 2,
  `other_qualify` 431) — the long tail needs manual triage; start from the qualified shortlist above.
