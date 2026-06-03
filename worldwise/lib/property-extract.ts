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
- description: a 2-4 sentence prose summary of the project (its location, concept, and standout features). Write it even when the brochure has no single description paragraph — synthesise from the available content.
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
          maxOutputTokens: 2048,
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
  return mapGeminiToProperty(JSON.parse(text))
}
