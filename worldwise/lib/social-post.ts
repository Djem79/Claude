// Fan-out of approved Telegram-channel posts to Russian social networks
// (VK, Odnoklassniki). Pure module: only node:crypto — no fs/next imports,
// so it stays `node --test --experimental-strip-types`-able.
//
// Design rules (mirror postPlanToChannel in the webhook):
// - Missing env vars = network not configured = silently skipped, never an error.
// - A configured network that fails to post reports { ok: false } — callers
//   surface it, nothing throws (an unobserved rejection would crash the single
//   PM2 process).
// - Image is optional; on image-upload failure we degrade to a text-only post
//   rather than dropping the network.

import { createHash } from 'node:crypto'

export type SocialNetwork = 'vk' | 'ok'

export interface SocialResult {
  network: SocialNetwork
  ok: boolean
  error?: string
}

const HTTP_TIMEOUT = 10000

// ---------------------------------------------------------------------------
// Config

function vkConfig() {
  const token = process.env.VK_ACCESS_TOKEN
  const groupId = process.env.VK_GROUP_ID
  return token && groupId ? { token, groupId } : null
}

function okConfig() {
  const token = process.env.OK_ACCESS_TOKEN
  const appKey = process.env.OK_APP_KEY
  const appSecret = process.env.OK_APP_SECRET
  // OK's "вечный session_key" comes with a precomputed Session_secret_key —
  // when set, it is used directly and OK_APP_SECRET may be omitted.
  const sessionSecret = process.env.OK_SESSION_SECRET
  const groupId = process.env.OK_GROUP_ID
  return token && appKey && (appSecret || sessionSecret) && groupId
    ? { token, appKey, appSecret, sessionSecret, groupId }
    : null
}

export function socialNetworksConfigured(): SocialNetwork[] {
  const nets: SocialNetwork[] = []
  if (vkConfig()) nets.push('vk')
  if (okConfig()) nets.push('ok')
  return nets
}

// ---------------------------------------------------------------------------
// VK (api.vk.com, v5.199)

const VK_API = 'https://api.vk.com/method'
const VK_V = '5.199'

// VK returns HTTP 200 with an {error} body — every call must check it.
async function vkCall(method: string, params: Record<string, string>, token: string): Promise<unknown> {
  const body = new URLSearchParams({ ...params, access_token: token, v: VK_V })
  const res = await fetch(`${VK_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(HTTP_TIMEOUT),
  })
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}`)
  const json = (await res.json()) as { response?: unknown; error?: { error_code?: number; error_msg?: string } }
  if (json.error) throw new Error(`${method}: [${json.error.error_code}] ${json.error.error_msg}`)
  return json.response
}

async function vkUploadWallPhoto(image: Buffer, groupId: string, token: string): Promise<string> {
  const server = (await vkCall('photos.getWallUploadServer', { group_id: groupId }, token)) as { upload_url: string }
  const fd = new FormData()
  fd.append('photo', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'post.png')
  const upRes = await fetch(server.upload_url, { method: 'POST', body: fd, signal: AbortSignal.timeout(HTTP_TIMEOUT * 2) })
  if (!upRes.ok) throw new Error(`vk upload HTTP ${upRes.status}`)
  const up = (await upRes.json()) as { server: number; photo: string; hash: string }
  const saved = (await vkCall('photos.saveWallPhoto', {
    group_id: groupId,
    server: String(up.server),
    photo: up.photo,
    hash: up.hash,
  }, token)) as Array<{ owner_id: number; id: number }>
  const p = saved[0]
  if (!p) throw new Error('vk saveWallPhoto: empty response')
  return `photo${p.owner_id}_${p.id}`
}

async function postToVk(text: string, image: Buffer | null): Promise<void> {
  const cfg = vkConfig()
  if (!cfg) return
  let attachments: string | undefined
  if (image) {
    try {
      attachments = await vkUploadWallPhoto(image, cfg.groupId, cfg.token)
    } catch (e) {
      console.error('[social-post] vk photo upload failed, falling back to text-only:', e)
    }
  }
  const params: Record<string, string> = {
    owner_id: `-${cfg.groupId}`,
    from_group: '1',
    message: text,
  }
  if (attachments) params.attachments = attachments
  await vkCall('wall.post', params, cfg.token)
}

// ---------------------------------------------------------------------------
// Odnoklassniki (api.ok.ru REST)

const OK_API = 'https://api.ok.ru/fb.do'

/** md5(access_token + application_secret_key) — the OAuth-token session secret. */
export function okSessionSecret(accessToken: string, appSecret: string): string {
  return createHash('md5').update(accessToken + appSecret).digest('hex')
}

/**
 * OK request signature: md5 of the alphabetically sorted `key=value` pairs
 * (WITHOUT access_token) concatenated with the session secret. For OAuth
 * tokens the session secret is okSessionSecret(); permanent session keys ship
 * with a ready-made Session_secret_key. Exported for unit tests.
 */
export function okSignature(params: Record<string, string>, sessionSecret: string): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('')
  return createHash('md5').update(sorted + sessionSecret).digest('hex')
}

interface OkAuth { token: string; appKey: string; appSecret?: string; sessionSecret?: string }

async function okCall(
  method: string,
  params: Record<string, string>,
  cfg: OkAuth,
): Promise<unknown> {
  const base: Record<string, string> = { ...params, application_key: cfg.appKey, format: 'json', method }
  const sessionSecret = cfg.sessionSecret ?? okSessionSecret(cfg.token, cfg.appSecret ?? '')
  const sig = okSignature(base, sessionSecret)
  const body = new URLSearchParams({ ...base, sig, access_token: cfg.token })
  const res = await fetch(OK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(HTTP_TIMEOUT),
  })
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}`)
  const json = (await res.json()) as { error_code?: number; error_msg?: string }
  if (json && typeof json === 'object' && 'error_code' in json) {
    throw new Error(`${method}: [${json.error_code}] ${json.error_msg}`)
  }
  return json
}

async function okUploadPhoto(image: Buffer, cfg: OkAuth & { groupId: string }): Promise<string> {
  const up = (await okCall('photosV2.getUploadUrl', { gid: cfg.groupId, count: '1' }, cfg)) as { upload_url: string; photo_ids: string[] }
  const fd = new FormData()
  fd.append('pic1', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'post.png')
  const upRes = await fetch(up.upload_url, { method: 'POST', body: fd, signal: AbortSignal.timeout(HTTP_TIMEOUT * 2) })
  if (!upRes.ok) throw new Error(`ok upload HTTP ${upRes.status}`)
  const uploaded = (await upRes.json()) as { photos?: Record<string, { token: string }> }
  const first = uploaded.photos && Object.values(uploaded.photos)[0]
  if (!first?.token) throw new Error('ok upload: no photo token in response')
  return first.token
}

async function postToOk(text: string, image: Buffer | null): Promise<void> {
  const cfg = okConfig()
  if (!cfg) return
  const media: unknown[] = [{ type: 'text', text }]
  if (image) {
    try {
      const photoToken = await okUploadPhoto(image, cfg)
      media.push({ type: 'photo', list: [{ id: photoToken }] })
    } catch (e) {
      console.error('[social-post] ok photo upload failed, falling back to text-only:', e)
    }
  }
  await okCall('mediatopic.post', {
    gid: cfg.groupId,
    type: 'GROUP_THEME',
    attachment: JSON.stringify({ media }),
  }, cfg)
}

// ---------------------------------------------------------------------------
// Fan-out

/**
 * Post to every configured network in parallel. Never throws; each network
 * reports its own outcome. Empty array = nothing configured.
 */
export async function fanOutPost(text: string, image: Buffer | null): Promise<SocialResult[]> {
  // Failures are console.error'd HERE, not only carried in the result — the
  // callback-answer toast that shows the summary is ephemeral, and a silent
  // wall.post error once cost days of missing VK posts with zero log trail.
  const fail = (network: SocialNetwork) => (e: unknown): SocialResult => {
    const error = String(e instanceof Error ? e.message : e)
    console.error(`[social-post] ${network} post failed:`, error)
    return { network, ok: false, error }
  }
  const jobs: Array<Promise<SocialResult>> = []
  if (vkConfig()) {
    jobs.push(postToVk(text, image).then((): SocialResult => ({ network: 'vk', ok: true })).catch(fail('vk')))
  }
  if (okConfig()) {
    jobs.push(postToOk(text, image).then((): SocialResult => ({ network: 'ok', ok: true })).catch(fail('ok')))
  }
  return Promise.all(jobs)
}

const NETWORK_LABEL: Record<SocialNetwork, string> = { vk: 'VK', ok: 'OK' }

/**
 * Short suffix for the Telegram callback answer and the persistent status
 * message, e.g. " · VK ✓ · OK ⚠️ (mediatopic.post: [102] ...)". Failures carry
 * the error (truncated) — a bare ⚠️ told the admin nothing actionable.
 * Empty string when no networks are configured (the common pre-setup state).
 */
export function formatFanOutSummary(results: SocialResult[]): string {
  if (results.length === 0) return ''
  return results.map(r => {
    if (r.ok) return ` · ${NETWORK_LABEL[r.network]} ✓`
    const why = r.error ? ` (${r.error.length > 60 ? `${r.error.slice(0, 60)}…` : r.error})` : ''
    return ` · ${NETWORK_LABEL[r.network]} ⚠️${why}`
  }).join('')
}
