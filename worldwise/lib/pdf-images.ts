import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { classifyImages, isLikelyFloorPlanDims, partitionGallery, selectPlanSection, type ImgCategory } from '@/lib/image-classify'
import { isLikelyPhoto, MIN_PHOTO_BYTES } from '@/lib/photo-filter'

const execFileP = promisify(execFile)

// Safety cap on how many images end up in the gallery.
const MAX_CANDIDATES = 24

// Floor plans are surfaced in their own gated section; cap them separately from the gallery.
const FLOORPLAN_MAX = 12

// The plans pass works on SMALL images the 50KB gallery gate rejects. Keep its own
// floor (drop true icons), narrow it by geometry, and cap the classify call.
const PLAN_MIN_BYTES = 12 * 1024
const PLAN_CLASSIFY_MAX = 60
const MASTERPLAN_IN_PLANS = 2

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

// Read "<w> <h>" via ImageMagick identify (IM7 = `magick identify`, IM6 = `identify`).
// Returns null on any failure so the caller can skip the plan-geometry filter.
async function imageDims(resizer: string | null, file: string): Promise<{ w: number; h: number } | null> {
  if (!resizer) return null
  const [bin, pre] = resizer === 'magick' ? ['magick', ['identify']] : ['identify', []]
  try {
    const { stdout } = await execFileP(bin as string, [...(pre as string[]), '-format', '%w %h', file], { timeout: PROC_TIMEOUT_MS })
    const [w, h] = stdout.trim().split(/\s+/).map(Number)
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null
  } catch { return null }
}

// Read the colorspace via ImageMagick identify (e.g. "sRGB", "CMYK", "Gray").
// Returns null on failure. Used to detect print-CMYK rasters (see colourFixArgs).
async function imageColorspace(resizer: string | null, file: string): Promise<string | null> {
  if (!resizer) return null
  const [bin, pre] = resizer === 'magick' ? ['magick', ['identify']] : ['identify', []]
  try {
    const { stdout } = await execFileP(bin as string, [...(pre as string[]), '-format', '%[colorspace]', file], { timeout: PROC_TIMEOUT_MS })
    return stdout.trim() || null
  } catch { return null }
}

// ImageMagick args that normalise a source raster's colour to sRGB before resize.
// Developer brochures are print artwork: their embedded rasters are CMYK JPEGs, which
// `pdfimages -all` dumps as a raw stream WITHOUT applying Adobe's APP14 inversion — so
// the pixels stay inverted and the browser renders a negative (verified 2026-07-20 on a
// real brochure). A plain `-colorspace sRGB` does NOT fix it (ImageMagick reads the
// inverted values as-is); CMYK must be `-negate`d first, then converted. Non-CMYK
// sources just normalise to sRGB (no-op for sRGB, harmless for Gray).
function colourFixArgs(colorspace: string | null): string[] {
  return colorspace === 'CMYK' ? ['-negate', '-colorspace', 'sRGB'] : ['-colorspace', 'sRGB']
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
export async function extractImagesFromPdf(pdfBuf: Buffer, id: string): Promise<{ gallery: string[]; floorPlans: string[] }> {
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
    let galleryPool = collect('img').filter(sizeOk)
    let rasterised = false

    if (galleryPool.length === 0) {
      try { await execFileP('pdftoppm', ['-jpeg', '-r', '120', pdfPath, path.join(tmpDir, 'page')], { timeout: PROC_TIMEOUT_MS }) }
      catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
      galleryPool = collect('page').filter(sizeOk)
      rasterised = true
    }
    if (galleryPool.length === 0) return { gallery: [], floorPlans: [] }

    const resizer = await findResizer()

    const thumbnail = (files: string[]) => mapLimit(files, RESIZE_CONCURRENCY, async (f, i) => {
      const src = path.join(tmpDir, f)
      const thumbPath = path.join(tmpDir, `thumb-${path.basename(f)}-${i}.jpg`)
      const cs = await imageColorspace(resizer, src)
      await execFileP(resizer as string, [src, ...colourFixArgs(cs), '-thumbnail', '320x320', '-background', 'white', '-flatten', '-strip', '-quality', '70', thumbPath], { timeout: PROC_TIMEOUT_MS })
      return { b64: fs.readFileSync(thumbPath).toString('base64'), mime: 'image/jpeg' }
    })

    // ---- Gallery pass (large renders, unchanged 50KB gate) -----------------
    const classifiable = galleryPool.slice(0, CLASSIFY_MAX)
    if (galleryPool.length > CLASSIFY_MAX) console.warn(`[pdf-images] ${galleryPool.length} gallery candidates; classifying first ${CLASSIFY_MAX}`)
    let galleryIdx: number[]
    let galleryCats: ImgCategory[] = []
    try {
      if (!resizer) throw new Error('no ImageMagick for thumbnails')
      const cats = await classifyImages(await thumbnail(classifiable))
      galleryCats = classifiable.map((_, i) => cats[i] ?? 'other')
      galleryIdx = partitionGallery(galleryCats, MAX_CANDIDATES)
      if (galleryIdx.length === 0) {
        console.warn('[pdf-images] classifier kept no gallery image; falling back to document order')
        galleryIdx = classifiable.map((_, i) => i).slice(0, MAX_CANDIDATES)
      }
    } catch (e) {
      console.error('[pdf-images] gallery classification failed; using document order', e)
      galleryIdx = galleryPool.map((_, i) => i).slice(0, MAX_CANDIDATES)
      galleryCats = []
    }

    // ---- Plan pass (SMALL images with floor-plan geometry) -----------------
    // Skipped without ImageMagick (no identify/thumbnails) or when we rasterised
    // pages (those are full-page renders, not embedded unit plans).
    let planPool: string[] = []
    if (resizer && !rasterised && galleryCats.length) {
      const smalls = collect('img').filter(f => {
        const b = fs.statSync(path.join(tmpDir, f)).size
        return b >= PLAN_MIN_BYTES && b < MIN_PHOTO_BYTES
      })
      const measured = await mapLimit(smalls, RESIZE_CONCURRENCY, async f => {
        const d = await imageDims(resizer, path.join(tmpDir, f))
        return { f, ok: !!d && isLikelyFloorPlanDims(d.w, d.h) }
      })
      planPool = measured.filter(m => m.ok).map(m => m.f).slice(0, PLAN_CLASSIFY_MAX)
    }
    let planSel: { master: number[]; floor: number[] } = { master: [], floor: [] }
    if (planPool.length && galleryCats.length) {
      try {
        const planCatsRaw = await classifyImages(await thumbnail(planPool))
        const planCats = planPool.map((_, i) => planCatsRaw[i] ?? 'other')
        planSel = selectPlanSection(galleryCats, planCats, MASTERPLAN_IN_PLANS, FLOORPLAN_MAX)
      } catch (e) { console.error('[pdf-images] plan classification failed; no plans this import', e) }
    }

    // ---- Write: gallery files, then plan-section files (master + floor) -----
    const galleryFiles = galleryIdx.map(i => classifiable[i] ?? galleryPool[i])
    const masterFiles = planSel.master.map(i => classifiable[i]).filter(Boolean) as string[]
    const floorFiles = planSel.floor.map(i => planPool[i]).filter(Boolean) as string[]
    const allFiles = [...galleryFiles, ...masterFiles, ...floorFiles]

    const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
    const startIdx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

    const allUrls = await mapLimit(allFiles, RESIZE_CONCURRENCY, async (f, i) => {
      const src = path.join(tmpDir, f)
      const targetIdx = startIdx + i
      if (resizer) {
        const name = `${targetIdx}.jpg`
        try {
          const cs = await imageColorspace(resizer, src)
          await execFileP(resizer, [src, ...colourFixArgs(cs), '-resize', `${MAX_DIM}x${MAX_DIM}>`, '-strip', '-quality', '82', path.join(publicDir, name)], { timeout: PROC_TIMEOUT_MS })
          return `/images/properties/${id}/${name}`
        } catch (e) { console.error('[pdf-images] resize failed, copying original', e) }
      }
      const ext = path.extname(f).toLowerCase()
      const name = `${targetIdx}${ext}`
      fs.copyFileSync(src, path.join(publicDir, name))
      return `/images/properties/${id}/${name}`
    })

    return { gallery: allUrls.slice(0, galleryFiles.length), floorPlans: allUrls.slice(galleryFiles.length) }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
