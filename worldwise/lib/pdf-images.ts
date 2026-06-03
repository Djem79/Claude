import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
export const MIN_PHOTO_BYTES = 50 * 1024

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}

/**
 * Extract candidate photos from a PDF straight into public/images/properties/<id>/,
 * named with the gallery's numeric convention (0.png, 1.png …) so PropertyForm's
 * existing uploader appends cleanly afterwards. Returns the public URL paths.
 *
 * Primary: `pdfimages -png` (embedded rasters, forced to web-safe PNG). Fallback
 * when none survive the size filter: `pdftoppm -png` (rasterize each page). Both
 * are poppler-utils binaries invoked via child_process — no npm native addon.
 */
export function extractImagesFromPdf(pdfBuf: Buffer, id: string): string[] {
  const publicDir = path.join(process.cwd(), 'public', 'images', 'properties', id)
  fs.mkdirSync(publicDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'))
  const pdfPath = path.join(tmpDir, 'in.pdf')
  fs.writeFileSync(pdfPath, pdfBuf)

  const collect = (prefix: string) =>
    fs.readdirSync(tmpDir)
      .filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f))
      .filter(f => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f))
      .sort()

  try { execFileSync('pdfimages', ['-png', pdfPath, path.join(tmpDir, 'img')], { stdio: 'ignore' }) }
  catch (e) { console.error('[pdf-images] pdfimages failed', e) }
  let usable = collect('img')

  if (usable.length === 0) {
    try { execFileSync('pdftoppm', ['-png', '-r', '150', pdfPath, path.join(tmpDir, 'page')], { stdio: 'ignore' }) }
    catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
    usable = collect('page')
  }

  // Continue the gallery's numeric naming after anything already present.
  const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
  let idx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f, 10))) + 1

  const urls: string[] = []
  for (const f of usable) {
    const name = `${idx}.png`
    fs.copyFileSync(path.join(tmpDir, f), path.join(publicDir, name))
    urls.push(`/images/properties/${id}/${name}`)
    idx++
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
  return urls
}
