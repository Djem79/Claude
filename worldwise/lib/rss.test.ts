import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeXml, buildRssXml } from './rss.ts'

test('escapeXml escapes all five XML special characters', () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;')
})

test('buildRssXml neutralises hostile AI-generated titles', () => {
  const xml = buildRssXml({
    title: 'Blog',
    link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml',
    description: 'd',
    items: [
      {
        title: '</script><script>alert(1)</script>',
        link: 'https://worldwise.pro/blog/x',
        description: 'a & b <c>',
      },
    ],
  })
  assert.ok(!xml.includes('<script>'))
  assert.ok(xml.includes('&lt;/script&gt;'))
  assert.ok(xml.includes('a &amp; b &lt;c&gt;'))
})

test('item with pubDate renders RFC-822 date; without pubDate omits the tag', () => {
  const base = {
    title: 'Blog',
    link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml',
    description: 'd',
  }
  const dated = buildRssXml({
    ...base,
    items: [{ title: 't', link: 'l', description: 'd', pubDate: '2026-06-10T09:00:00.000Z' }],
  })
  assert.ok(dated.includes('<pubDate>Wed, 10 Jun 2026 09:00:00 GMT</pubDate>'))
  const undated = buildRssXml({ ...base, items: [{ title: 't', link: 'l', description: 'd' }] })
  assert.ok(!undated.includes('<pubDate>'))
})

test('channel skeleton: xml declaration, guid permalink, atom self link', () => {
  const xml = buildRssXml({
    title: 'Blog',
    link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml',
    description: 'd',
    items: [{ title: 't', link: 'https://worldwise.pro/blog/x', description: 'd' }],
  })
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.ok(xml.includes('<guid isPermaLink="true">https://worldwise.pro/blog/x</guid>'))
  assert.ok(
    xml.includes(
      '<atom:link href="https://worldwise.pro/blog/rss.xml" rel="self" type="application/rss+xml"/>'
    )
  )
  assert.ok(xml.includes('<language>en</language>'))
})
