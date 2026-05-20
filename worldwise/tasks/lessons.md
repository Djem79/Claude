# Lessons

## 2026-05-21 — Verify request path BEFORE locking an origin firewall

**What happened:** During H3 hardening I assumed `worldwise.pro` was proxied
through Cloudflare (orange cloud) and locked ufw to Cloudflare IP ranges only.
The domain is actually **DNS-only** — it resolves directly to the origin
`62.238.35.20`, so traffic never touches Cloudflare. The lockdown blocked all
real visitors and took the site down for ~30–60s until I rolled back.

**Why it happened:** I trusted CLAUDE.md's "DNS managed via Cloudflare" + the
presence of CF IP ranges in ufw, and inferred proxying without verifying the
actual public DNS resolution or request path.

**Rules to prevent repeat:**
- Before any origin firewall / IP-allowlist change, run `dig +short <domain>` and
  confirm whether it resolves to the proxy (Cloudflare) or the origin IP. DNS-only
  vs proxied changes everything.
- Confirm which header carries the trustworthy client IP for the *actual* topology
  (`x-real-ip` set by nginx when nginx is the edge; `cf-connecting-ip` only when
  CF is genuinely in the path AND origin is CF-locked).
- For risky prod infra changes, keep an open SSH session and a one-command rollback
  ready, and verify externally (`curl https://domain`) immediately after — which is
  how this was caught fast.
- A redundant rule below a specific allowlist (`ALLOW Anywhere`) silently negates
  the allowlist — but removing it is only safe once you've confirmed the proxy is
  actually in front.
