#!/usr/bin/env node
/**
 * recompress-images.cjs — downscale + recompress oversized site images IN PLACE.
 *
 * Why: legacy area/team/property images were committed at print resolution (up to ~3 MB).
 * End users already get small AVIF/WebP via next/image, but the multi-MB originals bloat
 * the repo, slow the rsync deploy, and force an expensive first on-the-fly optimization.
 * This shrinks the SOURCE files while keeping the SAME filename + extension (galleries and
 * data/properties.json reference images by name, so the extension must not change).
 *
 * What it does: for every JPG/PNG under the target dirs larger than MIN_BYTES, if its longest
 * edge exceeds MAX_EDGE it is resized to fit; then it is re-encoded (mozjpeg q80 / png effort)
 * and written back only when the result is actually smaller. Format is preserved.
 *
 * Usage (from worldwise/):
 *   node scripts/recompress-images.cjs            # dry-run: report what would change
 *   node scripts/recompress-images.cjs --apply    # write changes in place
 *   node scripts/recompress-images.cjs --apply public/images/areas   # limit to a subtree
 *
 * Safe to re-run (idempotent: already-small/already-downscaled files are skipped).
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const APPLY = process.argv.includes('--apply')
const MIN_BYTES = 200 * 1024
const MAX_EDGE = 1600
const JPEG_Q = 80
const argDirs = process.argv.slice(2).filter(a => !a.startsWith('--'))
const ROOTS = argDirs.length ? argDirs : [
  'public/images/areas',
  'public/images/team',
  'public/images/properties',
]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jpe?g|png)$/i.test(e.name)) out.push(p)
  }
  return out
}

async function processFile(file) {
  const before = fs.statSync(file).size
  if (before < MIN_BYTES) return null
  const isPng = /\.png$/i.test(file)
  let img = sharp(file, { failOn: 'none' })
  const meta = await img.metadata()
  const longest = Math.max(meta.width || 0, meta.height || 0)

  let pipeline = sharp(file, { failOn: 'none' }).rotate() // honour EXIF orientation
  if (longest > MAX_EDGE) {
    pipeline = pipeline.resize({ width: meta.width >= meta.height ? MAX_EDGE : null,
                                 height: meta.height > meta.width ? MAX_EDGE : null,
                                 withoutEnlargement: true })
  }
  // PNG: full-colour lossless re-encode (NO palette — palette quantises to <=256 colours and
  // would posterize photographic PNG screenshots). Savings come from the downscale to MAX_EDGE.
  pipeline = isPng
    ? pipeline.png({ compressionLevel: 9, effort: 8 })
    : pipeline.jpeg({ quality: JPEG_Q, mozjpeg: true })

  const buf = await pipeline.toBuffer()
  if (buf.length >= before) return { file, before, after: before, skipped: 'no-gain' }
  if (APPLY) {
    const tmp = file + '.tmp'
    fs.writeFileSync(tmp, buf)
    fs.renameSync(tmp, file)
  }
  return { file, before, after: buf.length, dims: longest > MAX_EDGE ? `${meta.width}x${meta.height}->${MAX_EDGE}px` : 'recompress' }
}

;(async () => {
  const files = ROOTS.flatMap(r => walk(r))
  let changed = 0, savedBefore = 0, savedAfter = 0, errors = 0, skipped = 0
  for (const f of files) {
    try {
      const r = await processFile(f)
      if (!r) continue
      if (r.skipped) { skipped++; continue }
      changed++; savedBefore += r.before; savedAfter += r.after
      if (changed <= 8 || changed % 100 === 0) {
        console.log(`${(r.before/1024).toFixed(0)}K -> ${(r.after/1024).toFixed(0)}K  ${r.dims}  ${r.file}`)
      }
    } catch (e) {
      errors++; console.error(`ERROR ${f}: ${e.message}`)
    }
  }
  const mb = n => (n / 1024 / 1024).toFixed(1)
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${changed} files ${APPLY ? 'recompressed' : 'would shrink'}, ${skipped} skipped (no gain), ${errors} errors`)
  console.log(`Total: ${mb(savedBefore)}MB -> ${mb(savedAfter)}MB  (saved ${mb(savedBefore - savedAfter)}MB)`)
})()
