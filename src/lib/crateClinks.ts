// Soft clinks for the coins and gems a crate throws, one as each lands for the first time:
// coins ring like small metal discs, gems tink like glass. Built from the glockenspiel and
// shaker in instruments.ts, kept quiet and thinned out so a shower of 70 stays a patter.
import { glock, shaker } from './instruments'
import { audioContext, sfxOut } from './sound'

type Dest = { ctx: BaseAudioContext; out: AudioNode }

// A coin: two close metal partials that beat against each other, over a tiny scrape.
export function coinClink(d: Dest, t: number, pitch = 1, vol = 0.014) {
  const f = 2600 * pitch
  glock(d, t, f, vol, 0.24)
  glock(d, t, f * 1.37, vol * 0.55, 0.16)
  shaker(d, t, vol * 0.5, 0.03, 9000)
}

// A gem: one high, pure glass ping with a long, faint tail.
export function gemTink(d: Dest, t: number, pitch = 1, vol = 0.011) {
  const f = 3900 * pitch
  glock(d, t, f, vol, 0.5)
  glock(d, t, f * 1.5, vol * 0.25, 0.22)
}

// At most one clink this often, and fewer as the shower thickens.
const GAP = 0.03
let last = 0
let recent = 0

// One landing. `speed` is how hard it hit (m/s), which sets how loud the clink is.
export function landClink(gem: boolean, speed: number) {
  const ctx = audioContext()
  const out = sfxOut()
  if (!ctx || !out) return
  const now = ctx.currentTime
  if (now - last < GAP) return
  // Recent clinks fade away over a quarter second; the busier it is, the more get skipped.
  recent = recent * Math.exp(-(now - last) / 0.25) + 1
  if (Math.random() < Math.min(0.6, (recent - 3) * 0.08)) return
  last = now
  const t = now + 0.005 + Math.random() * 0.012
  const pitch = 0.88 + Math.random() * 0.26
  const loud = Math.min(1, 0.45 + speed / 12)
  if (gem) gemTink({ ctx, out }, t, pitch, 0.011 * loud)
  else coinClink({ ctx, out }, t, pitch, 0.014 * loud)
}
