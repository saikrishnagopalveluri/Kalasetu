import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkAndAwardBadges } from '@/lib/badges'

const LEVEL1_MODULE_IDS = ['l1-pricing', 'l1-vishwakarma', 'l1-whatsapp', 'l1-descriptions', 'l1-instagram', 'l1-protecting']

// module_progress rows are written client-side (RLS allows a user to insert
// their own progress), this route only checks whether that just completed
// Level 1 in full and, if so, awards the badge — badge writes have no
// client insert policy on purpose (supabase/032_badges.sql).
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const auth = await requireUser(request)
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('module_progress').select('module_id').eq('user_id', auth.userId).in('module_id', LEVEL1_MODULE_IDS)
  const completedIds = new Set((data ?? []).map((r) => r.module_id))
  const level1Complete = LEVEL1_MODULE_IDS.every((id) => completedIds.has(id))

  if (level1Complete) await checkAndAwardBadges(auth.userId, 'LEVEL1_COMPLETE')
  return NextResponse.json({ ok: true, level1Complete })
}
