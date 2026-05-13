import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

export const alt = 'Worldwise Real Estate — Dubai Property Investment'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const NAVY_1 = '#0a1830'
const NAVY_2 = '#0e2142'
const NAVY_3 = '#142b54'
const GOLD = '#caa55a'
const GOLD_DEEP = '#a8863f'
const GOLD_BRIGHT = '#d6b46a'
const IVORY = '#f3ece0'

async function loadFont(family: string, weight = 400): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=block`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } },
  ).then((r) => r.text())
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!url) throw new Error(`No font URL for ${family}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export default async function OgImage() {
  let cormorant400: ArrayBuffer | null = null
  let cormorant500: ArrayBuffer | null = null
  try {
    ;[cormorant400, cormorant500] = await Promise.all([
      loadFont('Cormorant Garamond', 400),
      loadFont('Cormorant Garamond', 500),
    ])
  } catch {}

  let logoSrc: string | null = null
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'logo-dark-bg.png'))
    logoSrc = `data:image/png;base64,${buf.toString('base64')}`
  } catch {}

  const fonts: { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 500 }[] = []
  if (cormorant400) fonts.push({ name: 'Cormorant Garamond', data: cormorant400, style: 'normal', weight: 400 })
  if (cormorant500) fonts.push({ name: 'Cormorant Garamond', data: cormorant500, style: 'normal', weight: 500 })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: `radial-gradient(120% 90% at 50% 45%, ${NAVY_3} 0%, ${NAVY_2} 38%, ${NAVY_1} 78%, #060f22 100%)`,
          fontFamily: fonts.length ? '"Cormorant Garamond"' : 'Georgia, serif',
        }}
      >
        {/* Top gold hairline */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundImage: `linear-gradient(90deg, transparent 0%, ${GOLD_DEEP} 20%, ${GOLD_BRIGHT} 50%, ${GOLD_DEEP} 80%, transparent 100%)` }} />
        {/* Bottom gold hairline */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundImage: `linear-gradient(90deg, transparent 0%, ${GOLD_DEEP} 20%, ${GOLD_BRIGHT} 50%, ${GOLD_DEEP} 80%, transparent 100%)` }} />

        {/* Inner frame */}
        <div style={{ position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, border: '1px solid rgba(202,165,90,0.18)' }} />

        {/* Corner accents */}
        <div style={{ position: 'absolute', top: 18, left: 18, width: 46, height: 46, borderTop: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}`, opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 18, right: 18, width: 46, height: 46, borderTop: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}`, opacity: 0.9 }} />
        <div style={{ position: 'absolute', bottom: 18, left: 18, width: 46, height: 46, borderBottom: `1px solid ${GOLD}`, borderLeft: `1px solid ${GOLD}`, opacity: 0.9 }} />
        <div style={{ position: 'absolute', bottom: 18, right: 18, width: 46, height: 46, borderBottom: `1px solid ${GOLD}`, borderRight: `1px solid ${GOLD}`, opacity: 0.9 }} />

        {/* Vignette */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(80% 65% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />

        {/* Content */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px 80px' }}>
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Worldwise Real Estate" width={685} height={360} style={{ objectFit: 'contain' }} />
          )}

          {/* Divider */}
          <div style={{ marginTop: 22, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 120, height: 1, backgroundImage: `linear-gradient(90deg, transparent, ${GOLD} 50%, transparent)` }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD }} />
            <div style={{ width: 120, height: 1, backgroundImage: `linear-gradient(90deg, transparent, ${GOLD} 50%, transparent)` }} />
          </div>

          {/* Tagline */}
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 32, fontWeight: 400, color: IVORY, opacity: 0.92, letterSpacing: 0.4 }}>
            <span>Dubai Property Investment</span>
            <span style={{ color: GOLD, margin: '0 18px', fontWeight: 500 }}>·</span>
            <span>8–10% ROI</span>
            <span style={{ color: GOLD, margin: '0 18px', fontWeight: 500 }}>·</span>
            <span>0% Tax</span>
          </div>
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 48, left: 0, right: 0, display: 'flex', justifyContent: 'center', fontSize: 24, fontWeight: 500, color: GOLD, letterSpacing: 7, paddingLeft: 7 }}>
          worldwise.pro
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
