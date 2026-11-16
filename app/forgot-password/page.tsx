'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'
import PeacockMark from '@/components/PeacockMark'

type Method = 'choose' | 'email' | 'sms-phone' | 'sms-otp' | 'new-password'

const RESEND_COOLDOWN_SECONDS = 30

function maskPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 4) return phone
  return `${'•'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`
}

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [method, setMethod] = useState<Method>('choose')

  // Email flow
  const [email, setEmail] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // SMS flow
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [smsSubmitting, setSmsSubmitting] = useState(false)
  const [smsError, setSmsError] = useState('')
  const [resendIn, setResendIn] = useState(0)

  // New password (after successful SMS OTP verification; the email link
  // path lands on its own dedicated /reset-password page instead, since
  // Supabase exchanges that link for a session outside this component)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    resendTimerRef.current = setInterval(() => setResendIn((s) => Math.max(s - 1, 0)), 1000)
    return () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current) }
  }, [resendIn])

  async function handleSendEmail() {
    if (!supabase || !email.trim()) return
    setEmailSubmitting(true)
    // resetPasswordForEmail never reveals whether the address is registered
    // (Supabase always resolves the same way either way), so we show one
    // generic confirmation regardless of the actual outcome, for the same
    // reason: an attacker probing emails shouldn't learn anything from this.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setEmailSubmitting(false)
    setEmailSent(true)
  }

  async function handleSendOtp() {
    if (!supabase || !phone.trim()) return
    setSmsError('')
    setSmsSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() })
    setSmsSubmitting(false)
    if (error) {
      setSmsError(t('forgotPassword.smsSendFailed'))
      return
    }
    setMethod('sms-otp')
    setResendIn(RESEND_COOLDOWN_SECONDS)
  }

  async function handleResendOtp() {
    if (resendIn > 0 || !supabase) return
    setSmsError('')
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() })
    if (error) { setSmsError(t('forgotPassword.smsSendFailed')); return }
    setResendIn(RESEND_COOLDOWN_SECONDS)
  }

  async function handleVerifyOtp() {
    if (!supabase || !otp.trim()) return
    setSmsError('')
    setSmsSubmitting(true)
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp.trim(), type: 'sms' })
    setSmsSubmitting(false)
    if (error) {
      setSmsError(t('forgotPassword.otpInvalid'))
      return
    }
    setMethod('new-password')
  }

  function validatePassword(): string {
    if (newPassword.length < 8) return t('signup.passwordTooShort')
    if (newPassword !== confirmPassword) return t('forgotPassword.passwordMismatch')
    return ''
  }

  async function handleSetNewPassword() {
    const validation = validatePassword()
    if (validation) { setPasswordError(validation); return }
    if (!supabase) return
    setPasswordError('')
    setPasswordSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSubmitting(false)
    if (error) { setPasswordError(t('forgotPassword.resetFailed')); return }
    await supabase.auth.signOut()
    setPasswordSuccess(true)
    setTimeout(() => router.push('/login'), 1800)
  }

  const strength = passwordStrength(newPassword)

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <PeacockMark size={40} style={{ marginBottom: 10 }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ks-earth)', marginBottom: 6 }}>
          {t('forgotPassword.title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('forgotPassword.subtitle')}</p>
      </div>
      <div className="ks-zari-band" style={{ borderRadius: 4, marginBottom: 24 }} />

      <div className="ks-pop-in ks-lattice" style={{
        backgroundColor: 'var(--ks-linen)', border: '1px solid var(--ks-border)', borderRadius: 18,
        padding: 22, marginBottom: 20, boxShadow: '0 6px 20px rgba(19,42,69,0.08)',
      }}>
        {method === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" onClick={() => setMethod('email')} style={methodButtonStyle}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>✉️</span>
              <span>{t('forgotPassword.viaEmail')}</span>
            </button>
            <button type="button" onClick={() => setMethod('sms-phone')} style={methodButtonStyle}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>💬</span>
              <span>{t('forgotPassword.viaSms')}</span>
            </button>
          </div>
        )}

        {method === 'email' && !emailSent && (
          <>
            <label htmlFor="fp-email" style={labelStyle}>{t('login.email')}</label>
            <input
              id="fp-email" type="email" inputMode="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail() }}
              placeholder="you@example.com" style={{ ...inputStyle, marginBottom: 16 }}
            />
            <button onClick={handleSendEmail} disabled={emailSubmitting || !email.trim()} style={primaryButtonStyle(emailSubmitting)}>
              {emailSubmitting ? t('forgotPassword.sending') : t('forgotPassword.sendResetLink')}
            </button>
          </>
        )}

        {method === 'email' && emailSent && (
          <p style={{ fontSize: 14, color: 'var(--ks-earth)', lineHeight: 1.6, textAlign: 'center' }}>
            ✓ {t('forgotPassword.emailSentMessage')}
          </p>
        )}

        {method === 'sms-phone' && (
          <>
            <label htmlFor="fp-phone" style={labelStyle}>{t('forgotPassword.registeredMobile')}</label>
            <input
              id="fp-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp() }}
              placeholder="+91 XXXXX XXXXX" style={{ ...inputStyle, marginBottom: smsError ? 8 : 16 }}
            />
            {smsError && <p role="alert" style={{ ...errorStyle, marginBottom: 12 }}><span aria-hidden="true">⚠</span> {smsError}</p>}
            <button onClick={handleSendOtp} disabled={smsSubmitting || !phone.trim()} style={primaryButtonStyle(smsSubmitting)}>
              {smsSubmitting ? t('forgotPassword.sending') : t('forgotPassword.sendOtp')}
            </button>
          </>
        )}

        {method === 'sms-otp' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 14 }}>
              {t('forgotPassword.otpSentTo')} {maskPhone(phone)}
            </p>
            <label htmlFor="fp-otp" style={labelStyle}>{t('forgotPassword.enterOtp')}</label>
            <input
              id="fp-otp" inputMode="numeric" autoComplete="one-time-code" value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp() }}
              placeholder="••••••" style={{ ...inputStyle, marginBottom: smsError ? 8 : 16, letterSpacing: '0.3em', textAlign: 'center' }}
            />
            {smsError && <p role="alert" style={{ ...errorStyle, marginBottom: 12 }}><span aria-hidden="true">⚠</span> {smsError}</p>}
            <button onClick={handleVerifyOtp} disabled={smsSubmitting || !otp.trim()} style={primaryButtonStyle(smsSubmitting)}>
              {smsSubmitting ? t('forgotPassword.verifying') : t('forgotPassword.verifyOtp')}
            </button>
            <button
              type="button" onClick={handleResendOtp} disabled={resendIn > 0}
              style={{ ...linkButtonStyle, marginTop: 14, opacity: resendIn > 0 ? 0.5 : 1 }}
            >
              {resendIn > 0 ? `${t('forgotPassword.resendIn')} ${resendIn}s` : t('forgotPassword.resendOtp')}
            </button>
          </>
        )}

        {method === 'new-password' && !passwordSuccess && (
          <>
            <label htmlFor="fp-new-password" style={labelStyle}>{t('forgotPassword.newPassword')}</label>
            <input
              id="fp-new-password" type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {newPassword && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i < strength.level ? strength.color : 'var(--ks-border)',
                  }} />
                ))}
              </div>
            )}
            <label htmlFor="fp-confirm-password" style={labelStyle}>{t('forgotPassword.confirmPassword')}</label>
            <input
              id="fp-confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetNewPassword() }}
              style={{ ...inputStyle, marginBottom: passwordError ? 8 : 16 }}
            />
            {passwordError && <p role="alert" style={{ ...errorStyle, marginBottom: 12 }}><span aria-hidden="true">⚠</span> {passwordError}</p>}
            <button onClick={handleSetNewPassword} disabled={passwordSubmitting || !newPassword || !confirmPassword} style={primaryButtonStyle(passwordSubmitting)}>
              {passwordSubmitting ? t('forgotPassword.saving') : t('forgotPassword.setNewPassword')}
            </button>
          </>
        )}

        {passwordSuccess && (
          <p style={{ fontSize: 14, color: 'var(--ks-jade)', fontWeight: 600, textAlign: 'center' }}>
            ✓ {t('forgotPassword.passwordChanged')}
          </p>
        )}
      </div>

      {method !== 'choose' && !passwordSuccess && (
        <button type="button" onClick={() => setMethod('choose')} style={{ ...linkButtonStyle, display: 'block', margin: '0 auto' }}>
          ← {t('forgotPassword.chooseAnotherMethod')}
        </button>
      )}

      <p style={{ fontSize: 14, color: 'var(--ks-muted)', marginTop: 20, textAlign: 'center' }}>
        <Link href="/login" style={linkStyle}>← {t('forgotPassword.backToLogin')}</Link>
      </p>
    </div>
  )
}

function passwordStrength(pw: string): { level: number; color: string } {
  if (pw.length === 0) return { level: 0, color: 'var(--ks-border)' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const colors = ['var(--ks-clay)', 'var(--ks-turmeric)', 'var(--ks-jade)']
  return { level: Math.max(score, 1), color: colors[Math.min(score, 2)] }
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
  borderRadius: 8, padding: '9px 11px', marginTop: 2,
}

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', background: 'var(--ks-indigo)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)',
    cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, minHeight: 50,
  }
}

const methodButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
  background: '#fff', border: '1.5px solid var(--ks-border)', borderRadius: 12,
  padding: '15px 16px', fontSize: 14.5, fontWeight: 600, color: 'var(--ks-earth)',
  fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 50,
}

const linkButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--ks-indigo)', fontWeight: 600,
  fontSize: 13.5, fontFamily: 'var(--font-body)', cursor: 'pointer', padding: 0,
}

const linkStyle: React.CSSProperties = { color: 'var(--ks-indigo)', fontWeight: 600 }
