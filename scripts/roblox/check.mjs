// Checks the Roblox building export end to end: runs the real BuildingBuilder.luau (with
// Roblox stand-ins, test/stubs.luau) on the exported data, draws the parts it makes the way
// Roblox shapes them, and lays each view beside the web game's own model.
//   node scripts/roblox/check.mjs kitDir ids levels [outDir]     (needs the luau CLI: LUAU=path)
//   e.g. node scripts/roblox/check.mjs roblox-export pizza,house 1,5,10 roblox-check
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'

const [kitArg, ids, levels, outArg = 'roblox-check'] = process.argv.slice(2)
const kit = resolve(kitArg)
const outDir = resolve(outArg)
mkdirSync(outDir, { recursive: true })
const here = 'scripts/roblox'
const assets = JSON.parse(readFileSync(join(kit, 'json/modelAssets.json'), 'utf8'))

// The runner: stand-ins, the builder, the data, then every part of every level as JSON.
let s = readFileSync(join(here, 'test/stubs.luau'), 'utf8') + '\nlocal Builder = (function()\n' + readFileSync(join(here, 'BuildingBuilder.luau'), 'utf8') + '\nend)()\nlocal mods = {}\n'
for (const id of ids.split(',')) s += `mods[${JSON.stringify(id)}] = { fn = function()\n${readFileSync(join(kit, 'Data/Buildings', `${id}.luau`), 'utf8')}\nend }\n`
// Each mesh's asset id stands in as its name, so the drawing knows which OBJ to load.
s += `local assets = { Meshes = {${Object.keys(assets.Meshes).map((k) => `[${JSON.stringify(k)}] = { assetId = ${JSON.stringify(k)} }`).join(',')}}, Images = {${Object.keys(assets.Images).map((k) => `[${JSON.stringify(k)}] = { assetId = ${JSON.stringify(k)} }`).join(',')}} }\n`
s += readFileSync(join(here, 'test/run.luau'), 'utf8').replace('LEVELS', levels)
const runner = join(tmpdir(), 'cartopia-roblox-check.luau')
writeFileSync(runner, s)
const lines = execFileSync(process.env.LUAU ?? 'luau', [runner], { encoding: 'utf8', maxBuffer: 1 << 30 }).split('\n').filter(Boolean)
const builds = []
for (const l of lines) {
  if (l.startsWith('#')) console.log(l.slice(1))
  else builds.push(JSON.parse(l))
}

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' })
await server.listen()
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 480, height: 480 } })
const objs = {}
for (const b of builds) for (const p of b.parts) if (p.mesh === 'FileMesh') objs[p.meshId] ??= readFileSync(join(kit, 'Models/meshes', `${p.meshId}.obj`), 'utf8')
for (const b of builds) for (const p of b.parts) for (const t of [...p.tex, ...(p.meshTex ? [{ img: p.meshTex }] : [])]) objs['img:' + t.img] ??= 'data:image/png;base64,' + readFileSync(join(kit, 'Models/images', `${t.img}.png`)).toString('base64')
async function shoot(b, side, frame) {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('page error', e.message))
  await page.addInitScript(([parts, o, k]) => Object.assign(window, { __parts: parts, __objs: o, __k: k }), [side === 'roblox' ? b.parts : [], side === 'roblox' ? objs : {}, b.k])
  await page.goto(`http://localhost:5197/${here}/check.html?id=${b.id}&level=${b.level}&side=${side}`)
  await page.waitForFunction(() => window.ready, null, { timeout: 180000 })
  await page.waitForTimeout(500)
  const f = frame ?? (await page.evaluate(() => window.frame()))
  const shots = await page.evaluate((fr) => window.shoot(fr), f)
  await page.close()
  return { shots, frame: f }
}
const page = await ctx.newPage()
for (const b of builds) {
  const web = await shoot(b, 'web')
  const rbx = await shoot(b, 'roblox', web.frame)
  // Web on top, Roblox below, one column per view.
  const png = await page.evaluate(async ([a, c]) => {
    const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u })
    const cv = document.createElement('canvas')
    cv.width = 480 * a.length
    cv.height = 960
    const g = cv.getContext('2d')
    for (let i = 0; i < a.length; i++) {
      g.drawImage(await load(a[i]), i * 480, 0)
      g.drawImage(await load(c[i]), i * 480, 480)
    }
    g.fillStyle = '#fff'
    g.font = 'bold 22px sans-serif'
    g.fillText('web', 10, 28)
    g.fillText('roblox', 10, 508)
    return cv.toDataURL('image/png')
  }, [web.shots, rbx.shots])
  const file = join(outDir, `${b.id}-L${b.level}.png`)
  writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'))
  console.log(`${b.id} L${b.level}: ${b.count} parts -> ${file}`)
}
await browser.close()
await server.close()
process.exit(0)
