'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import RequireAdmin from '@/components/RequireAdmin'
import { LANGUAGE_NAMES } from '@/lib/languages'

type Artisan = {
  id: string
  name: string
  phone: string | null
  craft_type: string | null
  state: string | null
  subscription_tier: string
  created_at: string
}

type Blog = { id: string; slug: string; title: string; category: string; created_at: string }
type Story = { id: string; slug: string; title: string; status: string; category: string; author_id: string; likes_count: number; created_at: string }
type Opportunity = { id: string; type: string; title: string; deadline: string | null }
type Video = { id: string; youtube_id: string; title: string; language: string; category: string }
type SchemeSource = { id: string; url: string; label: string; category: string; active: boolean; robots_allowed: boolean | null; last_checked_at: string | null }
type SchemeCandidate = { id: string; source_id: string; type: string; title: string; description: string; official_url: string; deadline: string | null; fetched_at: string }

const TIERS = ['free', 'starter', 'pro', 'premium']
const TIER_COLOR: Record<string, string> = {
  free: 'var(--ks-muted)',
  starter: 'var(--ks-saffron)',
  pro: 'var(--ks-indigo)',
  premium: 'var(--ks-jade)',
}
const TABS = ['Artisans', 'Blogs', 'Stories', 'Opportunities', 'Scheme Sources', 'Videos'] as const

function OperationsInner() {
  const [tab, setTab] = useState<typeof TABS[number]>('Artisans')

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 4 }}>
        Artisans &amp; Content
      </h1>
      <Link href="/admin" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', textDecoration: 'none' }}>← Admin home</Link>

      <div role="tablist" aria-label="Content sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0 20px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
              color: tab === t ? '#fff' : 'var(--ks-earth)',
              border: `1px solid ${tab === t ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
              borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Artisans' && <ArtisansTab />}
      {tab === 'Blogs' && <BlogsTab />}
      {tab === 'Stories' && <StoriesTab />}
      {tab === 'Opportunities' && <OpportunitiesTab />}
      {tab === 'Scheme Sources' && <SchemeSourcesTab />}
      {tab === 'Videos' && <VideosTab />}
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--ks-earth)', textTransform: 'capitalize' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: TIER_COLOR[tier] ?? 'var(--ks-muted)', flexShrink: 0 }} />
      {tier}
    </span>
  )
}

function ArtisansTab() {
  const [artisans, setArtisans] = useState<Artisan[] | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase!
      .from('artisan_profiles')
      .select('id, name, phone, craft_type, state, subscription_tier, created_at')
      .order('created_at', { ascending: false })
    setArtisans(data ?? [])
  }

  async function updateTier(id: string, tier: string) {
    const { error } = await supabase!.from('artisan_profiles').update({ subscription_tier: tier }).eq('id', id)
    if (error) {
      console.error('Failed to update subscription tier:', error.message)
      alert('Could not update the tier. Please try again.')
      return
    }
    load()
  }

  if (artisans === null) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>Loading…</p>
  if (artisans.length === 0) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>No artisans yet.</p>

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 10 }}>{artisans.length} artisan{artisans.length === 1 ? '' : 's'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {artisans.map((a) => (
          <div key={a.id} style={{
            background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            borderLeft: `3px solid ${TIER_COLOR[a.subscription_tier] ?? 'var(--ks-muted)'}`,
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ks-earth)' }}>{a.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ks-muted)' }}>
                {[a.craft_type, a.state, a.phone].filter(Boolean).join(' · ')}
              </div>
            </div>
            <TierBadge tier={a.subscription_tier} />
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <span style={visuallyHiddenStyle}>Subscription tier for {a.name}</span>
              <select
                value={a.subscription_tier}
                onChange={(e) => updateTier(a.id, e.target.value)}
                style={{
                  background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
                  padding: '6px 10px', fontSize: 12.5, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)',
                }}
              >
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function BlogsTab() {
  const [blogs, setBlogs] = useState<Blog[] | null>(null)
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('ai-tools')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase!.from('blogs').select('id, slug, title, category, created_at').order('created_at', { ascending: false })
    setBlogs(data ?? [])
  }

  async function handleAdd() {
    if (!slug.trim() || !title.trim() || !content.trim()) return
    setSaving(true)
    await supabase!.from('blogs').insert({ slug, title, summary, content, category })
    setSlug(''); setTitle(''); setSummary(''); setContent('')
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase!.from('blogs').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={formCardStyle}>
        <Field label="URL slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="url-slug-like-this" style={inputStyle} />
        </Field>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
        </Field>
        <Field label="Summary">
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line summary" style={inputStyle} />
        </Field>
        <Field label="Content">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content (paragraphs separated by blank lines)" rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="ai-tools">AI tools</option>
            <option value="marketing">Marketing</option>
            <option value="business">Business</option>
          </select>
        </Field>
        <button onClick={handleAdd} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Add post'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', margin: '4px 0 10px' }}>{blogs?.length ?? 0} post{blogs?.length === 1 ? '' : 's'}</p>
      {blogs?.map((b) => (
        <div key={b.id} style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>{b.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{b.category} · /{b.slug}</div>
          </div>
          <button onClick={() => handleDelete(b.id)} style={deleteBtn}>Delete</button>
        </div>
      ))}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: 'var(--ks-jade)',
  PENDING_REVIEW: 'var(--ks-turmeric)',
  DRAFT: 'var(--ks-muted)',
}

function StoriesTab() {
  const [stories, setStories] = useState<Story[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(new Map())

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase!
      .from('stories')
      .select('id, slug, title, status, category, author_id, likes_count, created_at')
      .order('created_at', { ascending: false })
    setStories(data ?? [])

    const authorIds = [...new Set((data ?? []).map((s) => s.author_id))]
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase!.from('artisan_profiles').select('id, name').in('id', authorIds)
      setNames(new Map((profiles ?? []).map((p: { id: string; name: string }) => [p.id, p.name])))
    }
  }

  async function handleDelete(id: string) {
    await supabase!.from('stories').delete().eq('id', id)
    load()
  }

  if (stories === null) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>Loading…</p>
  if (stories.length === 0) return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>No stories yet.</p>

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 10 }}>{stories.length} stor{stories.length === 1 ? 'y' : 'ies'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stories.map((s) => (
          <div key={s.id} style={{
            ...rowStyle, marginBottom: 0,
            borderLeft: `3px solid ${STATUS_COLOR[s.status] ?? 'var(--ks-muted)'}`,
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>
                {s.status === 'PUBLISHED' ? <a href={`/community/${s.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{s.title}</a> : s.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>
                {names.get(s.author_id) ?? s.author_id.slice(0, 8)} · {s.category} · {s.status}
                {s.status === 'PUBLISHED' ? ` · ❤ ${s.likes_count}` : ''}
              </div>
            </div>
            <button onClick={() => handleDelete(s.id)} style={deleteBtn}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function OpportunitiesTab() {
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [type, setType] = useState('competition')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase!.from('opportunities').select('id, type, title, deadline').order('created_at', { ascending: false })
    setItems(data ?? [])
  }

  async function handleAdd() {
    if (!title.trim() || !description.trim() || !url.trim()) return
    setSaving(true)
    await supabase!.from('opportunities').insert({ type, title, description, official_url: url, deadline: deadline || null })
    setTitle(''); setDescription(''); setUrl(''); setDeadline('')
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase!.from('opportunities').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={formCardStyle}>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            <option value="scheme">Scheme</option>
            <option value="competition">Competition</option>
            <option value="tradeshow">Trade show</option>
          </select>
        </Field>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={inputStyle} />
        </Field>
        <Field label="Official URL">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://official-site.gov.in" style={inputStyle} />
        </Field>
        <Field label="Deadline (optional)">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
        </Field>
        <button onClick={handleAdd} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Add opportunity'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', margin: '4px 0 10px' }}>{items?.length ?? 0} opportunit{items?.length === 1 ? 'y' : 'ies'}</p>
      {items?.map((o) => (
        <div key={o.id} style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>{o.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{o.type}{o.deadline ? ` · due ${o.deadline}` : ''}</div>
          </div>
          <button onClick={() => handleDelete(o.id)} style={deleteBtn}>Delete</button>
        </div>
      ))}
    </div>
  )
}

function SchemeSourcesTab() {
  const [sources, setSources] = useState<SchemeSource[] | null>(null)
  const [candidates, setCandidates] = useState<SchemeCandidate[] | null>(null)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('scheme')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string>('')
  const [runError, setRunError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [sourcesRes, candidatesRes] = await Promise.all([
      supabase!.from('scheme_sources').select('id, url, label, category, active, robots_allowed, last_checked_at').order('created_at', { ascending: false }),
      supabase!.from('scheme_candidates').select('id, source_id, type, title, description, official_url, deadline, fetched_at').eq('status', 'pending').order('fetched_at', { ascending: false }),
    ])
    setSources(sourcesRes.data ?? [])
    setCandidates(candidatesRes.data ?? [])
  }

  async function handleAddSource() {
    if (!url.trim() || !label.trim()) return
    setSaving(true)
    await supabase!.from('scheme_sources').insert({ url: url.trim(), label: label.trim(), category })
    setUrl(''); setLabel('')
    await load()
    setSaving(false)
  }

  async function handleDeleteSource(id: string) {
    await supabase!.from('scheme_sources').delete().eq('id', id)
    load()
  }

  async function handleRunCheck() {
    setRunning(true)
    setRunError('')
    setRunResult('')
    try {
      const { data: sessionData } = await supabase!.auth.getSession()
      const accessToken = sessionData.session?.access_token
      const res = await fetch('/api/admin/scrape-schemes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) { setRunError(data.error || 'Check failed.'); return }
      setRunResult(
        `Checked ${data.checked} · ${data.newCandidates} new · ${data.skippedUnchanged} unchanged · ${data.skippedIrrelevant} not relevant · ${data.skippedRobots} blocked by robots.txt` +
        (data.errors?.length ? ` · ${data.errors.length} error(s): ${data.errors.join('; ')}` : '')
      )
      await load()
    } catch {
      setRunError('Could not reach the check. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  async function handleApprove(c: SchemeCandidate) {
    await supabase!.from('opportunities').insert({
      type: c.type, title: c.title, description: c.description, official_url: c.official_url, deadline: c.deadline,
    })
    await supabase!.from('scheme_candidates').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', c.id)
    setCandidates((prev) => (prev ?? []).filter((x) => x.id !== c.id))
  }

  async function handleReject(id: string) {
    await supabase!.from('scheme_candidates').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
    setCandidates((prev) => (prev ?? []).filter((x) => x.id !== id))
  }

  return (
    <div>
      <div style={formCardStyle}>
        <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.6, marginBottom: 12 }}>
          Checks each active source below (respecting robots.txt), and adds anything new or changed to the review queue.
          Nothing is published to the public Opportunities list until you approve it here.
        </p>
        <button onClick={handleRunCheck} disabled={running} style={primaryBtn}>{running ? 'Checking…' : 'Run check now'}</button>
        {runResult && <p role="status" style={{ fontSize: 12, color: 'var(--ks-jade)', marginTop: 10, lineHeight: 1.5 }}>{runResult}</p>}
        {runError && <p role="alert" style={{ fontSize: 12, color: 'var(--ks-clay)', marginTop: 10, fontWeight: 600 }}>{runError}</p>}
      </div>

      {candidates && candidates.length > 0 && (
        <>
          <SectionLabel dotColor="var(--ks-clay)">Review queue ({candidates.length})</SectionLabel>
          {candidates.map((c) => (
            <div key={c.id} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8, borderLeft: '3px solid var(--ks-clay)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ks-earth)' }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ks-muted)', flexShrink: 0, textTransform: 'capitalize' }}>{c.type}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.5 }}>{c.description}</div>
              <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{c.official_url}{c.deadline ? ` · deadline ${c.deadline}` : ''}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApprove(c)} style={{ ...primaryBtn, padding: '7px 14px' }}>Approve &amp; publish</button>
                <button onClick={() => handleReject(c.id)} style={{ ...deleteBtn, padding: '7px 14px' }}>Reject</button>
              </div>
            </div>
          ))}
          <div style={{ marginBottom: 20 }} />
        </>
      )}

      <SectionLabel dotColor="var(--ks-indigo)">Sources</SectionLabel>
      <div style={formCardStyle}>
        <Field label="Label">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. PM Vishwakarma" style={inputStyle} />
        </Field>
        <Field label="URL">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://official-site.gov.in" style={inputStyle} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="scheme">Scheme</option>
            <option value="competition">Competition</option>
            <option value="tradeshow">Trade show</option>
          </select>
        </Field>
        <button onClick={handleAddSource} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Add source'}</button>
      </div>
      {sources?.map((s) => (
        <div key={s.id} style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--ks-muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span>{s.url} · {s.category}</span>
              <span>{s.last_checked_at ? `· checked ${new Date(s.last_checked_at).toLocaleDateString('en-IN')}` : '· never checked'}</span>
              {s.robots_allowed === false && (
                <span style={warningPillStyle}>Blocked by robots.txt</span>
              )}
            </div>
          </div>
          <button onClick={() => handleDeleteSource(s.id)} style={deleteBtn}>Delete</button>
        </div>
      ))}
    </div>
  )
}

function VideosTab() {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [youtubeId, setYoutubeId] = useState('')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('en')
  const [category, setCategory] = useState('marketing')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase!.from('videos').select('id, youtube_id, title, language, category').order('created_at', { ascending: false })
    setVideos(data ?? [])
  }

  async function handleAdd() {
    if (!youtubeId.trim() || !title.trim()) return
    setSaving(true)
    await supabase!.from('videos').insert({ youtube_id: youtubeId.trim(), title, language, category })
    setYoutubeId(''); setTitle('')
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase!.from('videos').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={formCardStyle}>
        <Field label="YouTube video ID (the part after ?v= in the URL)">
          <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. Q7nDHdU0oY0" style={inputStyle} />
        </Field>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} />
        </Field>
        <Field label="Language">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle}>
            {Object.entries(LANGUAGE_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            <option value="schemes">Schemes</option>
            <option value="marketing">Marketing</option>
            <option value="pricing">Pricing</option>
            <option value="inspiration">Inspiration</option>
          </select>
        </Field>
        <button onClick={handleAdd} disabled={saving} style={primaryBtn}>{saving ? 'Saving…' : 'Add video'}</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', margin: '4px 0 10px' }}>{videos?.length ?? 0} video{videos?.length === 1 ? '' : 's'}</p>
      {videos?.map((v) => (
        <div key={v.id} style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)' }}>{v.title}</div>
            <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{LANGUAGE_NAMES[v.language] ?? v.language} · {v.category}</div>
          </div>
          <button onClick={() => handleDelete(v.id)} style={deleteBtn}>Delete</button>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

function SectionLabel({ children, dotColor }: { children: React.ReactNode; dotColor: string }) {
  return (
    <p style={{
      display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--ks-earth)',
      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10,
    }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {children}
    </p>
  )
}

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 4,
}

const formCardStyle: React.CSSProperties = {
  background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 14, padding: 16, marginBottom: 20,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
}
const deleteBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--ks-clay)', color: 'var(--ks-clay)', borderRadius: 8,
  padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
}
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ks-ivory)',
  border: '1px solid var(--ks-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8,
}
const warningPillStyle: React.CSSProperties = {
  display: 'inline-block', background: 'rgba(196,85,45,0.12)', color: 'var(--ks-clay)',
  fontWeight: 700, fontSize: 10.5, borderRadius: 999, padding: '2px 8px',
}

export default function OperationsPage() {
  return (
    <RequireAdmin>
      <OperationsInner />
    </RequireAdmin>
  )
}
