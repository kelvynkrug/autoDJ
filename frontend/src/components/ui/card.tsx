import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
}

export function Card({ children, hover = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-zinc-800 bg-zinc-900 p-5
        ${hover ? 'transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-black/20' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
