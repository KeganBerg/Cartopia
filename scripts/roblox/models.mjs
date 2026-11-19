// Exports every building's model at every level for the Roblox port: renders each
// one with the game's own code (scripts/roblox/models.tsx in Chromium) and writes
//   Data/Buildings/<id>.luau  the parts, each tagged with the levels it shows at
//   Data/ModelAssets.luau     mesh and image names, with an empty assetId to fill in
//   Models/meshes/*.obj       shapes that aren't a block, ball or cylinder (upload once)
//   Models/images/*.png       the textures (upload once)
// scripts/roblox/BuildingBuilder.luau turns them into Roblox parts.
//   node scripts/roblox/models.mjs [outDir] [ids]     (default roblox-export/, all buildings)
import { createRequire } from 'node:module'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'

const out = resolve(process.argv[2] ?? 'roblox-export')
const only = process.argv[3]?.split(',')
for (const d of ['Data/Buildings', 'Models', 'json/buildings']) rmSync(join(out, d), { recursive: true, force: true })
for (const d of ['Data/Buildings', 'Models/meshes', 'Models/images', 'json/buildings']) mkdirSync(join(out, d), { recursive: true })

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' })
await server.listen()
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error', e.message))
await page.goto('http://localhost:5198/scripts/roblox/models.html')
await page.waitForFunction(() => window.ready, null, { timeout: 180000 })
const ids = (await page.evaluate(() => window.ids)).filter((b) => !only || only.includes(b.id))
const log = (s) => console.log(new Date().toISOString().slice(11, 19), s)

// Flat things (signs, decals, windows) get a thin slab in Roblox.
const THIN = 0.006
const r3 = (x) => Math.round(x * 1000) / 1000
const r4 = (x) => Math.round(x * 10000) / 10000

function part(p) {
  const e = p.m
  const cols = [[e[0], e[1], e[2]], [e[4], e[5], e[6]], [e[8], e[9], e[10]]]
  const len = cols.map((c) => Math.hypot(...c))
  if (len.some((l, i) => l < 1e-6 && !p.flat[i])) return null
  const size = len.map((l, i) => (p.flat[i] ? THIN : Math.max(r3(l), 0.002)))
  const unit = cols.map((c, i) => (len[i] < 1e-6 ? [0, 0, 0] : c.map((x) => x / len[i])))
  // A flat axis of zero length: rebuild it from the other two.
  for (let i = 0; i < 3; i++) if (len[i] < 1e-6) {
    const [a, b] = [unit[(i + 1) % 3], unit[(i + 2) % 3]]
    unit[i] = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  }
  // Roblox CFrame components: the rotation matrix row by row (columns are right, up, back).
  const rot = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => r4(unit[c][r]) || 0))
  return { s: p.s, pos: [r3(e[12]), r3(e[13]), r3(e[14])], size, rot }
}

const meshes = {}
const models = {}
for (const b of ids) {
  const seen = new Map() // part key -> part with a level mask
  const mats = new Map()
  const rots = new Map()
  const idx = (map, v) => {
    const k = JSON.stringify(v)
    if (!map.has(k)) map.set(k, { i: map.size + 1, v })
    return map.get(k).i
  }
  let most = 0
  const crowd = []
  for (let level = 1; level <= b.maxLevel; level++) {
    const { parts, meshes: m, crowd: c } = await page.evaluate(([id, lv]) => window.build(id, lv), [b.id, level])
    crowd.push(c)
    Object.assign(meshes, m)
    most = Math.max(most, parts.length)
    for (const p of parts) {
      const q = part(p)
      if (!q) continue
      const mat = idx(mats, p.mat)
      const faces = p.faces ? p.faces.map((f) => idx(mats, f)) : undefined
      const rot = idx(rots, q.rot)
      const row = [q.s, mat, rot, ...q.pos, ...q.size]
      const k = JSON.stringify([row, faces])
      const hit = seen.get(k)
      if (hit) hit.mask |= 1 << (level - 1)
      else seen.set(k, { row, faces, mask: 1 << (level - 1) })
    }
  }
  const parts = [...seen.values()].map((p) => [...p.row, p.mask, ...(p.faces ? [p.faces] : [])])
  models[b.id] = { id: b.id, name: b.name, kind: b.kind, w: b.w, h: b.h, maxLevel: b.maxLevel, crowd: crowd.some(Boolean) ? crowd : undefined, rots: [...rots.values()].map((r) => r.v), mats: [...mats.values()].map((m) => m.v), parts }
  log(`${b.id}: ${b.maxLevel} levels, ${parts.length} parts (${most} at most in one level)${crowd.some(Boolean) ? `, crowd ${crowd.join('/')}` : ''}`)
}
const images = await page.evaluate(() => window.images())
await page.evaluate(() => Promise.all(Object.values(window.images()).map((u) => new Promise((ok) => { const i = new Image(); i.onload = ok; i.src = u }))))
const averages = await page.evaluate(() => window.averages())
// The colour a textured surface shows from a distance: its colour times the image's average.
// BuildingBuilder paints the part this colour, so it reads right before the image is uploaded.
const hex = (c) => '#' + c.map((x) => Math.round(Math.min(1, x) * 255).toString(16).padStart(2, '0')).join('')
for (const m of Object.values(models)) for (const mat of m.mats) if (mat.tex && averages[mat.tex]) {
  const c = [1, 3, 5].map((i) => parseInt(mat.color.slice(i, i + 2), 16) / 255)
  mat.shade = hex(c.map((x, i) => x * averages[mat.tex][i]))
}
await browser.close()
await server.close()

// Luau table literals.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
function luau(v) {
  if (v === null || v === undefined) return 'nil'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return JSON.stringify(v)
  if (Array.isArray(v)) return `{${v.map(luau).join(',')}}`
  return `{${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${IDENT.test(k) ? k : `[${JSON.stringify(k)}]`}=${luau(x)}`).join(',')}}`
}

const HEAD = '-- Generated by scripts/roblox/models.mjs from the web game\'s building models (github.com/KeganBerg/Cartopia).\n'
for (const m of Object.values(models)) {
  const body = [
    `${HEAD}-- ${m.name}. Units are the web game's (a lot tile is 2 wide); BuildingBuilder scales them to studs.`,
    '-- parts: {shape, mat, rot, x, y, z, sizeX, sizeY, sizeZ, levels, faces?}. shape B block, S ball, C cylinder (axis Y),',
    '-- D disc (facing +Z) or a mesh name in ModelAssets.Meshes. levels: bit n-1 set = shown at level n.',
    '-- rot: rows of the rotation matrix (Roblox CFrame order). faces: mats for +X, -X, +Y, -Y, +Z, -Z.',
    'return {',
    `\tid = ${luau(m.id)}, name = ${luau(m.name)}, kind = ${luau(m.kind)}, w = ${m.w}, h = ${m.h}, maxLevel = ${m.maxLevel},`,
    ...(m.crowd ? [`\t-- People the web game animates in and around it at each level (left out here; spawn your own crowd).\n\tcrowd = ${luau(m.crowd)},`] : []),
    `\trots = {\n${m.rots.map((r) => `\t\t${luau(r)},`).join('\n')}\n\t},`,
    `\tmats = {\n${m.mats.map((r) => `\t\t${luau(r)},`).join('\n')}\n\t},`,
    `\tparts = {\n${m.parts.map((r) => `\t\t${luau(r)},`).join('\n')}\n\t},`,
    '}',
    '',
  ].join('\n')
  writeFileSync(join(out, 'Data/Buildings', `${m.id}.luau`), body)
  writeFileSync(join(out, 'json/buildings', `${m.id}.json`), JSON.stringify(m))
}

// Meshes as OBJ in a unit box (the builder sizes them), and images as PNG.
for (const [k, g] of Object.entries(meshes)) {
  const L = []
  for (let i = 0; i < g.p.length; i += 3) L.push(`v ${g.p[i]} ${g.p[i + 1]} ${g.p[i + 2]}`)
  for (let i = 0; i < g.n.length; i += 3) L.push(`vn ${g.n[i]} ${g.n[i + 1]} ${g.n[i + 2]}`)
  for (let i = 0; i < g.u.length; i += 2) L.push(`vt ${g.u[i]} ${g.u[i + 1]}`)
  const t = g.u.length ? 1 : 0
  const f = (a) => [a + 1, t ? a + 1 : '', g.n.length ? a + 1 : ''].join('/').replace(/\/+$/, '')
  for (let i = 0; i < g.i.length; i += 3) L.push(`f ${f(g.i[i])} ${f(g.i[i + 1])} ${f(g.i[i + 2])}`)
  writeFileSync(join(out, 'Models/meshes', `${k}.obj`), L.join('\n') + '\n')
}
for (const [k, url] of Object.entries(images)) writeFileSync(join(out, 'Models/images', `${k}.png`), Buffer.from(url.split(',')[1], 'base64'))

const assets = {
  Meshes: Object.fromEntries(Object.keys(meshes).sort().map((k) => [k, { file: `Models/meshes/${k}.obj`, assetId: '' }])),
  Images: Object.fromEntries(Object.keys(images).sort().map((k) => [k, { file: `Models/images/${k}.png`, assetId: '' }])),
}
writeFileSync(join(out, 'json', 'modelAssets.json'), JSON.stringify(assets, null, 1))
writeFileSync(
  join(out, 'Data', 'ModelAssets.luau'),
  `${HEAD}-- Upload Models/meshes/*.obj and Models/images/*.png once, then put each asset id number in assetId.\n` +
    `-- Until then BuildingBuilder draws a mesh as a block of the same size and a texture as a plain colour.\n\nreturn {\n` +
    ['Meshes', 'Images'].map((g) => `\t${g} = {\n${Object.entries(assets[g]).map(([k, v]) => `\t\t[${JSON.stringify(k)}] = { file = ${JSON.stringify(v.file)}, assetId = "" },`).join('\n')}\n\t},`).join('\n') +
    '\n}\n',
)
writeFileSync(join(out, 'json', 'buildings.json'), JSON.stringify(Object.values(models).map(({ parts, rots, mats, ...m }) => ({ ...m, parts: parts.length })), null, 1))
log(`done: ${ids.length} buildings, ${Object.keys(meshes).length} meshes, ${Object.keys(images).length} images`)
process.exit(0)
