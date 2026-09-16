// Single source of truth for subscription pricing, shared by the pricing
// page (what the user sees) and both Razorpay routes (what actually gets
// charged and verified) — a UI-only price table that drifted from what the
// server charges would either overcharge or undercharge someone.
//
// Annual price = 10x monthly ("2 months free"), rounded to a clean number —
// standard SaaS convention, matches what was agreed with the product owner.

export type BillingPeriod = 'monthly' | 'annual'
export type TierId = 'starter' | 'pro' | 'premium'

export const TIER_PRICE_PAISE: Record<TierId, Record<BillingPeriod, number>> = {
  starter: { monthly: 9900, annual: 99000 },     // ₹99/mo, ₹990/yr
  pro: { monthly: 29900, annual: 299000 },       // ₹299/mo, ₹2,990/yr
  premium: { monthly: 59900, annual: 599000 },   // ₹599/mo, ₹5,990/yr
}

export const VALID_TIERS = Object.keys(TIER_PRICE_PAISE) as TierId[]

export function isValidTier(tier: unknown): tier is TierId {
  return typeof tier === 'string' && VALID_TIERS.includes(tier as TierId)
}

export function isValidPeriod(period: unknown): period is BillingPeriod {
  return period === 'monthly' || period === 'annual'
}

export function priceFor(tier: TierId, period: BillingPeriod): number {
  return TIER_PRICE_PAISE[tier][period]
}

// How much cheaper the annual price is per year, as a percentage of what 12
// months at the monthly rate would have cost — used for the "save X%" badge.
export function annualSavingsPercent(tier: TierId): number {
  const monthlyYearCost = TIER_PRICE_PAISE[tier].monthly * 12
  const annualCost = TIER_PRICE_PAISE[tier].annual
  return Math.round(((monthlyYearCost - annualCost) / monthlyYearCost) * 100)
}
