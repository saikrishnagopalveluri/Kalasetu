'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import { authErrorKey } from '@/lib/authErrors'
import type { TranslationKey } from '@/lib/translations'
import PeacockMark from '@/components/PeacockMark'
import { registerReferral } from '@/lib/referrals'

const CRAFT_TYPES: { value: string; key: TranslationKey }[] = [
  { value: 'Handloom weaving', key: 'craft.handloom' },
  { value: 'Kalamkari', key: 'craft.kalamkari' },
  { value: 'Silver filigree', key: 'craft.filigree' },
  { value: 'Leather craft', key: 'craft.leather' },
  { value: 'Block printing', key: 'craft.block' },
  { value: 'Pottery', key: 'craft.pottery' },
  { value: 'Embroidery', key: 'craft.embroidery' },
  { value: 'Other', key: 'craft.other' },
]

const STATES: { value: string; key: TranslationKey }[] = [
  { value: 'Andhra Pradesh', key: 'signup.state.andhraPradesh' },
  { value: 'Telangana', key: 'signup.state.telangana' },
  { value: 'Maharashtra', key: 'signup.state.maharashtra' },
  { value: 'Himachal Pradesh', key: 'signup.state.himachalPradesh' },
  { value: 'Tamil Nadu', key: 'signup.state.tamilNadu' },
  { value: 'Karnataka', key: 'signup.state.karnataka' },
  { value: 'Kerala', key: 'signup.state.kerala' },
  { value: 'Gujarat', key: 'signup.state.gujarat' },
  { value: 'Rajasthan', key: 'signup.state.rajasthan' },
  { value: 'Uttar Pradesh', key: 'signup.state.uttarPradesh' },
  { value: 'West Bengal', key: 'signup.state.westBengal' },
  { value: 'Madhya Pradesh', key: 'signup.state.madhyaPradesh' },
  { value: 'Odisha', key: 'signup.state.odisha' },
  { value: 'Bihar', key: 'signup.state.bihar' },
  { value: 'Punjab', key: 'signup.state.punjab' },
  { value: 'Other', key: 'signup.state.other' },
]

const INCOME_RANGES: { value: string; key: TranslationKey }[] = [
  { value: 'Under ₹15,000/month', key: 'signup.income.under15k' },
  { value: '₹15,000–30,000/month', key: 'signup.income.15to30k' },
  { value: '₹30,000–60,000/month', key: 'signup.income.30to60k' },
  { value: '₹60,000–1,00,000/month', key: 'signup.income.60to100k' },
  { value: 'Above ₹1,00,000/month', key: 'signup.income.above100k' },
]

const VISHWAKARMA_OPTIONS: { value: string; key: TranslationKey }[] = [
  { value: 'yes', key: 'signup.vishwakarma.yes' },
  { value: 'no', key: 'signup.vishwakarma.no' },
  { value: 'unsure', key: 'signup.vishwakarma.unsure' },
]

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupFormInner />
    </Suspense>
  )
}

function SignupFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref')
  const { signUp, error, clearError } = useAuth()
  const { t } = useLanguage()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [craftType, setCraftType] = useState(CRAFT_TYPES[0].value)
  const [state, setState] = useState(STATES[0].value)
  const [preferredLanguage, setPreferredLanguage] = useState('en')
  const [yearsActive, setYearsActive] = useState('')
  const [incomeRange, setIncomeRange] = useState('')
  const [vishwakarmaEligible, setVishwakarmaEligible] = useState('unsure')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !password) {
      setValidationError(t('signup.nameEmailPasswordRequired'))
      return
    }
    if (password.length < 8) {
      setValidationError(t('signup.passwordTooShort'))
      return
    }
    if (!agreedToTerms) {
      setValidationError(t('signup.mustAgree'))
      return
    }
    setValidationError('')
    clearError()
    setSubmitting(true)
    const ok = await signUp({
      email, password, name, phone, craftType, state,
      preferredLanguage, yearsActive, incomeRange, vishwakarmaEligible,
    })
    if (ok && referralCode) await registerReferral(referralCode)
    setSubmitting(false)
    if (ok) router.push('/')
  }

  const authKey = authErrorKey(error)
  const shownError = validationError || (authKey ? t(authKey) : '')

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <PeacockMark size={40} style={{ marginBottom: 10 }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ks-earth)', marginBottom: 6 }}>
          {t('signup.title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>
          {t('signup.subtitle')}
        </p>
      </div>
      <div className="ks-zari-band" style={{ borderRadius: 4, marginBottom: 24 }} />

      <div className="ks-pop-in ks-lattice" style={cardStyle}>
        <FieldLabel htmlFor="signup-name">{t('signup.fullName')}</FieldLabel>
        <input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('signup.fullNamePlaceholder')} style={inputStyle} />

        <FieldLabel htmlFor="signup-email">{t('signup.email')}</FieldLabel>
        <input id="signup-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />

        <FieldLabel htmlFor="signup-password">{t('signup.password')}</FieldLabel>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('signup.passwordPlaceholder')}
            style={{ ...inputStyle, marginBottom: 0, paddingRight: 66 }}
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

        <FieldLabel htmlFor="signup-phone">{t('signup.phone')}</FieldLabel>
        <input id="signup-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ ...inputStyle, marginBottom: 4 }} />
      </div>

      <div className="ks-pop-in ks-lattice" style={cardStyle}>
        <FieldLabel>{t('signup.craftType')}</FieldLabel>
        <ChipRow options={CRAFT_TYPES} value={craftType} onChange={setCraftType} />

        <FieldLabel htmlFor="signup-state">{t('signup.state')}</FieldLabel>
        <select id="signup-state" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle}>
          {STATES.map((s) => <option key={s.value} value={s.value}>{t(s.key)}</option>)}
        </select>

        <FieldLabel htmlFor="signup-language">{t('signup.preferredLanguage')}</FieldLabel>
        <select id="signup-language" value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} style={inputStyle}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
        </select>

        <FieldLabel htmlFor="signup-years">{t('signup.yearsActive')}</FieldLabel>
        <input id="signup-years" type="number" inputMode="numeric" min="0" value={yearsActive} onChange={(e) => setYearsActive(e.target.value)} placeholder={t('signup.yearsActivePlaceholder')} style={inputStyle} />

        <FieldLabel htmlFor="signup-income">{t('signup.incomeRange')}</FieldLabel>
        <select id="signup-income" value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="">{t('signup.preferNotToSay')}</option>
          {INCOME_RANGES.map((r) => <option key={r.value} value={r.value}>{t(r.key)}</option>)}
        </select>

        <FieldLabel>{t('signup.vishwakarma.question')}</FieldLabel>
        <ChipRow options={VISHWAKARMA_OPTIONS} value={vishwakarmaEligible} onChange={setVishwakarmaEligible} />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ks-earth)', marginBottom: 16, cursor: 'pointer', padding: '2px 2px' }}>
        <input
          type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
          style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: 'var(--ks-indigo)' }}
        />
        <span>
          {t('signup.agreePrefix')}{' '}
          <a href="/terms" target="_blank" style={linkStyle}>{t('signup.termsOfService')}</a> {t('signup.and')}{' '}
          <a href="/privacy" target="_blank" style={linkStyle}>{t('signup.privacyPolicy')}</a>{t('signup.agreeSuffix')}
        </span>
      </label>

      {shownError && (
        <p role="alert" style={errorStyle}>
          <span aria-hidden="true">⚠</span> {shownError}
        </p>
      )}

      <button onClick={handleSubmit} disabled={submitting} style={primaryButtonStyle(submitting)}>
        {submitting ? t('signup.creatingAccount') : t('signup.createAccount')}
      </button>

      <p style={{ fontSize: 14, color: 'var(--ks-muted)', marginTop: 20, textAlign: 'center' }}>
        {t('signup.alreadyHaveAccount')} <Link href="/login" style={linkStyle}>{t('signup.logIn')}</Link>
      </p>
    </div>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ks-earth)', marginBottom: 7, marginTop: 4 }}>{children}</label>
}

function ChipRow({ options, value, onChange }: { options: { value: string; key: TranslationKey }[]; value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            background: value === opt.value ? 'var(--ks-indigo)' : '#fff',
            color: value === opt.value ? '#fff' : 'var(--ks-earth)',
            border: `1.5px solid ${value === opt.value ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
            borderRadius: 999, padding: '9px 15px', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 40,
          }}
        >
          {t(opt.key)}
        </button>
      ))}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--ks-linen)', border: '1px solid var(--ks-border)', borderRadius: 18,
  padding: 22, marginBottom: 18, boxShadow: '0 6px 20px rgba(19,42,69,0.08)',
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
  borderRadius: 8, padding: '9px 11px', marginBottom: 16,
}

function primaryButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'block', width: '100%', background: 'var(--ks-indigo)', color: '#fff', border: 'none',
    borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-body)',
    cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, minHeight: 50,
  }
}

const linkStyle: React.CSSProperties = { color: 'var(--ks-indigo)', fontWeight: 600 }
