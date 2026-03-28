'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProcessingPollerProps {
  hasPendingTracks: boolean
}

export function ProcessingPoller({ hasPendingTracks }: ProcessingPollerProps) {
  const router = useRouter()

  useEffect(() => {
    if (!hasPendingTracks) return

    const interval = setInterval(() => {
      router.refresh()
    }, 5000)

    return () => clearInterval(interval)
  }, [hasPendingTracks, router])

  return null
}
