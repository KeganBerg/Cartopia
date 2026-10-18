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
    expect(app).toMatch(/<Kept on=\{isSocialTab\(panel\)\} open=\{!!panel\}><SocialPanel tab=\{socialTab\} \/><\/Kept>/)
    for (const p of ['FriendsPanel', 'ClanPanel', 'MeetPanel', 'LeadersPanel']) expect(app).not.toMatch(new RegExp(`<${p}\\b`))
  })
  it("has each tab's own window step aside inside it", () => {
    const menus = readFileSync('src/ui/Menus.tsx', 'utf8')
    expect(menus).toMatch(/if \(shelled\) return <>\{children\}<\/>/)
    expect(readFileSync('src/ui/Social.tsx', 'utf8')).toMatch(/if \(shelled\) return null/)
  })
})

// Leaving Crates paused the first time: three swaps PCFSoft shadows for PCF at the first shadow
// draw, so every depot shader compiled in the background was thrown away and built again.
describe('Crates', () => {
  it('compiles the depot for the shadows three really draws', () => {
    expect(readFileSync('src/scene/Stage.tsx', 'utf8')).not.toMatch(/PCFSoftShadowMap/)
    expect(readFileSync('src/scene/warm.ts', 'utf8')).toMatch(/if \(gl\.shadowMap\.type === PCFSoftShadowMap\) gl\.shadowMap\.type = PCFShadowMap/)
  })
  it('finishes every compiled shader while the depot is still getting ready', async () => {
    const { warmShaders } = await import('./warm')
    const { Scene, PerspectiveCamera, PCFShadowMap, PCFSoftShadowMap } = await import('three')
    const used: number[] = []
    const programs = [0, 1, 2].map((i) => ({ getUniforms: () => used.push(i) }))
    const gl = { shadowMap: { type: PCFSoftShadowMap }, info: { programs }, getRenderTarget: () => null, setRenderTarget: () => {}, compileAsync: () => Promise.resolve() }
    await warmShaders(gl as never, new Scene(), new PerspectiveCamera(), false)
    expect(used).toEqual([0, 1, 2])
    expect(gl.shadowMap.type).toBe(PCFShadowMap)
  })
})

// Kegan, the Build grid: "Lagging". Each building thumbnail was dozens of small meshes.
describe('Build grid', () => {
  it('merges each building thumbnail like the town', () => {
    expect(readFileSync('src/scene/BuildingPreview.tsx', 'utf8')).toMatch(/model: \(\) => <Batch version=\{1\}>.*<BuildingModel /)
  })
  it('sizes a merged building by its own pieces', async () => {
    const { Group, Mesh, BoxGeometry, MeshBasicMaterial } = await import('three')
    const { seat } = await import('./fit')
    const turn = new Group()
    const model = new Group()
    turn.add(model)
    model.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()))
    const plain = seat(model, turn)
    const copy = new Mesh(new BoxGeometry(9, 9, 9), new MeshBasicMaterial())
    copy.userData.merged = true
    model.add(copy)
    expect(seat(model, turn)).toEqual(plain)
  })
})

// Kegan: "why does the game still freeze each transition to a new tab". Every tap rebuilt the
// whole page: its cards, its 3D thumbnails, and a page layout per thumbnail as each went in.
describe('every tab switch', () => {
  it('keeps the main menus and their tabs built while switching', () => {
    const app = readFileSync('src/App.tsx', 'utf8')
    for (const m of ['ShopPanel', 'InventoryPanel', 'CarsPage', 'SocialPanel', 'BankPanel', 'CarPacksPanel', 'GoalsPanel']) expect(app).toMatch(new RegExp(`<Kept on=\\{[^}]+\\} open=\\{!!panel\\}><${m}\\b`))
    const menus = readFileSync('src/ui/Menus.tsx', 'utf8')
    expect(menus).toMatch(/<KeepTabs tab=\{tab\} render=\{\(t\) => \(t === 'upgrades'/)
    expect(menus).toMatch(/<KeepTabs tab=\{room\} render=/)
    expect(readFileSync('src/ui/SocialPanel.tsx', 'utf8')).toMatch(/<KeepTabs tab=\{tab\}/)
    expect(readFileSync('src/ui/Goals.tsx', 'utf8')).toMatch(/<KeepTabs tab=\{tab\}/)
  })
  it("doesn't lay the page out again for each thumbnail as a grid goes in", () => {
    const src = readFileSync('src/scene/BuildingPreview.tsx', 'utf8')
    const attach = src.slice(src.indexOf('function attach('), src.indexOf('// Unused models past KEEP_IDLE'))
    expect(attach).toMatch(/sizer\.observe\(canvas\)\n  \} else fit\(slot, canvas\.clientWidth, canvas\.clientHeight\)/)
    expect(attach).not.toMatch(/\[\.\.\.models\]/)
  })
})
