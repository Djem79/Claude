import fs from 'fs'

// Write a file atomically: write to a temp file in the same directory, then
// rename over the target. rename(2) is atomic on the same filesystem, so a
// crash or full disk mid-write can never leave a truncated/corrupted data file.
// See audit M3. (Single PM2 instance => no cross-process locking needed.)
export function writeFileAtomic(filePath: string, contents: string): void {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}
