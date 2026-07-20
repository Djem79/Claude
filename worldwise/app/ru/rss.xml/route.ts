import { getRuMaterials, buildDzenRss } from '@/lib/ru-content'

// Дзен-лента: читает server-only data/, поэтому только runtime; Дзен
// опрашивает ленту сам несколько раз в час — часа кэша достаточно.
export const dynamic = 'force-dynamic'

export async function GET() {
  // В ленте только посты планов. Лонгриды (format-article) публикуются в Дзен
  // ВРУЧНУЮ с фото-обложками и ссылками — включённые в ленту они создавали
  // дубли на канале (импорт 2026-07-20 привёз RSS-копии трёх ручных статей).
  // Страницы /ru/<slug> у статей остаются — на них ведут ссылки.
  const xml = buildDzenRss(getRuMaterials().filter(m => m.format === 'post'))
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
