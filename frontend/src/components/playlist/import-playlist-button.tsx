'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ImportPlaylistButtonProps {
  playlistId: string
  playlistName: string
}

export function ImportPlaylistButton({ playlistId, playlistName }: ImportPlaylistButtonProps) {
  const [state, setState] = useState<'idle' | 'importing' | 'done'>('idle')

  const handleImport = () => {
    setState('importing')
    setTimeout(() => setState('done'), 2000)
  }

  if (state === 'done') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <svg className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        Importada
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleImport}
      disabled={state === 'importing'}
    >
      {state === 'importing' ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Importando...
        </>
      ) : (
        'Importar'
      )}
    </Button>
  )
}
