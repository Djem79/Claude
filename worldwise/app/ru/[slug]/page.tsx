import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRuMaterialBySlug } from '@/lib/ru-content'

// Материалы приходят из server-only data/ — рендер только на запросе.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const material = getRuMaterialBySlug(slug)
  return {
    title: material ? `${material.title} — Смотрим Дубай` : 'Смотрим Дубай',
    robots: { index: false, follow: false },
  }
}

export default async function RuMaterialPage({ params }: Props) {
  const { slug } = await params
  const material = getRuMaterialBySlug(slug)
  if (!material) notFound()

  return (
    <article className="text-gray-800 [&_p]:mb-4 [&_p]:leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-navy [&_h2]:mt-8 [&_h2]:mb-3 [&_a]:underline [&_a]:text-gold-accessible">
      <h1 className="text-3xl font-bold text-navy mb-2">{material.title}</h1>
      <p className="text-sm text-gray-500 mb-6">{material.date}</p>
      {/* html построен в lib/ru-content.ts: весь пользовательский текст прогнан
          через escapeHtml, ссылки — только наши константы. */}
      <div dangerouslySetInnerHTML={{ __html: material.html }} />
    </article>
  )
}
