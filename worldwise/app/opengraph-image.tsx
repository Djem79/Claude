import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Worldwise Real Estate — Dubai Property Investment'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  // Fetch Cormorant Garamond SemiBold from Google Fonts
  let cormorantData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&display=block',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
    if (url) cormorantData = await fetch(url).then(r => r.arrayBuffer())
  } catch {}

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
          backgroundColor: '#0D1B2A',
          position: 'relative',
        }}
      >
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#C9A84C' }} />

        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 800,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Brand block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div
            style={{
              fontFamily: cormorantData ? 'Cormorant Garamond' : 'Georgia, serif',
              fontSize: 86,
              fontWeight: 600,
              color: '#C9A84C',
              letterSpacing: '0.18em',
              lineHeight: 1,
            }}
          >
            WORLDWISE
          </div>

          <div
            style={{
              fontFamily: cormorantData ? 'Cormorant Garamond' : 'Georgia, serif',
              fontSize: 26,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.42em',
              marginTop: 10,
            }}
          >
            REAL ESTATE
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 36, marginBottom: 36 }}>
            <div style={{ width: 60, height: 1, backgroundColor: 'rgba(201,168,76,0.4)' }} />
            <div style={{ width: 6, height: 6, backgroundColor: '#C9A84C', borderRadius: '50%' }} />
            <div style={{ width: 60, height: 1, backgroundColor: 'rgba(201,168,76,0.4)' }} />
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: cormorantData ? 'Cormorant Garamond' : 'Georgia, serif',
              fontSize: 24,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.08em',
            }}
          >
            Dubai Property Investment · 8–10% ROI · 0% Tax
          </div>
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            color: 'rgba(201,168,76,0.6)',
            letterSpacing: '0.05em',
          }}
        >
          worldwise.pro
        </div>

        {/* Gold bottom bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: '#C9A84C' }} />
      </div>
    ),
    {
      ...size,
      fonts: cormorantData
        ? [{ name: 'Cormorant Garamond', data: cormorantData, style: 'normal', weight: 600 }]
        : [],
    }
  )
}
