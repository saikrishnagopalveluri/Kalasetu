'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'
import PeacockMark from '@/components/PeacockMark'

// Landing page for the link in the password-reset email. Supabase's client
// SDK auto-detects the recovery token in the URL (detectSessionInUrl,
// enabled by default) and exchanges it for a real session before this
// component's effects run, firing a PASSWORD_RECOVERY auth event, so we just
// wait for that (or an existing session) before allowing a new password.
export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true)
    })
    // Covers the case where the event already fired before this listener
    // attached (a fast redirect); if a session already exists, proceed.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    const timer = setTimeout(() => { if (!ready) setInvalidLink(true) }, 5000)
    return () => { listener.subscription.unsubscribe(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validatePassword(): string {
    if (newPassword.length < 8) return t('signup.passwordTooShort')
    if (newPassword !== confirmPassword) return t('forgotPassword.passwordMismatch')
    return ''
  }

  async function handleSubmit() {
    const validation = validatePassword()
    if (validation) { setError(validation); return }
    if (!supabase) return
    setError('')
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)
    if (updateError) { setError(t('forgotPassword.resetFailed')); return }
    await supabase.auth.signOut()
    setSuccess(true)
    setTimeout(() => router.push('/login'), 1800)
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <PeacockMark size={40} style={{ marginBottom: 10 }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ks-earth)', marginBottom: 6 }}>
          {t('forgotPassword.setNewPassword')}
        </h1>
      </div>
      <div className="ks-zari-band" style={{ borderRadius: 4, marginBottom: 24 }} />

      <div className="ks-pop-in ks-lattice" style={{
        backgroundColor: 'var(--ks-linen)', border: '1px solid var(--ks-border)', borderRadius: 18,
        padding: 22, marginBottom: 20, boxShadow: '0 6px 20px rgba(19,42,69,0.08)',
      }}>
        {invalidLink && !ready ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--ks-earth)', lineHeight: 1.6, marginBottom: 14 }}>{t('forgotPassword.linkExpired')}</p>
            <a href="/forgot-password" style={linkStyle}>{t('forgotPassword.requestNewLink')}</a>
          </div>
        ) : !ready ? (
          <p style={{ fontSize: 14, color: 'var(--ks-muted)', textAlign: 'center' }}>{t('publicPage.loading')}</p>
        ) : success ? (
          <p style={{ fontSize: 14, color: 'var(--ks-jade)', fontWeight: 600, textAlign: 'center' }}>
            ✓ {t('forgotPassword.passwordChanged')}
          </p>
        ) : (
          <>
            <label htmlFor="rp-new-password" style={labelStyle}>{t('forgotPassword.newPassword')}</label>
            <input
              id="rp-new-password" type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <label htmlFor="rp-confirm-password" style={labelStyle}>{t('forgotPassword.confirmPassword')}</label>
            <input
              id="rp-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              style={{ ...inputStyle, marginBottom: error ? 8 : 16 }}
            />
            {error && (
              <p role="alert" style={errorStyle}><span aria-hidden="true">⚠</span> {error}</p>
            )}
            <button onClick={handleSubmit} disabled={submitting} style={primaryButtonStyle(submitting)}>
              {submitting ? t('forgotPassword.saving') : t('forgotPassword.setNewPassword')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ks-earth)', marginBottom: 7,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--ks-ivory)', border: '1.5px solid var(--ks-border)',
  borderRadius: 10, padding: '13px 14px', fontSize: 16, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)', minHeight: 48,
}

const errorStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ks-clay)', fontSize: 13,
  fontWeight: 500, background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
  borderRadius: 8, padding: '9px 11px', marginTop: 2, marginBottom: 12,
}

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', background: 'var(--ks-indigo)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)',
    cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, minHeight: 50,
  }
}

const linkStyle: React.CSSProperties = { color: 'var(--ks-indigo)', fontWeight: 600 }
