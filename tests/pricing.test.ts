import { describe, it, expect } from 'vitest'
import {
  TIER_PRICE_PAISE,
  VALID_TIERS,
  annualSavingsPercent,
  isValidPeriod,
  isValidTier,
  priceFor,
} from '@/lib/pricing'

describe('pricing', () => {
  it('lists every tier exactly once', () => {
    expect(VALID_TIERS).toEqual(['starter', 'pro', 'premium'])
  })

  it.each(VALID_TIERS)('prices %s annually at ten times the monthly rate', (tier) => {
    expect(priceFor(tier, 'annual')).toBe(priceFor(tier, 'monthly') * 10)
  })

  it('keeps tiers in ascending price order', () => {
    const monthly = VALID_TIERS.map((t) => TIER_PRICE_PAISE[t].monthly)
    expect([...monthly].sort((a, b) => a - b)).toEqual(monthly)
  })

  it('stores prices as whole paise', () => {
    for (const tier of VALID_TIERS) {
      expect(Number.isInteger(priceFor(tier, 'monthly'))).toBe(true)
      expect(Number.isInteger(priceFor(tier, 'annual'))).toBe(true)
    }
  })

  it.each(VALID_TIERS)('shows a 17%% annual saving for %s', (tier) => {
    expect(annualSavingsPercent(tier)).toBe(17)
  })

  it.each([
    ['starter', true],
    ['premium', true],
    ['gold', false],
    ['', false],
    [null, false],
    [42, false],
    ['toString', false],
  ])('isValidTier(%j) is %s', (value, expected) => {
    expect(isValidTier(value)).toBe(expected)
  })

  it.each([
    ['monthly', true],
    ['annual', true],
    ['weekly', false],
    [undefined, false],
  ])('isValidPeriod(%j) is %s', (value, expected) => {
    expect(isValidPeriod(value)).toBe(expected)
  })
})
