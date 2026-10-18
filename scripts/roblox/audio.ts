// Renders the game's synthesised audio offline, the way the town plays it, so the
// Roblox port can upload it as audio assets: the town songs, the nightclub's
// tracks, the town ambience beds, the Rave Mode track and the sound effects.
// scripts/roblox/audio.mjs drives it in Chromium; each render returns a WAV.
// The sound effects play through sound.ts's own context, so before that module
// loads AudioContext is swapped for the offline context of the current render.

type Fx = { ctx: OfflineAudioContext | null }
const fx: Fx = { ctx: null }
// sound.ts makes one context and keeps it: hand it a stand-in that forwards to
// whichever offline context the current effects render uses.
;(window as unknown as { AudioContext: unknown }).AudioContext = function () {
  return new Proxy({}, {
    get(_, k) {
      const c = fx.ctx as unknown as Record<string | symbol, unknown>
      if (k === 'state') return 'running'
      if (k === 'resume' || k === 'suspend') return () => Promise.resolve()
      const v = c[k]
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v
    },
  })
}

const SR = 44100

function wav(buf: AudioBuffer, from = 0, to = buf.length) {
  const n = to - from
  const out = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o: number, v: string) => [...v].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true)
  out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 4, true)
  const l = buf.getChannelData(0)
  const r = buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[from + i])) * 32767, true)
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[from + i])) * 32767, true)
  }
  let s = ''
  const bytes = new Uint8Array(out.buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// A seamless loop of `secs`: render a little extra and fade the overhang into the start.
function loop(buf: AudioBuffer, secs: number, fade: number) {
  const n = Math.floor(secs * SR)
  const f = Math.floor(fade * SR)
  const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR })
  for (let c = 0; c < 2; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < n; i++) dst[i] = i < f ? src[i] * (i / f) + src[n + i] * (1 - i / f) : src[i]
  }
  return out
}

// Step a player the way the game does, a little ahead of the clock, every 0.1 s.
async function offline(secs: number, setup: (ctx: OfflineAudioContext) => (t: number) => void) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR)
  const step = setup(ctx)
  for (let t = 0.1; t < secs; t += 0.1) {
    const at = t
    ctx.suspend(at).then(() => {
      step(at)
      ctx.resume()
    })
  }
  step(0)
  return ctx.startRendering()
}

async function town(name: string) {
  const { SONGS, TownMusic } = await import('../../src/lib/townMusic')
  const song = SONGS.find((s) => s.name === name)!
  // 40 bars, then the closing chord's ring-out.
  const secs = (40 * 4 * 60) / song.bpm + 5
  const buf = await offline(secs, (ctx) => {
    const m = new TownMusic(ctx, ctx.destination)
    m.queue = [name]
    m.gap = [600, 600]
    m.level(1, 0, 0.01)
    return (t) => m.step(t + 0.3, song.when === 'night' ? 1 : 0, song.seasons[0], 0)
  })
  return { wav: wav(buf), secs }
}

async function club(track: number) {
  const { Soundscape } = await import('../../src/lib/ambience')
  const { CYCLE_BARS, barMs, nightWith } = await import('../../src/lib/clubSet')
  const { DAY_MS } = await import('../../src/game/clock')
  // One pass of the arrangement, which the club plays over and over all night.
  const secs = (CYCLE_BARS * barMs(track)) / 1000
  const buf = await offline(secs + 0.5, (ctx) => {
    const s = new Soundscape(ctx, ctx.destination)
    const start = nightWith(track, 1000) * DAY_MS
    s.wallAt = (t) => start + t * 1000
    s.level(1, 0, 0.01)
    // Only the club's music: the town around it is its own ambience bed.
    const music = (s as unknown as { clubMusic: (t: number, c: { pan: number; near: number }) => void }).clubMusic.bind(s)
    return (t) => music(t + 0.05, { pan: 0, near: 1 })
  })
  return { wav: wav(buf, 0, Math.floor(secs * SR)), secs }
}

async function ambience(season: 'spring' | 'summer' | 'fall' | 'winter', night: number, sky: { rain: number; snow: number; wind: number; wet: number }) {
  const { Soundscape } = await import('../../src/lib/ambience')
  const secs = 60
  const buf = await offline(secs + 4 + 6, (ctx) => {
    const s = new Soundscape(ctx, ctx.destination)
    s.level(1, 0, 0.01)
    return (t) => s.step(t + 0.05, night, season, null, sky)
  })
  // Skip the first 6 s while the beds fade in, then make a loop.
  const trimmed = new AudioBuffer({ length: buf.length - 6 * SR, numberOfChannels: 2, sampleRate: SR })
  for (let c = 0; c < 2; c++) trimmed.copyToChannel(buf.getChannelData(c).subarray(6 * SR), c)
  return { wav: wav(loop(trimmed, secs, 4)), secs }
}

async function thunder(loud: number) {
  const { Soundscape } = await import('../../src/lib/ambience')
  const buf = await offline(9, (ctx) => {
    const s = new Soundscape(ctx, ctx.destination)
    s.level(1, 0, 0.001)
    let done = false
    return (t) => {
      if (!done && t >= 0.1) {
        done = true
        s.thunder(t + 0.05, loud)
      }
    }
  })
  return { wav: wav(buf), secs: 9 }
}

async function techno() {
  const { TechnoTrack } = await import('../../src/lib/technoTrack')
  const { BAR_MS, BUILD_MS, CYCLE_BARS } = await import('../../src/game/techno')
  const build = BUILD_MS / 1000
  const cycle = (CYCLE_BARS * BAR_MS) / 1000
  const wall0 = 1_800_000_000_000
  const buf = await offline(build + cycle + 0.5, (ctx) => {
    const tr = new TechnoTrack(ctx, ctx.destination)
    // Under full scale: the game runs it at 0.85 into a soft clipper.
    tr.level(0.5, 0, 0.01)
    return (t) => tr.step(t + 0.3, wall0 + t * 1000, wall0 + BUILD_MS)
  })
  return {
    build: wav(buf, 0, Math.floor(build * SR)),
    loop: wav(buf, Math.floor(build * SR), Math.floor((build + cycle) * SR)),
    buildSecs: build,
    loopSecs: cycle,
  }
}

// Every sound effect, each fired in its own slot of one long render, then cut apart.
const SLOT = 4
async function effects() {
  const sound = await import('../../src/lib/sound')
  const arcade = await import('../../src/lib/arcadeSound')
  const { crateOpenSound } = await import('../../src/lib/crateOpenSfx')
  const { wheelTick, wheelWin } = await import('../../src/lib/wheelSfx')
  const { sfx, rescueSfx, crateSfx } = sound
  const list: [string, () => unknown][] = [
    ['click', () => sfx.click()], ['coin', () => sfx.coin()], ['coins', () => sfx.coins(5)], ['start', () => sfx.start()],
    ['bulldoze-tree', () => sfx.bulldoze(false)], ['bulldoze-rock', () => sfx.bulldoze(true)], ['sweep', () => sfx.sweep(5, 3, 1)],
    ['challenge', () => sfx.challenge()], ['menu-open', () => sfx.menuOpen()], ['menu-close', () => sfx.menuClose()], ['tab', () => sfx.tab()],
    ['equip', () => sfx.equip()], ['notify', () => sfx.notify()], ['message', () => sfx.message()], ['send', () => sfx.send()],
    ['reward', () => sfx.reward()], ['unlock', () => sfx.unlock()], ['step', () => sfx.step()], ['error', () => sfx.error()],
    ['level-up', () => sfx.levelUp()], ['dispatch', () => sfx.dispatch(3)], ['buy', () => sfx.buy()], ['horn', () => sfx.horn()],
    ['horn-icecream', () => sfx.horn('icecream' as never)], ['shift', () => sfx.shift(true)],
    ['win', () => sfx.win()], ['lose', () => sfx.lose()], ['putt', () => sfx.putt()], ['jet', () => sfx.jet()], ['boost', () => sfx.boost()],
    ['countdown', () => sfx.countdown(false)], ['countdown-go', () => sfx.countdown(true)],
    ['rescue-go', () => rescueSfx.go()], ['rescue-rumble', () => rescueSfx.rumble('common', 2)], ['rescue-rumble-rare', () => rescueSfx.rumble('rare', 2)],
    ['rescue-reveal-nothing', () => rescueSfx.reveal('nothing')], ['rescue-reveal-small', () => rescueSfx.reveal('small')],
    ['rescue-reveal-common', () => rescueSfx.reveal('common')], ['rescue-reveal-scarce', () => rescueSfx.reveal('scarce')],
    ['rescue-reveal-rare', () => rescueSfx.reveal('rare')], ['rescue-clunk', () => rescueSfx.clunk()], ['rescue-land-car', () => rescueSfx.land(true)],
    ['rescue-land', () => rescueSfx.land(false)], ['rescue-tick', () => rescueSfx.tick(1)], ['rescue-home', () => rescueSfx.home()],
    ['rescue-fanfare', () => rescueSfx.fanfare(false)], ['rescue-fanfare-big', () => rescueSfx.fanfare(true)],
    ['crate-charge', () => crateSfx.charge(1.5)], ['crate-reveal-1', () => crateSfx.reveal(0, false)], ['crate-reveal-2', () => crateSfx.reveal(1, false)],
    ['crate-reveal-3', () => crateSfx.reveal(2, false)], ['crate-reveal-4', () => crateSfx.reveal(3, false)], ['crate-reveal-coins', () => crateSfx.reveal(0, true)],
    ['crate-open-street', () => crateOpenSound('street')], ['crate-open-garage', () => crateOpenSound('garage')],
    ['crate-open-gold', () => crateOpenSound('gold')], ['crate-open-diamond', () => crateOpenSound('diamond')],
    ['wheel-tick', () => wheelTick(1)], ['wheel-win-common', () => wheelWin('common')], ['wheel-win-uncommon', () => wheelWin('uncommon')],
    ['wheel-win-rare', () => wheelWin('rare')], ['wheel-win-epic', () => wheelWin('epic')], ['wheel-win-legendary', () => wheelWin('legendary')],
    ...(Object.entries(arcade).filter(([k, v]) => /Sound$/.test(k) && typeof v === 'function') as [string, () => unknown][])
      .map(([k, f]): [string, () => unknown] => [`arcade-${k.replace(/Sound$/, '').replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, () => f()]),
  ]
  const secs = list.length * SLOT + 1
  const ctx = new OfflineAudioContext(2, SR * secs, SR)
  fx.ctx = ctx
  // Touching the context once builds sound.ts's master chain on this render.
  sound.audioContext()
  const errors: string[] = []
  list.forEach(([name, f], i) => {
    ctx.suspend(i * SLOT + 0.5).then(async () => {
      // Some effects skip a repeat within a moment of real time (menu open, then close).
      await new Promise((r) => setTimeout(r, 200))
      try {
        f()
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`)
      }
      ctx.resume()
    })
  })
  const buf = await ctx.startRendering()
  const out: Record<string, string> = {}
  const l = buf.getChannelData(0)
  const r = buf.getChannelData(1)
  list.forEach(([name], i) => {
    const a = Math.floor((i * SLOT + 0.5) * SR)
    let b = Math.floor(((i + 1) * SLOT + 0.5) * SR) - 1
    b = Math.min(b, buf.length - 1)
    // Trim the silence after the sound (keep a short tail).
    let end = a
    for (let k = a; k < b; k++) if (Math.abs(l[k]) > 1e-4 || Math.abs(r[k]) > 1e-4) end = k
    if (end > a) out[name] = wav(buf, a, Math.min(b, end + Math.floor(0.05 * SR)))
    else errors.push(`${name}: silent`)
  })
  return { out, errors }
}

Object.assign(window, { town, club, ambience, thunder, techno, effects, ready: true })
