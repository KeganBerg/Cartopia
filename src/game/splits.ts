// Live split times for solo runs against a ghost (the weekly time trial, friend ghost races):
// the strip has checkpoints, and passing one shows how far ahead (green, "-0.4") or behind
// (red, "+0.2") of the ghost the player is there.
import { GHOST_CURVE } from './trial'

// Checkpoints as a share of the strip.
export const SPLIT_MARKS = [0.25, 0.5, 0.75]

// When a ghost that finishes in `time` passes each checkpoint, on the curve ghostDist() drives it along.
export const curveSplits = (time: number, marks = SPLIT_MARKS) => marks.map((m) => time * m ** (1 / GHOST_CURVE))

// The checkpoint times to beat: the player's own best run stretched to the time being chased (the
// board's best can differ a little from this device's run), else the ghost's curve.
export function refSplits(target: number, best: { t: number; splits: number[] } | null) {
  if (!best || best.t <= 0 || best.splits.length !== SPLIT_MARKS.length) return curveSplits(target)
  return best.splits.map((s) => (s * target) / best.t)
}

// Which checkpoints a racer passed going from `prev` to `dist` metres in one step (from t0 to t1
// seconds), with the moment it crossed each.
export function crossings(prev: number, dist: number, t0: number, t1: number, track: number, marks = SPLIT_MARKS) {
  const out: { i: number; t: number }[] = []
  marks.forEach((m, i) => {
    const at = m * track
    if (prev < at && dist >= at) out.push({ i, t: t0 + ((t1 - t0) * (at - prev)) / (dist - prev) })
  })
  return out
}

// Seconds behind (positive) or ahead (negative) at a checkpoint, to a tenth.
export const splitDelta = (mine: number, theirs: number) => Math.round((mine - theirs) * 10) / 10 || 0

// "-0.4", "+0.2", "0.0"
export const splitLabel = (d: number) => (d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1))
