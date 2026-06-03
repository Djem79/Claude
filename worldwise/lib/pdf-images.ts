import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { classifyImages, selectByCategory, type ImgCategory } from '@/lib/image-classify'
import { isLikelyPhoto } from '@/lib/photo-filter'

const execFileP = promisify(execFile)

// Safety cap on how many images end up in the gallery.
const MAX_CANDIDATES = 24

// Don't ship more than this many thumbnails to the classifier in a single call
// (developer brochures rarely exceed this once logos/icons are size-filtered out).
const CLASSIFY_MAX = 120

// poppler/imagemagick can take a while on big brochures; cap so a pathological
// PDF can't hang the worker. async execFile keeps the event loop free meanwhile.
const PROC_TIMEOUT_MS = 60_000

// Cap the longest side; brochure rasters are print-resolution (4000px+, multi-MB)
// and would otherwise ship to the browser at full size.
const MAX_DIM = 1600

// How many ImageMagick ops to run at once (vs. one-by-one, which was slow).
const RESIZE_CONCURRENCY = 5

// Probe for an ImageMagick CLI once (IM7 = `magick`, IM6 = `convert`). Returns the
// binary name to use, or null if neither is installed (→ fall back to raw copy).
async function findResizer(): Promise<string | null> {
  for (const bin of ['magick', 'convert']) {
    try { await execFileP(bin, ['-version'], { timeout: 5_000 }); return bin } catch { /* try next */ }
  }
  return null
}

// Bounded-concurrency async map (no deps).
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, worker))
  return results
}

/**
 * Extract candidate photos from a PDF into public/images/properties/<id>/, named
 * 0.jpg, 1.jpg … (the gallery convention) so PropertyForm's uploader appends cleanly.
 * Returns the public URL paths.
 *
 * Pipeline: `pdfimages -all` dumps embedded rasters (fallback `pdftoppm -jpeg` when
 * none survive the size filter). Each surviving candidate is thumbnailed and sent to
 * Gemini, which labels it exterior / interior / floorplan / amenity / lifestyle / mood.
 * We KEEP exterior → interior → amenity → floorplan (ranked, so facades lead the
 * gallery) and DROP lifestyle/mood/other — this is what surfaces the product renders
 * in long brochures whose front section is all mood/lifestyle. Keepers are downscaled
 * (≤1600px, q82). If classification is unavailable (no key / API error / no
 * ImageMagick) it falls back to document order. All tools run via async execFile.
 */
export async function extractImagesFromPdf(pdfBuf: Buffer, id: string): Promise<string[]> {
  if (!/^\d{6,20}$/.test(id)) throw new Error(`[pdf-images] invalid id: ${id}`)
  const publicDir = path.join(process.cwd(), 'public', 'images', 'properties', id)
  fs.mkdirSync(publicDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'))

  try {
    const pdfPath = path.join(tmpDir, 'in.pdf')
    fs.writeFileSync(pdfPath, pdfBuf)

    const sizeOk = (f: string) => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f)
    const collect = (prefix: string) =>
      fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f)).sort()

    try { await execFileP('pdfimages', ['-all', pdfPath, path.join(tmpDir, 'img')], { timeout: PROC_TIMEOUT_MS }) }
    catch (e) { console.error('[pdf-images] pdfimages failed', e) }
    let usable = collect('img').filter(sizeOk)

    if (usable.length === 0) {
      try { await execFileP('pdftoppm', ['-jpeg', '-r', '120', pdfPath, path.join(tmpDir, 'page')], { timeout: PROC_TIMEOUT_MS }) }
      catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
      usable = collect('page').filter(sizeOk)
    }
    if (usable.length === 0) return []

    const resizer = await findResizer()

    // --- choose which candidates to keep, by content ------------------------
    const classifiable = usable.slice(0, CLASSIFY_MAX)
    if (usable.length > CLASSIFY_MAX) {
      console.warn(`[pdf-images] ${usable.length} candidates; classifying first ${CLASSIFY_MAX}`)
    }
    let keepIdx: number[]
    try {
      if (!resizer) throw new Error('no ImageMagick for thumbnails')
      const thumbs = await mapLimit(classifiable, RESIZE_CONCURRENCY, async (f, i) => {
        const thumbPath = path.join(tmpDir, `thumb-${i}.jpg`)
        await execFileP(resizer, [path.join(tmpDir, f), '-thumbnail', '320x320', '-background', 'white', '-flatten', '-strip', '-quality', '70', thumbPath], { timeout: PROC_TIMEOUT_MS })
        return { b64: fs.readFileSync(thumbPath).toString('base64'), mime: 'image/jpeg' }
      })
      const cats = await classifyImages(thumbs)
      const full: ImgCategory[] = classifiable.map((_, i) => cats[i] ?? 'other')
      keepIdx = selectByCategory(full, MAX_CANDIDATES)
      if (keepIdx.length === 0) {
        console.warn('[pdf-images] classifier kept nothing; falling back to document order')
        keepIdx = classifiable.map((_, i) => i).slice(0, MAX_CANDIDATES)
      }
    } catch (e) {
      console.error('[pdf-images] classification failed; using document order', e)
      keepIdx = usable.map((_, i) => i).slice(0, MAX_CANDIDATES)
    }
    const keep = keepIdx.map(i => usable[i])

    // --- write final downscaled images --------------------------------------
    const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
    const startIdx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

    const urls = await mapLimit(keep, RESIZE_CONCURRENCY, async (f, i) => {
      const src = path.join(tmpDir, f)
      const targetIdx = startIdx + i
      if (resizer) {
        const name = `${targetIdx}.jpg`
        try {
          // `1600x1600>` only shrinks (never upscales); -strip drops metadata.
          await execFileP(resizer, [src, '-resize', `${MAX_DIM}x${MAX_DIM}>`, '-strip', '-quality', '82', path.join(publicDir, name)], { timeout: PROC_TIMEOUT_MS })
          return `/images/properties/${id}/${name}`
        } catch (e) { console.error('[pdf-images] resize failed, copying original', e) }
      }
      const ext = path.extname(f).toLowerCase()
      const name = `${targetIdx}${ext}`
      fs.copyFileSync(src, path.join(publicDir, name))
      return `/images/properties/${id}/${name}`
    })
    return urls
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
