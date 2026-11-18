import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { evaluateStory, type StoryScores } from '@/lib/storyEvaluator'

export type { StoryScores }

// Live "Check with AI" preview only — never publishes anything itself.
// The score returned here is advisory; /api/story-publish re-runs this
// same evaluation server-side before actually publishing, so a client
// can never just report back a fabricated score to skip the real gate.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok || !auth.userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    if (isRateLimited(userKey(auth.userId), 20, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
    }

    const { title, content, language } = await readJsonObject(request)
    if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const scores = await evaluateStory(title, content, typeof language === 'string' ? language : undefined)
    if (!scores) return NextResponse.json({ error: 'Evaluation failed. Please try again.' }, { status: 502 })

    return NextResponse.json(scores)
  } catch (error) {
    console.error('story-evaluate route error:', error)
    return NextResponse.json({ error: 'AI service unavailable. Please try again.' }, { status: 500 })
  }
}
