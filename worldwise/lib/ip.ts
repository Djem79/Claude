import type { NextRequest } from 'next/server'

// Resolve the client IP for rate limiting.
//
// SECURITY (audit H3): trust ONLY `x-real-ip`. nginx sets it to `$remote_addr`
// (the real connecting peer) and overrides any client-supplied value, so it is
// the only header that isn't spoofable in our topology.
//
// We deliberately do NOT trust `cf-connecting-ip` or the `x-forwarded-for`
// chain: worldwise.pro is currently DNS-only on Cloudflare (traffic hits the
// origin directly, NOT through the CF proxy), so those headers are fully
// attacker-controlled and would let a client mint a fresh rate-limit bucket.
//
// If the site is ever moved behind the Cloudflare proxy, configure nginx's
// real_ip module (`set_real_ip_from <CF ranges>; real_ip_header CF-Connecting-IP`)
// so `$remote_addr` (and thus X-Real-IP) stays the real visitor IP — this code
// then needs no change.
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? 'unknown'
}
