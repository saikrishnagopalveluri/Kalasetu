import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({
  brand: 'KalaSetu',
  remove: vi.fn(),
  storageFrom: vi.fn(),
  hasClient: true,
}))

vi.mock('@/lib/brand', () => ({
  get BRAND() {
    return { name: state.brand }
  },
}))
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return state.hasClient ? { storage: { from: state.storageFrom } } : null
  },
}))

describe('applyBrandToText / normalizeBrandToToken', () => {
  beforeEach(() => vi.resetModules())

  it.each([
    ['KalaSetu', 'Welcome to {{BRAND}}, made by Hastkatha', 'Welcome to KalaSetu, made by KalaSetu'],
    ['Hastkatha', 'Welcome to {{BRAND}}, made by KalaSetu', 'Welcome to Hastkatha, made by Hastkatha'],
  ])('renders every brand reference as %s', async (brand, input, expected) => {
    state.brand = brand
    const { applyBrandToText } = await import('@/lib/applyBrand')
    expect(applyBrandToText(input)).toBe(expected)
  })

  it('leaves text without any brand untouched', async () => {
    const { applyBrandToText } = await import('@/lib/applyBrand')
    expect(applyBrandToText('Count your hours.')).toBe('Count your hours.')
  })

  it('turns both literal brand names back into the token', async () => {
    const { normalizeBrandToToken } = await import('@/lib/applyBrand')
    expect(normalizeBrandToToken('KalaSetu and Hastkatha')).toBe('{{BRAND}} and {{BRAND}}')
  })

  it('round-trips: normalize then apply gives the current brand', async () => {
    state.brand = 'KalaSetu'
    const { applyBrandToText, normalizeBrandToToken } = await import('@/lib/applyBrand')
    expect(applyBrandToText(normalizeBrandToToken('Sell on Hastkatha today'))).toBe('Sell on KalaSetu today')
  })
})

describe('removeFromStorage', () => {
  const BASE = 'https://abc.supabase.co/storage/v1/object/public'

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    state.hasClient = true
    state.remove.mockResolvedValue({ error: null })
    state.storageFrom.mockReturnValue({ remove: state.remove })
  })

  it('removes the storage paths behind public URLs, decoding them', async () => {
    const { removeFromStorage } = await import('@/lib/storageCleanup')
    await removeFromStorage('products', [`${BASE}/products/u1/saree%20red.png`, `${BASE}/products/u1/b.jpg`])
    expect(state.storageFrom).toHaveBeenCalledWith('products')
    expect(state.remove).toHaveBeenCalledWith(['u1/saree red.png', 'u1/b.jpg'])
  })

  it('skips empty values and URLs from another bucket', async () => {
    const { removeFromStorage } = await import('@/lib/storageCleanup')
    await removeFromStorage('products', [null, undefined, '', `${BASE}/avatars/u1/me.png`])
    expect(state.remove).not.toHaveBeenCalled()
  })

  it('logs instead of throwing when storage refuses the delete', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.remove.mockResolvedValue({ error: { message: 'not allowed' } })
    const { removeFromStorage } = await import('@/lib/storageCleanup')
    await expect(removeFromStorage('products', [`${BASE}/products/x.png`])).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('does nothing without a Supabase client', async () => {
    state.hasClient = false
    const { removeFromStorage } = await import('@/lib/storageCleanup')
    await removeFromStorage('products', [`${BASE}/products/x.png`])
    expect(state.storageFrom).not.toHaveBeenCalled()
  })
})

describe('findRealPhoto', () => {
  type Page = { title: string; imageinfo?: Record<string, unknown>[] }
  const respond = (pages: Record<string, Page> | null) => ({
    ok: true,
    json: async () => (pages ? { query: { pages } } : {}),
  })

  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('returns the first wide-enough image with a cleaned-up credit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({
      1: { title: 'File:Small.jpg', imageinfo: [{ width: 400, url: 'https://x/small.jpg' }] },
      2: {
        title: 'File:Loom.jpg',
        imageinfo: [{
          width: 1600,
          thumburl: 'https://x/loom-1200.jpg',
          extmetadata: { Artist: { value: '<a href="u">Asha Rao</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
        }],
      },
    })))
    const { findRealPhoto } = await import('@/lib/stockImage')
    expect(await findRealPhoto('handloom weaving')).toEqual({
      url: 'https://x/loom-1200.jpg',
      credit: 'Photo: Asha Rao (CC BY-SA 4.0), via Wikimedia Commons',
      sourceTitle: 'File:Loom.jpg',
    })
  })

  it('widens a long query step by step until something is found', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond(null))
      .mockResolvedValueOnce(respond(null))
      .mockResolvedValueOnce(respond({ 1: { title: 'File:Mug.jpg', imageinfo: [{ width: 900, url: 'https://x/mug.jpg' }] } }))
    vi.stubGlobal('fetch', fetchMock)
    const { findRealPhoto } = await import('@/lib/stockImage')
    const found = await findRealPhoto('ceramic mug on wooden table')
    expect(found?.credit).toBe('Photo via Wikimedia Commons')
    const queries = fetchMock.mock.calls.map(([url]) => new URL(url as string).searchParams.get('gsrsearch'))
    expect(queries).toEqual([
      'ceramic mug on wooden table filetype:bitmap',
      'ceramic mug on filetype:bitmap',
      'ceramic mug filetype:bitmap',
    ])
  })

  it('returns null instead of throwing when the network fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { findRealPhoto } = await import('@/lib/stockImage')
    expect(await findRealPhoto('pottery')).toBeNull()
    error.mockRestore()
  })
})

describe('extractDominantColor', () => {
  // Fakes the two browser APIs the function uses: an <img> that loads
  // immediately, and a canvas whose pixels are all one RGBA colour.
  function stubBrowser(pixel: number[] | 'error' | 'no-context') {
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      set src(_value: string) {
        queueMicrotask(() => (pixel === 'error' ? this.onerror?.() : this.onload?.()))
      }
    }
    const data = new Uint8ClampedArray(48 * 48 * 4)
    if (Array.isArray(pixel)) for (let i = 0; i < data.length; i += 4) data.set(pixel, i)
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => (pixel === 'no-context' ? null : { drawImage: () => {}, getImageData: () => ({ data }) }),
    }
    vi.stubGlobal('Image', FakeImage)
    vi.stubGlobal('document', { createElement: () => canvas })
  }

  afterEach(() => vi.unstubAllGlobals())

  it.each([
    [[200, 30, 30, 255], 'red'],
    [[30, 60, 200, 255], 'blue'],
    [[40, 160, 60, 255], 'green'],
    [[240, 240, 240, 255], 'white'],
    [[10, 10, 10, 255], 'black'],
    [[128, 128, 128, 255], 'gray'],
    [[230, 120, 20, 255], 'orange'],
  ] as const)('names RGB %j as %s', async (pixel, expected) => {
    stubBrowser([...pixel])
    const { extractDominantColor } = await import('@/lib/colorExtract')
    expect(await extractDominantColor('data:image/png;base64,x')).toBe(expected)
  })

  it('ignores fully transparent images', async () => {
    stubBrowser([255, 0, 0, 0])
    const { extractDominantColor } = await import('@/lib/colorExtract')
    expect(await extractDominantColor('data:image/png;base64,x')).toBeNull()
  })

  it.each(['error', 'no-context'] as const)('resolves null on %s', async (failure) => {
    stubBrowser(failure)
    const { extractDominantColor } = await import('@/lib/colorExtract')
    expect(await extractDominantColor('data:image/png;base64,x')).toBeNull()
  })
})
