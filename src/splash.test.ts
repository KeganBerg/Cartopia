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

  // The splash shows the player's race car from a render in public/splash/.
  // A new car without one falls back to the Hot Shot: run scripts/splash/shoot.mjs car-<id>.
  it('has a render of every car', () => {
    const missing = CARS.map((c) => c.id).filter((id) => !['', '-mask'].every((m) => existsSync(new URL(`../public/splash/car-${id}${m}.webp`, import.meta.url))))
    expect(missing).toEqual([])
  })
})
