import { describe, expect, it } from 'vitest'
import es from './es.json'
import pt from './pt.json'

// Every gap in the English ({} or a lone #) must have its place in the translation, or a
// number or a name would vanish from the screen.
const gapsIn = (en: string) => (en.match(/\{\}|(?<=^|\s)#(?=\s|$|[.,!?:;)])/g) ?? []).length
const gapsOut = (to: string) => (to.match(/\{\d*\}/g) ?? []).length

describe.each([['Spanish', es as Record<string, string>], ['Portuguese', pt as Record<string, string>]])('the %s dictionary', (_, dict) => {
  it('keeps every gap and says something for every line', () => {
    const bad = Object.entries(dict).filter(([en, to]) => !to.trim() || gapsIn(en) !== gapsOut(to))
    expect(bad).toEqual([])
  })
})
