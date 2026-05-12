import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'

const TAG_COLORS: Record<string, string> = {
  'Investment Guide': 'bg-blue-50 text-blue-700',
  'Legal Guide': 'bg-purple-50 text-purple-700',
  'Visa & Residency': 'bg-green-50 text-green-700',
  'Market Update': 'bg-amber-50 text-amber-700',
  'Area Spotlight': 'bg-teal-50 text-teal-700',
}

export default function BlogPreview() {
  const articles = getAllArticles().slice(0, 3)

  return (
    <section id="blog" className="py-20 bg-[#F8F8F6]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
              Worldwise Insights
            </p>
            <h2 className="section-title">UAE Real Estate<br />Expert Guides</h2>
            <p className="section-subtitle">
              Practical knowledge for international property investors
            </p>
          </div>
          <Link href="/blog" className="btn-outline-gold whitespace-nowrap self-start md:self-end">
            All Articles →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {articles.map(a => (
            <article key={a.slug} className="bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                <span className="font-serif text-4xl text-gold/30">W</span>
              </div>
              <div className="p-6">
                <span className={`badge ${TAG_COLORS[a.tag] ?? 'bg-gray-100 text-gray-600'}`}>
                  {a.tag}
                </span>
                <h3 className="font-serif text-xl text-navy mt-3 mb-3 leading-snug">
                  {a.title}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-3 mb-5">{a.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{a.readTime}</span>
                  <Link href={`/blog/${a.slug}`} className="text-gold hover:underline font-medium">
                    Read More →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
