import { describe, expect, it } from 'vitest'
import { stackCars, stackFace } from './garageStacks'

const row = (uid: string, model: string, pi: number) => ({ c: { uid, model }, pi })

describe('garage stacks', () => {
  const rows = [row('a1', 'ace', 40), row('b1', 'bolt', 90), row('a2', 'ace', 70), row('a3', 'ace', 55)]
  const stacks = stackCars(rows)

  it('puts every copy of a model in one stack, in first-seen order', () => {
    expect(stacks.map((s) => s.model)).toEqual(['ace', 'bolt'])
    expect(stacks[0].copies.map((r) => r.c.uid)).toEqual(['a2', 'a3', 'a1'])
    expect(stacks[1].copies).toHaveLength(1)
  })

  it('shows the top-PI copy by default and the picked copy when it is in the stack', () => {
    expect(stackFace(stacks[0], null).c.uid).toBe('a2')
    expect(stackFace(stacks[0], 'a1').c.uid).toBe('a1')
    expect(stackFace(stacks[0], 'b1').c.uid).toBe('a2')
  })
})
