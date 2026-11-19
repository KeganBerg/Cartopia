// @vitest-environment jsdom
import '../scene/testCanvas'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// A stand-in WebGL2 context that keeps the fragment shaders it is given.
const shaders: string[] = []
const gl = new Proxy({} as Record<string | symbol, unknown>, {
  get(_t, k) {
    if (k === 'shaderSource') return (_s: unknown, src: string) => void shaders.push(src)
    if (k === 'getProgramParameter') return () => true
    if (k === 'getExtension') return () => null
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 0
    return () => ({})
  },
})
const plain = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
  return kind === 'webgl2' ? gl : plain.call(this, kind as '2d')
} as unknown as HTMLCanvasElement['getContext']

const { useGame } = await import('../game/store')
const { LoadingBand, LoadingScene } = await import('./Loading')
const { prizeLook } = await import('../scene/CrateScene')
const { cleanCard } = await import('../lib/live')
const { serverCar, bestCarSkins } = await import('../lib/serverCar')
const { skinNumber } = await import('../game/data')

const car = { uid: 'c1', model: 'hotshot', color: '#00897b', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 }, skin: 'aurora', modSkin: { spoiler: 'ember' }, mods: [] as string[] }

describe('a car in an animated skin wears it on every screen', () => {
  it('on the loading screens, through the skin shader instead of flat paint', async () => {
    useGame.setState({ cars: [car], raceCar: 'c1' } as never)
    for (const ui of [<LoadingScene key="s" label="Loading" ready={false} max={Infinity} />, <LoadingBand key="b" />]) {
      shaders.length = 0
      const el = document.createElement('div')
      const root = createRoot(el)
      await act(async () => root.render(ui))
      expect(el.querySelector('canvas.pc-skin')?.getAttribute('data-skin')).toBe('aurora')
      expect(el.querySelector('div.pc-paint')).toBeNull()
      expect(shaders.some((s) => s.includes(`skinShade(${skinNumber('aurora')},`))).toBe(true)
      await act(async () => root.unmount())
    }
  })

  it('on a crate prize shown on your own car', () => {
    const hat = prizeLook({ kind: 'hat', hat: 'cap' } as never, [car], 'c1')
    const mod = prizeLook({ kind: 'mod', mod: 'spoiler1', car: 'c1' } as never, [car], 'c1')
    for (const l of [hat, mod]) expect(l).toMatchObject({ skin: 'aurora', modSkin: { spoiler: 'ember' } })
  })

  it("on other players' cars: lobby cards, race cars and the online rivals list", () => {
    expect(cleanCard({ id: 'p', skin: 'aurora', modSkin: { spoiler: 'ember', kit: 'nope' } })).toMatchObject({ skin: 'aurora', modSkin: { spoiler: 'ember' } })
    expect(cleanCard({ id: 'p', skin: 'not-a-skin' })?.skin).toBeUndefined()
    const row = { best_car: { name: 'Kazumi Hot Shot RS', color: '#00897b', pi: 999, body: 'coupe' }, race_car: 'c1', cars: [car] }
    expect(serverCar(row)).toMatchObject({ skin: 'aurora', modSkin: { spoiler: 'ember' } })
    expect(bestCarSkins(row)).toMatchObject({ skin: 'aurora' })
  })

  // A look built from one of the player's own cars (it copies the car's finish) has to copy its
  // skins too, or that screen shows the car in flat paint. The few listed here show the car
  // repainted on purpose, where a skin would hide the paint being picked or competed with.
  it('in every look built from an owned car', () => {
    const repaint: Record<string, string> = {
      'ui/Trim.tsx': 'saved paint presets, which hold paint only',
      'ui/TunerTrials.tsx': 'the trial paints a pattern on your car',
      'ui/PaintRivals.tsx': "the rival's paint on your car",
      'ui/WorldTour.tsx': 'the tour livery on your car',
      'ui/Tutorial.tsx': 'picking a paint colour',
      'ui/Paint.tsx': 'a paint job, not a look',
    }
    const root = join(__dirname, '..')
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p)
      }
    }
    walk(join(root, 'ui'))
    walk(join(root, 'scene'))
    const missing: string[] = []
    for (const f of files) {
      const rel = f.slice(root.length + 1)
      if (repaint[rel]) continue
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/finish(: |=\{)[\w?.]+\.finish\b/.test(line) && !/\bskin\b/.test(line)) missing.push(`${rel}:${i + 1}`)
      })
    }
    expect(missing).toEqual([])
  })
})
