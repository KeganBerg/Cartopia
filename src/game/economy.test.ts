import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { econCatalog } from './econCatalog'

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
