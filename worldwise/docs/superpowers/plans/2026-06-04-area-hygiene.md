# Area Data Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the property `area` field consistent for new imports and form submissions via a controlled Dubai-community vocabulary + a tolerant canonicalizer; never rewrite existing records.

**Architecture:** A new pure, unit-tested `lib/dubai-areas.ts` exposes the vocabulary (`DUBAI_AREAS`) and `canonicalizeArea(raw)`. The import route canonicalizes the AI-extracted area (kept OUT of the pure `property-map.ts` so its node:test stays resolvable), the extraction prompt is biased toward the list, and PropertyForm offers a dropdown + "Other…" fallback.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, node:test (type-stripping) for the pure helper.

**Spec:** `docs/superpowers/specs/2026-06-04-area-hygiene-design.md`

**Path note:** Repo parent dir contains a non-breaking space. In every shell step: `GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"; cd "$GD/worldwise"`. Edit via `python3`/heredoc against `"$GD/worldwise/..."`; confirm with `git -C "$GD" status --short`. Run with `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

**Testability note:** `canonicalizeArea` is applied in `app/api/admin/import/route.ts` and `PropertyForm.tsx`, NOT inside `lib/property-map.ts` — a value-import of `@/lib/dubai-areas` into property-map would make `property-map.test.ts` unresolvable under `node --test`. Same end effect (area canonicalized at entry).

---

## File Structure

- **Create** `lib/dubai-areas.ts` — `DUBAI_AREAS`, `canonicalizeArea`.
- **Create** `lib/dubai-areas.test.ts` — node:test.
- **Modify** `lib/property-extract.ts` — inject the controlled list into the `area` prompt instruction.
- **Modify** `app/api/admin/import/route.ts` — canonicalize the extracted area.
- **Modify** `app/admin/property/PropertyForm.tsx` — area dropdown + "Other…" fallback.

---

## Task 1: Controlled vocabulary + canonicalizer (TDD)

**Files:** Create `lib/dubai-areas.ts`, Test `lib/dubai-areas.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/dubai-areas.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUBAI_AREAS, canonicalizeArea } from './dubai-areas.ts'

test('canonical name returns itself (case/space-insensitive)', () => {
  assert.equal(canonicalizeArea('Dubai Marina'), 'Dubai Marina')
  assert.equal(canonicalizeArea('dubai marina'), 'Dubai Marina')
  assert.equal(canonicalizeArea('  BUSINESS   BAY '), 'Business Bay')
})

test('variant maps to canonical via alias', () => {
  assert.equal(canonicalizeArea('Jumeirah Lake Towers'), 'JLT')
  assert.equal(canonicalizeArea('Sports city'), 'Dubai Sports City')
  assert.equal(canonicalizeArea('Sport City'), 'Dubai Sports City')
  assert.equal(canonicalizeArea('Dubai Investment Park 2'), 'Dubai Investment Park')
  assert.equal(canonicalizeArea('Sobha Hartland, Mohammed Bin Rashid City (MBR City)'), 'Mohammed Bin Rashid City')
})

test('unknown area is returned unchanged (never invented)', () => {
  assert.equal(canonicalizeArea('Danube Properties'), 'Danube Properties')
  assert.equal(canonicalizeArea('Dubai'), 'Dubai')
})

test('empty/whitespace returns empty string', () => {
  assert.equal(canonicalizeArea('   '), '')
  assert.equal(canonicalizeArea(''), '')
})

test('every alias target exists in DUBAI_AREAS', () => {
  const set = new Set(DUBAI_AREAS)
  for (const v of ['JLT', 'Dubai Sports City', 'Mohammed Bin Rashid City', 'Expo City', 'JBR', 'Dubai Investment Park', 'Sobha Hartland', 'Arjan', 'Dubailand', 'Meydan', 'Dubai Maritime City'])
    assert.ok(set.has(v), v)
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; node --test --experimental-strip-types lib/dubai-areas.test.ts`
Expected: FAIL (cannot find module './dubai-areas.ts').

- [ ] **Step 3: Write the implementation** — create `lib/dubai-areas.ts`:

```ts
// Controlled vocabulary for the property `area` field, used to keep new imports and
// form submissions consistent. Pure + dependency-free (unit-tested). Existing
// records are not rewritten — this only canonicalizes data at entry.

export const DUBAI_AREAS: string[] = [
  'Al Furjan',
  'Al Jaddaf',
  'Arjan',
  'Business Bay',
  'Damac Hills',
  'Damac Hills 2',
  'Downtown Dubai',
  'Dubai Creek Harbour',
  'Dubai Harbour',
  'Dubai Hills Estate',
  'Dubai Investment Park',
  'Dubai Marina',
  'Dubai Maritime City',
  'Dubai Production City',
  'Dubai Science Park',
  'Dubai South',
  'Dubai Sports City',
  'Dubailand',
  'Emaar Beachfront',
  'Expo City',
  'JBR',
  'JLT',
  'JVC',
  'Meydan',
  'Mohammed Bin Rashid City',
  'Palm Jumeirah',
  'Sobha Hartland',
  'The Oasis',
  'The Valley',
]

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Normalized variant -> canonical name. Every target must exist in DUBAI_AREAS.
const ALIAS_MAP: Record<string, string> = {
  'jumeirah lake towers': 'JLT',
  'sport city': 'Dubai Sports City',
  'sports city': 'Dubai Sports City',
  'maritime city': 'Dubai Maritime City',
  'jumeirah beach residences (jbr)': 'JBR',
  'jumeirah beach residence': 'JBR',
  'dubai investment park 2': 'Dubai Investment Park',
  'dubai expo': 'Expo City',
  'mbr city': 'Mohammed Bin Rashid City',
  'mbr city district 7': 'Mohammed Bin Rashid City',
  'meydan, district 11': 'Meydan',
  'sobha hartland, mohammed bin rashid city (mbr city)': 'Mohammed Bin Rashid City',
  'sobha hartland, mbr city, dubai': 'Sobha Hartland',
  'arjan, dubailand': 'Arjan',
  'city of arabia, dubailand': 'Dubailand',
}

const CANON_BY_NORM: Record<string, string> = Object.fromEntries(
  DUBAI_AREAS.map(a => [norm(a), a])
)

/**
 * Map a raw area string to a canonical Dubai community. Exact (case-insensitive)
 * canonical match wins; else an alias match; else the trimmed raw is returned
 * unchanged (never invents, never drops — generic "Dubai" stays "Dubai").
 */
export function canonicalizeArea(raw: string): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  const n = norm(trimmed)
  return CANON_BY_NORM[n] ?? ALIAS_MAP[n] ?? trimmed
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `node --test --experimental-strip-types lib/dubai-areas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/lib/dubai-areas.ts worldwise/lib/dubai-areas.test.ts
git -C "$GD" commit -m "feat(areas): controlled Dubai-community vocabulary + canonicalizeArea"
```

---

## Task 2: Canonicalize area on PDF import

**Files:** Modify `app/api/admin/import/route.ts`

- [ ] **Step 1: Add the import.** After the existing `import { extractPropertyFromPdf } from '@/lib/property-extract'` line, add:
`import { canonicalizeArea } from '@/lib/dubai-areas'`

- [ ] **Step 2: Canonicalize after extraction.** Find:

```ts
  let fields
  try {
    fields = await extractPropertyFromPdf(buf)
  } catch (e) {
    return NextResponse.json({ error: `Extraction failed: ${(e as Error).message}` }, { status: 502 })
  }
```

and insert, immediately after the `catch { ... }` block:

```ts
  if (fields.area) fields.area = canonicalizeArea(fields.area)
```

- [ ] **Step 3: Build**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Failed|error" | head`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add "worldwise/app/api/admin/import/route.ts"
git -C "$GD" commit -m "feat(import): canonicalize extracted area to controlled vocabulary"
```

---

## Task 3: Bias the extraction prompt toward the controlled list

**Files:** Modify `lib/property-extract.ts`

- [ ] **Step 1: Add the import.** At the top of the file (with the other imports), add:
`import { DUBAI_AREAS } from '@/lib/dubai-areas'`

- [ ] **Step 2: Update the `area` instruction.** In the SYSTEM template literal, replace this line:

```
- area: the Dubai district / community the project is located in (e.g. "Dubai Marina", "Business Bay", "Palm Jumeirah", "Dubai Hills", "JVC", "Dubai Creek Harbour"). Infer it from the location / address / map section. Use the community name, NOT the full street address. This field is important — do your best to determine it.
```

with:

```
- area: the Dubai community the project is in. Choose the SINGLE closest match from this controlled list: ${DUBAI_AREAS.join(', ')}. If (and only if) none of them fits, return a short community name (never a full street address). Infer it from the location / address / map section. This field is important — do your best to determine it.
```

(The SYSTEM value is a template literal, so `${DUBAI_AREAS.join(', ')}` interpolates at module load.)

- [ ] **Step 3: Build** → "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/lib/property-extract.ts
git -C "$GD" commit -m "feat(import): bias area extraction toward controlled vocabulary"
```

---

## Task 4: Area dropdown + "Other…" in PropertyForm

**Files:** Modify `app/admin/property/PropertyForm.tsx`

- [ ] **Step 1: Add the import.** With the other imports at the top, add:
`import { DUBAI_AREAS } from '@/lib/dubai-areas'`

- [ ] **Step 2: Add custom-area state.** After the line `const [amenitiesRaw, setAmenitiesRaw] = useState((property?.amenities ?? []).join('\n'))`, add:

```tsx
  const [areaCustom, setAreaCustom] = useState<boolean>(() => !!property?.area && !DUBAI_AREAS.includes(property.area))
```

- [ ] **Step 3: Replace the area field.** Replace:

```tsx
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Area / District *</label>
          <input className={fieldClass} value={form.area} onChange={e => set('area', e.target.value)} required />
        </div>
```

with:

```tsx
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Area / District *</label>
          <select
            className={fieldClass}
            value={areaCustom ? '__other__' : (form.area || '')}
            onChange={e => {
              if (e.target.value === '__other__') { setAreaCustom(true); set('area', '') }
              else { setAreaCustom(false); set('area', e.target.value) }
            }}
            required
          >
            <option value="" disabled>Select area…</option>
            {DUBAI_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            <option value="__other__">Other…</option>
          </select>
          {areaCustom && (
            <input
              className={`${fieldClass} mt-2`}
              value={form.area || ''}
              onChange={e => set('area', e.target.value)}
              placeholder="Custom area / community"
              required
            />
          )}
        </div>
```

- [ ] **Step 4: Build** → "Compiled successfully".

- [ ] **Step 5: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add "worldwise/app/admin/property/PropertyForm.tsx"
git -C "$GD" commit -m "feat(admin): area dropdown (controlled vocabulary) + Other fallback"
```

---

## Task 5: Full verification

- [ ] **Step 1: Unit tests** — `node --test --experimental-strip-types lib/*.test.ts` → all pass (incl. dubai-areas; property-map unaffected).
- [ ] **Step 2: Build + lint** — `npm run build` "Compiled successfully"; `npx eslint lib/dubai-areas.ts lib/property-extract.ts "app/api/admin/import/route.ts" "app/admin/property/PropertyForm.tsx"` → 0 errors.
- [ ] **Step 3: Manual (after deploy; needs server data + a real import):** import a brochure → the staged draft's `area` is a canonical value (e.g. "JLT", "Dubai Sports City"); in PropertyForm the Area field is a dropdown of `DUBAI_AREAS` with a working "Other…" text fallback; editing a property whose area is off-list preselects "Other…" with the original value intact.
- [ ] **Step 4:** Report. Deploy is a SEPARATE step on explicit request.

---

## Self-Review (done)

- **Spec coverage:** vocabulary + canonicalizer (T1); import canonicalization (T2 — moved from property-map to the import route for node:test resolvability, same effect, noted in spec deviation); prompt bias (T3); form dropdown + Other (T4). Existing records untouched; pricePerSqft/size out of scope — honored.
- **Type consistency:** `canonicalizeArea(raw: string): string` and `DUBAI_AREAS: string[]` used identically in T2/T3/T4; alias targets guarded by a test.
- **No placeholders:** every code step is complete and copy-paste ready.
