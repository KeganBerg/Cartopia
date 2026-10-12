// The prize wheel's sounds: a woody tick each time a peg passes the flapper, and a chime when it
// stops, bigger the rarer the slice. Built from instruments.ts.
import { glock, marimba, softKick, vibes, woodblock } from './instruments'
import { audioContext, audioOut } from './sound'
import type { WheelTier } from '../game/wheel'

function dest() {
  const ctx = audioContext()
  const out = audioOut()
  return ctx && out ? { ctx, out, t: ctx.currentTime + 0.005 } : null
}

// speed: 0 (crawling) to 1 (full spin); fast ticks are quieter and higher.
export function wheelTick(speed: number) {
  const d = dest()
  if (!d) return
  woodblock(d, d.t, 1500 + speed * 500, 0.05 + (1 - speed) * 0.05)
}

const NOTES: Record<WheelTier, number[]> = {
  common: [523, 659, 784],
  uncommon: [523, 659, 784, 1047],
  rare: [587, 740, 880, 1175],
  epic: [523, 659, 784, 1047, 1319],
  legendary: [523, 659, 784, 1047, 1319, 1568, 2093],
}

export function wheelWin(tier: WheelTier) {
  const d = dest()
  if (!d) return
  const notes = NOTES[tier]
  notes.forEach((f, i) => glock(d, d.t + i * 0.07, f, 0.07))
  marimba(d, d.t, notes[0] / 2, 0.1, 0.8)
  if (tier === 'epic' || tier === 'legendary') {
    softKick(d, d.t, 0.12)
    vibes(d, d.t + notes.length * 0.07, notes[notes.length - 1], 0.05, 2.4)
  }
}
