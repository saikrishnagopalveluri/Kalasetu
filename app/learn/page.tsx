import { redirect } from 'next/navigation'

// /learn's content (LESSONS + videos) now lives inside /upskill as its
// Level 1 section (see supabase/033_upskill.sql and app/upskill/page.tsx,
// which reuses the exact same learn.lesson.* translation keys) — this
// redirect keeps any existing bookmark or external link to /learn working.
export default function LearnPage() {
  redirect('/upskill')
}
