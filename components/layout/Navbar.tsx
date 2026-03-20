'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CartButton from '@/components/ui/CartButton'

const navLinks = [
  { label: 'Collections', href: '/collections' },
  { label: 'Journal', href: '/journal' },
  { label: 'About', href: '/about' },
  { label: 'Team', href: '/team' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        scrolled || mobileOpen
          ? 'bg-proton-white/95 backdrop-blur-sm border-b border-proton-light'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className={`font-inter text-xs uppercase tracking-widest transition-colors duration-300 ${
            scrolled || mobileOpen ? 'text-proton-black' : 'text-proton-white'
          }`}
        >
          Proton Lab CC
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`font-inter text-xs uppercase tracking-widest transition-colors duration-300 ${
                  scrolled
                    ? pathname === link.href
                      ? 'text-proton-black border-b border-proton-black pb-0.5'
                      : 'text-proton-grey hover:text-proton-black'
                    : pathname === link.href
                    ? 'text-proton-white border-b border-proton-white pb-0.5'
                    : 'text-proton-white/70 hover:text-proton-white'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <span
            className={`transition-colors duration-300 ${
              scrolled || mobileOpen ? 'text-proton-black' : 'text-proton-white'
            }`}
          >
            <CartButton />
          </span>

          {/* Hamburger */}
          <button
            className={`md:hidden p-2 transition-colors duration-300 ${
              scrolled || mobileOpen ? 'text-proton-black' : 'text-proton-white'
            }`}
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <span className="sr-only">{mobileOpen ? 'Close' : 'Menu'}</span>
            <div className="w-5 flex flex-col gap-1.5">
              <span
                className={`block h-px bg-current transition-all duration-300 ${
                  mobileOpen ? 'rotate-45 translate-y-2.5' : ''
                }`}
              />
              <span
                className={`block h-px bg-current transition-all duration-300 ${
                  mobileOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block h-px bg-current transition-all duration-300 ${
                  mobileOpen ? '-rotate-45 -translate-y-2.5' : ''
                }`}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <ul className="px-6 pb-8 pt-4 space-y-6 bg-proton-white/95">
          {navLinks.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block font-inter text-sm uppercase tracking-widest transition-colors duration-200 ${
                  pathname === link.href
                    ? 'text-proton-black'
                    : 'text-proton-grey hover:text-proton-black'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
