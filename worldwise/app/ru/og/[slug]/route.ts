import { getRuMaterialBySlug } from '@/lib/ru-content'
import { renderBlogCard } from '@/lib/blog-card-image'

// ЧПУ-обложка материала /ru для Дзен-RSS: /ru/og/<slug>.png.
// Загрузчик Дзена не скачивает картинки по URL с query-параметрами
// (пост уходил в Дзен без изображения — 2026-07-20), поэтому ленте нужен
// чистый адрес с расширением. Заголовок и тег берутся из самого материала,
// рендер — тот же, что у /api/blog-image.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(_req: Request, { params }: Props) {
  const { slug: file } = await params
  if (!file.endsWith('.png')) {
    return new Response('Not found', { status: 404 })
  }
  const slug = file.slice(0, -4)
  const material = getRuMaterialBySlug(slug)
  if (!material) {
    return new Response('Not found', { status: 404 })
  }
  return renderBlogCard(slug, material.title, material.tag ?? 'Market Update')
}
