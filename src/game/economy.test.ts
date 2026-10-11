import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { econCatalog } from './econCatalog'
import { xpToNext } from './data'

// The newest migration that sets public.econ_catalog().
const dir = new URL('../../supabase/migrations/', import.meta.url)
const migration = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((sql) => sql.includes('$catalog$')).pop()!

describe('server economy catalog', () => {
  it('matches the prices and rewards in data.ts', () => {
    // When this fails, paste the printed JSON between the $catalog$ markers in a new migration
    // (create or replace function public.econ_catalog()) so the server checks the new numbers.
    const sql = /\$catalog\$(.*)\$catalog\$/s.exec(migration)![1]
    expect(JSON.parse(sql), JSON.stringify(econCatalog())).toEqual(econCatalog())
  })
})

describe('server XP curve', () => {
  it('matches xpToNext in data.ts', () => {
    // The guard rebuilds each save's level from its lifetime XP with public.econ_xp_to_next, so a
    // different curve there would push levels back up (or down) on every save. Keep the two equal.
    const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8'))
      .filter((s) => s.includes('function public.econ_xp_to_next')).pop()!
    const [, a, p] = /econ_xp_to_next[\s\S]*?round\(\s*([\d.]+)\s*\*\s*power\(l::numeric,\s*([\d.]+)\)\s*\)/.exec(sql)!
    for (let l = 1; l <= 100; l++) expect(Math.round(Number(a) * Math.pow(l, Number(p))), `level ${l}`).toBe(xpToNext(l))
  })
})
