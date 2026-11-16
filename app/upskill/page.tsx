'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGE_NAMES } from '@/lib/languages'
import type { TranslationKey } from '@/lib/translations'
import { IconCheck } from '@/components/CraftIcons'

type Course = { id: string; level: number; title_key: TranslationKey; description_key: TranslationKey; order: number }
type CourseModule = { id: string; course_id: string; title_key: TranslationKey; body_key: TranslationKey | null; order: number }
type Video = { id: string; youtube_id: string; title: string; language: string; category: string }

function UpSkillInner() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [courses, setCourses] = useState<Course[]>([])
  const [modules, setModules] = useState<CourseModule[]>([])
  const [progress, setProgress] = useState<Set<string>>(new Set())
  const [videos, setVideos] = useState<Video[]>([])
  const [openModule, setOpenModule] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.from('courses').select('id, level, title_key, description_key, order').order('order')
      .then(({ data }) => setCourses((data ?? []) as Course[]))
    supabase.from('course_modules').select('id, course_id, title_key, body_key, order').order('order')
      .then(({ data }) => setModules((data ?? []) as CourseModule[]))
    supabase.from('videos').select('id, youtube_id, title, language, category').order('created_at', { ascending: false })
      .then(({ data }) => setVideos(data ?? []))
  }, [])

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('module_progress').select('module_id').eq('user_id', user.id)
      .then(({ data }) => setProgress(new Set((data ?? []).map((r) => r.module_id))))
  }, [user])

  async function toggleComplete(moduleId: string) {
    if (!user || !supabase) return
    setSaving(moduleId)
    if (progress.has(moduleId)) {
      await supabase.from('module_progress').delete().eq('user_id', user.id).eq('module_id', moduleId)
      setProgress((prev) => { const next = new Set(prev); next.delete(moduleId); return next })
    } else {
      await supabase.from('module_progress').insert({ user_id: user.id, module_id: moduleId })
      setProgress((prev) => new Set(prev).add(moduleId))
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (accessToken) {
        fetch('/api/module-complete-hook', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {})
      }
    }
    setSaving(null)
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('upskill.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6 }}>
        {t('upskill.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      {courses.map((course) => {
        const courseModules = modules.filter((m) => m.course_id === course.id)
        const done = courseModules.filter((m) => progress.has(m.id)).length
        const complete = courseModules.length > 0 && done === courseModules.length
        return (
          <div key={course.id} style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ks-earth)' }}>
                {t('upskill.levelLabel').replace('{n}', String(course.level))} — {t(course.title_key)}
              </h2>
              {complete && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--ks-jade)' }}>
                  <IconCheck size={14} /> {t('upskill.certificateEarned')}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', marginBottom: 6, lineHeight: 1.5 }}>{t(course.description_key)}</p>
            <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginBottom: 12 }}>
              {t('upskill.progressLabel').replace('{done}', String(done)).replace('{total}', String(courseModules.length))}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {courseModules.map((m) => {
                const isDone = progress.has(m.id)
                const open = openModule === m.id
                return (
                  <div key={m.id} style={{
                    background: 'var(--ks-ivory)', border: open ? '1px solid var(--ks-turmeric)' : '1px solid var(--ks-border)',
                    borderRadius: 12, overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => setOpenModule(open ? null : m.id)}
                      aria-expanded={open}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', padding: '13px 15px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone ? 'var(--ks-jade)' : '#fff', border: isDone ? 'none' : '1.5px solid var(--ks-border)', color: '#fff',
                      }}>
                        {isDone && <IconCheck size={13} />}
                      </span>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>{t(m.title_key)}</span>
                      <span style={{ color: 'var(--ks-muted)', fontSize: 12 }} aria-hidden="true">{open ? '▾' : '▸'}</span>
                    </button>
                    {open && (
                      <div style={{ padding: '0 15px 16px 51px' }}>
                        {m.body_key && t(m.body_key).split('\n\n').map((para, i) => (
                          <p key={i} style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.65, marginBottom: 12 }}>{para}</p>
                        ))}
                        <button
                          onClick={() => toggleComplete(m.id)}
                          disabled={saving === m.id}
                          style={{
                            background: isDone ? '#fff' : 'var(--ks-indigo)', color: isDone ? 'var(--ks-earth)' : '#fff',
                            border: isDone ? '1px solid var(--ks-border)' : 'none', borderRadius: 8, padding: '8px 14px',
                            fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                          }}
                        >
                          {isDone ? t('upskill.markIncomplete') : t('upskill.markComplete')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {videos.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ks-earth)', marginBottom: 14 }}>
            {t('learn.watchLearn')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {videos.map((v) => (
              <div key={v.id} style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: 'var(--ks-earth)' }}>
                  <iframe src={`https://www.youtube.com/embed/${v.youtube_id}`} title={v.title} allowFullScreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ks-earth)', lineHeight: 1.4, marginBottom: 5 }}>{v.title}</div>
                  <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--ks-muted)', background: 'var(--ks-linen)', borderRadius: 999, padding: '2px 9px' }}>
                    {LANGUAGE_NAMES[v.language] ?? v.language}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function UpSkillPage() {
  return (
    <RequireAuth>
      <UpSkillInner />
    </RequireAuth>
  )
}
