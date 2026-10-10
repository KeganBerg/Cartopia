// Heights of the flat layers that lie on the ground. Each layer sits a clear
// step above the one under it, so phones with a coarse depth buffer never
// flicker between two of them (Z-fighting).
export const LAYER = {
  outer: -0.05, // grass beyond the town
  base: -0.025, // clickable ground under every plot
  land: 0, // owned plots
  grid: 0.01, // build grid lines and For Sale plots
  lot: 0.02, // asphalt and building paving
  paint: 0.03, // road markings
} as const

// Material props for a flat decal resting on another surface (paint, a mat, a
// light pool). Nudges it towards the camera in depth so it always draws on
// top, however far the camera is zoomed out.
export const decal = (n = 1) => ({ polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -4 * n })
