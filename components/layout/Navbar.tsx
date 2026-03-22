'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import CartButton from '@/components/ui/CartButton'

const secondaryLinks = [
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const isLight = scrolled || mobileOpen

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isCustom = pathname.startsWith('/custom')
  const isShop = pathname.startsWith('/shop') || pathname.startsWith('/collections') || pathname.startsWith('/products')

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        isLight
          ? 'bg-proton-white/95 backdrop-blur-sm border-b border-proton-light'
          : 'bg-transparent'
      }`}
    >
      {/* Desktop nav — 3 equal columns: left | center | right */}
      <nav className="hidden md:grid grid-cols-3 items-center max-w-7xl mx-auto px-6 md:px-12 h-20">

        {/* Left — Custom | Shop */}
        <div className="flex items-center gap-0 w-fit">
          <Link
            href="/shop"
            className={`px-3 py-2 text-xs uppercase tracking-widest font-inter transition-colors duration-300 ${
              isShop
                ? isLight ? 'text-proton-black' : 'text-proton-white'
                : isLight ? 'text-proton-grey hover:text-proton-black' : 'text-proton-white/60 hover:text-proton-white'
            }`}
          >
            Shop
          </Link>
          <span className={`text-xs ${isLight ? 'text-proton-black/30' : 'text-proton-white/30'}`}>|</span>
          <Link
            href="/custom"
            className={`px-3 py-2 text-xs uppercase tracking-widest font-inter transition-colors duration-300 ${
              isCustom
                ? isLight ? 'text-proton-black' : 'text-proton-white'
                : isLight ? 'text-proton-grey hover:text-proton-black' : 'text-proton-white/60 hover:text-proton-white'
            }`}
          >
            Custom
          </Link>
        </div>

        {/* Centre — Logo */}
        <div className="flex justify-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/PLlogo1.png"
              alt="Proton Lab CC"
              width={240}
              height={70}
              className={`h-32 w-auto transition-all duration-300 ${
                isLight ? 'brightness-0' : 'brightness-100'
              }`}
              priority
            />
          </Link>
        </div>

        {/* Right — About | Contact | Cart */}
        <div className="flex items-center justify-end gap-0">
          {secondaryLinks.map((link, i) => (
            <>
              {i > 0 && <span key={`div-${link.href}`} className={`text-xs ${isLight ? 'text-proton-black/30' : 'text-proton-white/30'}`}>|</span>}
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 font-inter text-xs uppercase tracking-widest transition-colors duration-300 ${
                  isLight
                    ? pathname === link.href ? 'text-proton-black border-b border-proton-black pb-0.5' : 'text-proton-grey hover:text-proton-black'
                    : pathname === link.href ? 'text-proton-white border-b border-proton-white pb-0.5' : 'text-proton-white/60 hover:text-proton-white'
                }`}
              >
                {link.label}
              </Link>
            </>
          ))}
          <span className={`text-xs ${isLight ? 'text-proton-black/30' : 'text-proton-white/30'}`}>|</span>
          <span className={`pl-3 transition-colors duration-300 ${isLight ? 'text-proton-black' : 'text-proton-white'}`}>
            <CartButton />
          </span>
        </div>
      </nav>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-between px-6 h-16">
        <Link href="/" className="flex items-center">
          <Image
            src="/PLlogo1.png"
            alt="Proton Lab CC"
            width={140}
            height={40}
            className={`h-10 w-auto transition-all duration-300 ${isLight ? 'brightness-0' : 'brightness-100'}`}
            priority
          />
        </Link>
        <div className="flex items-center gap-2">
          <span className={`transition-colors duration-300 ${isLight ? 'text-proton-black' : 'text-proton-white'}`}>
            <CartButton />
          </span>
          <button
            className={`p-2 transition-colors duration-300 ${isLight ? 'text-proton-black' : 'text-proton-white'}`}
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <div className="w-5 flex flex-col gap-1.5">
              <span className={`block h-px bg-current transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2.5' : ''}`} />
              <span className={`block h-px bg-current transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-px bg-current transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? 'max-h-screen' : 'max-h-0'}`}>
        <div className="px-6 pb-8 pt-4 bg-proton-white/95 space-y-6">
          <div className="grid grid-cols-2 gap-3 pb-6 border-b border-proton-light">
            <Link href="/custom" className={`text-center py-3 border text-xs uppercase tracking-widest transition-all duration-200 ${isCustom ? 'bg-proton-black text-proton-white border-proton-black' : 'border-proton-black text-proton-black'}`}>
              Custom
            </Link>
            <Link href="/shop" className={`text-center py-3 border text-xs uppercase tracking-widest transition-all duration-200 ${isShop ? 'bg-proton-black text-proton-white border-proton-black' : 'border-proton-black text-proton-black'}`}>
              Shop
            </Link>
          </div>
          <ul className="space-y-5">
            {secondaryLinks.map(link => (
              <li key={link.href}>
                <Link href={link.href} className={`block font-inter text-sm uppercase tracking-widest transition-colors duration-200 ${pathname === link.href ? 'text-proton-black' : 'text-proton-grey hover:text-proton-black'}`}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )
}
