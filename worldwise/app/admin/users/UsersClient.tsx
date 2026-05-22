'use client'

import { useState } from 'react'
import { AdminUser, AdminRole, AdminSection } from '@/types'
import { ALL_SECTIONS, DEFAULT_SECTIONS, effectiveSections } from '@/lib/permissions'

type SafeUser = Omit<AdminUser, 'passwordHash'>

const SECTION_LABEL: Record<AdminSection, string> = {
  properties: 'Properties',
  leads: 'Leads',
  dashboard: 'Dashboard',
}

function toggle(list: AdminSection[], s: AdminSection): AdminSection[] {
  return list.includes(s) ? list.filter(x => x !== s) : [...list, s]
}

function fmt(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function UsersClient({ initialUsers, currentUsername }: {
  initialUsers: SafeUser[]
  currentUsername: string
}) {
  const [users, setUsers] = useState<SafeUser[]>(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Add form state
  const [addName, setAddName] = useState('')
  const [addUsername, setAddUsername] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState<AdminRole>('manager')
  const [addSections, setAddSections] = useState<AdminSection[]>(DEFAULT_SECTIONS)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<AdminRole>('manager')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')
  const [editSections, setEditSections] = useState<AdminSection[]>(DEFAULT_SECTIONS)

  function startEdit(u: SafeUser) {
    setEditingId(u.id)
    setEditName(u.name)
    setEditRole(u.role)
    setEditActive(u.active)
    setEditPassword('')
    setEditSections(effectiveSections(u))
    setError('')
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, username: addUsername, password: addPassword, role: addRole, sections: addSections }),
    })
    if (res.ok) {
      const user: SafeUser = await res.json()
      setUsers(prev => [...prev, user])
      setShowAdd(false)
      setAddName(''); setAddUsername(''); setAddPassword(''); setAddRole('manager'); setAddSections(DEFAULT_SECTIONS)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error creating user')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = { name: editName, role: editRole, active: editActive, sections: editSections }
    if (editPassword.trim()) body.password = editPassword
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated: SafeUser = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      setEditingId(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error saving')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Delete user "${username}" permanently?`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      if (editingId === id) setEditingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-navy mb-1">User Management</h1>
          <p className="text-gray-500 text-sm">Manage admin accounts and access levels.</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setError('') }}
          className="btn-primary text-sm px-5 py-2.5"
        >
          + Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-sm shadow-sm border border-gray-100 p-6">
          <h2 className="font-medium text-navy mb-4">New User</h2>
          <form onSubmit={handleAdd} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Full Name</label>
              <input
                className="input-field"
                placeholder="e.g. Arina Ivanova"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Username</label>
              <input
                className="input-field"
                placeholder="e.g. arina"
                value={addUsername}
                onChange={e => setAddUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Initial password"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
              <select
                className="input-field"
                value={addRole}
                onChange={e => setAddRole(e.target.value as AdminRole)}
              >
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {addRole === 'manager' && (
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 font-medium block mb-2">Section access</label>
                <div className="flex flex-wrap gap-4">
                  {ALL_SECTIONS.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-navy">
                      <input
                        type="checkbox"
                        checked={addSections.includes(s)}
                        onChange={() => setAddSections(prev => toggle(prev, s))}
                      />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setError('') }}
                className="text-sm text-gray-500 hover:text-navy px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Username', 'Role', 'Status', 'Last Login', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <>
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-navy">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.role === 'owner' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmt(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmt(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => editingId === u.id ? setEditingId(null) : startEdit(u)}
                        className="text-xs text-gold hover:underline"
                      >
                        {editingId === u.id ? 'Close' : 'Edit'}
                      </button>
                      {u.username !== currentUsername && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === u.id && (
                  <tr key={u.id + '-edit'}>
                    <td colSpan={7} className="px-4 py-5 bg-gray-50/50">
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">Full Name</label>
                          <input
                            className="input-field"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
                          <select
                            className="input-field"
                            value={editRole}
                            onChange={e => setEditRole(e.target.value as AdminRole)}
                          >
                            <option value="manager">Manager</option>
                            <option value="owner">Owner</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">New Password</label>
                          <input
                            type="password"
                            className="input-field"
                            placeholder="Leave blank to keep"
                            value={editPassword}
                            onChange={e => setEditPassword(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
                          <select
                            className="input-field"
                            value={editActive ? 'active' : 'inactive'}
                            onChange={e => setEditActive(e.target.value === 'active')}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        {editRole === 'manager' && (
                          <div className="md:col-span-4">
                            <label className="text-xs text-gray-500 font-medium block mb-2">Section access</label>
                            <div className="flex flex-wrap gap-4">
                              {ALL_SECTIONS.map(s => (
                                <label key={s} className="flex items-center gap-2 text-sm text-navy">
                                  <input
                                    type="checkbox"
                                    checked={editSections.includes(s)}
                                    onChange={() => setEditSections(prev => toggle(prev, s))}
                                  />
                                  {SECTION_LABEL[s]}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="md:col-span-4 flex gap-3">
                          <button
                            onClick={() => handleSaveEdit(u.id)}
                            disabled={saving}
                            className="btn-primary text-sm disabled:opacity-60"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setError('') }}
                            className="text-sm text-gray-500 hover:text-navy px-4 py-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No users.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
