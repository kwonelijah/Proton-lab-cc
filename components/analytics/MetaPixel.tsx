'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { META_PIXEL_ID, CONSENT_EVENT, getConsent } from '@/lib/meta'

// Loads the Meta Pixel base code once the visitor has granted cookie consent,
// then reports PageView on every client-side route change. Rendered globally
// from app/layout.tsx.

let initialised = false
let lastTrackedPath: string | null = null

function initPixel() {
  if (initialised || !META_PIXEL_ID || typeof window === 'undefined') return
  initialised = true

  // Meta Pixel base code (the official snippet, without document.write)
  if (!window.fbq) {
    type FbqStub = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void
      queue: unknown[][]
      push: unknown
      loaded: boolean
      version: string
    }
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args)
      } else {
        fbq.queue.push(args)
      }
    } as FbqStub
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    window._fbq = fbq
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  window.fbq!('init', META_PIXEL_ID)
  window.fbq!('track', 'PageView')
  lastTrackedPath = window.location.pathname
}

export default function MetaPixel() {
  const pathname = usePathname()

  // Initialise immediately if consent was granted on a previous visit,
  // otherwise wait for the banner's accept event.
  useEffect(() => {
    if (getConsent() === 'granted') initPixel()
    const onConsentChange = (e: Event) => {
      if ((e as CustomEvent).detail === 'granted') initPixel()
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange)
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange)
  }, [])

  // PageView on client-side navigation (init covers the initial load)
  useEffect(() => {
    if (!initialised || !window.fbq || pathname === lastTrackedPath) return
    lastTrackedPath = pathname
    window.fbq('track', 'PageView')
  }, [pathname])

  return null
}
