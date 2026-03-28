import { NextResponse } from 'next/server'
import { createServerClient } from './server'

interface AuthResult {
  user: { id: string; email?: string }
  session: {
    access_token: string
    provider_token?: string | null
    provider_refresh_token?: string | null
  }
}

export async function requireAuth(): Promise<
  | { ok: true; auth: AuthResult }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createServerClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Autenticacao necessaria' } },
        { status: 401 },
      ),
    }
  }

  return {
    ok: true,
    auth: {
      user: { id: session.user.id, email: session.user.email },
      session: {
        access_token: session.access_token,
        provider_token: session.provider_token,
        provider_refresh_token: session.provider_refresh_token,
      },
    },
  }
}
