// Server-only Supabase client using the service-role key. Never import this
// from a client component — it bypasses Row Level Security entirely and
// must only be used in trusted API routes (e.g. payment verification)
// after independently confirming who the caller is.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null
