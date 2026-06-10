// Classifies the ACTUAL images extracted from a developer brochure by content,
// so the gallery is built from real building/interior renders — not from whatever
// happens to sit at the front of the document. Replaces the old (unreliable)
// "ask the model for render page numbers" approach.

export type ImgCategory =
  | 'exterior' | 'interior' | 'floorplan' | 'masterplan' | 'amenity' | 'lifestyle' | 'mood' | 'other'

// Categories we keep, in priority order. Exterior + interior are what the user
// wants most; community/master-plan ("amenity") and floor plans are secondary.
// lifestyle (posed people shoots), mood (abstract art/textures/logos) and other
// are dropped entirely.
const KEEP: ImgCategory[] = ['exterior', 'interior', 'amenity', 'floorplan']

const VALID = new Set<ImgCategory>([
  'exterior', 'interior', 'floorplan', 'masterplan', 'amenity', 'lifestyle', 'mood', 'other',
])

export function normalizeCategory(s: unknown): ImgCategory {
  const v = String(s ?? '').toLowerCase().trim()
  return (VALID.has(v as ImgCategory) ? v : 'other') as ImgCategory
}

/**
 * Given a per-candidate category list (aligned by index to the candidate images),
 * return the indices to keep — ranked exterior → interior → amenity → floorplan,
 * preserving document order within each category, dropping lifestyle/mood/other —
 * capped to `cap`. Pure (no I/O) so it is unit-tested directly.
 */
export function selectByCategory(cats: ImgCategory[], cap: number): number[] {
  const keep: number[] = []
  for (const cat of KEEP) {
    for (let i = 0; i < cats.length; i++) {
      if (cats[i] === cat) keep.push(i)
    }
  }
  return keep.slice(0, cap)
}

// True only for images shaped like a floor plan / site plan: reasonably large in
// BOTH dimensions (drops thin banners) and decent area (drops icons/small thumbs).
// Used to narrow the SMALL-image pool (the ones the 50KB gallery gate rejects) before
// the plans classify pass, so it isn't flooded by section-cover/decorative crops.
// Pure — unit-tested.
export function isLikelyFloorPlanDims(width: number, height: number): boolean {
  return Math.min(width, height) >= 250 && width * height >= 150_000
}

// Gallery indices ranked exterior -> interior -> amenity (document order within each),
// capped. Master-plans and everything else are intentionally NOT in the gallery —
// they go to the plans section (selectPlanSection) or are dropped. Pure — unit-tested.
export function partitionGallery(cats: ImgCategory[], cap: number): number[] {
  const ORDER: ImgCategory[] = ['exterior', 'interior', 'amenity']
  const out: number[] = []
  for (const cat of ORDER) {
    for (let i = 0; i < cats.length; i++) if (cats[i] === cat) out.push(i)
  }
  return out.slice(0, cap)
}

// Build the gated "Floor plans & site plans" section: up to `maxMaster` master-plan
// indices (from the GALLERY classify pass — master-plans are large) plus the floorplan
// indices (from the separate PLAN classify pass — unit layouts are small). Document
// order within each; index spaces are separate (master -> gallery files, floor ->
// plan files), so the caller maps them to the right file arrays. Pure — unit-tested.
export function selectPlanSection(
  galleryCats: ImgCategory[],
  planCats: ImgCategory[],
  maxMaster: number,
  maxFloor: number,
): { master: number[]; floor: number[] } {
  const master: number[] = []
  for (let i = 0; i < galleryCats.length && master.length < maxMaster; i++) {
    if (galleryCats[i] === 'masterplan') master.push(i)
  }
  const floor: number[] = []
  for (let i = 0; i < planCats.length && floor.length < maxFloor; i++) {
    if (planCats[i] === 'floorplan') floor.push(i)
  }
  return { master, floor }
}

const MODEL = 'gemini-2.5-flash'

const CLASSIFY_SYSTEM = `You are shown images extracted from a Dubai real-estate developer brochure, in order. Classify EACH image into exactly one category:
- "exterior": a photo or 3D render of the property building's OUTSIDE — a villa/townhouse/apartment facade, the building seen from outside, street/front/rear view, the home with its own garden, pool or driveway.
- "interior": INSIDE a unit — living room, bedroom, bathroom, kitchen, dining room, walk-in closet, staircase; a furnished room of the home.
- "floorplan": a 2D architectural floor plan of an INDIVIDUAL unit — the interior layout of ONE apartment, villa or townhouse showing its rooms, walls and (often) dimensions or a "Ground Floor / First Floor / Roof" label. NOT the whole community.
- "masterplan": a top-down master-plan, site-layout or cluster MAP of the WHOLE project — a schematic/diagram or aerial map showing many plots/buildings/roads/lagoons across the development (e.g. coloured cluster maps, "community map", site plan). It covers the project, not a single home.
- "amenity": the community's shared FACILITIES, rendered photo-realistically as part of the project — lagoons, swimming pools, parks, clubhouses, gyms, gardens, promenades, sports or leisure areas (a render of the place, not a schematic map).
- "lifestyle": stock-style photos of PEOPLE (models, couples, families) posing — beach, portrait or lifestyle shots used for mood, that do NOT show the actual property.
- "mood": abstract or decorative imagery — water ripples, ink, smoke, flowing fabric, sand or stone textures, plain sky, close-up plants, logos, brand stamps, or section-title backgrounds.
- "other": anything that fits none of the above.
Return a JSON array of category strings, one per image, in the SAME ORDER as the images. The array length MUST equal the number of images.`

/**
 * One Gemini multimodal call: send the candidate thumbnails (interleaved with index
 * labels to keep alignment) and get back a category per image. Throws on missing key
 * / API error / non-array response — the caller falls back to document order.
 */
export async function classifyImages(thumbs: { b64: string; mime: string }[]): Promise<ImgCategory[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const parts: Array<Record<string, unknown>> = []
  thumbs.forEach((t, i) => {
    parts.push({ text: `Image ${i}:` })
    parts.push({ inlineData: { mimeType: t.mime, data: t.b64 } })
  })
  parts.push({ text: `Classify all ${thumbs.length} images. Return exactly ${thumbs.length} category strings in order.` })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      // Key in a header, not the URL — URLs end up in proxy logs and error traces.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CLASSIFY_SYSTEM }] },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'STRING',
              enum: ['exterior', 'interior', 'floorplan', 'masterplan', 'amenity', 'lifestyle', 'mood', 'other'],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  )
  if (!res.ok) throw new Error(`Gemini classify error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini classify response')
  const raw = JSON.parse(text)
  if (!Array.isArray(raw)) throw new Error('Gemini classify response is not an array')
  return raw.map(normalizeCategory)
}
