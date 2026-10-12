// Heights of the flat layers that lie on the ground. Each layer sits a clear
// step above the one under it, so phones with a coarse depth buffer never
// flicker between two of them (Z-fighting).
//
// THE NO-FLICKER RULE (checked by coplanar.test.tsx for every building, level,
// merged form and at night): two faces that face the same way and overlap are
// at least 0.002 apart, or the top one is a decal() below. 0.002 is one depth
// step at the free camera's furthest zoom (see FREE.near in freeCam.ts). Mind
// merged forms: a small piece centred on a wall's edge (a corner post, a fin,
// a wheel) is kept at true size on its inner side, which puts its outer face
// exactly on the stretched wall; nudge it a few thousandths outward instead.
// Shader tricks that hash per-building seeds read them flat (closingTime.ts).
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
