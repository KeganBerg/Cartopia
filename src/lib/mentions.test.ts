import { describe, expect, it } from 'vitest'
import { insertMention, mentionAt, mentionedNames, mentions, mergePicks, splitMentions } from './mentions'

describe('@mentions', () => {
  it('finds usernames in text', () => {
    expect(splitMentions('Tomahawk tank, enjoy @Gabe')).toEqual(['Tomahawk tank, enjoy ', { name: 'Gabe' }])
    expect(splitMentions('@KBerg vs @ifinishfast!')).toEqual([{ name: 'KBerg' }, ' vs ', { name: 'ifinishfast' }, '!'])
    expect(mentionedNames('hi @a_b_c and @x')).toEqual(['a_b_c'])
  })

  it('ignores emails and too-long names', () => {
    expect(mentionedNames('mail me at bob@gabe.com')).toEqual([])
    expect(mentionedNames('@abcdefghijklmnopq')).toEqual([])
    expect(mentionedNames('@@Gabe')).toEqual([])
  })

  it('knows when you are named, any case', () => {
    expect(mentions('gg @gabe', 'Gabe')).toBe(true)
    expect(mentions('gg @Gabey', 'Gabe')).toBe(false)
    expect(mentions('gg @Gabe', null)).toBe(false)
  })

  it('spots the mention being typed', () => {
    expect(mentionAt('enjoy @Ga', 9)).toEqual({ start: 6, query: 'Ga' })
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionAt('bob@ga', 6)).toBeNull()
    expect(mentionAt('enjoy @Gabe now', 15)).toBeNull()
  })

  it('fills in the picked name', () => {
    expect(insertMention('enjoy @Ga', 6, 9, 'Gabe')).toEqual({ text: 'enjoy @Gabe ', caret: 12 })
    expect(insertMention('hi @Ga there', 3, 6, 'Gabe')).toEqual({ text: 'hi @Gabe there', caret: 8 })
  })

  it('lists friends before other players, once each', () => {
    const f = [{ id: '1', username: 'Gabe', friend: true }]
    const p = [{ id: '1', username: 'Gabe', friend: false }, { id: '2', username: 'Gabriel', friend: false }]
    expect(mergePicks(f, p).map((x) => x.id)).toEqual(['1', '2'])
  })
})
