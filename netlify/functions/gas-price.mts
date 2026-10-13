// The live Los Angeles gas price for the Big Bison sign (src/game/gasPrice.ts).
// Needs the Netlify env var EIA_API_KEY (free from eia.gov/opendata); without it, or
// when EIA is down, it answers the fallback price. Netlify's CDN caches the answer,
// so EIA sees a few calls a day however many players load the town.
import { EIA_SERIES, GAS_FALLBACK, eiaLatest } from '../../src/game/gasPrice'

export default async () => {
  const key = process.env.EIA_API_KEY
  let live: { price: number; period: string } | null = null
  if (key) {
    const q = new URLSearchParams({
      api_key: key,
      frequency: 'weekly',
      'data[0]': 'value',
      'facets[series][]': EIA_SERIES,
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      offset: '0',
      length: '2',
    })
    try {
      const res = await fetch(`https://api.eia.gov/v2/petroleum/pri/gnd/data/?${q}`, { signal: AbortSignal.timeout(6000) })
      if (res.ok) live = eiaLatest(await res.json())
      else console.error('eia', res.status)
    } catch (e) {
      console.error('eia', (e as Error).message)
    }
  }
  return Response.json(
    { price: live?.price ?? GAS_FALLBACK, week: live?.period ?? null, live: !!live },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        // EIA publishes weekly; a miss retries after 10 minutes instead of 6 hours.
        'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${live ? 21600 : 600}, stale-while-revalidate=86400`,
      },
    },
  )
}
