# Navbar Transparency Fix + White Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the navbar always visible on light-background pages, and replace the existing logo with a white/gold SVG version readable on the navy navbar.

**Architecture:** Three file changes — create a new SVG logo file, update `Navigation.tsx` to use it and accept a `transparent` prop, then pass that prop from the homepage only. All other pages get solid navy navbar by default.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, inline SVG

---

### Task 1: Create logo-white.svg

**Files:**
- Create: `worldwise/public/images/logo-white.svg`

- [ ] **Step 1: Write the SVG file**

Create `worldwise/public/images/logo-white.svg` with this exact content:

```svg
<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg">
  <polygon points="0,2 14,2 28,48 14,48" fill="#C9A96E"/>
  <polygon points="14,48 28,48 36,22 22,22" fill="#C9A96E"/>
  <polygon points="22,22 36,22 50,48 36,48" fill="#FFFFFF"/>
  <polygon points="36,48 50,48 64,2 50,2" fill="#FFFFFF"/>
  <text x="32" y="60" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="9" fill="#FFFFFF" letter-spacing="2">WORLDWISE</text>
  <text x="32" y="70" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="6" fill="rgba(255,255,255,0.7)" letter-spacing="3">REAL ESTATE</text>
</svg>
```

- [ ] **Step 2: Verify the file exists**

```bash
ls -la /Users/dzhambulat/Documents/Claude/worldwise/public/images/logo-white.svg
```

Expected: file listed with non-zero size.

- [ ] **Step 3: Commit**

```bash
git add worldwise/public/images/logo-white.svg
git commit -m "Add white/gold SVG logo for dark navbar background"
```

---

### Task 2: Update Navigation — new logo + transparent prop

**Files:**
- Modify: `worldwise/components/Navigation.tsx`

- [ ] **Step 1: Replace the file contents**

Write this to `worldwise/components/Navigation.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navigation({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solidNav = scrolled || !transparent

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solidNav ? 'bg-navy/95 backdrop-blur-sm shadow-lg py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src="/images/logo-white.svg" alt="Worldwise Real Estate" className="h-12 w-auto" />
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
          <Link href="/properties" className="hover:text-gold transition-colors">Properties</Link>
          <Link href="/#areas" className="hover:text-gold transition-colors">Areas</Link>
          <Link href="/#about" className="hover:text-gold transition-colors">About</Link>
          <Link href="/#blog" className="hover:text-gold transition-colors">Insights</Link>
          <Link href="/#contact" className="btn-primary text-sm px-6 py-2.5">
            Free Consultation
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-navy border-t border-white/10 px-6 py-6 flex flex-col gap-5 text-white">
          <Link href="/properties" onClick={() => setMenuOpen(false)} className="hover:text-gold">Properties</Link>
          <Link href="/#areas" onClick={() => setMenuOpen(false)} className="hover:text-gold">Areas</Link>
          <Link href="/#about" onClick={() => setMenuOpen(false)} className="hover:text-gold">About</Link>
          <Link href="/#blog" onClick={() => setMenuOpen(false)} className="hover:text-gold">Insights</Link>
          <Link href="/#contact" onClick={() => setMenuOpen(false)} className="btn-primary text-center">
            Free Consultation
          </Link>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/dzhambulat/Documents/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add worldwise/components/Navigation.tsx
git commit -m "Update Navigation: white SVG logo, transparent prop for homepage"
```

---

### Task 3: Pass transparent prop from homepage

**Files:**
- Modify: `worldwise/app/page.tsx` — line 22, change `<Navigation />` to `<Navigation transparent />`

- [ ] **Step 1: Edit app/page.tsx**

In `worldwise/app/page.tsx`, find this line:

```tsx
      <Navigation />
```

Replace with:

```tsx
      <Navigation transparent />
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/dzhambulat/Documents/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/page.tsx
git commit -m "Homepage uses transparent navbar; all other pages solid navy"
```

---

### Task 4: Deploy to production

**Files:** None (server-side only)

- [ ] **Step 1: Backup server data**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

Expected: no output (success).

- [ ] **Step 2: Sync files**

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  /Users/dzhambulat/Documents/Claude/worldwise/ root@62.238.35.20:/var/www/worldwise/
```

Expected: transferred files listed including `public/images/logo-white.svg`, `components/Navigation.tsx`, `app/page.tsx`.

- [ ] **Step 3: Build and restart on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm run build && pm2 restart worldwise"
```

Expected: `✓ Compiled successfully` then `[PM2] [worldwise](0) ✓` with status `online`.
