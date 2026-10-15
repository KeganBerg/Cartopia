// Fails if the built game's chunks import each other in a loop. A loop means one chunk can run
// before a chunk it needs has finished, which is how 705d811 shipped a game that never got past
// the splash (react imported rolldown's helpers from the sound chunk, which needed react).
// Run after `vite build`: node scripts/check-dist.mjs [dist]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.argv[2] ?? 'dist', 'assets')
const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
// Static imports only (`import{a}from"./x.js"`, `import"./x.js"`, `export{a}from"./x.js"`);
// dynamic import("./x.js") loads later and can't deadlock startup.
const STATIC = /\b(?:import|export)\s*(?:[^;()"'`]*?\bfrom\s*)?["'`]\.\/([\w.-]+\.js)["'`]/g

const deps = new Map(files.map((f) => {
  const src = readFileSync(join(dir, f), 'utf8')
  return [f, [...new Set([...src.matchAll(STATIC)].map((m) => m[1]))].filter((d) => d !== f)]
}))

const loops = []
const state = new Map()
const visit = (f, path) => {
  state.set(f, 'open')
  for (const d of deps.get(f) ?? []) {
    if (state.get(d) === 'open') loops.push([...path.slice(path.indexOf(d)), d].join(' -> '))
    else if (!state.has(d)) visit(d, [...path, d])
  }
  state.set(f, 'done')
}
for (const f of files) if (!state.has(f)) visit(f, [f])

if (loops.length) {
  console.error(`Chunk import loops in ${dir}:\n  ${loops.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-dist: ${files.length} chunks, no import loops`)
