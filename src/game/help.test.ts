import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILDINGS } from './data'
import { econCatalog } from './econCatalog'
import { HELP_TABLE, helpable, helpPrize, helpAct } from './help'

const dir = new URL('../../supabase/migrations/', import.meta.url)
const newest = (tag: string) => {
  const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((s) => s.includes(tag)).pop()!
  const at = sql.indexOf(tag) + tag.length
  return JSON.parse(sql.slice(at, sql.indexOf(tag, at)))
}

describe('helping friends', () => {
  it('pays what the server pays', () => {
    expect(newest('$helps$')).toEqual(HELP_TABLE)
  })

  it('offers help at the same businesses the server accepts', () => {
    const cat = econCatalog().buildings as Record<string, { up?: { coins: number[] } }>
    for (const d of BUILDINGS) expect([d.id, helpable(d)]).toEqual([d.id, (cat[d.id]?.up?.coins[0] ?? 0) > 0])
  })

  it('pays more for higher levels and parts for finishing a town', () => {
    expect(helpPrize(1, 1, 1)).toEqual({ coins: 25, xp: 2, parts: 0 })
    expect(helpPrize(10, 3, 5)).toEqual({ coins: 90, xp: 4, parts: 2 })
    expect(helpAct('carwash').icon).toBe('🧽')
  })
})
