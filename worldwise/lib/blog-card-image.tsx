import { ImageResponse } from 'next/og'
import { isValidSlug } from '@/lib/slug'
import fs from 'fs'
import path from 'path'

// Общий рендерер карточки поста/статьи (1200×630, navy/gold, raw-фон из
// public/images/blog/<slug>-raw.png). Используется двумя роутами:
//  - /api/blog-image?slug&title&tag — исторический URL (TG-превью и пр.);
//  - /ru/og/<slug>.png — ЧПУ-URL без query-параметров для Дзен-RSS
//    (загрузчик Дзена не скачивает картинки по URL с параметрами).

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'
const IVORY = '#f3ece0'
const SIZE = { width: 1200, height: 630 }

async function loadFont(family: string, weight = 400): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=block`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } },
  ).then((r) => r.text())
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!url) throw new Error(`No font URL for ${family}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export async function renderBlogCard(slug: string, title: string, tag: string): Promise<Response> {
  if (!isValidSlug(slug)) {
    return new Response('Invalid slug', { status: 400 })
  }

  const rawPath = path.join(process.cwd(), 'public', 'images', 'blog', `${slug}-raw.png`)
  if (!fs.existsSync(rawPath)) {
    return new Response('Background not found', { status: 404 })
  }
  const bgSrc = `data:image/png;base64,${fs.readFileSync(rawPath).toString('base64')}`

  let logoSrc: string | null = null
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'logo-dark-bg.png'))
    logoSrc = `data:image/png;base64,${buf.toString('base64')}`
  } catch {}

  let cormorant500: ArrayBuffer | null = null
  try { cormorant500 = await loadFont('Cormorant Garamond', 500) } catch {}
  const fonts = cormorant500
    ? [{ name: 'Cormorant Garamond', data: cormorant500, style: 'normal' as const, weight: 500 as const }]
    : []

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', backgroundColor: NAVY, fontFamily: fonts.length ? '"Cormorant Garamond"' : 'Georgia, serif' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgSrc} alt="" width={SIZE.width} height={SIZE.height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(180deg, rgba(13,27,42,0.15) 0%, rgba(13,27,42,0.05) 38%, rgba(13,27,42,0.78) 78%, rgba(13,27,42,0.95) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(13,27,42,0.55) 0%, rgba(13,27,42,0) 55%)' }} />
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="Worldwise Real Estate" width={240} height={126} style={{ position: 'absolute', top: 44, left: 54, objectFit: 'contain' }} />
        )}
        <div style={{ position: 'absolute', left: 54, right: 64, bottom: 54, display: 'flex', flexDirection: 'column' }}>
          {tag ? (
            <div style={{ display: 'flex', alignSelf: 'flex-start', color: NAVY, backgroundColor: GOLD, fontSize: 22, fontWeight: 700, letterSpacing: 1.5, padding: '7px 18px', borderRadius: 999, marginBottom: 20, textTransform: 'uppercase' }}>
              {tag}
            </div>
          ) : null}
          <div style={{ display: 'flex', color: IVORY, fontSize: 60, fontWeight: 500, lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 50, right: 64, display: 'flex', color: 'rgba(255,255,255,0.78)', fontSize: 22, letterSpacing: 0.5 }}>
          worldwise.pro
        </div>
      </div>
    ),
    { ...SIZE, fonts, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  )
}
