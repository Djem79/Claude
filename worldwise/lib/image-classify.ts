// Classifies the ACTUAL images extracted from a developer brochure by content,
// so the gallery is built from real building/interior renders — not from whatever
// happens to sit at the front of the document. Replaces the old (unreliable)
// "ask the model for render page numbers" approach.

export type ImgCategory =
  | 'exterior' | 'interior' | 'floorplan' | 'amenity' | 'lifestyle' | 'mood' | 'other'

// Categories we keep, in priority order. Exterior + interior are what the user
// wants most; community/master-plan ("amenity") and floor plans are secondary.
// lifestyle (posed people shoots), mood (abstract art/textures/logos) and other
// are dropped entirely.
const KEEP: ImgCategory[] = ['exterior', 'interior', 'amenity', 'floorplan']

const VALID = new Set<ImgCategory>([
  'exterior', 'interior', 'floorplan', 'amenity', 'lifestyle', 'mood', 'other',
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

const MODEL = 'gemini-2.5-flash'

const CLASSIFY_SYSTEM = `You are shown images extracted from a Dubai real-estate developer brochure, in order. Classify EACH image into exactly one category:
- "exterior": a photo or 3D render of the property building's OUTSIDE — a villa/townhouse/apartment facade, the building seen from outside, street/front/rear view, the home with its own garden, pool or driveway.
- "interior": INSIDE a unit — living room, bedroom, bathroom, kitchen, dining room, walk-in closet, staircase; a furnished room of the home.
- "floorplan": a 2D architectural floor plan, unit layout, cluster map, master-plan map or site layout diagram.
- "amenity": the community's shared FACILITIES, rendered as part of the project — aerial views of the whole community, lagoons, swimming pools, parks, clubhouses, gyms, gardens, promenades, sports or leisure areas.
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
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
              enum: ['exterior', 'interior', 'floorplan', 'amenity', 'lifestyle', 'mood', 'other'],
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
