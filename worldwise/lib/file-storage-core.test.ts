import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanFolderName,
  sanitizeStorageName,
  sniffStorageFile,
  ALLOWED_EXT,
  SNIFF_OK,
  breadcrumb,
  subfoldersOf,
  filesInFolder,
  collectDescendantFolderIds,
  searchStore,
} from './file-storage-core.ts'
import type { FileStore } from '../types'

const store: FileStore = {
  folders: [
    { id: 'a', name: 'Contracts', parentId: null, createdAt: '', createdBy: 'u' },
    { id: 'b', name: 'NDAs', parentId: 'a', createdAt: '', createdBy: 'u' },
    { id: 'c', name: 'Marketing', parentId: null, createdAt: '', createdBy: 'u' },
  ],
  files: [
    { id: 'f1', name: 'deal.pdf', ext: 'pdf', mime: 'application/pdf', size: 1, folderId: 'b', uploadedAt: '', uploadedBy: 'u' },
    { id: 'f2', name: 'logo.png', ext: 'png', mime: 'image/png', size: 1, folderId: null, uploadedAt: '', uploadedBy: 'u' },
    { id: 'f3', name: 'nda-template.pdf', ext: 'pdf', mime: 'application/pdf', size: 1, folderId: 'a', uploadedAt: '', uploadedBy: 'u' },
  ],
}

test('cleanFolderName trims, collapses, strips slashes, caps length', () => {
  assert.equal(cleanFolderName('  My  Folder  '), 'My Folder')
  assert.equal(cleanFolderName('a/b\\c'), 'a b c')
  assert.equal(cleanFolderName(123 as unknown), '')
  assert.equal(cleanFolderName('x'.repeat(80)).length, 60)
})

test('sanitizeStorageName keeps extension, removes unsafe chars', () => {
  assert.equal(sanitizeStorageName('My Report (final).PDF'), 'my-report-final.pdf')
  assert.equal(sanitizeStorageName('../../etc/passwd'), 'etcpasswd')
  assert.equal(sanitizeStorageName(''), 'file')
})

test('sniffStorageFile detects allowed magic bytes', () => {
  assert.equal(sniffStorageFile(Buffer.from('%PDF-1.7')), 'pdf')
  assert.equal(sniffStorageFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), 'png')
  assert.equal(sniffStorageFile(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'zip')
  assert.equal(sniffStorageFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), 'ole')
  assert.equal(sniffStorageFile(Buffer.from('<svg></svg>')), null)
})

test('SNIFF_OK maps detected type to legitimate extensions', () => {
  assert.ok(SNIFF_OK.zip.has('docx') && SNIFF_OK.zip.has('xlsx') && SNIFF_OK.zip.has('zip'))
  assert.ok(SNIFF_OK.ole.has('doc') && SNIFF_OK.ole.has('xls'))
  assert.ok(ALLOWED_EXT.has('pdf') && !ALLOWED_EXT.has('svg'))
})

test('breadcrumb walks root → leaf', () => {
  assert.deepEqual(breadcrumb(store, null), [{ id: null, name: 'Root' }])
  assert.deepEqual(breadcrumb(store, 'b'), [
    { id: null, name: 'Root' },
    { id: 'a', name: 'Contracts' },
    { id: 'b', name: 'NDAs' },
  ])
})

test('subfoldersOf / filesInFolder scope by folderId', () => {
  assert.deepEqual(subfoldersOf(store, null).map(f => f.id), ['a', 'c'])
  assert.deepEqual(subfoldersOf(store, 'a').map(f => f.id), ['b'])
  assert.deepEqual(filesInFolder(store, null).map(f => f.id), ['f2'])
  assert.deepEqual(filesInFolder(store, 'b').map(f => f.id), ['f1'])
})

test('collectDescendantFolderIds includes self + all descendants', () => {
  assert.deepEqual(new Set(collectDescendantFolderIds(store, 'a')), new Set(['a', 'b']))
  assert.deepEqual(collectDescendantFolderIds(store, 'c'), ['c'])
})

test('searchStore matches files & folders by name with path labels', () => {
  const res = searchStore(store, 'nda')
  assert.deepEqual(res.folders.map(f => f.id), ['b'])
  assert.deepEqual(res.files.map(f => f.id), ['f3'])
  assert.equal(res.files[0].pathLabel, 'Root / Contracts')
  const empty = searchStore(store, '   ')
  assert.deepEqual(empty, { folders: [], files: [] })
})
