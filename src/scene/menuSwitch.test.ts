import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOUNTS_PER_FRAME, nextMounts, type Slot as S } from './thumbCopy'

const slot = (key: string, seen = true): S => ({ key, still: false, scene: false, angle: 0.12, at: -Infinity, fresh: true, seen, ctx: {} as CanvasRenderingContext2D, canvas: { width: 100, height: 80 } as HTMLCanvasElement })

// Kegan: "The game lags when switching menus, make switching menus flawless".
describe('switching menus', () => {
  it('builds a page of new cars one a frame, not all on the tap', () => {
    const page = [slot('c|off', false), ...Array.from({ length: 12 }, (_, i) => slot(`c|car${i}`))]
    const inScene = new Set<string>()
    const frames: string[][] = []
    for (let add; (add = nextMounts(page, () => true, inScene)).length; ) {
      frames.push(add)
      for (const k of add) inScene.add(k)
    }
    expect(Math.max(...frames.map((f) => f.length))).toBe(MOUNTS_PER_FRAME)
    expect(inScene.size).toBe(13)
    expect(frames.at(-1)).toContain('c|off')
  })

  it('builds a car once for two tiles showing it', () => {
    expect(nextMounts([slot('c|a'), slot('c|a'), slot('c|b')], () => true, new Set(), 3)).toEqual(['c|a', 'c|b'])
  })

  it('builds the car turntable and thumbnail canvases before the first menu opens', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/<WarmPreview \/>/)
    const warm = readFileSync('src/scene/WarmPreview.tsx', 'utf8')
    expect(warm).toMatch(/<CarThumb\b/)
    expect(warm).toMatch(/<CarPreview\b/)
  })
})

// Kegan: "Menu on Social glitches when clicking on different pages". Each tab was a whole new
// window; now the window stays and only what's under the tab row swaps.
describe('Social tabs', () => {
  it('keeps one window for all four tabs', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).toMatch(/isSocialTab\(panel\) && <SocialPanel tab=\{panel\} \/>/)
    for (const p of ['FriendsPanel', 'ClanPanel', 'MeetPanel', 'LeadersPanel']) expect(app).not.toMatch(new RegExp(`<${p}\\b`))
  })
  it("has each tab's own window step aside inside it", () => {
    const menus = readFileSync('src/ui/Menus.tsx', 'utf8')
    expect(menus).toMatch(/if \(shelled\) return <>\{children\}<\/>/)
    expect(readFileSync('src/ui/Social.tsx', 'utf8')).toMatch(/if \(shelled\) return null/)
  })
})
