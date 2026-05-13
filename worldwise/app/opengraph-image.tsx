import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

export const alt = 'Worldwise Real Estate — Dubai Property Investment'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  let cormorantData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=block',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
    if (url) cormorantData = await fetch(url).then(r => r.arrayBuffer())
  } catch {}

  let logoSrc: string | null = null
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo-dark-bg.png')
    const logoBuffer = fs.readFileSync(logoPath)
    logoSrc = `data:image/png;base64,${logoBuffer.toString('base64')}`
  } catch {}

  const accent = '#298455'
  const fg = '#f3ece0'
  const hairline = 'rgba(255,255,255,0.18)'
  const font = cormorantData ? 'Cormorant Garamond' : 'Georgia, serif'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(120% 90% at 50% 45%, #142b54 0%, #0e2142 38%, #0a1830 78%, #060f22 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent rule */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${accent} 25%, ${accent} 75%, transparent 100%)`,
          opacity: 0.85,
        }} />

        {/* Bottom accent rule */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${accent} 25%, ${accent} 75%, transparent 100%)`,
          opacity: 0.85,
        }} />

        {/* Inner hairline frame */}
        <div style={{
          position: 'absolute', top: 28, left: 28, right: 28, bottom: 28,
          border: `1px solid ${hairline}`,
        }} />

        {/* Corner — TL */}
        <div style={{
          position: 'absolute', top: 18, left: 18, width: 46, height: 46,
          borderTop: `1px solid ${accent}`, borderLeft: `1px solid ${accent}`, opacity: 0.9,
        }} />
        {/* Corner — TR */}
        <div style={{
          position: 'absolute', top: 18, right: 18, width: 46, height: 46,
          borderTop: `1px solid ${accent}`, borderRight: `1px solid ${accent}`, opacity: 0.9,
        }} />
        {/* Corner — BL */}
        <div style={{
          position: 'absolute', bottom: 18, left: 18, width: 46, height: 46,
          borderBottom: `1px solid ${accent}`, borderLeft: `1px solid ${accent}`, opacity: 0.9,
        }} />
        {/* Corner — BR */}
        <div style={{
          position: 'absolute', bottom: 18, right: 18, width: 46, height: 46,
          borderBottom: `1px solid ${accent}`, borderRight: `1px solid ${accent}`, opacity: 0.9,
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(80% 65% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          position: 'relative', zIndex: 2,
        }}>
          {/* Logo */}
          {logoSrc && (
            <img
              src={logoSrc}
              width={300}
              height={300}
              style={{ objectFit: 'contain', marginBottom: 4 }}
            />
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '18px 0 16px' }}>
            <div style={{ width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${accent} 50%, transparent)` }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
            <div style={{ width: 120, height: 1, background: `linear-gradient(90deg, transparent, ${accent} 50%, transparent)` }} />
          </div>

          {/* Tagline */}
          <div style={{
            fontFamily: font, fontSize: 28, fontWeight: 400,
            letterSpacing: '0.04em', color: fg, opacity: 0.9,
            display: 'flex', alignItems: 'center', gap: 0,
          }}>
            <span>Dubai Property Investment</span>
            <span style={{ color: accent, margin: '0 10px', fontWeight: 500 }}>·</span>
            <span>8–10% ROI</span>
            <span style={{ color: accent, margin: '0 10px', fontWeight: 500 }}>·</span>
            <span>0% Tax</span>
          </div>
        </div>

        {/* URL */}
        <div style={{
          position: 'absolute', bottom: 50, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          fontFamily: font, fontSize: 20, fontWeight: 500,
          letterSpacing: '0.32em', color: accent, opacity: 0.95,
        }}>
          worldwise.pro
        </div>
      </div>
    ),
    {
      ...size,
      fonts: cormorantData
        ? [{ name: 'Cormorant Garamond', data: cormorantData, style: 'normal', weight: 400 }]
        : [],
    }
  )
}
