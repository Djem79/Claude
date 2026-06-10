import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeFileAtomic, readJsonFile, mutateJsonFile } from './json-store.ts'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-store-test-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const file = () => path.join(dir, 'store.json')

test('readJsonFile: missing file returns the fallback', () => {
  assert.deepEqual(readJsonFile(file(), { items: [] }), { items: [] })
  assert.deepEqual(readJsonFile(file(), null), null)
})

test('readJsonFile: parses an existing file', () => {
  fs.writeFileSync(file(), JSON.stringify({ a: 1 }))
  assert.deepEqual(readJsonFile(file(), {}), { a: 1 })
})

test('readJsonFile: corrupt file THROWS — never masked as fallback', () => {
  fs.writeFileSync(file(), '{ not json !!!')
  assert.throws(() => readJsonFile(file(), { safe: true }))
})

test('mutateJsonFile: creates the file from the fallback on first mutation', () => {
  const out = mutateJsonFile<string[]>(file(), [], cur => [...cur, 'first'])
  assert.deepEqual(out, ['first'])
  assert.deepEqual(JSON.parse(fs.readFileSync(file(), 'utf-8')), ['first'])
})

test('mutateJsonFile: reads FRESH state on every call — sequential mutations both survive', () => {
  mutateJsonFile<string[]>(file(), [], cur => [...cur, 'a'])
  mutateJsonFile<string[]>(file(), [], cur => [...cur, 'b'])
  assert.deepEqual(readJsonFile<string[]>(file(), []), ['a', 'b'])
})

test('mutateJsonFile: corrupt file throws and the file is left untouched', () => {
  fs.writeFileSync(file(), '{ broken')
  assert.throws(() => mutateJsonFile<string[]>(file(), [], () => ['clobbered']))
  assert.equal(fs.readFileSync(file(), 'utf-8'), '{ broken')
})

test('mutateJsonFile: returns the value produced by the callback', () => {
  fs.writeFileSync(file(), JSON.stringify({ count: 2 }))
  const out = mutateJsonFile(file(), { count: 0 }, cur => ({ count: cur.count + 1 }))
  assert.deepEqual(out, { count: 3 })
})

test('writeFileAtomic: writes content and leaves no temp debris', () => {
  writeFileAtomic(file(), '{"x":1}')
  assert.equal(fs.readFileSync(file(), 'utf-8'), '{"x":1}')
  const leftovers = fs.readdirSync(dir).filter(f => f.includes('.tmp'))
  assert.deepEqual(leftovers, [])
})

test('writeFileAtomic: creates missing parent directories', () => {
  const nested = path.join(dir, 'data', 'deep', 'store.json')
  writeFileAtomic(nested, '{"ok":true}')
  assert.deepEqual(JSON.parse(fs.readFileSync(nested, 'utf-8')), { ok: true })
})

test('writeFileAtomic: overwrite replaces the previous content completely', () => {
  writeFileAtomic(file(), JSON.stringify({ long: 'x'.repeat(1000) }))
  writeFileAtomic(file(), '{"short":1}')
  assert.deepEqual(JSON.parse(fs.readFileSync(file(), 'utf-8')), { short: 1 })
})
