// How each scanned car is cut up and restyled. See bake.mjs.
//
// source: where the source model's nose, tail, axles, sill, beltline and roof sit (metres,
//   +z forward, y up), and its half width without mirrors.
// target: the Cartopia body it replaces: front and rear ends, wheel-base from len * 0.33,
//   width, ride height, beltline and roof.
// parts: which source meshes ("node|material") become which Cartopia part. Anything
//   unlisted (interior, wheels, mirrors, wipers, handles) is left out; we add our own.
// style.hoodStretch > 1 slides the cabin back between the axles (a longer hood).
// Windows, lights and trim are our own, drawn over the hull by scanGeo (src/scene/CarModel.tsx).
export const RECIPES = {
  // Sparkline Current: an electric grand tourer.
  current: {
    credit: '"Car Concept" glTF sample (KhronosGroup/glTF-Sample-Assets, CC BY 4.0), from "Free Concept Car 004" by Unity Fan (CC0). Restyled: toy proportions, longer hood, solid rear quarters, new lights.',
    source: { front: 2.42, rear: -1.94, frontAxle: 1.49, rearAxle: -1.315, sill: 0.13, belt: 0.9, roof: 1.15, half: 1.11 },
    target: { len: 1.26, front: 0.66, rear: 0.61, wid: 0.72, lift: 0.08, belt: 0.29, roof: 0.44 },
    parts: {
      glass: [/^BodyWindshield\|Glass/, /^BodyRearwindow\|/, /^BodyDoor[LR]Window\|/],
      black: [/^BodyWindshieldGasket\|/, /^BodyDoor[LR]WindowGasket\|/, /^BodyTaillightsPanels\|/],
      tail: [/^BodyTaillights\|/, /^BodyTurnsignalsRear\|/],
      dark: [/^BodyPanelsColor2\|/, /^BodyDoor[LR]Color2\|/, /^BodyHoodTopgrill\|/],
      paint: [/^Body(Hood|Pillars|RearPanelsColor1|RoofPanel|Door[LR]Color1|WindowsRearSides|Headlights)\|/],
    },
    style: { hoodStretch: 1.3, cabinWidth: 0.86, hoodFrom: 0.2, noseDrop: 0.22, darkBelow: 0.16, endStations: 14, endSmooth: 8 },
    stations: 48,
    ring: 29,
    smooth: 3,
  },
}
