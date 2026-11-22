import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { Mesh, PerspectiveCamera, PCFSoftShadowMap, Scene } from 'three'
import { warmShaders } from './warm'

// Kegan (2026-11-22): loading the game lagged his whole computer and the loading screen
// froze and jumped. The town built all its shaders on its first frame while the browser's
// graphics process (which also draws the page) waited on each one; the loading bar ran on
// a timer that stopped whenever the game's code was busy.
const fakeGl = (seen: boolean[], hiddenOne: Mesh) => ({
  shadowMap: { type: PCFSoftShadowMap },
  info: { programs: [] },
  getRenderTarget: () => null,
  setRenderTarget: () => {},
  compileAsync: () => {
    seen.push(hiddenOne.visible)
    return Promise.resolve()
  },
})

describe('Loading the town', () => {
  it('builds only the shaders the town draws, leaving hidden pieces alone', async () => {
    const scene = new Scene()
    const off = new Mesh()
    off.visible = false
    scene.add(off)
    const seen: boolean[] = []
    await warmShaders(fakeGl(seen, off) as never, scene, new PerspectiveCamera(), true, false)
    expect(seen).toEqual([false])
    // Races still warm their hidden pieces (smoke, flames), then hide them again.
    await warmShaders(fakeGl(seen, off) as never, scene, new PerspectiveCamera(), false)
    expect(seen).toEqual([false, true])
    expect(off.visible).toBe(false)
  })
  it('waits for the background shader builds before the first frame, where the browser has them', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    expect(app).toMatch(/frameloop=\{townPaused \|\| warming \? 'never' : 'demand'\}/)
    expect(app).toMatch(/paused=\{townPaused \|\| warming\}/)
    // Built in slices, and warmed only once the town is in the scene.
    expect(app).toMatch(/<InSlices>\s*<World \/>\s*<TownWarm onReady=\{warmed\} \/>\s*<\/InSlices>/)
    const warm = readFileSync('src/scene/TownWarm.tsx', 'utf8')
    expect(warm).toMatch(/gl\.extensions\.has\('KHR_parallel_shader_compile'\)/)
    expect(warm).toMatch(/setTimeout\(done, WARM_LIMIT\)/)
  })
  it('moves the loading bar with a Web Animation, not a timer', () => {
    const html = readFileSync('index.html', 'utf8')
    const splash = html.slice(html.indexOf('splash:start'), html.indexOf('splash:end'))
    expect(splash).toMatch(/bar\.animate\(/)
    expect(splash).not.toMatch(/var tick=setInterval/)
  })
})
