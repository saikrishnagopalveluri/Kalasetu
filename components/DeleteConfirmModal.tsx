'use client'

import { useLanguage } from '@/lib/LanguageProvider'

// Shared in-app confirmation for any permanent delete (design ideas,
// products, catalogues, ...), never a native window.confirm(), which
// renders as a browser-chrome dialog outside the site's own styling and
// reads as broken/untrusted rather than part of the product.
export default function DeleteConfirmModal({
  title,
  warning,
  error,
  onCancel,
  onConfirm,
}: {
  title: string
  warning: string
  error?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useLanguage()

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(19,42,69,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="ks-delete-confirm-title"
        style={{ background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%', padding: 24, textAlign: 'center' }}
      >
        <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">⚠️</div>
        <h2 id="ks-delete-confirm-title" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ks-earth)', marginBottom: 8 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 20 }}>
          {warning}
        </p>
        {error && (
          <p role="alert" style={{ fontSize: 12.5, color: 'var(--ks-clay)', marginBottom: 14 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, background: '#fff', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)',
            borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
          }}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onConfirm} style={{
            flex: 1, background: 'var(--ks-clay)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-body)', cursor: 'pointer',
          }}>
            {t('design.deletePermanently')}
          </button>
        </div>
      </div>
    </div>
  )
}
