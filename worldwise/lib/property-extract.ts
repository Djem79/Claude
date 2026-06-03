import type { Property } from '@/types'
import { mapGeminiToProperty } from '@/lib/property-map'

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    developer: { type: 'STRING' },
    area: { type: 'STRING' },
    type: { type: 'STRING', enum: ['apartment', 'villa', 'townhouse', 'penthouse'] },
    status: { type: 'STRING', enum: ['off-plan', 'secondary', 'rent'] },
    priceAed: { type: 'NUMBER' },
    pricePerSqft: { type: 'NUMBER' },
    roi: { type: 'NUMBER' },
    grossYield: { type: 'NUMBER' },
    bedrooms: { type: 'STRING' },
    completionDate: { type: 'STRING' },
    paymentPlan: { type: 'STRING' },
    shortDescription: { type: 'STRING' },
    description: { type: 'STRING' },
    amenities: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  // Force the model to emit the always-fill inferred fields — without this,
  // structured output treats them as optional and intermittently omits
  // `description` (it summarises from brochure content; never genuinely empty).
  required: ['title', 'area', 'type', 'status', 'shortDescription', 'description'],
} as const

const SYSTEM = `You extract structured real-estate listing data from a Dubai developer project brochure (PDF).

HARD FACTS — copy ONLY what the brochure states, never invent or guess. Omit the field if absent:
- priceAed: starting/"from" price in AED as a plain number (no currency symbol, no commas, no "from").
- pricePerSqft: plain number, only if stated.
- roi, grossYield: percentages as plain numbers (e.g. 7.5), only if the brochure explicitly states them.
- bedrooms: a human label like "Studio", "1-3 BR".
- developer: the developer/brand name. title: the project name. completionDate: handover date if stated.

INFERRED / SUMMARISED FIELDS — always fill these from the brochure content; summarising is expected and is NOT considered invention:
- area: the Dubai district / community the project is located in (e.g. "Dubai Marina", "Business Bay", "Palm Jumeirah", "Dubai Hills", "JVC", "Dubai Creek Harbour"). Infer it from the location / address / map section. Use the community name, NOT the full street address. This field is important — do your best to determine it.
- description: a FULL, extended description of the project — 3-4 paragraphs, roughly 150-250 words. Cover, drawing on the WHOLE brochure: what the project is and its developer / master-community context; the location and connectivity; the design and lifestyle concept; the standout amenities; the available unit types and their sizes; and the investment appeal. Write in warm, vivid, magazine-quality English with a natural human voice — engaging and evocative, with varied sentence rhythm; never robotic, templated or list-like, and avoid generic AI filler and repeated phrasing (no bullet lists). It must always be full and rich — never a single sentence, never empty.
- shortDescription: a single-sentence hook.
- amenities: the listed facilities / features as short individual items.

status: "off-plan" for under-construction/launch projects, "secondary" for ready resale, "rent" only for rentals. type = the dominant unit type (apartment, villa, townhouse, or penthouse).`

/**
 * Send the whole PDF to Gemini multimodal and return cleaned, partial property
 * fields. Throws on missing key / API error / unparseable response — the caller
 * surfaces that to the admin.
 */
export async function extractPropertyFromPdf(pdfBuf: Buffer): Promise<Partial<Property>> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBuf.toString('base64') } },
            { text: 'Extract this project\'s details into the schema.' },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`)
  }
  const j = await res.json()
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  const parsed = JSON.parse(text)
  return mapGeminiToProperty(parsed)
}
