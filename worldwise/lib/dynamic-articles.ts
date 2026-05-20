import fs from 'fs'
import path from 'path'
import { writeFileAtomic } from '@/lib/atomic-write'

export interface DynamicArticle {
  slug: string
  tag: string
  title: string
  excerpt: string
  readTime: string
  content: string
  publishedAt: string
  source: 'ai-generated'
}

const DATA_DIR = path.join(process.cwd(), 'data')
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json')
const DRAFT_PATH = path.join(DATA_DIR, 'article-draft.json')
const TAG_INDEX_PATH = path.join(DATA_DIR, 'article-tag-index.json')

export const TAGS = [
  'Market Update',
  'Investment Guide',
  'Area Spotlight',
  'Legal Guide',
  'Visa & Residency',
] as const

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch (e) {
    console.error(`[dynamic-articles] Failed to read ${filePath}:`, e)
    return fallback
  }
}

export function getDynamicArticles(): DynamicArticle[] {
  return readJson<DynamicArticle[]>(ARTICLES_PATH, [])
}

export function getDraft(): DynamicArticle | null {
  return readJson<DynamicArticle | null>(DRAFT_PATH, null)
}

export function deleteDraft(): void {
  if (fs.existsSync(DRAFT_PATH)) fs.unlinkSync(DRAFT_PATH)
}

export function publishDraft(): DynamicArticle | null {
  const draft = getDraft()
  if (!draft) return null
  const existing = getDynamicArticles()
  existing.unshift(draft)
  writeFileAtomic(ARTICLES_PATH, JSON.stringify(existing, null, 2))
  deleteDraft()
  return draft
}

export function getTagIndex(): number {
  return readJson<{ index: number }>(TAG_INDEX_PATH, { index: 0 }).index
}

export function incrementTagIndex(current: number): void {
  writeFileAtomic(TAG_INDEX_PATH, JSON.stringify({ index: (current + 1) % TAGS.length }))
}
