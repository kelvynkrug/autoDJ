'use client'

import { useState, useEffect } from 'react'

interface TrackProgressProps {
  durationMs: number
  isPlaying: boolean
  className?: string
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function TrackProgress({ durationMs, isPlaying, className = '' }: TrackProgressProps) {
  const [currentMs, setCurrentMs] = useState(0)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentMs((prev) => {
        if (prev >= durationMs) return 0
        return prev + 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying, durationMs])

  const percent = (currentMs / durationMs) * 100

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs tabular-nums text-zinc-400 w-10 text-right">
        {formatTime(currentMs)}
      </span>
      <div className="relative flex-1 h-1.5 rounded-full bg-zinc-800 group cursor-pointer">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${percent}%`, marginLeft: '-6px' }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-400 w-10">
        {formatTime(durationMs)}
      </span>
    </div>
  )
}
