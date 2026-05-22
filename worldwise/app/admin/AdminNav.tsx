'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AdminRole, AdminSection } from '@/types'
import { canAccess } from '@/lib/permissions'
import LogoutButton from './LogoutButton'

type NavSession = { name: string; role: AdminRole; sections?: AdminSection[] } | null

const NAV_LINKS: {
  href: string
  label: string
  section: AdminSection
  active: (p: string) => boolean
}[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    section: 'dashboard',
    active: (p: string) => p === '/admin/dashboard',
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    section: 'leads',
    active: (p: string) => p.startsWith('/admin/leads'),
  },
  {
    href: '/admin',
    label: 'Properties',
    section: 'properties',
    active: (p: string) => p === '/admin' || p.startsWith('/admin/property'),
  },
]

export default function AdminNav({ session }: { session: NavSession }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const visibleLinks = session
    ? NAV_LINKS.filter(link => canAccess(session, link.section))
    : []

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (pathname === '/admin/login') return null

  return (
    <header className="bg-navy text-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-xl tracking-widest">WORLDWISE</span>
          <span className="text-white/40 text-sm hidden sm:inline">Admin Panel</span>
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-5 text-sm">
            {visibleLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.active(pathname)
                    ? 'text-gold border-b-2 border-gold pb-0.5 font-medium'
                    : 'text-white/60 hover:text-white'
                }
              >
                {link.label}
              </Link>
            ))}
            {session?.role === 'owner' && (
              <Link
                href="/admin/users"
                className={
                  pathname.startsWith('/admin/users')
                    ? 'text-gold border-b-2 border-gold pb-0.5 font-medium'
                    : 'text-white/60 hover:text-white'
                }
              >
                Users
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-white/50 text-sm">{session?.name}</span>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline text-white/60 hover:text-white text-sm"
          >
            View Site ↗
          </Link>
          <div className="hidden md:block">
            <LogoutButton />
          </div>
          {/* Burger */}
          <button
            className="md:hidden flex flex-col justify-center gap-1.5 p-1"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? (
              <span className="text-white/80 text-xl leading-none">✕</span>
            ) : (
              <>
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-white/10 mt-3 pt-2 flex flex-col">
          {visibleLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`py-2.5 px-1 text-sm ${
                link.active(pathname)
                  ? 'border-l-2 border-gold pl-3 text-gold font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {session?.role === 'owner' && (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className={`py-2.5 px-1 text-sm ${
                pathname.startsWith('/admin/users')
                  ? 'border-l-2 border-gold pl-3 text-gold font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Users
            </Link>
          )}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-white/50 text-sm">{session?.name}</span>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white text-sm"
              >
                View Site ↗
              </Link>
              <LogoutButton />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
