// Renders the club's music offline, exactly as the town plays it, and keeps
// every light cue the music reports (its time on the audio clock). The capture
// script pulls the WAV and the cues out with window.render(bar, seconds,
// track): that stretch of a night playing the track (default 0), from that bar.
import { Soundscape } from '../../src/lib/ambience'
import { barMs, nightWith } from '../../src/lib/clubSet'
import { DAY_MS } from '../../src/game/clock'

type Cue = [number, ...unknown[]]

async function render(bar: number, secs: number, track = 0) {
  const sr = 44100
  const ctx = new OfflineAudioContext(2, sr * secs, sr)
  const s = new Soundscape(ctx, ctx.destination)
  const start = nightWith(track, 1000) * DAY_MS + bar * barMs(track)
  s.wallAt = (t) => start + t * 1000
  const cues: Cue[] = []
  s.onHit = (at: number, ...rest: unknown[]) => cues.push([at, ...rest])
  s.level(1, 0, 0.01)
  // Step it the way the game does, a little ahead of the clock, every 0.2 s.
  for (let t = 0.2; t < secs; t += 0.2) {
    const at = t
    ctx.suspend(at).then(() => {
      s.step(at + 0.05, 1, 'summer', { pan: 0, near: 1 })
      ctx.resume()
    })
  }
  s.step(0.05, 1, 'summer', { pan: 0, near: 1 })
  const buf = await ctx.startRendering()
  // 16-bit stereo WAV.
  const n = buf.length
  const out = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o: number, v: string) => [...v].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true)
  out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 4, true)
  const l = buf.getChannelData(0)
  const r = buf.getChannelData(1)
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true)
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true)
  }
  const bytes = new Uint8Array(out.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { wav: btoa(bin), cues }
}
;(window as unknown as { render: typeof render }).render = render
