import { NextRequest } from 'next/server'
import { renderBlogCard } from '@/lib/blog-card-image'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const slug = searchParams.get('slug') ?? ''
  const title = (searchParams.get('title') ?? '').slice(0, 140)
  const tag = (searchParams.get('tag') ?? '').slice(0, 40)
  return renderBlogCard(slug, title, tag)
}
