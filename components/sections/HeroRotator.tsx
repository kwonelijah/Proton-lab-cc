'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface HeroRotatorProps {
  srcs: string[]
  intervalMs?: number
  className?: string
  // next/image `sizes`; defaults to the desktop hero (hidden on phones).
  sizes?: string
}

// Full-bleed photos stacked on top of each other, crossfading to the next one
// every `intervalMs` (homepage hero, 8s). The first photo loads eagerly; the
// rest load in the background so the swap is seamless. Respects the visitor's
// reduced-motion setting by staying on the first photo.
export default function HeroRotator({ srcs, intervalMs = 8000, className = '', sizes = '(max-width: 767px) 1px, 100vw' }: HeroRotatorProps) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (srcs.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setActive(i => (i + 1) % srcs.length), intervalMs)
    return () => window.clearInterval(id)
  }, [srcs.length, intervalMs])

  return (
    <>
      {srcs.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={i === 0}
          sizes={sizes}
          className={`object-cover transition-opacity duration-1000 ${i === active ? 'opacity-70' : 'opacity-0'} ${className}`}
        />
      ))}
    </>
  )
}
