'use client'

import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'

const RIGHTS_ITEMS: TranslationKey[] = [
  'privacy.rights.item1',
  'privacy.rights.item2',
  'privacy.rights.item3',
  'privacy.rights.item4',
]

export default function PrivacyPage() {
  const { t } = useLanguage()
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('privacy.title')}
      </h1>
      <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 20 }}>{t('privacy.lastUpdated')}</p>
      <div className="ks-zari-band" style={{ width: 64, borderRadius: 3, marginBottom: 28 }} />

      <Section title={t('privacy.collect.title')}>
        {t('privacy.collect.body1')}
        <br /><br />
        {t('privacy.collect.body2')}
      </Section>

      <Section title={t('privacy.use.title')}>
        {t('privacy.use.body')}
      </Section>

      <Section title={t('privacy.cookies.title')}>
        {t('privacy.cookies.body')}
      </Section>

      <Section title={t('privacy.share.title')}>
        {t('privacy.share.body')}
      </Section>

      <Section title={t('privacy.rights.title')}>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ks-earth)', marginBottom: 10 }}>
          {t('privacy.rights.intro')}
        </p>
        <ul style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: 'var(--ks-earth)' }}>
          {RIGHTS_ITEMS.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ks-earth)' }}>
          {t('privacy.rights.outro')}
        </p>
      </Section>

      <Section title={t('privacy.retention.title')}>
        {t('privacy.retention.body')}
      </Section>

      <Section title={t('privacy.security.title')}>
        {t('privacy.security.body')}
      </Section>

      <Section title={t('privacy.age.title')}>
        {t('privacy.age.body')}
      </Section>

      <Section title={t('privacy.changes.title')}>
        {t('privacy.changes.body')}
      </Section>

      <Section title={t('privacy.contact.title')} last>
        {t('privacy.contact.body')} <a href="mailto:hello@hastkatha.in" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>hello@hastkatha.in</a>
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
      <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--ks-earth)' }}>{children}</div>
    </div>
  )
}
