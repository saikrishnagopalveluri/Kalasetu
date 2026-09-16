'use client'

import { useId, useState } from 'react'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'

function CalculatorInner() {
  const { t } = useLanguage()
  const [labourHours, setLabourHours] = useState('')
  const [labourers, setLabourers] = useState('1')
  const [days, setDays] = useState('1')
  const [hourlyRate, setHourlyRate] = useState('200')
  const [materialCost, setMaterialCost] = useState('')
  const [otherCosts, setOtherCosts] = useState('')
  const [marginPercent, setMarginPercent] = useState('30')
  const [method, setMethod] = useState<'margin' | 'markup'>('margin')

  const hours = Number(labourHours) || 0
  const numLabourers = Number(labourers) || 1
  const numDays = Number(days) || 1
  const rate = Number(hourlyRate) || 0
  const material = Number(materialCost) || 0
  const other = Number(otherCosts) || 0
  const margin = Number(marginPercent) || 0

  const labourCost = hours * numLabourers * numDays * rate
  const totalCost = labourCost + material + other

  // Margin: price such that margin% of the SELLING price is profit.
  // Markup: price such that margin% of the COST is added as profit.
  const sellingPrice = method === 'margin'
    ? margin < 100 ? totalCost / (1 - margin / 100) : totalCost
    : totalCost * (1 + margin / 100)

  const profit = sellingPrice - totalCost

  const ids = {
    hours: useId(), people: useId(), days: useId(), rate: useId(),
    material: useId(), other: useId(), pct: useId(),
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('calculator.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        {t('calculator.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      <div className="ks-calc-layout">
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 22 }}>
        <p style={sectionLabel}>{t('calculator.labour')}</p>
        <Row>
          <Field label={t('calculator.hoursWorked')} htmlFor={ids.hours}>
            <input id={ids.hours} type="number" inputMode="decimal" min="0" value={labourHours} onChange={(e) => setLabourHours(e.target.value)} placeholder="e.g. 20" style={inputStyle} />
          </Field>
          <Field label={t('calculator.numberOfPeople')} htmlFor={ids.people}>
            <input id={ids.people} type="number" inputMode="numeric" min="1" value={labourers} onChange={(e) => setLabourers(e.target.value)} style={inputStyle} />
          </Field>
        </Row>
        <Row>
          <Field label={t('calculator.numberOfDays')} htmlFor={ids.days}>
            <input id={ids.days} type="number" inputMode="numeric" min="1" value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t('calculator.ratePerHour')} htmlFor={ids.rate}>
            <input id={ids.rate} type="number" inputMode="decimal" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} style={inputStyle} />
          </Field>
        </Row>

        <p style={{ ...sectionLabel, marginTop: 10 }}>{t('calculator.materialsOther')}</p>
        <Row>
          <Field label={t('calculator.rawMaterialCost')} htmlFor={ids.material}>
            <input id={ids.material} type="number" inputMode="decimal" min="0" value={materialCost} onChange={(e) => setMaterialCost(e.target.value)} placeholder="e.g. 800" style={inputStyle} />
          </Field>
          <Field label={t('calculator.packagingTransport')} htmlFor={ids.other}>
            <input id={ids.other} type="number" inputMode="decimal" min="0" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} placeholder="e.g. 100" style={inputStyle} />
          </Field>
        </Row>

        <p style={{ ...sectionLabel, marginTop: 10 }}>{t('calculator.profit')}</p>
        <div role="group" aria-label={t('calculator.profit')} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <MethodButton active={method === 'margin'} onClick={() => setMethod('margin')}>
            {t('calculator.marginLabel')}
          </MethodButton>
          <MethodButton active={method === 'markup'} onClick={() => setMethod('markup')}>
            {t('calculator.markupLabel')}
          </MethodButton>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 12, lineHeight: 1.55 }}>
          {method === 'margin' ? t('calculator.marginExplain') : t('calculator.markupExplain')}
        </p>
        <Field label={method === 'margin' ? t('calculator.desiredMargin') : t('calculator.desiredMarkup')} htmlFor={ids.pct}>
          <input id={ids.pct} type="number" inputMode="numeric" min="0" max={method === 'margin' ? 99 : undefined} value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)} style={{ ...inputStyle, marginBottom: 0, maxWidth: 140 }} />
        </Field>
      </div>

      <div className="ks-calc-result ks-pop-in" style={{ background: 'var(--ks-earth)', borderRadius: 14, padding: '22px 20px' }}>
        <Line
          label={t('calculator.totalCost')}
          value={totalCost}
          sub={`${t('calculator.labour')} ₹${labourCost.toLocaleString('en-IN')} + ${t('calculator.materialWord')} ₹${material.toLocaleString('en-IN')} + ${t('calculator.otherWord')} ₹${other.toLocaleString('en-IN')}`}
        />
        <Line label={method === 'margin' ? t('calculator.desiredMarginShort') : t('calculator.desiredMarkupShort')} valueText={`${margin}%`} />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '14px 0' }} />
        <div style={{ fontSize: 12, color: 'var(--ks-turmeric)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          {t('calculator.recommendedPrice')}
        </div>
        <div style={{ fontSize: 'clamp(28px, 8vw, 34px)', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', marginBottom: 8, lineHeight: 1.1 }}>
          ₹{Math.round(sellingPrice).toLocaleString('en-IN')}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
          {t('calculator.profitOnPiece').replace('{profit}', Math.round(profit).toLocaleString('en-IN'))}
        </div>
      </div>
      </div>

      <style jsx>{`
        /* Below ~720px the result stays below the form (matches how every
           other page in the app stacks on mobile). Above it, the artisan
           is filling in a fairly tall form and shouldn't have to scroll
           past it just to see the price update, so the result panel
           moves beside the form and stays in view while they type. */
        @media (min-width: 720px) {
          .ks-calc-layout {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 20px;
            align-items: start;
          }
          .ks-calc-result {
            position: sticky;
            top: 84px;
          }
        }
      `}</style>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

function MethodButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        flex: 1, background: active ? 'var(--ks-indigo)' : '#fff',
        color: active ? '#fff' : 'var(--ks-earth)',
        border: `1px solid ${active ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
        borderRadius: 8, padding: '11px 10px', fontSize: 13, fontWeight: 600,
        fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
      }}
    >
      {children}
    </button>
  )
}

function Line({ label, value, valueText, sub }: { label: string; value?: number; valueText?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
      <div>
        <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
        {valueText ?? `₹${Math.round(value ?? 0).toLocaleString('en-IN')}`}
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '11px 12px', fontSize: 16, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)', marginBottom: 16,
}

export default function CalculatorPage() {
  return (
    <RequireAuth>
      <CalculatorInner />
    </RequireAuth>
  )
}
