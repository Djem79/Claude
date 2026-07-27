import type { NextRequest } from 'next/server'

// Resolve the client IP for rate limiting.
//
// SECURITY (audit H3): trust ONLY `x-real-ip`. nginx sets it to `$remote_addr`
// (the real connecting peer) and overrides any client-supplied value, so it is
// the only header that isn't spoofable in our topology.
//
// We deliberately do NOT trust `cf-connecting-ip` or the `x-forwarded-for` chain:
// at the application layer both are just request headers a client can set freely,
// which would let anyone mint a fresh rate-limit bucket per request.
//
// Topology (since 2026-07): worldwise.pro IS proxied through Cloudflare, the origin
// firewall only accepts CF ranges, and nginx restores the real visitor IP via its
// real_ip module (/etc/nginx/conf.d/cloudflare-realip.conf: `set_real_ip_from <CF
// ranges>; real_ip_header CF-Connecting-IP`). That module rewrites `$remote_addr`
// BEFORE nginx sets X-Real-IP, so this header carries the true visitor IP and the
// code below needs no change. Earlier comments here described the pre-July DNS-only
// setup — do not take a stale comment as a description of the live topology.
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? 'unknown'
}
