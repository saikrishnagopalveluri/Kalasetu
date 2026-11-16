import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { evaluateStory } from '@/lib/storyEvaluator'
import { checkAndAwardBadges } from '@/lib/badges'
import { STORY_CATEGORIES } from '@/lib/storyCategories'

const PUBLISH_THRESHOLD = 8

// A title written in a non-Latin script (Hindi, Telugu, ...) — the normal
// case for this feature, not an edge case — strips down to nothing here,
// which used to leave a slug that was just a bare "-<timestamp>". Falling
// back to a generic base keeps the URL valid and non-empty either way.
function slugify(text: string): string {
  const base = text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
  return base || 'story'
}

function readingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// The only path that may ever set stories.status = 'PUBLISHED' — see
// supabase/034_lock_story_publish.sql, which removed the client's ability
// to insert/update a story into PUBLISHED directly. The AI score a story
// is published against is always computed here, server-side, right before
// the write; a client-supplied score is never trusted (previously it was,
// which let anyone insert a story pre-marked PUBLISHED with a self-reported
// score of 10 straight from the browser).
export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const auth = await requireUser(request)
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (isRateLimited(userKey(auth.userId), 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
  }

  const { title, content, language, category } = await request.json()
  if (!title?.trim() || !content?.trim() || !category) {
    return NextResponse.json({ error: 'title, content, and category are required' }, { status: 400 })
  }
  if (!STORY_CATEGORIES.some((c) => c.value === category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const scores = await evaluateStory(title, content, language)
  if (!scores) return NextResponse.json({ error: 'Evaluation failed. Please try again.' }, { status: 502 })

  if (scores.overall < PUBLISH_THRESHOLD) {
    return NextResponse.json({ ok: true, published: false, scores })
  }

  const slug = `${slugify(title)}-${Date.now().toString(36)}`
  const { error: insertError } = await supabaseAdmin.from('stories').insert({
    author_id: auth.userId,
    slug, title, content, category,
    language: language || 'en',
    status: 'PUBLISHED',
    ai_scores: scores,
    ai_feedback: scores.feedback,
    reading_time_minutes: readingTime(content),
    published_at: new Date().toISOString(),
  })
  if (insertError) {
    console.error('story-publish insert failed:', insertError.message)
    return NextResponse.json({ error: 'Could not publish. Please try again.' }, { status: 500 })
  }

  await checkAndAwardBadges(auth.userId, 'STORY_PUBLISHED')

  return NextResponse.json({ ok: true, published: true, scores, slug })
}
