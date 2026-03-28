'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TrackProgressProps {
  durationMs: number
  isPlaying: boolean
  currentMs?: number
  onSeek?: (ms: number) => void
  className?: string
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function TrackProgress({ durationMs, isPlaying, currentMs: externalMs, onSeek, className = '' }: TrackProgressProps) {
  const [internalMs, setInternalMs] = useState(0)
  const currentMs = externalMs ?? internalMs
  const barRef = useRef<HTMLDivElement>(null)

  // Reset when track changes
  useEffect(() => {
    setInternalMs(0)
  }, [durationMs])

  // Internal timer when no external time provided
  useEffect(() => {
    if (externalMs !== undefined || !isPlaying) return
    const interval = setInterval(() => {
      setInternalMs((prev) => {
        if (prev >= durationMs) return 0
        return prev + 250
      })
    }, 250)
    return () => clearInterval(interval)
  }, [isPlaying, durationMs, externalMs])

  const percent = durationMs > 0 ? (currentMs / durationMs) * 100 : 0

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || !onSeek) return
    const rect = barRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const seekMs = Math.floor(ratio * durationMs)
    onSeek(seekMs)
    setInternalMs(seekMs)
  }, [durationMs, onSeek])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs tabular-nums text-zinc-400 w-10 text-right">
        {formatTime(currentMs)}
      </span>
      <div
        ref={barRef}
        className="relative flex-1 h-1.5 rounded-full bg-zinc-800 group cursor-pointer"
        onClick={handleClick}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-violet-500 transition-all duration-150"
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
