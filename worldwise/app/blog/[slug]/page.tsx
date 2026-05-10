import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import { getArticleBySlug, articles } from '@/lib/articles'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export function generateStaticParams() {
  return articles.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticleBySlug(params.slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `https://worldwise.pro/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://worldwise.pro/blog/${article.slug}`,
    },
  }
}

const TAG_COLORS: Record<string, string> = {
  'Investment Guide': 'bg-blue-50 text-blue-700',
  'Legal Guide': 'bg-purple-50 text-purple-700',
  'Visa & Residency': 'bg-green-50 text-green-700',
}

export default function ArticlePage({ params }: Props) {
  const article = getArticleBySlug(params.slug)
  if (!article) notFound()

  const lines = article.content.split('\n')
  const rendered = lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="font-serif text-2xl md:text-3xl text-navy mt-10 mb-4">
          {line.slice(3)}
        </h2>
      )
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="font-serif text-xl text-navy mt-8 mb-3">
          {line.slice(4)}
        </h3>
      )
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="text-gray-700 leading-relaxed ml-4 list-disc"
          dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }}
        />
      )
    }
    if (line.startsWith('| ')) {
      return null
    }
    if (line.trim() === '') {
      return <div key={i} className="h-2" />
    }
    if (/^\d+\./.test(line)) {
      return (
        <li key={i} className="text-gray-700 leading-relaxed ml-4 list-decimal"
          dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\.\s*/, '')) }}
        />
      )
    }
    return (
      <p key={i} className="text-gray-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInline(line) }}
      />
    )
  })

  const tables = renderTables(article.content)

  return (
    <>
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
            <p className="text-white/60 text-sm">{article.readTime}</p>
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

function formatInline(text: string): string {
  return text
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
              className="text-gray-700 leading-relaxed mb-4"
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
                  <span className="text-gold mt-1 flex-shrink-0">•</span>
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

    if (line.startsWith('| ')) {
      const headers = line.split('|').map(c => c.trim()).filter(Boolean)
      i++ // skip separator
      i++
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('| ')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
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

function renderTables(_content: string) {
  return null
}
