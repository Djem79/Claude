import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import { articles } from '@/lib/articles'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UAE Real Estate Guides & Insights | Worldwise',
  description:
    'Expert guides for international investors: off-plan property, legal process, visa options and more. Practical knowledge for buying UAE real estate.',
  alternates: { canonical: 'https://worldwise.pro/blog' },
  openGraph: {
    title: 'UAE Real Estate Guides & Insights — Worldwise',
    description: 'Expert guides for international investors buying property in the UAE.',
    url: 'https://worldwise.pro/blog',
  },
}

const TAG_COLORS: Record<string, string> = {
  'Investment Guide': 'bg-blue-50 text-blue-700',
  'Legal Guide': 'bg-purple-50 text-purple-700',
  'Visa & Residency': 'bg-green-50 text-green-700',
}

export default function BlogPage() {
  return (
    <>
      <Navigation />
      <main>
        {/* Header */}
        <section className="bg-navy py-20 pt-32">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
              Worldwise Insights
            </p>
            <h1 className="font-serif text-4xl md:text-5xl text-white mb-4">
              UAE Real Estate Expert Guides
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Practical knowledge for international property investors — covering legal process, investment strategy and residency options.
            </p>
          </div>
        </section>

        {/* Articles grid */}
        <section className="py-20 bg-[#F8F8F6]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-6">
              {articles.map(a => (
                <article
                  key={a.slug}
                  className="bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                    <span className="font-serif text-4xl text-gold/30">W</span>
                  </div>
                  <div className="p-6">
                    <span className={`badge ${TAG_COLORS[a.tag] ?? 'bg-gray-100 text-gray-600'}`}>
                      {a.tag}
                    </span>
                    <h2 className="font-serif text-xl text-navy mt-3 mb-3 leading-snug">
                      {a.title}
                    </h2>
                    <p className="text-gray-500 text-sm line-clamp-3 mb-5">{a.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{a.readTime}</span>
                      <Link
                        href={`/blog/${a.slug}`}
                        className="text-gold hover:underline font-medium"
                      >
                        Read More →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
