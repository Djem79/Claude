import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const execFileP = promisify(execFile)

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
export const MIN_PHOTO_BYTES = 50 * 1024

// Don't flood the gallery — keep at most this many candidates from one PDF.
const MAX_CANDIDATES = 12

// poppler/imagemagick can take a while on big brochures; cap so a pathological
// PDF can't hang the worker. async execFile keeps the event loop free meanwhile.
const PROC_TIMEOUT_MS = 60_000

// Cap the longest side; brochure rasters are print-resolution (4000px+, multi-MB)
// and would otherwise ship to the browser at full size.
const MAX_DIM = 1600

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

/**
 * Extract candidate photos from a PDF straight into public/images/properties/<id>/,
 * named with the gallery's numeric convention (0.jpg, 1.jpg …) so PropertyForm's
 * existing uploader appends cleanly afterwards. Returns the public URL paths.
 *
 * Primary: `pdfimages -all` — extracts embedded rasters in their NATIVE format
 * (JPEG stays JPEG, no re-encode), so it's fast; non-web formats (ppm/tiff) are
 * dropped by the extension filter. Fallback when none survive the size filter:
 * `pdftoppm -jpeg` (rasterize each page). Each kept image is downscaled/recompressed
 * with ImageMagick so print-resolution rasters don't ship as multi-MB; if ImageMagick
 * is absent it falls back to copying the original. All external tools are run via
 * async execFile (no npm native addon, no event-loop block) with a hard timeout.
 */
export async function extractImagesFromPdf(pdfBuf: Buffer, id: string): Promise<string[]> {
  if (!/^\d{6,20}$/.test(id)) throw new Error(`[pdf-images] invalid id: ${id}`)
  const publicDir = path.join(process.cwd(), 'public', 'images', 'properties', id)
  fs.mkdirSync(publicDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'))

  try {
    const pdfPath = path.join(tmpDir, 'in.pdf')
    fs.writeFileSync(pdfPath, pdfBuf)

    const collect = (prefix: string) =>
      fs.readdirSync(tmpDir)
        .filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f))
        .filter(f => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f))
        .sort()

    try { await execFileP('pdfimages', ['-all', pdfPath, path.join(tmpDir, 'img')], { timeout: PROC_TIMEOUT_MS }) }
    catch (e) { console.error('[pdf-images] pdfimages failed', e) }
    let usable = collect('img')

    if (usable.length === 0) {
      try { await execFileP('pdftoppm', ['-jpeg', '-r', '120', pdfPath, path.join(tmpDir, 'page')], { timeout: PROC_TIMEOUT_MS }) }
      catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
      usable = collect('page')
    }
    usable = usable.slice(0, MAX_CANDIDATES)

    const resizer = await findResizer()

    // Continue the gallery's numeric naming after anything already present.
    const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
    let idx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

    const urls: string[] = []
    for (const f of usable) {
      const src = path.join(tmpDir, f)
      let name: string
      if (resizer) {
        name = `${idx}.jpg`
        try {
          // `1600x1600>` only shrinks (never upscales); -strip drops metadata.
          await execFileP(resizer, [src, '-resize', `${MAX_DIM}x${MAX_DIM}>`, '-strip', '-quality', '82', path.join(publicDir, name)], { timeout: PROC_TIMEOUT_MS })
        } catch (e) {
          console.error('[pdf-images] resize failed, copying original', e)
          const ext = path.extname(f).toLowerCase()
          name = `${idx}${ext}`
          fs.copyFileSync(src, path.join(publicDir, name))
        }
      } else {
        const ext = path.extname(f).toLowerCase()
        name = `${idx}${ext}`
        fs.copyFileSync(src, path.join(publicDir, name))
      }
      urls.push(`/images/properties/${id}/${name}`)
      idx++
    }
    return urls
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
