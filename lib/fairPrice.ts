// Deterministic fair-price maths for the voice agent. The model decides
// WHEN to price something and explains the result, but the numbers come
// from this function, never from the model, so an artisan is never quoted
// an invented price. Same defaults as the Pricing Calculator page
// (app/calculator): ₹200 an hour and a 30% margin on the selling price.

export const DEFAULT_HOURLY_WAGE_INR = 200
export const DEFAULT_MARGIN_PERCENT = 30
// Marketplace commission and payment fees typically take 10-20%; online
// prices are lifted so the artisan still takes home the fair price.
export const ONLINE_FEE_PERCENT = 15

export type FairPriceInput = {
  materialCostInr: number
  hoursOfWork: number
  hourlyWageInr?: number
  otherCostsInr?: number
  marginPercent?: number
}

export type FairPriceResult = {
  materials: number
  labour: number
  otherCosts: number
  totalCost: number
  hourlyWage: number
  marginPercent: number
  fairPrice: number
  onlinePrice: number
  minimumPrice: number
  profit: number
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

// Rounds up to the next ₹10, the way artisans actually quote prices.
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

export function calculateFairPrice(input: FairPriceInput): FairPriceResult {
  const materials = clampNumber(input.materialCostInr, 0, 10_000_000, 0)
  const hours = clampNumber(input.hoursOfWork, 0, 10_000, 0)
  const hourlyWage = clampNumber(input.hourlyWageInr, 0, 100_000, DEFAULT_HOURLY_WAGE_INR)
  const otherCosts = clampNumber(input.otherCostsInr, 0, 10_000_000, 0)
  const marginPercent = clampNumber(input.marginPercent, 0, 90, DEFAULT_MARGIN_PERCENT)

  const labour = hours * hourlyWage
  const totalCost = materials + labour + otherCosts
  // Margin on the selling price, same as the calculator's default method.
  const fairPrice = roundUp10(totalCost / (1 - marginPercent / 100))
  return {
    materials,
    labour,
    otherCosts,
    totalCost,
    hourlyWage,
    marginPercent,
    fairPrice,
    onlinePrice: roundUp10(fairPrice * (1 + ONLINE_FEE_PERCENT / 100)),
    // Below this the artisan is not even paid for their time and materials.
    minimumPrice: roundUp10(totalCost),
    profit: fairPrice - totalCost,
  }
}
