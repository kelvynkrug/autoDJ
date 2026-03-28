import { Sidebar } from '@/components/layout/sidebar'
import { PlayerBar } from '@/components/player/player-bar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />

      <main className="md:ml-56 pt-14 md:pt-0 pb-24">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      <PlayerBar />
    </div>
  )
}
