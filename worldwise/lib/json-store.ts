import fs from 'fs'
import path from 'path'

// Shared JSON data-layer primitives — spec:
// docs/superpowers/specs/2026-06-10-json-store-mutex-design.md
//
// SELF-CONTAINED on purpose (imports `fs` only, no `@/` or extensionless relative
// imports): that keeps it runnable under `node --test --experimental-strip-types`
// like lib/lead-parse.ts. lib/atomic-write.ts re-exports writeFileAtomic from here,
// so this is the single atomic-write implementation in the app.

/**
 * Write a file atomically: write to a temp file in the same directory, then
 * rename over the target. rename(2) is atomic on the same filesystem, so a
 * crash or full disk mid-write can never leave a truncated/corrupted data file.
 * (Single PM2 instance => no cross-process locking needed.)
 */
export function writeFileAtomic(filePath: string, contents: string): void {
  // First write on a fresh server may precede the data/ dir itself.
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

/**
 * Read a JSON store: a genuinely MISSING file (ENOENT) returns `fallback`;
 * a present-but-unparseable file THROWS. Masking a corrupt read as "empty"
 * is how stores get wiped — the next mutation persists the fallback.
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw e
  }
  return JSON.parse(raw) as T
}

/**
 * Synchronous read-modify-write critical section over one JSON file.
 *
 * Reads FRESH state, applies the sync `mutate` callback, writes atomically and
 * returns the new value. The callback type `(current: T) => T` structurally
 * forbids an `await` inside the section — in a single-threaded Node process
 * with a single PM2 instance, that synchronicity IS the per-file mutex: two
 * concurrent requests cannot interleave their read and write.
 *
 * Anything async (bcrypt, fetch, file-byte I/O) must happen BEFORE or AFTER
 * this call, never inside the callback. Every `data/*.json` mutation in the
 * app must go through here (or a module wrapper over it).
 */
export function mutateJsonFile<T>(filePath: string, fallback: T, mutate: (current: T) => T): T {
  const next = mutate(readJsonFile(filePath, fallback))
  writeFileAtomic(filePath, JSON.stringify(next, null, 2))
  return next
}
