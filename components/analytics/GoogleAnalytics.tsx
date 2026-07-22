'use client'

import { useEffect } from 'react'
import { initGa } from '@/lib/ga'

// Loads Google Analytics (gtag.js) on first mount. Route-change page views
// come from GA4 Enhanced Measurement, so there is no navigation listener —
// compare MetaPixel.tsx, where the pixel needs one.

export default function GoogleAnalytics() {
  useEffect(() => {
    initGa()
  }, [])

  return null
}
