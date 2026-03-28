interface CompatibilityIndicatorProps {
  score: number
  className?: string
}

export function CompatibilityIndicator({ score, className = '' }: CompatibilityIndicatorProps) {
  if (score <= 0) return null

  const getColor = () => {
    if (score >= 0.8) return 'from-emerald-500 to-emerald-400'
    if (score >= 0.6) return 'from-amber-500 to-yellow-400'
    return 'from-red-500 to-red-400'
  }

  const getLabel = () => {
    if (score >= 0.8) return 'Excelente'
    if (score >= 0.6) return 'Boa'
    return 'Baixa'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getColor()} transition-all duration-500`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 w-16 text-right">{getLabel()} {Math.round(score * 100)}%</span>
    </div>
  )
}
