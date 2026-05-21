import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Data-retention enforcement (audit P4). The privacy policy promises enquiry
// data is kept at most 24 months from the last interaction, then deleted.
// This script deletes leads (and their attachment files) past that window.
// Run on the server via cron, e.g. weekly:
//   0 4 * * 0  cd /var/www/worldwise && node scripts/prune-leads.mjs >> /var/log/worldwise-prune.log 2>&1

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LEADS_PATH = path.join(ROOT, 'data', 'leads.json')
const LEAD_FILES_BASE = path.join(ROOT, 'lead-files')

const RETENTION_DAYS = 24 * 30 // ~24 months
const DRY_RUN = process.argv.includes('--dry-run')

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

function main() {
  if (!fs.existsSync(LEADS_PATH)) {
    log('No leads.json — nothing to prune')
    return
  }

  let leads
  try {
    leads = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf-8'))
  } catch (e) {
    log(`ERROR: cannot parse leads.json — aborting: ${e.message}`)
    process.exit(1)
  }

  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000
  const lastInteraction = l => new Date(l.updatedAt ?? l.contactedAt ?? l.createdAt).getTime()

  const keep = []
  const expired = []
  for (const l of leads) {
    if (lastInteraction(l) < cutoff) expired.push(l)
    else keep.push(l)
  }

  if (expired.length === 0) {
    log(`No leads older than ${RETENTION_DAYS} days (total: ${leads.length})`)
    return
  }

  log(`${expired.length} lead(s) past retention${DRY_RUN ? ' [dry-run]' : ''}; keeping ${keep.length}`)

  if (DRY_RUN) {
    for (const l of expired) log(`  would delete: ${l.id} (last ${new Date(lastInteraction(l)).toISOString().slice(0, 10)})`)
    return
  }

  for (const l of expired) {
    const dir = path.join(LEAD_FILES_BASE, String(l.id))
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
  writeFileAtomic(LEADS_PATH, JSON.stringify(keep, null, 2))
  log(`Deleted ${expired.length} lead(s) and their attachments`)
}

main()
