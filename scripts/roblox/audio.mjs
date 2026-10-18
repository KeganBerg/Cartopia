// Renders the game's audio for the Roblox port (scripts/roblox/audio.ts in Chromium) and
// writes MP3s ready to upload as Roblox audio assets, plus Data/Audio.luau mapping each
// file to where it plays, with an empty assetId to fill in after upload.
//   node scripts/roblox/audio.mjs [outDir]     (default roblox-export/; needs ffmpeg)
import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'
import { buildSprite, writeMap } from './audioMap.mjs'

const out = resolve(process.argv[2] ?? 'roblox-export')
const audioDir = join(out, 'Audio')
const tmp = join(tmpdir(), 'cartopia-roblox-audio')
rmSync(audioDir, { recursive: true, force: true })
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
mkdirSync(join(out, 'Data'), { recursive: true })
mkdirSync(join(out, 'json'), { recursive: true })
// QUICK=1 renders one of each kind, to check the pipeline.
const QUICK = !!process.env.QUICK

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const require = createRequire('/opt/node-tools/node_modules/')
const { chromium } = require('playwright')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error', e.message))
await page.goto('http://localhost:5199/scripts/roblox/audio.html')
await page.waitForFunction(() => window.ready, null, { timeout: 120000 })
// sound.ts only plays after the player's first tap.
await page.mouse.click(10, 10)
const call = (fn, ...args) => page.evaluate(([f, a]) => window[f](...a), [fn, args])

// Data the map needs, straight from the game's modules.
const meta = await page.evaluate(async () => {
  const { SONGS } = await import('/src/lib/townMusic.ts')
  const { GROOVES } = await import('/src/lib/clubGrooves.ts')
  return { songs: SONGS.map((s) => ({ name: s.name, when: s.when, seasons: s.seasons, bpm: s.bpm })), grooves: GROOVES.map((g) => ({ name: g.name, bpm: g.bpm })) }
})

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const groups = {} // group -> [{ file, wav }]
function keep(group, file, b64) {
  const wav = join(tmp, `${group}-${file.replace(/[/.]/g, "_")}.wav`)
  writeFileSync(wav, Buffer.from(b64, 'base64'))
  ;(groups[group] ??= []).push({ file, wav })
}
const log = (s) => console.log(new Date().toISOString().slice(11, 19), s)

const map = { Music: { Town: [], Club: [], Rave: {} }, Ambience: { Beds: [], Thunder: [] }, Sfx: {}, Voice: [] }

for (const s of QUICK ? meta.songs.slice(0, 1) : meta.songs) {
  log(`town ${s.name}`)
  const r = await call('town', s.name)
  const file = `music/${s.seasons[0]}-${s.when}-${slug(s.name)}.mp3`
  keep('music', file, r.wav)
  map.Music.Town.push({ name: s.name, file, seasons: s.seasons, when: s.when, bpm: s.bpm, seconds: Math.round(r.secs), assetId: '' })
}
for (let i = 0; i < (QUICK ? 1 : meta.grooves.length); i++) {
  const g = meta.grooves[i]
  log(`club ${g.name}`)
  const r = await call('club', i)
  const file = `club/${String(i + 1).padStart(2, '0')}-${slug(g.name)}.mp3`
  keep('club', file, r.wav)
  map.Music.Club.push({ track: i, name: g.name, file, bpm: g.bpm, seconds: Math.round(r.secs), looped: true, assetId: '' })
}
log('rave')
{
  const r = await call('techno')
  keep('rave', 'rave/build-up.mp3', r.build)
  keep('rave', 'rave/drop-loop.mp3', r.loop)
  map.Music.Rave = {
    buildUp: { file: 'rave/build-up.mp3', seconds: Math.round(r.buildSecs), assetId: '' },
    dropLoop: { file: 'rave/drop-loop.mp3', seconds: Math.round(r.loopSecs), looped: true, assetId: '' },
  }
}
const CALM = { rain: 0, snow: 0, wind: 0, wet: 0 }
const SKIES = [
  ['calm', CALM, ['spring', 'summer', 'fall', 'winter']],
  ['rain', { rain: 0.6, snow: 0, wind: 0.2, wet: 0.7 }, ['spring', 'summer', 'fall']],
  ['storm', { rain: 1, snow: 0, wind: 0.7, wet: 1 }, ['summer']],
  ['wind', { rain: 0, snow: 0, wind: 0.8, wet: 0 }, ['fall']],
  ['snow', { rain: 0, snow: 0.7, wind: 0.4, wet: 0 }, ['winter']],
]
for (const [sky, mix, seasons] of QUICK ? SKIES.slice(0, 1) : SKIES)
  for (const season of seasons)
    for (const [when, night] of [['day', 0], ['night', 1]]) {
      log(`ambience ${season} ${when} ${sky}`)
      const r = await call('ambience', season, night, mix)
      const file = `ambience/${season}-${when}-${sky}.mp3`
      keep('ambience', file, r.wav)
      map.Ambience.Beds.push({ season, when, weather: sky, file, seconds: r.secs, looped: true, assetId: '' })
    }
for (const [name, loud] of [['near', 1], ['far', 0.45]]) {
  log(`thunder ${name}`)
  const r = await call('thunder', loud)
  keep('ambience', `ambience/thunder-${name}.mp3`, r.wav)
  map.Ambience.Thunder.push({ file: `ambience/thunder-${name}.mp3`, assetId: '' })
}
log('effects')
{
  const r = await call('effects')
  if (r.errors.length) console.log('effects not rendered:', r.errors.join('; '))
  for (const [name, b64] of Object.entries(r.out)) {
    keep('sfx', `sfx/${name}.mp3`, b64)
    map.Sfx[name] = { file: `sfx/${name}.mp3`, assetId: '' }
  }
}
await browser.close()
await server.close()

// One gain per group, so every file in a group keeps the balance it has in the game,
// with the loudest file of the group peaking at -1 dBFS.
for (const [group, files] of Object.entries(groups)) {
  let max = -Infinity
  for (const f of files) {
    const res = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${f.wav}" -af volumedetect -f null - 2>&1 | grep max_volume`], { encoding: 'utf8' })
    max = Math.max(max, Number(res.match(/max_volume: (-?[\d.]+)/)[1]))
  }
  const gain = -1 - max
  log(`${group}: ${files.length} files, gain ${gain.toFixed(1)} dB`)
  for (const f of files) {
    const dest = join(audioDir, f.file)
    mkdirSync(join(dest, '..'), { recursive: true })
    const rate = group === 'sfx' ? '128k' : '192k'
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', f.wav, '-af', `volume=${gain.toFixed(2)}dB`, '-codec:a', 'libmp3lame', '-b:a', rate, dest])
  }
}

// The tutorial's spoken lines are already MP3s.
mkdirSync(join(audioDir, 'voice'), { recursive: true })
for (const f of readdirSync('public/audio/tutorial').filter((x) => x.endsWith('.mp3')).sort()) {
  copyFileSync(join('public/audio/tutorial', f), join(audioDir, 'voice', f))
  map.Voice.push({ step: f.replace(/\.mp3$/, ''), file: `voice/${f}`, assetId: '' })
}

// Where each sound plays, as the web game does it.
map.Rules = {
  town: 'One town song at a time, shuffled from the songs for this season and time of day (Music.Town: seasons, when), never one of the last 3 played; a quiet gap of a few seconds between songs. Stops during races and arcade games.',
  club: 'The nightclub plays one Music.Club track all night, a different one every night: track = trackOf(night) in src/lib/clubSet.ts (same for every server). Louder the closer the camera is to the club; the town song fades out as it fades in.',
  rave: 'Rave Mode: buildUp once over the 10 s warning (fading in), then dropLoop looped. Town songs and the club stop while it plays.',
  ambience: 'Ambience.Beds loops under everything: pick by season, day or night, and weather; crossfade over a few seconds when any of them changes. Thunder plays at random during storms.',
  voice: 'Voice lines play once on their tutorial step.',
}
// Starting volumes (Sound.Volume), from the web game's mix.
map.Volume = { town: 0.38, club: 0.8, rave: 0.85, ambience: 0.6, sfx: 0.7, voice: 1 }

buildSprite(out, map)
writeMap(out, map)
rmSync(tmp, { recursive: true, force: true })
log(`done: ${Object.values(groups).reduce((n, g) => n + g.length, 0) + map.Voice.length} files -> ${audioDir}`)
process.exit(0)
