'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-navy/95 backdrop-blur-sm shadow-lg py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo.png" alt="Worldwise" className="h-10 w-auto" />
          <span className="font-serif text-2xl text-white tracking-wide hidden sm:inline">WORLDWISE</span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/80">
          <Link href="/properties" className="hover:text-gold transition-colors">Properties</Link>
          <Link href="/#areas" className="hover:text-gold transition-colors">Areas</Link>
          <Link href="/#about" className="hover:text-gold transition-colors">About</Link>
          <Link href="/#blog" className="hover:text-gold transition-colors">Insights</Link>
          <Link href="/#contact" className="btn-primary text-sm px-6 py-2.5">
            Free Consultation
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-navy border-t border-white/10 px-6 py-6 flex flex-col gap-5 text-white">
          <Link href="/properties" onClick={() => setMenuOpen(false)} className="hover:text-gold">Properties</Link>
          <Link href="/#areas" onClick={() => setMenuOpen(false)} className="hover:text-gold">Areas</Link>
          <Link href="/#about" onClick={() => setMenuOpen(false)} className="hover:text-gold">About</Link>
          <Link href="/#blog" onClick={() => setMenuOpen(false)} className="hover:text-gold">Insights</Link>
          <Link href="/#contact" onClick={() => setMenuOpen(false)} className="btn-primary text-center">
            Free Consultation
          </Link>
        </div>
      )}
    </nav>
  )
}
