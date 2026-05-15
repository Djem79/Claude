# Design: Replace Emoji Icons in WhyWorldwise Section

**Date:** 2026-05-10  
**Status:** Approved  
**File affected:** `components/WhyWorldwise.tsx`

## Problem

The four emoji icons (🔑 📊 🌍 ✅) in the WhyWorldwise section clash with the site's luxury navy/gold aesthetic. Emojis render differently across OS/browser, look informal, and undermine the premium positioning of the brand.

## Solution

Replace emojis with custom inline SVG icons styled to match the brand. No new npm dependencies.

## Icon Design

| Card | Icon concept | SVG shape |
|------|-------------|-----------|
| End-to-End Support | House | Roof outline + walls |
| Data-Driven Advice | Trending up | Polyline growth + arrow |
| 30+ Countries Served | Globe | Circle + horizon + meridians |
| RERA Certified | Shield with checkmark | Shield path + ✓ |

## Visual Style

- **Stroke color:** `currentColor` (parent set to `text-gold`)
- **Stroke width:** `1.5` — thin, elegant
- **Fill:** `none`
- **ViewBox:** `0 0 24 24`
- **Display size:** `w-7 h-7` (28px)

## Container

Each SVG wrapped in:
```
w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-4
```
Replaces the current `<div className="text-3xl mb-3">{p.icon}</div>`.

## Implementation Scope

Single file change: `components/WhyWorldwise.tsx`  
- Remove `icon` string field from `points` array  
- Add `icon` as JSX (`React.ReactNode`) with inline SVG  
- Replace the emoji render div with the new container + SVG
