import { describe, expect, it } from 'vitest'
import { legalHtml, PRIVACY, TERMS } from './legal'
import { parsePrefs } from '../lib/prefs'

describe('legal pages', () => {
  it('build as plain HTML the site CSP allows (no scripts), linking each other', () => {
    const terms = legalHtml(TERMS, PRIVACY)
    const privacy = legalHtml(PRIVACY, TERMS)
    for (const html of [terms, privacy]) {
      expect(html).not.toMatch(/<script/i)
      expect(html).toContain('Draft')
    }
    expect(terms).toContain('href="/privacy"')
    expect(privacy).toContain('href="/terms"')
  })

  it('name the services the game really uses', () => {
    const text = JSON.stringify(PRIVACY)
    for (const s of ['Supabase', 'Netlify', 'push', 'Chat']) expect(text).toContain(s)
    expect(JSON.stringify(TERMS)).toMatch(/no real-world value/)
  })

  it('escapes text', () => {
    const doc = { ...TERMS, intro: '<b>&' }
    expect(legalHtml(doc, PRIVACY)).toContain('&lt;b&gt;&amp;')
  })
})

describe('settings', () => {
  it('fall back to defaults for missing or bad data', () => {
    expect(parsePrefs(null)).toEqual({ graphics: 'auto', reduceMotion: null, vibration: true, muteTaunts: false, askLeave: true, askSell: true, steer: 'smooth' })
    expect(parsePrefs('{oops')).toEqual({ graphics: 'auto', reduceMotion: null, vibration: true, muteTaunts: false, askLeave: true, askSell: true, steer: 'smooth' })
    expect(parsePrefs('{"graphics":"ultra","reduceMotion":"yes"}')).toEqual({ graphics: 'auto', reduceMotion: null, vibration: true, muteTaunts: false, askLeave: true, askSell: true, steer: 'smooth' })
    expect(parsePrefs('{"graphics":"saver","reduceMotion":true,"vibration":false,"steer":"sharp"}')).toEqual({ graphics: 'saver', reduceMotion: true, vibration: false, muteTaunts: false, askLeave: true, askSell: true, steer: 'sharp' })
    expect(parsePrefs('{"askLeave":false,"askSell":false}')).toMatchObject({ askLeave: false, askSell: false })
    expect(parsePrefs('{"muteTaunts":true}').muteTaunts).toBe(true)
    expect(parsePrefs('{"muteTaunts":"yes"}').muteTaunts).toBe(false)
  })
})
