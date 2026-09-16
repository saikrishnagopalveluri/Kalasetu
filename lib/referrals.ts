'use client'

import { supabase } from './supabase'

// Thin client wrapper around /api/referral — mirrors lib/useAI.ts's shape.
// All the actual state-machine logic (milestone checks, reward unlocking,
// wallet crediting) lives server-side; this just forwards the auth token.

async function post(body: object) {
  if (!supabase) return null
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) return null
  try {
    const res = await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('Referral call failed:', err)
    return null
  }
}

// Called once, right after a successful signup, if the visitor arrived via
// a Saathi's ?ref= link. Safe to call even with no code — the API no-ops.
export function registerReferral(code: string) {
  return post({ action: 'register', code })
}

// Called from the two existing flows that complete these milestones: saving
// the profile (app/profile/page.tsx) and creating the first product
// (app/products/page.tsx). Cheap and safe to call every time either action
// succeeds — the server only records the first occurrence of each stage.
export function advanceReferral(stage: 'PROFILE_COMPLETED' | 'FIRST_PRODUCT_COMPLETED') {
  return post({ action: 'advance', stage })
}
