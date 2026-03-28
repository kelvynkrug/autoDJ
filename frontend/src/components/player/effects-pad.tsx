'use client'

import { useState, useCallback, useRef } from 'react'

interface EffectsPadProps {
  onEffect: (effect: string) => void
  disabled?: boolean
}

const EFFECTS = [
  { id: 'siren', label: 'Sirene', icon: '\uD83D\uDCEF', color: 'from-red-500 to-orange-500', ring: 'ring-red-500/50' },
  { id: 'horn', label: 'Air Horn', icon: '\uD83D\uDD0A', color: 'from-yellow-500 to-amber-500', ring: 'ring-yellow-500/50' },
  { id: 'rewind', label: 'Rewind', icon: '\u23EA', color: 'from-blue-500 to-cyan-500', ring: 'ring-blue-500/50' },
  { id: 'brake', label: 'Brake', icon: '\u23F9\uFE0F', color: 'from-purple-500 to-pink-500', ring: 'ring-purple-500/50' },
  { id: 'echo', label: 'Echo', icon: '\uD83D\uDD01', color: 'from-green-500 to-emerald-500', ring: 'ring-green-500/50' },
  { id: 'riser', label: 'Riser', icon: '\uD83D\uDCC8', color: 'from-violet-500 to-indigo-500', ring: 'ring-violet-500/50' },
  { id: 'crowd', label: 'Crowd', icon: '\uD83D\uDE4C', color: 'from-pink-500 to-rose-500', ring: 'ring-pink-500/50' },
  { id: 'filter', label: 'Filter', icon: '\uD83C\uDF9B\uFE0F', color: 'from-teal-500 to-cyan-500', ring: 'ring-teal-500/50' },
] as const

export function EffectsPad({ onEffect, disabled = false }: EffectsPadProps) {
  const [activeEffects, setActiveEffects] = useState<Set<string>>(new Set())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const EFFECT_DURATIONS: Record<string, number> = {
    siren: 1500,
    horn: 500,
    rewind: 2000,
    brake: 1500,
    echo: 4000,
    riser: 3000,
    crowd: 4000,
    filter: 3000,
  }

  const handleClick = useCallback((effectId: string) => {
    if (disabled) return

    onEffect(effectId)

    const prev = timersRef.current.get(effectId)
    if (prev) clearTimeout(prev)

    setActiveEffects((s) => new Set(s).add(effectId))

    const duration = EFFECT_DURATIONS[effectId] ?? 2000
    const timer = setTimeout(() => {
      setActiveEffects((s) => {
        const next = new Set(s)
        next.delete(effectId)
        return next
      })
      timersRef.current.delete(effectId)
    }, duration)

    timersRef.current.set(effectId, timer)
  }, [disabled, onEffect])

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        FX Pad
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EFFECTS.map((fx) => {
          const isActive = activeEffects.has(fx.id)

          return (
            <button
              key={fx.id}
              onClick={() => handleClick(fx.id)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center gap-1
                aspect-square rounded-xl border border-zinc-800 bg-zinc-900/80
                text-zinc-300 transition-all duration-150 select-none cursor-pointer
                hover:border-zinc-700 hover:bg-zinc-800/80
                active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isActive ? `ring-2 ${fx.ring} border-transparent` : ''}
              `}
            >
              {isActive && (
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-br ${fx.color} opacity-15 animate-pulse`}
                />
              )}
              <span className="text-xl leading-none">{fx.icon}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {fx.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
