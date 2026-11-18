import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  admin: { current: true },
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    if (!mocks.admin.current) return null
    return {
      from: () => ({ select: () => ({ eq: mocks.eq }), insert: mocks.insert }),
      rpc: mocks.rpc,
    }
  },
}))

describe('KalaWallet', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.admin.current = true
    mocks.insert.mockResolvedValue({ error: null })
  })

  describe('getBalance', () => {
    it('sums the user transaction history, including debits', async () => {
      mocks.eq.mockResolvedValue({ data: [{ amount: 100 }, { amount: 50 }, { amount: -30 }] })
      const { getBalance } = await import('@/lib/kalawallet')
      expect(await getBalance('user-1')).toBe(120)
      expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('treats a user with no transactions as a zero balance', async () => {
      mocks.eq.mockResolvedValue({ data: null })
      const { getBalance } = await import('@/lib/kalawallet')
      expect(await getBalance('user-1')).toBe(0)
    })

    it('returns zero when the service-role client is missing', async () => {
      mocks.admin.current = false
      const { getBalance } = await import('@/lib/kalawallet')
      expect(await getBalance('user-1')).toBe(0)
    })
  })

  describe('earn', () => {
    it('records a credit with its reference id', async () => {
      const { earn } = await import('@/lib/kalawallet')
      await earn('user-1', 25, 'WELCOME_BONUS', 'Welcome', 'ref-9')
      expect(mocks.insert).toHaveBeenCalledWith({
        user_id: 'user-1', amount: 25, type: 'WELCOME_BONUS', description: 'Welcome', reference_id: 'ref-9',
      })
    })

    it.each([0, -10])('ignores a non-positive amount (%d)', async (amount) => {
      const { earn } = await import('@/lib/kalawallet')
      await earn('user-1', amount, 'ADMIN_ADJUSTMENT', 'noop')
      expect(mocks.insert).not.toHaveBeenCalled()
    })
  })

  describe('redeem', () => {
    it('debits through the atomic database function', async () => {
      mocks.rpc.mockResolvedValue({ data: true, error: null })
      const { redeem } = await import('@/lib/kalawallet')
      expect(await redeem('user-1', 40, 'Template unlock')).toEqual({ ok: true })
      expect(mocks.rpc).toHaveBeenCalledWith('redeem_kalapoints', {
        p_user_id: 'user-1', p_amount: 40, p_description: 'Template unlock',
      })
    })

    it('refuses when the balance is too low', async () => {
      mocks.rpc.mockResolvedValue({ data: false, error: null })
      const { redeem } = await import('@/lib/kalawallet')
      expect(await redeem('user-1', 40, 'Template unlock')).toEqual({ ok: false, error: 'Insufficient KalaPoints' })
    })

    it('hides database errors behind a generic message', async () => {
      mocks.rpc.mockResolvedValue({ data: null, error: { message: 'deadlock detected' } })
      const { redeem } = await import('@/lib/kalawallet')
      expect(await redeem('user-1', 40, 'x')).toEqual({ ok: false, error: 'Redemption failed' })
    })

    it.each([0, -5])('rejects an invalid amount (%d) without touching the database', async (amount) => {
      const { redeem } = await import('@/lib/kalawallet')
      expect(await redeem('user-1', amount, 'x')).toEqual({ ok: false, error: 'Invalid amount' })
      expect(mocks.rpc).not.toHaveBeenCalled()
    })
  })
})
