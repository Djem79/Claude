import type { NextRequest } from 'next/server'

// Resolve the client IP for rate limiting.
//
// SECURITY (audit H3): these headers are client-supplied and only trustworthy
// when the request actually passed through our front proxy. `cf-connecting-ip`
// is set by Cloudflare on every proxied request; `x-real-ip` is set by nginx.
// We deliberately do NOT trust the `x-forwarded-for` chain (fully attacker-
// controlled) so a spoofed header can't mint a fresh rate-limit bucket.
//
// This is only sound if the origin rejects traffic that bypasses Cloudflare
// (firewall to Cloudflare IPs / Authenticated Origin Pulls). Without that,
// an attacker hitting the origin directly can still spoof these — close that
// at the infrastructure layer.
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
