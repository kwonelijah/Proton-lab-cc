'use client'

import { useEffect, useRef } from 'react'

export default function ShopVideoHeader() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    video.play().catch((e) => {
      if (process.env.NODE_ENV !== 'production') console.warn('Shop video autoplay blocked:', e)
    })
  }, [])

  return (
    <div className="relative min-h-screen bg-proton-black overflow-hidden flex items-end">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      >
        <source src="https://zpwxsatldyroswl1.public.blob.vercel-storage.com/PLShopHomepageClip.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-proton-black/30" />
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-7xl w-full mx-auto px-6 md:px-12 pb-10 md:pb-14">
          <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">In Stock</p>
          <h1 className="font-playfair text-5xl md:text-7xl text-proton-white leading-none">
            Shop
          </h1>
        </div>
      </div>
    </div>
  )
}
