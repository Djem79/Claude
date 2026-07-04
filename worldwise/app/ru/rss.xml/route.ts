import { getRuMaterials, buildDzenRss } from '@/lib/ru-content'

// Дзен-лента: читает server-only data/, поэтому только runtime; Дзен
// опрашивает ленту сам несколько раз в час — часа кэша достаточно.
export const dynamic = 'force-dynamic'

export async function GET() {
  const xml = buildDzenRss(getRuMaterials())
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
