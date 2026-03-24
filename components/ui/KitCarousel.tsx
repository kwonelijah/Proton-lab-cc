'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

interface KitCarouselProps {
  images: { src: string; alt: string }[]
}

export default function KitCarousel({ images }: KitCarouselProps) {
  const [index, setIndex] = useState(0)
  const pausedRef = useRef(false)

  const count = images.length
  const visible = 2

  const prev = useCallback(() => {
    setIndex(i => (i - 2 + count) % count)
  }, [count])

  const next = useCallback(() => {
    setIndex(i => (i + 2) % count)
  }, [count])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current) next()
    }, 10000)
    return () => clearInterval(timer)
  }, [next])

  const getSlide = (offset: number) => images[(index + offset) % count]

  if (count === 0) return null

  return (
    <div
      className="relative w-full overflow-hidden bg-proton-black py-16 md:py-24"
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      onFocus={() => { pausedRef.current = true }}
      onBlur={() => { pausedRef.current = false }}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <p className="text-[10px] text-proton-white/40 uppercase tracking-widest mb-10 text-center">Kit Gallery</p>

        <div className="grid grid-cols-2 gap-4 md:gap-6">
          {[0, 1].map(offset => {
            const slide = getSlide(offset)
            return (
              <div
                key={offset}
                className="relative aspect-[3/2] overflow-hidden"
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 40vw"
                  className="object-cover"
                />
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mt-10">
          <button
            onClick={prev}
            aria-label="Previous"
            className="text-proton-white/40 hover:text-proton-white transition-colors duration-200 text-lg"
          >
            ←
          </button>
          <div className="flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`w-1 h-1 rounded-full transition-colors duration-200 ${i === index ? 'bg-proton-white' : 'bg-proton-white/30'}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next"
            className="text-proton-white/40 hover:text-proton-white transition-colors duration-200 text-lg"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
