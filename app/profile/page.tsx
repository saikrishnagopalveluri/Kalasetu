'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { computeProfileCompleteness } from '@/lib/profileCompleteness'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'
import { removeFromStorage } from '@/lib/storageCleanup'
import { BRAND } from '@/lib/brand'
import { advanceReferral } from '@/lib/referrals'
import { IconBadge, IconSaathi, IconWallet } from '@/components/CraftIcons'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'

type Achievement = { id: string; title: string; issuing_organization: string | null; year: number | null; description: string | null }
type PortfolioProduct = { id: string; name: string; image_url: string }
type EarnedBadge = { badge_id: string; name: string; description: string; awarded_at: string }
type MyStory = { id: string; slug: string; title: string; status: string; likes_count: number }

function ProfileInner() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [about, setAbout] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [languagesKnown, setLanguagesKnown] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [achTitle, setAchTitle] = useState('')
  const [achOrg, setAchOrg] = useState('')
  const [achYear, setAchYear] = useState('')
  const [achDesc, setAchDesc] = useState('')
  const [addingAch, setAddingAch] = useState(false)

  const [portfolio, setPortfolio] = useState<PortfolioProduct[]>([])
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [myStories, setMyStories] = useState<MyStory[]>([])
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  const [slug, setSlug] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [published, setPublished] = useState(false)
  const [publishSaving, setPublishSaving] = useState(false)
  const [publishError, setPublishError] = useState('')

  const fieldIds = {
    name: useId(), business: useId(), about: useId(),
    achTitle: useId(), achOrg: useId(), achYear: useId(), achDesc: useId(),
    slug: useId(), phone: useId(),
  }

  useEffect(() => {
    if (!profile) return
    setSlug(profile.public_slug ?? slugify(profile.name ?? ''))
    setContactPhone(profile.public_contact_phone ?? '')
    setPublished(profile.catalogue_published ?? false)
  }, [profile])

  useEffect(() => {
    if (!profile) return
    setName(profile.name ?? '')
    setBusinessName(profile.business_name ?? '')
    setAbout(profile.about ?? '')
    setPhotoUrl(profile.profile_photo_url ?? null)
    setLanguagesKnown(profile.languages_known ?? [])
  }, [profile])

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('achievements').select('id, title, issuing_organization, year, description').eq('user_id', user.id)
      .order('year', { ascending: false }).then(({ data }) => setAchievements(data ?? []))
    supabase.from('products').select('id, name, image_url').eq('user_id', user.id).not('image_url', 'is', null)
      .then(({ data }) => setPortfolio((data ?? []) as PortfolioProduct[]))
    supabase.from('artisan_badges').select('badge_id, awarded_at, badges(name, description)').eq('user_id', user.id)
      .then(({ data }) => setBadges((data ?? []).map((row) => {
        // Supabase returns the related row as an array in its loose client
        // typing even for a to-one relationship — badges(id) has exactly
        // one row per badge_id, so this always takes the first (only) one.
        const badge = Array.isArray(row.badges) ? row.badges[0] : row.badges
        return { badge_id: row.badge_id, awarded_at: row.awarded_at, name: badge?.name ?? row.badge_id, description: badge?.description ?? '' }
      })))
    supabase.from('stories').select('id, slug, title, status, likes_count').eq('author_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setMyStories(data ?? []))
    supabase.from('wallet_transactions').select('amount').eq('user_id', user.id)
      .then(({ data }) => setWalletBalance((data ?? []).reduce((sum, tx) => sum + tx.amount, 0)))
  }, [user])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !supabase || !user) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('profile-photos').upload(path, file)
    if (error) { console.error('Photo upload failed:', error.message); return }
    const previousPhotoUrl = photoUrl
    setPhotoUrl(supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl)
    await removeFromStorage('profile-photos', [previousPhotoUrl])
  }

  function toggleLanguageKnown(id: string) {
    setLanguagesKnown((prev) => prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id])
  }

  async function handleSaveProfile() {
    if (!user) return
    setSaving(true)
    setSaveError('')
    let { error } = await supabase!.from('artisan_profiles').update({
      name, business_name: businessName || null, about: about || null, profile_photo_url: photoUrl,
      languages_known: languagesKnown.length > 0 ? languagesKnown : null,
    }).eq('id', user.id)
    // supabase/018_languages_known.sql may not have been run yet on this
    // database, so don't let that column-not-found error block saving every
    // other field, which worked fine before this one was added.
    if (error?.message.includes('languages_known')) {
      ({ error } = await supabase!.from('artisan_profiles').update({
        name, business_name: businessName || null, about: about || null, profile_photo_url: photoUrl,
      }).eq('id', user.id))
    }
    setSaving(false)
    if (error) { console.error('Profile save failed:', error.message); setSaveError(t('profile.saveFailed')); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // A real profile (photo + a written "about"), not just clicking Save on
    // an empty form — the bar for the Saathi programme's PROFILE_COMPLETED
    // milestone, separate from the fuller profile-completeness checklist.
    if (photoUrl && about.trim()) advanceReferral('PROFILE_COMPLETED')
  }

  async function handlePublish() {
    if (!user) return
    const cleanSlug = slugify(slug)
    if (!cleanSlug) { setPublishError(t('profile.enterPageName')); return }
    setPublishSaving(true)
    setPublishError('')
    const { error } = await supabase!.from('artisan_profiles').update({
      public_slug: cleanSlug, catalogue_published: true, public_contact_phone: contactPhone || null,
    }).eq('id', user.id)
    setPublishSaving(false)
    if (error) {
      setPublishError(error.message.includes('duplicate') ? t('profile.nameTaken') : t('profile.publishFailed'))
      return
    }
    setSlug(cleanSlug)
    setPublished(true)
  }

  async function handleUnpublish() {
    if (!user) return
    await supabase!.from('artisan_profiles').update({ catalogue_published: false }).eq('id', user.id)
    setPublished(false)
  }

  async function handleAddAchievement() {
    if (!achTitle.trim() || !user) return
    setAddingAch(true)
    await supabase!.from('achievements').insert({
      user_id: user.id, title: achTitle, issuing_organization: achOrg || null,
      year: achYear ? Number(achYear) : null, description: achDesc || null,
    })
    setAchTitle(''); setAchOrg(''); setAchYear(''); setAchDesc('')
    const { data } = await supabase!.from('achievements').select('id, title, issuing_organization, year, description').eq('user_id', user.id).order('year', { ascending: false })
    setAchievements(data ?? [])
    setAddingAch(false)
  }

  async function handleDeleteAchievement(id: string) {
    await supabase!.from('achievements').delete().eq('id', id)
    setAchievements((prev) => prev.filter((a) => a.id !== id))
  }

  // RLS already scopes this to the caller's own stories (auth.uid() =
  // author_id, see supabase/031_community_stories.sql) — no server route
  // needed, same as the achievement delete right above.
  async function handleDeleteStory(id: string) {
    await supabase!.from('stories').delete().eq('id', id)
    setMyStories((prev) => prev.filter((s) => s.id !== id))
  }

  const { checks, completeness } = computeProfileCompleteness({
    photoUrl, about, businessName,
    achievementsCount: achievements.length,
    portfolioCount: portfolio.length,
  })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('profile.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        {t('profile.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      {/* Completeness */}
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 18, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)' }}>{t('profile.complete').replace('{pct}', String(completeness))}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 8, background: 'var(--ks-linen)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}
        >
          <div style={{ width: `${completeness}%`, height: '100%', background: 'var(--ks-jade)', transition: 'width 0.3s ease' }} />
        </div>
        {checks.filter((c) => !c.done).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {checks.filter((c) => !c.done).map((c) => (
              <span key={c.labelKey} style={{ fontSize: 11.5, color: 'var(--ks-muted)', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 999, padding: '4px 11px' }}>
                {t(c.labelKey)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Personal + business */}
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 22 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--ks-border)' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ks-linen)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }} aria-hidden="true">👤</div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} style={secondaryButtonStyle}>
            {photoUrl ? t('profile.changePhoto') : t('profile.addPhoto')}
          </button>
        </div>

        <Field label={t('profile.fullName')} htmlFor={fieldIds.name}>
          <input id={fieldIds.name} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label={t('profile.businessName')} htmlFor={fieldIds.business}>
          <input id={fieldIds.business} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('profile.businessNamePlaceholder')} style={inputStyle} />
        </Field>
        <Field label={t('profile.aboutYou')} htmlFor={fieldIds.about}>
          <textarea id={fieldIds.about} value={about} onChange={(e) => setAbout(e.target.value)} rows={4} placeholder={t('profile.aboutPlaceholder')} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', marginBottom: 4 }} />
        </Field>

        <Field label={t('profile.languagesKnown')}>
          <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginTop: -3, marginBottom: 10, lineHeight: 1.5 }}>{t('profile.languagesKnownHint')}</p>
          <div role="group" aria-label={t('profile.languagesKnown')} style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={languagesKnown.includes(l.id)}
                onClick={() => toggleLanguageKnown(l.id)}
                style={{
                  background: languagesKnown.includes(l.id) ? 'var(--ks-indigo)' : '#fff',
                  color: languagesKnown.includes(l.id) ? '#fff' : 'var(--ks-earth)',
                  border: `1px solid ${languagesKnown.includes(l.id) ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
                  borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                  fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 36,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Field>

        <button onClick={handleSaveProfile} disabled={saving} style={{ ...primaryBtn, marginTop: 16, width: '100%' }}>
          {saving ? t('profile.saving') : saved ? `✓ ${t('profile.saved')}` : t('profile.saveProfile')}
        </button>
        {saveError && <p role="alert" style={{ color: 'var(--ks-clay)', fontSize: 12.5, fontWeight: 500, marginTop: 10 }}>{saveError}</p>}
      </div>

      {/* Achievements */}
      <p style={sectionLabel}>{t('profile.recognition')}</p>
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <Field label={t('profile.achievementTitlePlaceholder')} htmlFor={fieldIds.achTitle}>
          <input id={fieldIds.achTitle} value={achTitle} onChange={(e) => setAchTitle(e.target.value)} placeholder={t('profile.achievementTitlePlaceholder')} style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 12 }}>
          <Field label={t('profile.issuingOrg')} htmlFor={fieldIds.achOrg}>
            <input id={fieldIds.achOrg} value={achOrg} onChange={(e) => setAchOrg(e.target.value)} placeholder={t('profile.issuingOrg')} style={{ ...inputStyle, marginBottom: 0 }} />
          </Field>
          <Field label={t('profile.year')} htmlFor={fieldIds.achYear}>
            <input id={fieldIds.achYear} value={achYear} onChange={(e) => setAchYear(e.target.value)} placeholder={t('profile.year')} type="number" inputMode="numeric" style={{ ...inputStyle, marginBottom: 0 }} />
          </Field>
        </div>
        <Field label={t('profile.shortDescription')} htmlFor={fieldIds.achDesc}>
          <input id={fieldIds.achDesc} value={achDesc} onChange={(e) => setAchDesc(e.target.value)} placeholder={t('profile.shortDescription')} style={inputStyle} />
        </Field>
        <button onClick={handleAddAchievement} disabled={addingAch} style={{ ...primaryBtn, width: '100%' }}>
          {addingAch ? t('profile.adding') : t('profile.addAchievement')}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 26 }}>
        {achievements.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ fontSize: 17 }} aria-hidden="true">🏆</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ks-earth)' }}>{a.title}{a.year ? ` (${a.year})` : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--ks-muted)', marginTop: 2 }}>{[a.issuing_organization, a.description].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={() => handleDeleteAchievement(a.id)} style={deleteBtn} aria-label={`${t('profile.remove')}: ${a.title}`}>{t('profile.remove')}</button>
          </div>
        ))}
      </div>

      {/* Portfolio */}
      <p style={sectionLabel}>{t('profile.myWork')}</p>
      {portfolio.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 26 }}>
          {t('profile.portfolioEmptyPrefix')}{' '}
          <Link href="/products" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>{t('profile.portfolioEmptyLink')}</Link>{' '}
          {t('profile.portfolioEmptySuffix')}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 9, marginBottom: 26 }}>
          {portfolio.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.image_url} alt={p.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 9, border: '1px solid var(--ks-border)' }} />
          ))}
        </div>
      )}

      {/* Badges */}
      <p style={sectionLabel}>{t('profile.badges')}</p>
      {badges.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 26 }}>{t('profile.badgesEmpty')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 26 }}>
          {badges.map((b) => (
            <div key={b.badge_id} style={{
              background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '14px 12px', textAlign: 'center',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'rgba(212,160,23,0.16)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
              }}>
                <IconBadge size={20} style={{ color: 'var(--ks-turmeric)' }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ks-earth)', marginBottom: 3 }}>{b.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', lineHeight: 1.35 }}>{b.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* My Stories */}
      <p style={sectionLabel}>{t('profile.myStories')}</p>
      {myStories.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 26 }}>
          {t('profile.storiesEmptyPrefix')}{' '}
          <Link href="/community/new" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>{t('profile.storiesEmptyLink')}</Link>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 26 }}>
          {myStories.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: '11px 14px',
            }}>
              <a
                href={s.status === 'PUBLISHED' ? `/community/${s.slug}` : undefined}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ks-earth)', textDecoration: 'none', cursor: s.status === 'PUBLISHED' ? 'pointer' : 'default', flex: 1, minWidth: 0 }}
              >
                {s.title}
              </a>
              <span style={{ fontSize: 11, color: 'var(--ks-muted)', flexShrink: 0 }}>
                {s.status === 'PUBLISHED' ? `❤ ${s.likes_count}` : t('profile.storyDraft')}
              </span>
              <button
                type="button"
                onClick={() => setDeleteStoryId(s.id)}
                aria-label={`${t('profile.remove')}: ${s.title}`}
                style={{ ...deleteBtn, flexShrink: 0 }}
              >
                {t('profile.remove')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Impact + wallet */}
      <p style={sectionLabel}>{t('profile.myImpact')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 26 }}>
        <Link href="/saathi" style={{
          display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12,
          padding: '16px 14px', textDecoration: 'none',
        }}>
          <IconSaathi size={20} style={{ color: 'var(--ks-clay)', marginBottom: 8 }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ks-earth)' }}>{t('profile.saathiDashboard')}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 2 }}>{t('profile.viewImpact')} →</div>
        </Link>
        <Link href="/wallet" style={{
          display: 'block', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12,
          padding: '16px 14px', textDecoration: 'none',
        }}>
          <IconWallet size={20} style={{ color: 'var(--ks-clay)', marginBottom: 8 }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ks-earth)' }}>
            {walletBalance === null ? '…' : walletBalance} {t('wallet.pointsUnit')}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 2 }}>{t('profile.openWallet')} →</div>
        </Link>
      </div>

      {/* Public page */}
      <p style={sectionLabel}>{t('profile.publicPage')}</p>
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 16, lineHeight: 1.55 }}>
          {t('profile.publicPageDesc')}
        </p>
        <Field label={t('profile.pageName')} htmlFor={fieldIds.slug}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--ks-muted)', whiteSpace: 'nowrap' }}>{BRAND.fallbackUrl.replace('https://', '')}/a/</span>
            <input id={fieldIds.slug} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        </Field>
        <Field label={t('profile.publicContactNumber')} htmlFor={fieldIds.phone}>
          <input id={fieldIds.phone} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" type="tel" style={inputStyle} />
        </Field>
        {publishError && <p role="alert" style={{ color: 'var(--ks-clay)', fontSize: 12.5, fontWeight: 500, marginBottom: 12 }}>{publishError}</p>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handlePublish} disabled={publishSaving} style={primaryBtn}>
            {publishSaving ? t('profile.publishing') : published ? t('profile.updatePage') : t('profile.publishPage')}
          </button>
          {published && (
            <>
              <a href={`/a/${slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--ks-indigo)', fontWeight: 600 }}>{t('profile.viewLivePage')}</a>
              <button onClick={handleUnpublish} style={{ ...deleteBtn, marginLeft: 'auto' }}>{t('profile.unpublish')}</button>
            </>
          )}
        </div>
      </div>

      {deleteStoryId && (
        <DeleteConfirmModal
          title={t('community.deleteStoryTitle')}
          warning={t('community.deleteStoryWarning')}
          onCancel={() => setDeleteStoryId(null)}
          onConfirm={() => { handleDeleteStory(deleteStoryId); setDeleteStoryId(null) }}
        />
      )}
    </div>
  )
}

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '11px 12px', fontSize: 16, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', marginBottom: 12,
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 9,
  padding: '12px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 46,
}
const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', color: 'var(--ks-indigo)', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '10px 16px', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
}
const deleteBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--ks-clay)', color: 'var(--ks-clay)', borderRadius: 8,
  padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 36,
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  )
}
