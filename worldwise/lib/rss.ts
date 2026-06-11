// Pure RSS 2.0 XML builder — no fs/next imports so it stays node:test-able.
// escapeXml is load-bearing: article titles/excerpts include AI-generated text
// (same untrusted-content class as the JSON-LD invariant in lib/jsonld.ts).

export interface RssItem {
  title: string
  link: string
  description: string
  /** ISO date string; static editorial articles have no date — tag is omitted */
  pubDate?: string
}

export interface RssChannel {
  title: string
  link: string
  selfUrl: string
  description: string
  items: RssItem[]
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRssXml(channel: RssChannel): string {
  const items = channel.items
    .map(item => {
      const pubDate = item.pubDate
        ? `\n      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>`
        : ''
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>${pubDate}
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}
