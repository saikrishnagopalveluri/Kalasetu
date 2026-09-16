import { NextRequest, NextResponse } from 'next/server'
import { BRAND_ID } from '@/lib/brand'
import { runDailyBlog } from '../daily-blog/route'
import { runSchemeScrape } from '../scrape-schemes/route'

// The only cron entry in vercel.json — Vercel's Hobby plan allows just one
// cron job per account, so the daily blog post and the scheme scraper
// (previously two separate daily crons) now share this single schedule,
// alternating by day: schemes on even days of the year, the blog on odd
// days. Both underlying routes (cron/daily-blog, cron/scrape-schemes) are
// still directly callable with the same CRON_SECRET for a manual/admin run
// of either one specifically, on any day.
export const maxDuration = 300

function todaysTask(date: Date): 'schemes' | 'blog' {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  return dayOfYear % 2 === 0 ? 'schemes' : 'blog'
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (BRAND_ID !== 'hastkatha') {
    return NextResponse.json({ status: 'skipped', reason: `daily cron only runs on the hastkatha deployment (this is ${BRAND_ID})` })
  }

  const task = todaysTask(new Date())
  if (task === 'schemes') {
    const result = await runSchemeScrape()
    return NextResponse.json({ task: 'schemes', result })
  }
  const result = await runDailyBlog()
  return NextResponse.json({ task: 'blog', result })
}
