'use client'

import { useEffect } from 'react'
import { captureUtmOnFirstTouch } from '@/lib/utm'

// Renders nothing — on mount it records first-touch UTM / click-id params from the
// landing URL into localStorage so every lead form can attach them (lib/utm.ts).
export default function UtmCapture() {
  useEffect(() => {
    captureUtmOnFirstTouch()
  }, [])
  return null
}
