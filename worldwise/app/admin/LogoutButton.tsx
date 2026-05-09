'use client'

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <button onClick={handleLogout} className="text-white/60 hover:text-white text-sm">
      Log Out
    </button>
  )
}
