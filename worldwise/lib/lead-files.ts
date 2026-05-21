import path from 'path'

// Lead attachments are stored OUTSIDE public/ so they are never statically
// served — access is only via the authenticated download route. See audit P3.
export const LEAD_FILES_BASE = path.join(process.cwd(), 'lead-files')

// Resolve <base>/<leadId>/<fileId> with a path-traversal guard.
// Returns null if the resolved path escapes the base directory.
export function resolveLeadFileDir(leadId: string, fileId: string): string | null {
  const dir = path.resolve(LEAD_FILES_BASE, leadId, fileId)
  if (dir !== LEAD_FILES_BASE && !dir.startsWith(LEAD_FILES_BASE + path.sep)) return null
  return dir
}

// Magic-byte validation for the allowed attachment types (audit P7) — never
// trust the client-supplied MIME or extension alone. Returns a canonical type
// key, or null if the bytes match no allowed format.
export function sniffAttachment(buf: Buffer): 'pdf' | 'jpeg' | 'png' | 'webp' | 'doc' | 'docx' | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf' // %PDF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  // .doc = OLE compound file; .docx = ZIP container (PK\x03\x04)
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'doc'
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx'
  return null
}

export const ATTACHMENT_CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
