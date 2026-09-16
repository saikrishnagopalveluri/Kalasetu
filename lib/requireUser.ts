import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

// Server-side auth check for API routes that don't need service-role
// privileges, just proof of who's calling. Validating a bearer token against
// Supabase's auth server only needs the anon key, so this works even when
// SUPABASE_SERVICE_ROLE_KEY isn't configured (unlike lib/supabaseAdmin.ts).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const authClient = url && anonKey ? createClient(url, anonKey) : null

export type AuthResult = { ok: boolean; userId: string | null }

export async function requireUser(request: NextRequest): Promise<AuthResult> {
  // No auth backend configured at all: same dev-mode bypass RequireAuth.tsx
  // uses client-side, so a local run without Supabase set up isn't locked out.
  if (!authClient) return { ok: true, userId: null }

  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!accessToken) return { ok: false, userId: null }

  const { data, error } = await authClient.auth.getUser(accessToken)
  if (error || !data.user) return { ok: false, userId: null }
  return { ok: true, userId: data.user.id }
}
