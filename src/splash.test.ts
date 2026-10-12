import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARS } from './game/data'

// The CSP in netlify.toml only lets inline scripts run by hash. If the splash
// script in index.html changes without the hash, production silently drops it
// and the loading screen never leaves. Re-run scripts/splash/build.mjs to fix.
describe('loading screen', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])

  it('has its inline script', () => {
    expect(inline.length).toBe(1)
    expect(inline[0]).toContain('cartopiaSplash')
  })

  it('every inline script is allowed by the CSP', () => {
    for (const js of inline) {
      const hash = `'sha256-${createHash('sha256').update(js).digest('base64')}'`
      expect(toml).toContain(hash)
    }
  })

  // The loaders show the player's race car from renders in public/splash/: side
  // on in panels, three quarters on (hero) on the splash and scene covers. A new
  // car without them falls back to the Hot Shot: run scripts/splash/shoot.mjs car-<id>
  // and shoot.mjs hero-<id>.
  it('has a render of every car', () => {
    const files = CARS.flatMap((c) => ['car', 'hero'].flatMap((k) => ['', '-mask'].map((m) => `${k}-${c.id}${m}.webp`)))
    expect(files.filter((f) => !existsSync(new URL(`../public/splash/${f}`, import.meta.url)))).toEqual([])
  })

  // The town behind the splash, for every season and time of day (town.mjs).
  it('has a town for every season and time of day', () => {
    const files = ['spring', 'summer', 'fall', 'winter'].flatMap((s) => ['day', 'dusk', 'night'].map((t) => `town-${s}-${t}.webp`))
    expect(files.filter((f) => !existsSync(new URL(`../public/splash/${f}`, import.meta.url)))).toEqual([])
  })
})
