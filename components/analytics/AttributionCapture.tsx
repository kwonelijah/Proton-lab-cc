'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureAttribution } from '@/lib/attribution'

// Records UTM / click-id / referrer attribution on every route change so the
// checkout request can carry it (lib/attribution.ts). Renders nothing.
export default function AttributionCapture() {
  const pathname = usePathname()
  useEffect(() => {
    captureAttribution()
  }, [pathname])
  return null
}
