// Exports Cartopia's game data for the Roblox port: every plain-data export of the rule
// modules (cars, buildings, mods, crates, goals, tours...) as JSON and Luau ModuleScripts,
// the server catalog tables, and level curves sampled from the formulas.
//   node scripts/roblox/export.mjs [outDir]     (default roblox-export/)
import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MODULES } from './modules.mjs'

const out = resolve(process.argv[2] ?? 'roblox-export')
const tmp = resolve('node_modules/.cache/roblox-export')
mkdirSync(tmp, { recursive: true })

const modName = (p) => basename(p, '.ts')
const entry = MODULES.map((p, i) => `export * as m${i} from ${JSON.stringify(resolve(p))}`).join('\n')
writeFileSync(join(tmp, 'entry.ts'), entry)

// Browser globals some modules touch at import time come from jsdom (a dev dependency already).
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://cartopia.lol/' })
for (const k of ['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event'])
  if (!(k in globalThis) || k === 'navigator') Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true })
globalThis.addEventListener ??= dom.window.addEventListener.bind(dom.window)
globalThis.removeEventListener ??= dom.window.removeEventListener.bind(dom.window)
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
dom.window.matchMedia = globalThis.matchMedia
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 16)

await build({
  entryPoints: [join(tmp, 'entry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(tmp, 'bundle.mjs'),
  define: { __BUILD_ID__: '"roblox-export"', __RAVE_HALCYON__: 'false', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"' },
  loader: { '.png': 'empty', '.jpg': 'empty', '.mp3': 'empty', '.wav': 'empty', '.glsl': 'text', '.css': 'empty' },
  logLevel: 'error',
})
const bundle = await import(pathToFileURL(join(tmp, 'bundle.mjs')).href)

// Plain data only: numbers, strings, booleans, arrays and plain objects (Sets become arrays).
function plain(v, depth = 0) {
  if (depth > 40) return undefined
  if (v === null) return null
  const t = typeof v
  if (t === 'number') return Number.isFinite(v) ? v : v > 0 ? 'inf' : v < 0 ? '-inf' : undefined
  if (t === 'string' || t === 'boolean') return v
  if (t !== 'object') return undefined
  if (v instanceof Set) v = [...v]
  if (Array.isArray(v)) {
    const a = v.map((x) => plain(x, depth + 1))
    return a.some((x) => x === undefined) ? undefined : a
  }
  const proto = Object.getPrototypeOf(v)
  if (proto !== Object.prototype && proto !== null) return undefined
  const o = {}
  for (const [k, x] of Object.entries(v)) {
    const p = plain(x, depth + 1)
    if (p !== undefined) o[k] = p
  }
  return o
}

// Level curves sampled from formulas, so the port can check its Luau versions against them.
const LEVELS = Array.from({ length: 100 }, (_, i) => i + 1)
function curves(m) {
  const find = (name) => Object.values(m).find((x) => x && typeof x[name] === 'function')?.[name]
  const per = (name, f = find(name)) => (f ? Object.fromEntries(LEVELS.map((l) => [l, f(l)])) : undefined)
  const c = {
    xpToNext: per('xpToNext'),
    levelXpBoost: per('levelXpBoost'),
    playXpMult: per('playXpMult'),
    townXpMult: per('townXpMult'),
    fuelPerMin: per('fuelPerMin'),
    baseFuelCap: per('baseFuelCap'),
    gemCoins: per('gemCoins'),
    plotPriceByPlotsBought: find('plotPrice') && Object.fromEntries(Array.from({ length: 40 }, (_, n) => [n, find('plotPrice')(n)])),
  }
  const crates = Object.values(m).find((x) => Array.isArray(x?.CRATES))?.CRATES
  const crateOdds = find('crateOdds'), crateCost = find('crateCost')
  if (crates && crateOdds) {
    c.crateOddsByLevel = Object.fromEntries(crates.map((cr) => [cr.id, Object.fromEntries(LEVELS.map((l) => [l, crateOdds(cr, l)]))]))
    if (crateCost) c.crateCostByLevel = Object.fromEntries(crates.map((cr) => [cr.id, Object.fromEntries(LEVELS.map((l) => [l, plain(crateCost(cr, l))]))]))
  }
  return plain(c)
}

// Luau table literals.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const RESERVED = new Set('and break do else elseif end false for function if in local nil not or repeat return then true until while continue type export'.split(' '))
const str = (s) => JSON.stringify(s)
function luau(v, ind = '') {
  if (v === null) return 'nil'
  if (v === 'inf') return 'math.huge'
  if (v === '-inf') return '-math.huge'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return str(v)
  const next = ind + '\t'
  if (Array.isArray(v)) {
    if (!v.length) return '{}'
    const flat = v.every((x) => typeof x !== 'object' || x === null)
    if (flat && v.length <= 24) return `{ ${v.map((x) => luau(x)).join(', ')} }`
    return `{\n${v.map((x) => next + luau(x, next)).join(',\n')},\n${ind}}`
  }
  const ks = Object.keys(v)
  if (!ks.length) return '{}'
  const key = (k) => (IDENT.test(k) && !RESERVED.has(k) ? k : `[${/^-?\d+$/.test(k) ? k : str(k)}]`)
  return `{\n${ks.map((k) => `${next}${key(k)} = ${luau(v[k], next)}`).join(',\n')},\n${ind}}`
}
const header = (src) => `-- Generated by scripts/roblox/export.mjs from ${src} in github.com/KeganBerg/Cartopia. Do not edit by hand: re-export.\n`

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'json'), { recursive: true })
mkdirSync(join(out, 'Data'), { recursive: true })
const index = []
const all = {}
MODULES.forEach((p, i) => {
  const m = bundle[`m${i}`]
  const data = {}
  for (const [k, v] of Object.entries(m)) {
    const pv = plain(v)
    if (pv !== undefined && !(typeof pv === 'object' && pv && !Array.isArray(pv) && !Object.keys(pv).length)) data[k] = pv
  }
  const name = modName(p)
  all[name] = m
  const keys = Object.keys(data)
  if (!keys.length) return
  const luaName = name[0].toUpperCase() + name.slice(1)
  writeFileSync(join(out, 'json', `${name}.json`), JSON.stringify(data, null, 1))
  writeFileSync(join(out, 'Data', `${luaName}.luau`), `${header(p)}\nreturn ${luau(data)}\n`)
  index.push({ module: luaName, source: p, exports: keys })
})

// Car body shapes (the procedural car model's proportions) live un-exported in CarModel.tsx:
// read the literal straight from the source so the port can build the same cars from parts.
{
  const src = readFileSync('src/scene/CarModel.tsx', 'utf8')
  const start = src.indexOf('const SHAPES: Record<Body, Shape> = {')
  const end = src.indexOf('\n}\n', start)
  const shapes = plain(new Function(`return ${src.slice(src.indexOf('{', start), end + 2)}`)())
  writeFileSync(join(out, 'json', 'carShapes.json'), JSON.stringify(shapes, null, 1))
  writeFileSync(join(out, 'Data', 'CarShapes.luau'), `${header('src/scene/CarModel.tsx SHAPES (field meanings: the Shape type there)')}\nreturn ${luau(shapes)}\n`)
  index.push({ module: 'CarShapes', source: 'src/scene/CarModel.tsx', exports: Object.keys(shapes) })
}

// The server's own tables (what the Supabase guard and crate_open check against).
const econ = Object.values(all).find((m) => typeof m.econCatalog === 'function')
const crateMod = Object.values(all).find((m) => typeof m.crateTables === 'function')
const server = plain({ econCatalog: econ?.econCatalog(), crateTables: crateMod?.crateTables() })
writeFileSync(join(out, 'json', 'serverCatalog.json'), JSON.stringify(server, null, 1))
writeFileSync(join(out, 'Data', 'ServerCatalog.luau'), `${header('src/game/econCatalog.ts + crates.ts crateTables()')}\nreturn ${luau(server)}\n`)
index.push({ module: 'ServerCatalog', source: 'econCatalog() + crateTables()', exports: Object.keys(server) })

const cv = curves(all)
writeFileSync(join(out, 'json', 'curves.json'), JSON.stringify(cv, null, 1))
writeFileSync(join(out, 'Data', 'Curves.luau'), `${header('formulas in src/game (sampled levels 1-100)')}\nreturn ${luau(cv)}\n`)
index.push({ module: 'Curves', source: 'sampled formulas', exports: Object.keys(cv) })

copyFileSync('scripts/roblox/HANDOFF.md', join(out, 'HANDOFF.md'))
// The hand-written menu and button motion module (not generated).
copyFileSync('scripts/roblox/UIMotion.luau', join(out, 'Data', 'UIMotion.luau'))
index.push({ module: 'UIMotion', source: 'scripts/roblox/UIMotion.luau (menu and button motion)', exports: ['init', 'open', 'close', 'swap', 'bindButton', 'bindAll', 'pop', 'bump', 'shake', 'playSfx'] })
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1))
console.log(`${index.length} modules, ${index.reduce((n, x) => n + x.exports.length, 0)} tables -> ${out}`)
process.exit(0) // jsdom and store timers would keep node alive
