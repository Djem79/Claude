import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const execFileP = promisify(execFile)

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
export const MIN_PHOTO_BYTES = 50 * 1024

// Safety cap after page-filtering — keep the gallery manageable.
const MAX_CANDIDATES = 24

// poppler/imagemagick can take a while on big brochures; cap so a pathological
// PDF can't hang the worker. async execFile keeps the event loop free meanwhile.
const PROC_TIMEOUT_MS = 60_000

// Cap the longest side; brochure rasters are print-resolution (4000px+, multi-MB)
// and would otherwise ship to the browser at full size.
const MAX_DIM = 1600

// How many ImageMagick resizes to run at once (vs. one-by-one, which was slow).
const RESIZE_CONCURRENCY = 5

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}

// Probe for an ImageMagick CLI once (IM7 = `magick`, IM6 = `convert`). Returns the
// binary name to use, or null if neither is installed (→ fall back to raw copy).
async function findResizer(): Promise<string | null> {
  for (const bin of ['magick', 'convert']) {
    try { await execFileP(bin, ['-version'], { timeout: 5_000 }); return bin } catch { /* try next */ }
  }
  return null
}

// Map each embedded image's index (matches the `img-NNN` extraction filename) to
// its 1-based source page, parsed from `pdfimages -list`. Lets us keep only images
// on pages the AI flagged as real renders (vs. abstract/mood/text pages).
async function imagePageMap(pdfPath: string): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  try {
    const { stdout } = await execFileP('pdfimages', ['-list', pdfPath], { timeout: PROC_TIMEOUT_MS })
    for (const line of stdout.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+/) // "<page> <num> image ..."
      if (m) map.set(parseInt(m[2], 10), parseInt(m[1], 10)) // num -> page
    }
  } catch (e) { console.error('[pdf-images] pdfimages -list failed', e) }
  return map
}

function numFromName(f: string): number | null {
  const m = f.match(/-(\d+)\.[a-z]+$/i) // img-007.jpg → 7 ; page-12.jpg → 12
  return m ? parseInt(m[1], 10) : null
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
 * with the gallery's numeric convention (0.jpg, 1.jpg …) so PropertyForm's uploader
 * appends cleanly. Returns the public URL paths.
 *
 * Primary: `pdfimages -all` (native format, fast). When `renderPages` is given, only
 * images sitting on those pages are kept — the AI flags pages holding real building/
 * interior/amenity renders, so abstract/mood/texture/text pages are dropped. Fallback
 * when nothing usable: `pdftoppm -jpeg` (rasterize pages, also page-filtered). Each
 * kept image is downscaled/recompressed with ImageMagick (≤1600px, q82) in parallel;
 * if ImageMagick is absent it copies the original. All external tools run via async
 * execFile (no npm native addon, no event-loop block) with hard timeouts.
 */
export async function extractImagesFromPdf(pdfBuf: Buffer, id: string, renderPages?: number[]): Promise<string[]> {
  if (!/^\d{6,20}$/.test(id)) throw new Error(`[pdf-images] invalid id: ${id}`)
  const publicDir = path.join(process.cwd(), 'public', 'images', 'properties', id)
  fs.mkdirSync(publicDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'))
  const pageSet = renderPages && renderPages.length ? new Set(renderPages) : null

  try {
    const pdfPath = path.join(tmpDir, 'in.pdf')
    fs.writeFileSync(pdfPath, pdfBuf)

    const sizeOk = (f: string) => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f)
    const collect = (prefix: string) =>
      fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f)).sort()

    try { await execFileP('pdfimages', ['-all', pdfPath, path.join(tmpDir, 'img')], { timeout: PROC_TIMEOUT_MS }) }
    catch (e) { console.error('[pdf-images] pdfimages failed', e) }

    let usable = collect('img').filter(sizeOk)
    // Keep only images on AI-flagged render pages (if we have a mapping for them).
    if (pageSet) {
      const pages = await imagePageMap(pdfPath)
      const onRenderPage = usable.filter(f => {
        const n = numFromName(f)
        const pg = n === null ? undefined : pages.get(n)
        return pg !== undefined && pageSet.has(pg)
      })
      // Only narrow if the filter actually matched something — otherwise the mapping
      // was unavailable/mismatched and we'd rather show all than nothing.
      if (onRenderPage.length) usable = onRenderPage
    }

    if (usable.length === 0) {
      try { await execFileP('pdftoppm', ['-jpeg', '-r', '120', pdfPath, path.join(tmpDir, 'page')], { timeout: PROC_TIMEOUT_MS }) }
      catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
      usable = collect('page').filter(sizeOk)
      if (pageSet) {
        const onRenderPage = usable.filter(f => { const n = numFromName(f); return n !== null && pageSet.has(n) })
        if (onRenderPage.length) usable = onRenderPage
      }
    }
    usable = usable.slice(0, MAX_CANDIDATES)

    const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
    const startIdx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

    const resizer = await findResizer()
    const urls = await mapLimit(usable, RESIZE_CONCURRENCY, async (f, i) => {
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
