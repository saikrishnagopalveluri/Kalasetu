'use client'

import { useLanguage } from '@/lib/LanguageProvider'

export default function TermsPage() {
  const { t } = useLanguage()
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('terms.title')}
      </h1>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 20 }}>{t('terms.lastUpdated')}</p>
      <div className="ks-zari-band" style={{ width: 64, borderRadius: 3, marginBottom: 28 }} />

      <Section title={t('terms.what.title')}>{t('terms.what.body')}</Section>
      <Section title={t('terms.account.title')}>{t('terms.account.body')}</Section>
      <Section title={t('terms.aiContent.title')}>{t('terms.aiContent.body')}</Section>
      <Section title={t('terms.ownership.title')}>{t('terms.ownership.body')}</Section>
      <Section title={t('terms.subscriptions.title')}>{t('terms.subscriptions.body')}</Section>
      <Section title={t('terms.prohibited.title')}>{t('terms.prohibited.body')}</Section>
      <Section title={t('terms.noGuarantees.title')}>{t('terms.noGuarantees.body')}</Section>
      <Section title={t('terms.changes.title')}>{t('terms.changes.body')}</Section>
      <Section title={t('terms.governingLaw.title')}>{t('terms.governingLaw.body')}</Section>
      <Section title={t('terms.contact.title')} last>
        {t('terms.contact.body')} <a href="mailto:hello@hastkatha.in" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>hello@hastkatha.in</a>
      </Section>
    </div>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      marginBottom: 18, paddingBottom: 18,
      borderBottom: last ? 'none' : '1px solid var(--ks-border)',
    }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, marginBottom: 8, color: 'var(--ks-earth)' }}>{title}</h2>
      <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ks-earth)' }}>{children}</p>
    </div>
  )
}
