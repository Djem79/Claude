import { getAllArticles } from '@/lib/articles'
import { buildRssXml } from '@/lib/rss'

export const revalidate = 3600

const BASE = 'https://worldwise.pro'

export function GET() {
  const items = getAllArticles()
    .slice(0, 20)
    .map(a => ({
      title: a.title,
      link: `${BASE}/blog/${a.slug}`,
      description: a.excerpt,
      pubDate: 'publishedAt' in a ? a.publishedAt : undefined,
    }))

  const xml = buildRssXml({
    title: 'Worldwise — Dubai Real Estate Blog',
    link: `${BASE}/blog`,
    selfUrl: `${BASE}/blog/rss.xml`,
    description:
      'Dubai property market news, investment guides and area insights from Worldwise.',
    items,
  })

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
