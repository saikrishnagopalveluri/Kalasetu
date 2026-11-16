// Finds a real, already-published photograph for blog headers, instead of
// an AI-generated image — the user asked specifically for a relatable real
// picture, not a generated one. Wikimedia Commons is used rather than
// scraping Google Images: it has a free, keyless API, every result is
// already cleared for reuse under a stated license, and its own CDN serves
// the file directly, so there's no hotlinking or copyright risk the way
// there would be linking straight to an arbitrary Google Images result.
export type StockPhoto = { url: string; credit: string; sourceTitle: string }

type CommonsImageInfo = {
  url?: string
  thumburl?: string
  width?: number
  extmetadata?: {
    Artist?: { value: string }
    LicenseShortName?: { value: string }
  }
}

type CommonsPage = { title: string; imageinfo?: CommonsImageInfo[] }

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

async function searchOnce(query: string): Promise<StockPhoto | null> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    '&gsrlimit=10&gsrnamespace=6&prop=imageinfo' +
    '&iiprop=url|extmetadata|size&iiurlwidth=1200&format=json&origin=*'
  const res = await fetch(url, { headers: { 'User-Agent': 'ArtisanPlatformBlogBot/1.0 (contact: support via app)' } })
  if (!res.ok) return null
  const data = await res.json()
  const pages = data?.query?.pages as Record<string, CommonsPage> | undefined
  if (!pages) return null

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0]
    if (!info || !info.width || info.width < 700) continue
    const photoUrl = info.thumburl || info.url
    if (!photoUrl) continue
    const artist = info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value) : ''
    const license = info.extmetadata?.LicenseShortName?.value || ''
    const credit = artist
      ? `Photo: ${artist}${license ? ` (${license})` : ''}, via Wikimedia Commons`
      : 'Photo via Wikimedia Commons'
    return { url: photoUrl, credit, sourceTitle: page.title }
  }
  return null
}

export async function findRealPhoto(query: string): Promise<StockPhoto | null> {
  // Commons' search matches best on 1-2 concrete nouns, not a descriptive
  // phrase — "handcrafted ceramic mug on table" (a real query the model
  // produced) returned zero results, while "ceramic mug" returns several.
  // Widen progressively: the full phrase first, then its first three words,
  // then its first two, stopping at the first query that finds anything.
  const words = query.trim().split(/\s+/)
  const attempts = [query, words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')]
    .filter((q, i, arr) => q && arr.indexOf(q) === i)

  try {
    for (const attempt of attempts) {
      const found = await searchOnce(attempt)
      if (found) return found
    }
    return null
  } catch (err) {
    console.error('[stockImage] Wikimedia Commons search failed:', err)
    return null
  }
}
