import { describe, expect, it } from 'vitest'
import { compile, lookup, translateText } from './translate'

const c = compile({
  Garage: 'Garaje',
  'Win {} races': 'Gana {} carreras',
  'Win # campaign races': 'Gana {} carreras de campaña',
  '{} wants to be friends': '{} quiere ser tu amigo',
  '{} · Level {}': 'Nivel {1} · {0}',
  Ready: 'Listo',
  'Status: {}': 'Estado: {}',
  'Kipper Pocket': 'Kipper Pocket',
  'find old cars': 'encuentra autos viejos',
  Compact: 'Compacto',
  'Back Streets': 'Calles traseras',
})

describe('translating the game', () => {
  it('finds whole strings', () => {
    expect(lookup(c, 'Garage')).toBe('Garaje')
    expect(lookup(c, 'Nothing here')).toBeNull()
  })

  it('fills the gaps of a pattern, in order or by position', () => {
    expect(lookup(c, 'Win 12 races')).toBe('Gana 12 carreras')
    expect(lookup(c, 'Win 3 campaign races')).toBe('Gana 3 carreras de campaña')
    expect(lookup(c, 'Ava wants to be friends')).toBe('Ava quiere ser tu amigo')
    expect(lookup(c, 'Ben · Level 30')).toBe('Nivel 30 · Ben')
  })

  it('translates a gap that is itself in the dictionary', () => {
    expect(lookup(c, 'Status: Ready')).toBe('Estado: Listo')
  })

  it('copes with a capital the game added, a count in brackets and parts joined with ·', () => {
    expect(lookup(c, 'Find old cars')).toBe('Encuentra autos viejos')
    expect(lookup(c, 'Compact (12)')).toBe('Compacto (12)')
    expect(lookup(c, 'Back Streets · 1/5')).toBe('Calles traseras · 1/5')
    expect(lookup(c, 'Mirage Mile · 1/5')).toBeNull()
  })

  it('keeps the spaces round a piece of text, and skips names it should leave alone', () => {
    expect(translateText(c, ' Garage ')).toBe(' Garaje ')
    expect(translateText(c, 'Kipper Pocket')).toBeNull()
    expect(translateText(c, '1,250')).toBeNull()
  })
})
