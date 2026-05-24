// ROI infographic for the Telegram channel — vertical PNG (1080x1350) rendered
// via next/og. Data sources: worldwise/public/llms.txt (single source of truth
// for area averages). Brand palette matches /api/blog-image.

import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'
const IVORY = '#f3ece0'
const SIZE = { width: 1080, height: 1350 }

type Row = { district: string; price: string; roi: string; note?: string }

const ROWS: Row[] = [
  { district: 'Dubai Marina',      price: 'AED 1,850', roi: '7–8%',  note: 'High liquidity' },
  { district: 'Downtown Dubai',    price: 'AED 2,200', roi: '6–7%',  note: 'Prime address' },
  { district: 'Palm Jumeirah',     price: 'AED 2,800', roi: '6–8%',  note: 'Iconic' },
  { district: 'Business Bay',      price: 'AED 1,600', roi: '7–9%',  note: 'Yield favorite' },
  { district: 'Dubai Hills Estate',price: 'AED 1,400', roi: '6–7%',  note: 'Family-grade' },
  { district: 'JLT',               price: 'AED 1,200', roi: '7–9%',  note: 'Entry price' },
  { district: 'Creek Harbour',     price: 'AED 1,700', roi: '7–8%',  note: 'Growth area' },
  { district: 'Emaar Beachfront',  price: 'AED 2,500', roi: '7–8%',  note: 'Sea + Marina' },
]

async function loadFont(family: string, weight = 400): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=block`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } },
  ).then(r => r.text())
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!url) throw new Error(`No font URL for ${family}`)
  return fetch(url).then(r => r.arrayBuffer())
}

export async function GET() {
  let cormorant500: ArrayBuffer | null = null
  let cormorant700: ArrayBuffer | null = null
  try { cormorant500 = await loadFont('Cormorant Garamond', 500) } catch {}
  try { cormorant700 = await loadFont('Cormorant Garamond', 700) } catch {}
  const fonts = [
    ...(cormorant500 ? [{ name: 'Cormorant Garamond', data: cormorant500, style: 'normal' as const, weight: 500 as const }] : []),
    ...(cormorant700 ? [{ name: 'Cormorant Garamond', data: cormorant700, style: 'normal' as const, weight: 700 as const }] : []),
  ]
  const fontFamily = fonts.length ? '"Cormorant Garamond"' : 'Georgia, serif'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: NAVY,
          fontFamily,
          padding: '70px 60px 60px',
          position: 'relative',
        }}
      >
        {/* Subtle gold corner accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 220,
            height: 6,
            backgroundColor: GOLD,
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              color: NAVY,
              backgroundColor: GOLD,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              padding: '7px 18px',
              borderRadius: 999,
              marginBottom: 22,
              textTransform: 'uppercase',
            }}
          >
            ROI · 2026
          </div>
          <div style={{ display: 'flex', color: IVORY, fontSize: 68, fontWeight: 500, lineHeight: 1.05 }}>
            Dubai Real Estate
          </div>
          <div style={{ display: 'flex', color: IVORY, fontSize: 68, fontWeight: 500, lineHeight: 1.05 }}>
            by District
          </div>
          <div style={{ display: 'flex', color: 'rgba(243,236,224,0.6)', fontSize: 26, marginTop: 14, letterSpacing: 0.5 }}>
            Average price + annual rental yield
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${GOLD}`,
            paddingBottom: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ width: 440, color: GOLD, fontSize: 20, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>District</div>
          <div style={{ width: 230, color: GOLD, fontSize: 20, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, textAlign: 'right' }}>AED/sqft</div>
          <div style={{ flex: 1, color: GOLD, fontSize: 20, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, textAlign: 'right' }}>Yield</div>
        </div>

        {/* Rows */}
        {ROWS.map((row, i) => (
          <div
            key={row.district}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '18px 0',
              borderBottom: i < ROWS.length - 1 ? '1px solid rgba(243,236,224,0.08)' : 'none',
            }}
          >
            <div style={{ width: 440, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', color: IVORY, fontSize: 34, fontWeight: 500, lineHeight: 1.1 }}>
                {row.district}
              </div>
              {row.note && (
                <div style={{ display: 'flex', color: 'rgba(243,236,224,0.45)', fontSize: 18, marginTop: 4, letterSpacing: 0.3 }}>
                  {row.note}
                </div>
              )}
            </div>
            <div style={{ width: 230, color: IVORY, fontSize: 30, textAlign: 'right', fontWeight: 500 }}>
              {row.price}
            </div>
            <div style={{ flex: 1, color: GOLD, fontSize: 32, textAlign: 'right', fontWeight: 700 }}>
              {row.roi}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: 'rgba(243,236,224,0.5)', fontSize: 18, letterSpacing: 0.5 }}>
              Source: RERA · DLD · Worldwise data
            </div>
            <div style={{ display: 'flex', color: 'rgba(243,236,224,0.4)', fontSize: 16, marginTop: 4 }}>
              Long-term rental, indicative ranges. Off-plan figures vary by project.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', color: IVORY, fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>
              worldwise.pro
            </div>
            <div style={{ display: 'flex', color: GOLD, fontSize: 20, letterSpacing: 1, marginTop: 4 }}>
              @WorldwisePro
            </div>
          </div>
        </div>
      </div>
    ),
    { ...SIZE, fonts, headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
