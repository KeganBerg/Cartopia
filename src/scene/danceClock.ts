// The rooftop dancers' own beat count. It runs at the track's tempo and eases
// onto the music's steady beat grid, so a kick off the grid (a two-step, a
// half-time bar), a late cue or a hand-clap never snaps every figure into a
// new pose at once.
export type Dance = { phase: number; clap: number; ready: boolean }

export const newDance = (): Dance => ({ phase: 0, clap: 0, ready: false })

export function stepDance(d: Dance, dt: number, grid: number, bpm: number, clap: number) {
  if (!d.ready) {
    d.phase = grid
    d.ready = true
    return d
  }
  const adv = (Math.min(dt, 0.1) * bpm) / 60
  let err = grid - (d.phase - Math.floor(d.phase))
  err -= Math.round(err)
  // Catch up within a few beats, never running backwards or doubling speed.
  const fix = Math.max(-adv * 0.5, Math.min(adv * 0.5, err * Math.min(1, dt * 4)))
  d.phase += adv + fix
  // Hands go up on a clap quickly but not in one frame.
  d.clap += (clap - d.clap) * Math.min(1, dt * 16)
  return d
}
