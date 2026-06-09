'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StorageFolder, StorageFile, Crumb, FolderSearchHit, FileSearchHit } from '@/types'

type FolderView = {
  mode: 'folder'
  folderId: string | null
  breadcrumb: Crumb[]
  folders: StorageFolder[]
  files: StorageFile[]
}
type SearchView = { mode: 'search'; q: string; folders: FolderSearchHit[]; files: FileSearchHit[] }
type View = FolderView | SearchView

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function FilesClient() {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const q = query.trim()
    const url = q
      ? `/api/admin/files?q=${encodeURIComponent(q)}`
      : `/api/admin/files?folder=${folderId ?? 'root'}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load')
      setView(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [folderId, query])

  // Debounce so typing in search doesn't hammer the API.
  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('folderId', folderId ?? 'root')
    Array.from(files).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/admin/files', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function newFolder() {
    const name = window.prompt('New folder name')
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId ?? 'root' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder(f: StorageFolder) {
    const name = window.prompt('Rename folder', f.name)
    if (!name || name === f.name) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/folder/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rename failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(f: StorageFolder) {
    if (!window.confirm(`Delete folder "${f.name}" and everything inside it?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/folder/${f.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function renameFile(f: StorageFile) {
    const name = window.prompt('Rename file', f.name)
    if (!name || name === f.name) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rename failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFile(f: StorageFile) {
    if (!window.confirm(`Delete "${f.name}"?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/${f.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const isSearch = view?.mode === 'search'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl text-navy mb-4">Files</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          type="search"
          aria-label="Search files and folders"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files and folders…"
          className="flex-1 min-w-48 border border-gray-200 px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold"
        />
        <button onClick={newFolder} disabled={busy || isSearch} className="btn-outline text-sm disabled:opacity-40">
          New folder
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy || isSearch} className="btn-primary text-sm disabled:opacity-40">
          {busy ? 'Working…' : 'Upload'}
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={e => upload(e.target.files)} />
      </div>

      {/* Breadcrumb (folder mode only) */}
      {view?.mode === 'folder' && (
        <div className="text-sm text-gray-500 mb-3">
          {view.breadcrumb.map((c, i) => (
            <span key={c.id ?? 'root'}>
              {i > 0 && <span className="mx-1">/</span>}
              <button className="hover:text-navy" onClick={() => setFolderId(c.id)}>{c.name}</button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && view && (
        <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
          {view.folders.length === 0 && view.files.length === 0 && (
            <p className="px-4 py-10 text-center text-gray-400 text-sm">
              {isSearch ? 'No matches.' : 'This folder is empty.'}
            </p>
          )}

          {/* Folders */}
          {view.folders.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <button
                className="flex-1 text-left text-navy font-medium"
                onClick={() => { setQuery(''); setFolderId(f.id) }}
              >
                <span className="mr-2">📁</span>{f.name}
                {isSearch && <span className="text-gray-400 font-normal text-xs ml-2">{(f as FolderSearchHit).pathLabel}</span>}
              </button>
              <button className="text-xs text-gray-400 hover:text-navy" onClick={() => renameFolder(f)}>Rename</button>
              <button className="text-xs text-gray-400 hover:text-red-600" onClick={() => deleteFolder(f)}>Delete</button>
            </div>
          ))}

          {/* Files */}
          {view.files.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <a className="flex-1 text-navy" href={`/api/admin/files/${f.id}/download`}>
                <span className="mr-2">📄</span>{f.name}
                {isSearch && <span className="text-gray-400 text-xs ml-2">{(f as FileSearchHit).pathLabel}</span>}
              </a>
              <span className="text-xs text-gray-400 w-20 text-right">{fmtSize(f.size)}</span>
              <span className="hidden sm:inline text-xs text-gray-400 w-28 truncate">{f.uploadedBy}</span>
              <a className="text-xs text-gray-400 hover:text-navy" href={`/api/admin/files/${f.id}/download`}>Download</a>
              <button className="text-xs text-gray-400 hover:text-navy" onClick={() => renameFile(f)}>Rename</button>
              <button className="text-xs text-gray-400 hover:text-red-600" onClick={() => deleteFile(f)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
