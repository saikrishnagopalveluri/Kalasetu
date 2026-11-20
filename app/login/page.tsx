'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import { authErrorKey } from '@/lib/authErrors'
import PeacockMark from '@/components/PeacockMark'

export default function LoginPage() {
  const router = useRouter()
  const { logIn, error, clearError } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setValidationError(t('login.validationError'))
      return
    }
    setValidationError('')
    clearError()
    setSubmitting(true)
    const ok = await logIn(email, password)
    setSubmitting(false)
    if (ok) router.push('/')
  }

  const authKey = authErrorKey(error)
  const shownError = validationError || (authKey ? t(authKey) : '')

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <PeacockMark size={40} style={{ marginBottom: 10 }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ks-earth)', marginBottom: 6 }}>
          {t('login.title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>
          {t('login.subtitle')}
        </p>
      </div>
      <div className="ks-zari-band" style={{ borderRadius: 4, marginBottom: 24 }} />

      <form id="login-form" className="ks-pop-in ks-lattice" onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} style={{
        backgroundColor: 'var(--ks-linen)', border: '1px solid var(--ks-border)', borderRadius: 18,
        padding: 22, marginBottom: 20, boxShadow: '0 6px 20px rgba(19,42,69,0.08)',
      }}>
        <label htmlFor="login-email" style={labelStyle}>{t('login.email')}</label>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={!!shownError}
          style={inputStyle}
        />
        <label htmlFor="login-password" style={labelStyle}>{t('login.password')}</label>
        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
            aria-invalid={!!shownError}
            style={{ ...inputStyle, paddingRight: 66, marginBottom: shownError ? 12 : 4 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
            style={showHideButtonStyle}
          >
            {showPassword ? t('common.hidePassword') : t('common.showPassword')}
          </button>
        </div>
        {shownError && (
          <p role="alert" style={errorStyle}>
            <span aria-hidden="true">⚠</span> {shownError}
          </p>
        )}
        <Link href="/forgot-password" style={{ ...linkStyle, display: 'inline-block', fontSize: 13, marginTop: shownError ? 12 : 4 }}>
          {t('login.forgotPassword')}
        </Link>
      </form>

      <button type="submit" form="login-form" disabled={submitting} style={primaryButtonStyle(submitting)}>
        <span aria-live="polite">{submitting ? t('login.loggingIn') : t('login.logIn')}</span>
      </button>

      <p style={{ fontSize: 14, color: 'var(--ks-muted)', marginTop: 20, textAlign: 'center' }}>
        {t('login.newHere')} <Link href="/signup" style={linkStyle}>{t('login.createAccount')}</Link>
      </p>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ks-earth)', marginBottom: 7,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--ks-ivory)', border: '1.5px solid var(--ks-border)',
  borderRadius: 10, padding: '13px 14px', fontSize: 16, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)', marginBottom: 16, minHeight: 48,
}

const showHideButtonStyle: React.CSSProperties = {
  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', color: 'var(--ks-indigo)', fontSize: 12.5,
  fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer', padding: '8px 10px',
  minHeight: 40,
}

const errorStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ks-clay)', fontSize: 13,
  fontWeight: 500, background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
  borderRadius: 8, padding: '9px 11px', marginTop: 2,
}

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', background: 'var(--ks-indigo)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)',
    cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, minHeight: 50,
  }
}

const linkStyle: React.CSSProperties = { color: 'var(--ks-indigo)', fontWeight: 600 }
