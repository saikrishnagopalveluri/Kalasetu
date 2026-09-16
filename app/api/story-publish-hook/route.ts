import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { checkAndAwardBadges } from '@/lib/badges'

// The story row itself is written client-side (RLS allows an author to
// insert their own story, same as products/content elsewhere in this app),
// but badge-awarding writes to another table with no user-insert policy on
// purpose (see supabase/032_badges.sql), so it happens here instead, right
// after a successful publish.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  await checkAndAwardBadges(auth.userId, 'STORY_PUBLISHED')
  return NextResponse.json({ ok: true })
}
