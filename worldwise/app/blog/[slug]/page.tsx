import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import { getArticleBySlug, getAllArticles } from '@/lib/articles'
import { jsonLd as ldJson } from '@/lib/jsonld'
import type { Metadata } from 'next'

export const revalidate = 60

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllArticles().map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticleBySlug(params.slug)
  if (!article) return {}
  const ogImage = 'image' in article && article.image
    ? `https://worldwise.pro${article.image}`
    : '/opengraph-image'
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `https://worldwise.pro/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://worldwise.pro/blog/${article.slug}`,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [ogImage],
    },
  }
}

const TAG_COLORS: Record<string, string> = {
  'Investment Guide': 'bg-blue-50 text-blue-700',
  'Legal Guide': 'bg-purple-50 text-purple-700',
  'Visa & Residency': 'bg-green-50 text-green-700',
  'Market Update': 'bg-amber-50 text-amber-700',
  'Area Spotlight': 'bg-rose-50 text-rose-700',
}

export default function ArticlePage({ params }: Props) {
  const article = getArticleBySlug(params.slug)
  if (!article) notFound()

  const publishedAt = 'publishedAt' in article ? article.publishedAt : null
  const dateISO = publishedAt ?? new Date().toISOString()
  const dateDisplay = new Date(dateISO).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    datePublished: dateISO,
    dateModified: dateISO,
    author: { '@type': 'Organization', name: 'Worldwise Real Estate', url: 'https://worldwise.pro' },
    publisher: {
      '@type': 'Organization',
      name: 'Worldwise Real Estate',
      logo: { '@type': 'ImageObject', url: 'https://worldwise.pro/images/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://worldwise.pro/blog/${article.slug}` },
    url: `https://worldwise.pro/blog/${article.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }}
      />
      <Navigation />
      <main>
        {/* Header */}
        <section className="bg-navy py-20 pt-32">
          <div className="max-w-4xl mx-auto px-6">
            <Link href="/blog" className="text-gold/70 hover:text-gold text-sm mb-6 inline-block">
              ← All Articles
            </Link>
            <span className={`badge ${TAG_COLORS[article.tag] ?? 'bg-gray-100 text-gray-600'} mb-4 inline-block`}>
              {article.tag}
            </span>
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-white/60 text-sm">
              {dateDisplay} · {article.readTime}
            </p>
            {'image' in article && article.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.image}
                alt={article.title}
                className="w-full rounded-sm mt-8 aspect-[1200/630] object-cover"
              />
            )}
          </div>
        </section>

        {/* Content */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <ArticleContent content={article.content} />
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-[#F8F8F6]">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="font-serif text-2xl md:text-3xl text-navy mb-4">
              Ready to Invest in UAE Real Estate?
            </h2>
            <p className="text-gray-500 mb-8">
              Get a free consultation with our RERA-certified advisors.
            </p>
            <Link href="/#contact" className="btn-primary">
              Get Free Consultation
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Escape HTML first (article content — including AI-generated — is untrusted),
// then apply our own bold/italic markup. See tasks/security-audit.md C1.
function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function ArticleContent({ content }: { content: string }) {
  const blocks = parseContent(content)
  return (
    <div className="prose-custom">
      {blocks.map((block, i) => {
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="font-serif text-2xl md:text-3xl text-navy mt-10 mb-4 border-b border-gray-100 pb-2">
              {block.text}
            </h2>
          )
        }
        if (block.type === 'h3') {
          return (
            <h3 key={i} className="font-serif text-xl text-navy mt-8 mb-3">
              {block.text}
            </h3>
          )
        }
        if (block.type === 'p') {
          return (
            <p
              key={i}
              className="text-gray-700 leading-relaxed mb-4 max-w-[68ch]"
              dangerouslySetInnerHTML={{ __html: formatInline(block.text!) }}
            />
          )
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="my-4 space-y-2">
              {block.items!.map((item, j) => (
                <li
                  key={j}
                  className="text-gray-700 leading-relaxed flex gap-2"
                >
                  <span className="text-gold-accessible mt-1 flex-shrink-0">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="my-4 space-y-2 list-decimal list-inside">
              {block.items!.map((item, j) => (
                <li
                  key={j}
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatInline(item) }}
                />
              ))}
            </ol>
          )
        }
        if (block.type === 'table') {
          return (
            <div key={i} className="my-6 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-navy text-white">
                    {block.headers!.map((h, j) => (
                      <th key={j} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows!.map((row, j) => (
                    <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, k) => (
                        <td key={k} className="px-4 py-3 text-gray-700 border-b border-gray-100">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

type Block =
  | { type: 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }

const isTableRow = (l: string) => l.trimStart().startsWith('|')
// A markdown separator row: only pipes, dashes, colons, spaces, and at least one dash.
const isTableSeparator = (l: string) => /^[\s|:-]*-[\s|:-]*$/.test(l.trim()) && l.includes('|')

// Split "| a | | c |" → ['a','',  'c'] — drop only the empty segments produced by the
// outer pipes, keep interior empty cells so columns don't shift. (Old code used
// .filter(Boolean), which silently dropped intentional blank cells.)
function splitTableRow(line: string): string[] {
  const cells = line.split('|').map(c => c.trim())
  if (cells.length && cells[0] === '') cells.shift()
  if (cells.length && cells[cells.length - 1] === '') cells.pop()
  return cells
}

function parseContent(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3) })
      i++
      continue
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4) })
      i++
      continue
    }

    if (isTableRow(line)) {
      const headers = splitTableRow(line)
      i++
      // Skip the separator row only if it actually is one (don't eat a content row).
      if (i < lines.length && isTableSeparator(lines[i])) i++
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        const cells = splitTableRow(lines[i])
        // Pad/truncate to the header width so <td> count always matches <th>.
        while (cells.length < headers.length) cells.push('')
        rows.push(cells.slice(0, headers.length))
        i++
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\./.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\./.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s*/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    if (line.trim() !== '') {
      blocks.push({ type: 'p', text: line })
    }
    i++
  }

  return blocks
}
