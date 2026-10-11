import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALLOWED, ANYWHERE, WHOLE_WORD, displayName, isCleanChat, isCleanName } from './names'

describe('isCleanName', () => {
  it('blocks slurs, including spaced and leetspeak spellings', () => {
    for (const n of ['Niggapolis', 'n i g g a town', 'N1gg@ville', 'Faggot Falls', 'Shit Creek', 'FUK U', 'Big Ass Town']) {
      expect(isCleanName(n), n).toBe(false)
    }
  })
  it('allows ordinary names, even ones containing a blocked piece', () => {
    for (const n of ['Ram Ranch', 'Polio Folio', 'Peacock Point', 'Raccoon City', 'Spice Market', 'Classic Motors', 'Scunthorpe', 'Torpedo Bay', 'Cucumber Lane', 'Midnight Racers']) {
      expect(isCleanName(n), n).toBe(true)
    }
  })
})

describe('isCleanChat', () => {
  it('blocks bad words in a sentence, spaced out or in leetspeak', () => {
    for (const t of ['you are a b1tch', 'f u c k this', 'what the sh!t', 'nice ass', 'go away n i g g a']) {
      expect(isCleanChat(t), t).toBe(false)
    }
  })
  it("doesn't join ordinary words into a bad one", () => {
    for (const t of ['push it to the limit', 'this hit hard', 'gg nice race', 'see you at the docks', 'a cocktail at the classic diner', 'pass it on']) {
      expect(isCleanChat(t), t).toBe(true)
    }
  })
})

describe('displayName', () => {
  it('replaces a blocked name with a neutral one', () => {
    expect(displayName('Niggapolis', '8a1e7edb-cb66-437e-b1be-d3768917fda2')).toBe('Town #FDA2')
    expect(displayName('Ram Ranch', 'x')).toBe('Ram Ranch')
  })
})

describe('database name filter', () => {
  it('uses the same word lists as the game', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/0015_security_hardening.sql', import.meta.url), 'utf8')
    const block = sql.split('-- names:begin')[1].split('-- names:end')[0]
    const lists = [...block.matchAll(/array\[([^\]]*)\]/g)].map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((w) => w[1]))
    expect(lists).toEqual([ALLOWED, ANYWHERE, WHOLE_WORD])
  })
})
