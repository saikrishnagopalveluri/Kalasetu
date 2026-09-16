'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import { IconWallet } from '@/components/CraftIcons'

type Transaction = { id: string; amount: number; type: string; description: string; created_at: string }

const TYPE_LABEL: Record<string, TranslationKey> = {
  WELCOME_BONUS: 'wallet.type.welcomeBonus',
  REFERRAL_EMPOWERMENT: 'wallet.type.referralEmpowerment',
  ONBOARDING_COMPLETE: 'wallet.type.onboardingComplete',
  REDEMPTION: 'wallet.type.redemption',
  ADMIN_ADJUSTMENT: 'wallet.type.adminAdjustment',
}

function WalletInner() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [transactions, setTransactions] = useState<Transaction[] | null>(null)

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('wallet_transactions').select('id, amount, type, description, created_at').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => setTransactions(data ?? []))
  }, [user])

  const balance = (transactions ?? []).reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('wallet.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6, maxWidth: 520 }}>
        {t('wallet.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      <div style={{
        background: 'linear-gradient(135deg, var(--ks-indigo), #1C3A5E)', borderRadius: 16, padding: 24,
        color: '#fff', marginBottom: 22, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, opacity: 0.85 }}>
          <IconWallet size={20} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('wallet.balanceLabel')}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, marginBottom: 4 }}>
          {transactions === null ? '—' : balance} <span style={{ fontSize: 17, fontWeight: 500 }}>{t('wallet.pointsUnit')}</span>
        </div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>
          {t('wallet.worthPrefix')} ₹{transactions === null ? '—' : balance}
        </div>
      </div>

      <div style={{
        background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 24,
      }}>
        <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>
          {t('wallet.explainer')}
        </p>
      </div>

      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        {t('wallet.history')}
      </p>

      {transactions === null ? (
        <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{t('common.loading')}</p>
      ) : transactions.length === 0 ? (
        <div className="ks-lattice" style={{ backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 12, padding: '24px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)' }}>{t('wallet.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {transactions.map((tx) => (
            <div key={tx.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ks-earth)' }}>{tx.description}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 2 }}>
                  {t(TYPE_LABEL[tx.type] ?? 'wallet.type.adminAdjustment')} · {new Date(tx.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: tx.amount >= 0 ? 'var(--ks-jade)' : 'var(--ks-clay)', flexShrink: 0 }}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletInner />
    </RequireAuth>
  )
}
