'use client'

import { useState } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import { BRAND } from '@/lib/brand'
import { TIER_PRICE_PAISE, annualSavingsPercent, type BillingPeriod, type TierId } from '@/lib/pricing'

const TIERS: { id: 'free' | TierId; nameKey: TranslationKey; featureKeys: TranslationKey[]; highlight?: boolean }[] = [
  {
    id: 'free', nameKey: 'pricing.tier.free',
    featureKeys: ['pricing.feature.coach5', 'pricing.feature.listings3', 'pricing.feature.schemeNavigator'],
  },
  {
    id: 'starter', nameKey: 'pricing.tier.starter',
    featureKeys: ['pricing.feature.coachUnlimited', 'pricing.feature.listings15', 'pricing.feature.pricingAssistant', 'pricing.feature.oneTemplate'],
  },
  {
    id: 'pro', nameKey: 'pricing.tier.pro',
    featureKeys: ['pricing.feature.listingsUnlimited', 'pricing.feature.reelScripts', 'pricing.feature.orderCRM', 'pricing.feature.allTemplates'],
    highlight: true,
  },
  {
    id: 'premium', nameKey: 'pricing.tier.premium',
    featureKeys: ['pricing.feature.designStudio', 'pricing.feature.prioritySupport', 'pricing.feature.earlyAccess'],
  },
]

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function PricingInner() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [processingTier, setProcessingTier] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  async function handleUpgrade(tierId: TierId) {
    setMessage('')
    setProcessingTier(tierId)
    try {
      const { data: sessionData } = await supabase!.auth.getSession()
      const accessToken = sessionData.session?.access_token

      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tier: tierId, period }),
      })
      const data = await res.json()

      if (!res.ok || !data.orderId) {
        // Payments not configured yet — honest fallback, not a fake button.
        const subject = encodeURIComponent(`Upgrade to ${tierId} (${period})`)
        window.location.assign(`mailto:hello@hastkatha.in?subject=${subject}`)
        return
      }

      const razorpay = new window.Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: 'INR',
        name: BRAND.name,
        description: `${tierId} subscription (${period})`,
        theme: { color: '#132A45' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          })
          if (verifyRes.ok) {
            const tierName = TIERS.find((tr) => tr.id === tierId)?.nameKey
            setMessage(t('pricing.upgradedMessage').replace('{tier}', tierName ? t(tierName) : tierId))
          } else {
            setMessage(t('pricing.activationFailed'))
          }
        },
      })
      razorpay.open()
    } catch {
      setMessage(t('pricing.somethingWrong'))
    } finally {
      setProcessingTier(null)
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('pricing.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6 }}>
        {t('pricing.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 28 }} />

      {message && (
        <div style={{ background: 'rgba(15,91,78,0.12)', color: 'var(--ks-jade, #0F5B4E)', borderRadius: 10, padding: '12px 16px', fontSize: 13, marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div style={{
        display: 'inline-flex', background: 'var(--ks-linen)', borderRadius: 999, padding: 3, marginBottom: 24,
        border: '1px solid var(--ks-border)',
      }}>
        {(['monthly', 'annual'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '8px 18px', borderRadius: 999, border: 'none', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              background: period === p ? 'var(--ks-indigo)' : 'transparent',
              color: period === p ? '#fff' : 'var(--ks-earth)',
            }}
          >
            {t(p === 'monthly' ? 'pricing.billingMonthly' : 'pricing.billingAnnual')}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        {TIERS.map((tier) => {
          const isCurrent = profile?.subscription_tier === tier.id
            && (tier.id === 'free' || profile?.subscription_period === period)
          return (
            <div key={tier.id} style={{
              position: 'relative',
              background: 'var(--ks-ivory)',
              border: tier.highlight ? '2px solid var(--ks-turmeric)' : '1px solid var(--ks-border)',
              borderRadius: 16, padding: '22px 18px 18px',
              boxShadow: tier.highlight ? '0 12px 28px rgba(212,160,23,0.22)' : '0 2px 8px rgba(19,42,69,0.05)',
              transform: tier.highlight ? 'translateY(-4px)' : undefined,
            }}>
              {tier.highlight && (
                <span style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', fontSize: 10.5, fontWeight: 700,
                  padding: '4px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4,
                  boxShadow: '0 3px 8px rgba(212,160,23,0.4)', whiteSpace: 'nowrap',
                }}>
                  <span aria-hidden="true">★</span> {t('pricing.mostPopular')}
                </span>
              )}
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: 'var(--ks-earth)', marginBottom: 4 }}>
                {t(tier.nameKey)}
              </h2>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ks-indigo)', fontFamily: 'var(--font-display)' }}>
                  {tier.id === 'free' ? (
                    <>₹0<span style={{ fontSize: 12, color: 'var(--ks-muted)', fontWeight: 400 }}>{t('pricing.perMonth')}</span></>
                  ) : period === 'monthly' ? (
                    <>₹{TIER_PRICE_PAISE[tier.id].monthly / 100}<span style={{ fontSize: 12, color: 'var(--ks-muted)', fontWeight: 400 }}>{t('pricing.perMonth')}</span></>
                  ) : (
                    <>₹{TIER_PRICE_PAISE[tier.id].annual / 100}<span style={{ fontSize: 12, color: 'var(--ks-muted)', fontWeight: 400 }}>{t('pricing.perYear')}</span></>
                  )}
                </div>
                {tier.id !== 'free' && period === 'annual' && (
                  <div style={{ fontSize: 11, color: 'var(--ks-jade)', fontWeight: 600, marginTop: 2 }}>
                    {t('pricing.saveAnnual').replace('{percent}', String(annualSavingsPercent(tier.id)))} · {t('pricing.billedAnnually')}
                  </div>
                )}
              </div>
              <ul style={{ listStyle: 'none', marginBottom: 18 }}>
                {tier.featureKeys.map((fk) => (
                  <li key={fk} style={{
                    fontSize: 12.5, color: 'var(--ks-earth)', marginBottom: 8,
                    display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.45,
                  }}>
                    <span style={{ color: 'var(--ks-jade)', fontWeight: 700, flexShrink: 0 }} aria-hidden="true">✓</span>
                    {t(fk)}
                  </li>
                ))}
              </ul>
              {tier.id === 'free' ? (
                <div style={{
                  fontSize: 12, color: 'var(--ks-muted)', textAlign: 'center', padding: '9px 0',
                  border: '1px dashed var(--ks-border)', borderRadius: 8,
                }}>
                  {isCurrent ? t('pricing.yourCurrentPlan') : t('pricing.defaultPlan')}
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(tier.id as TierId)}
                  disabled={isCurrent || processingTier === tier.id}
                  style={{
                    width: '100%', background: isCurrent ? 'var(--ks-linen)' : 'var(--ks-indigo)',
                    color: isCurrent ? 'var(--ks-muted)' : '#fff', border: 'none', borderRadius: 9,
                    padding: '10px 0', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                    cursor: isCurrent ? 'default' : 'pointer',
                  }}
                >
                  {isCurrent ? t('pricing.currentPlan') : processingTier === tier.id ? t('pricing.opening') : t('pricing.upgrade')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <RequireAuth>
      <PricingInner />
    </RequireAuth>
  )
}
