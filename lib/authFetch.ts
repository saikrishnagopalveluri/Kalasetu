import { supabase } from '@/lib/supabase'

// Calls one of our signed-in API routes with the artisan's login token.
//
// A login can be ended on the server while this browser still holds a token
// that looks valid (for example after a password reset). Until that token
// runs out, every signed-in call fails with 401. So on a 401 this refreshes
// the login once and retries. If the login cannot be refreshed, Supabase
// signs this browser out, and the caller is told so it can ask the artisan to
// log in again instead of showing a generic "busy" message.

export type AuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token: string } | null } }>
    refreshSession: () => Promise<{ data: { session: { access_token: string } | null }; error: unknown }>
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function withToken(init: RequestInit, token: string | undefined): RequestInit {
  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
}

export async function fetchWithAuth(
  url: string,
  init: RequestInit = {},
  client: AuthClient | null = supabase as unknown as AuthClient | null,
  fetchImpl: FetchLike = (input, options) => fetch(input, options),
): Promise<{ res: Response; signedOut: boolean }> {
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } }
  const res = await fetchImpl(url, withToken(init, data.session?.access_token))
  if (res.status !== 401 || !client) return { res, signedOut: false }

  const refreshed = await client.auth.refreshSession()
  const token = refreshed.error ? undefined : refreshed.data.session?.access_token
  if (!token) return { res, signedOut: true }

  const retry = await fetchImpl(url, withToken(init, token))
  return { res: retry, signedOut: retry.status === 401 }
}
