# JSON-store mutation serialization (per-file "mutex") — design

**Date:** 2026-06-10 · **Status:** approved (option A) · closes the long-pending `project_json_mutation_race` item (#9) and audit follow-up.

## Problem

All JSON-store mutations are read-modify-write. In a single PM2 process a fully
synchronous RMW cannot interleave — but nothing *enforces* synchronicity, and the
pattern has been broken twice (lead attachments, `users.ts` bcrypt). Two libs also
swallow corrupt-read errors and return fallbacks that a subsequent mutation would
persist, wiping the store (`dynamic-articles.readJson`, `property-drafts.read`) —
the same class as the auto-blog keyword-bank bug fixed in the audit.

## Decision (approved)

Structural enforcement, not an async lock: one shared synchronous helper whose
callback type makes an `await` inside the critical section impossible.

## New module: `lib/json-store.ts`

Self-contained (imports `fs` only — **no `@/` or extensionless relative imports**,
so it is `node --test --experimental-strip-types`-testable):

```ts
/** Atomic write: temp file + rename. Single implementation for the whole app. */
export function writeFileAtomic(filePath: string, contents: string): void

/** ENOENT → fallback; present-but-unparseable → THROW (never mask as fallback). */
export function readJsonFile<T>(filePath: string, fallback: T): T

/**
 * Synchronous read-modify-write critical section. Reads FRESH state, applies the
 * sync `mutate` callback, writes atomically, returns the new value. The callback
 * type `(current: T) => T` structurally forbids awaits inside the section —
 * that's the mutex (single-threaded Node + single PM2 instance).
 */
export function mutateJsonFile<T>(filePath: string, fallback: T, mutate: (current: T) => T): T
```

`lib/atomic-write.ts` becomes a re-export (`export { writeFileAtomic } from './json-store'`)
so the existing imports (file-storage, scripts' `.ts` users) keep working — one
implementation, zero call-site churn.

## Refactors (behavior-preserving unless stated)

| Module | Change |
| ------ | ------ |
| `lib/leads.ts` | `saveLead`/`updateLead`/`deleteLead` go through `mutateJsonFile`; `getLeads` through `readJsonFile`. `mutateLeadAttachments` keeps its API, now naturally atomic inside one `mutateJsonFile` call. **Bugfix:** `saveLead` id = `Date.now()` made collision-proof (same-ms double submit minted duplicate ids) — bump until unique, like `createProperty`. |
| `lib/properties.ts` | Extract `normalizeProperties(raw)` (array check + legacy `ready→secondary`) shared by `getProperties` and a new internal `mutateProperties(fn)`; `create/update/deleteProperty` use it. Read semantics unchanged (ENOENT→[], corrupt→throw). |
| `lib/users.ts` | `createUser`/`updateUser`/`deleteUser` через `mutateJsonFile` (bcrypt hashes stay computed BEFORE the section). |
| `lib/dynamic-articles.ts` | `publishDraft` mutates `articles.json` via `mutateJsonFile` — **fix:** corrupt store now throws instead of being overwritten with `[draft]`. Display reads (`getDynamicArticles` etc.) keep the forgiving `readJson` (corrupt → empty blog, site alive). `incrementTagIndex` unchanged (computes from arg). |
| `lib/property-drafts.ts` | `addDraft`/`updateDraftFields`/`removeRecord` via `mutateJsonFile` — **fix:** corrupt store throws instead of being clobbered. `listDrafts`/`getDraft` keep the forgiving read. |
| `lib/file-storage.ts` | Untouched — `readStore`/`mutateStore` already implement exactly this pattern. |

## Rules going forward (CLAUDE.md update)

Every `data/*.json` mutation MUST go through `mutateJsonFile` (or a module wrapper
over it). Anything async (hashing, fetch, fs of file bytes) happens before/after
the section, never inside.

## Tests

`lib/json-store.test.ts` (node:test, `fs.mkdtempSync` sandbox): ENOENT→fallback;
corrupt JSON → throws from both `readJsonFile` and `mutateJsonFile` (file left
untouched); mutate round-trip persists and returns the new value; atomic write
leaves no `.tmp` debris; interleaving simulation — two logical mutations applied
sequentially both survive (no lost update).

## Out of scope

Cross-process locking (single PM2 instance is a hard invariant), async mutex,
file-storage refactor, `.mjs` cron scripts (own copies, no shared imports).
