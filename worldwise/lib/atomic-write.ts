// Single implementation lives in lib/json-store.ts (self-contained so it stays
// node:test-runnable). This re-export keeps existing imports working — new code
// should prefer mutateJsonFile/readJsonFile from '@/lib/json-store' directly.
export { writeFileAtomic } from './json-store'
