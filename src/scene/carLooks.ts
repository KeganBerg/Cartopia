import type { Body } from '../game/data'
import type { Shape } from './CarModel'

// Cars that share a body each get their own proportions here, so no two read as the same car
// in a different colour (carLookalike.test.ts holds every pair apart). Only the shape of the
// body and cabin changes: the length, width and wheels stay the body's, so town traffic,
// footprints and everything sized from the body still fit. Mods follow the new shape (carFrame
// and modGeo take the model).
type Own = { body: Body; shape: Partial<Omit<Shape, 'len' | 'wid' | 'wheel'>> }

export const MODEL_SHAPE: Record<string, Own> = {
  // Muscle.
  // Bore Horse: the body as drawn, with the roof sloping off into a fastback.
  stallion: { body: 'muscle', shape: { cabinZ: -0.13, cabinH: 0.2, taper: 0.7, fastback: 0.66 } },
  // Brawler: tall slab sides, a flat hood and an upright blunt nose with the headlights hidden
  // behind a full-width grille, the roof set well back, and one tail light across the back.
  charger: { body: 'muscle', shape: { body: 0.29, cabinZ: -0.22, cabinLen: 0.5, cabinH: 0.17, taper: 0.66, fastback: 0.55, hood: 0.01, drop: 0.012, nose: 0.01, scoop: false, lamps: 'hidden', lightbar: true } },
  // Rattler GT: a long low coupe racer: a rounded nose falling away from a long hood, the cabin
  // pushed back under a long fastback running down to a cut-off tail with a kicked-up lip.
  // Round lamps either side of a small mouth.
  rattler: { body: 'muscle', shape: { body: 0.21, lift: 0.085, cabinZ: -0.17, cabinLen: 0.62, cabinH: 0.17, taper: 0.46, fastback: 0.86, hood: 0.015, drop: 0.035, nose: 0.085, scoop: false, ducktail: true, lamps: 'round', grille: 'small' } },
  // Night Bandit: a drooping beak with quad lamps and no grille, a raised shaker hood, a low wide
  // roof and a ducktail.
  bandit: { body: 'muscle', shape: { body: 0.23, lift: 0.09, cabinZ: -0.13, cabinLen: 0.48, cabinH: 0.17, taper: 0.64, fastback: 0.6, hood: 0.07, drop: 0.045, nose: 0.085, ducktail: true, quad: true, grille: 'none' } },

  // Coupe.
  // Ronin GT: a tall upright greenhouse with a short flat roof and thick back pillars on a
  // squared-off body, a near-vertical nose and the hood level with the deck.
  gtr: { body: 'coupe', shape: { body: 0.235, cabinZ: -0.13, cabinLen: 0.54, cabinH: 0.23, taper: 0.8, fastback: 0.26, hood: 0.01, drop: 0.005, nose: 0.03 } },
  // Kitsune Drift: a light hatchback coupe: the cabin forward under a long sloping hatch, a thin
  // flat hood and a wedge nose with slim lamps under its pop-ups.
  kitsune: { body: 'coupe', shape: { body: 0.19, cabinZ: -0.16, cabinLen: 0.56, cabinH: 0.18, taper: 0.52, fastback: 0.78, hood: 0, drop: 0.035, nose: 0.075, lamps: 'strip', grille: 'none' } },
  // Silver Wing: a long hood and a small round cabin far back, the nose falling away in a curve
  // round two round lamps and a wide chrome grille.
  gullwing: { body: 'coupe', shape: { body: 0.22, cabinZ: -0.22, cabinLen: 0.44, cabinH: 0.19, taper: 0.48, fastback: 0.58, hood: 0.03, drop: 0.025, nose: 0.1, lamps: 'round', grille: 'big' } },

  // Super. Five takes on a mid-engined supercar.
  // Hyperion: a tall rounded body with a teardrop canopy, a rounded falling nose and a smooth
  // tail with only a kicked-up lip, no wing.
  hyper: { body: 'super', shape: { body: 0.21, cabinZ: -0.03, cabinLen: 0.48, cabinH: 0.15, taper: 0.46, fastback: 0.62, hood: 0.02, drop: 0.055, nose: 0.1, spoiler: false, ducktail: true } },
  // Endurance GT: very low, the cabin far forward with a long flying-buttress tail behind it.
  lemans: { body: 'super', shape: { body: 0.15, lift: 0.065, cabinZ: -0.02, cabinLen: 0.5, cabinH: 0.13, taper: 0.62, fastback: 0.76, hood: 0, drop: 0, nose: 0.045 } },
  // Ring V10: a long arched cabin set back, the nose short and upright with lamps in housings.
  ringmeister: { body: 'super', shape: { body: 0.17, cabinZ: -0.08, cabinLen: 0.58, cabinH: 0.17, taper: 0.6, fastback: 0.48, hood: 0.02, drop: 0.015, nose: 0.05, lamps: 'housing' } },
  // Sovereign 16: tall and heavy, quad lamps and a dropped nose under the horseshoe, a short high
  // roof and one tail light across the back.
  sovereign: { body: 'super', shape: { body: 0.21, lift: 0.075, cabinZ: -0.02, cabinLen: 0.46, cabinH: 0.17, taper: 0.52, fastback: 0.4, hood: 0, drop: 0.045, nose: 0.06, scoop: false, quad: true, lightbar: true } },
  // Zenith R: a low body with a small bubble canopy and a raised hood ridge.
  zenith: { body: 'super', shape: { body: 0.16, cabinZ: 0.0, cabinLen: 0.42, cabinH: 0.16, taper: 0.38, fastback: 0.5, hood: 0.035, drop: 0.01, nose: 0.085 } },

  // Wedge. The Corrida keeps the body as drawn.
  // Nightfall: lower and longer, a long canopy sweeping down to a wingless tail with a lip and
  // one tail light across the back.
  nightfall: { body: 'wedge', shape: { body: 0.14, cabinZ: -0.06, cabinLen: 0.7, cabinH: 0.13, taper: 0.55, fastback: 0.85, drop: 0.04, nose: 0.05, lightbar: true, spoiler: false, ducktail: true } },
  // Wraith: a taller body and an upright cabin set back, with quad lamps in a sharp falling nose.
  wraith: { body: 'wedge', shape: { body: 0.18, cabinZ: -0.07, cabinLen: 0.5, cabinH: 0.17, taper: 0.56, fastback: 0.6, drop: 0, nose: 0.1, quad: true } },

  // Truck. The Workhorse keeps the body, with lamps in housings.
  trail: { body: 'truck', shape: { lamps: 'housing' } },
  // Old Faithful: a rounded old pickup: a short tall cab, a curved nose and a lower body.
  hauler: { body: 'truck', shape: { body: 0.29, lift: 0.16, cabinZ: 0.24, cabinLen: 0.42, cabinH: 0.3, taper: 0.78, drop: 0.05, nose: 0.12 } },
  // Dune Stomper: lifted high, a long crew cab, a raised hood and slim lamps.
  stomper: { body: 'truck', shape: { body: 0.29, lift: 0.24, cabinZ: 0.13, cabinLen: 0.64, cabinH: 0.27, taper: 0.9, hood: 0.04, drop: 0, nose: 0.03, lamps: 'strip' } },

  // Roadster. The Zephyr keeps the body as drawn.
  // Speedster: a deep rounded tub, a low chopped screen and round lamps in a nose falling in a curve.
  speedster: { body: 'roadster', shape: { body: 0.23, cabinZ: -0.17, cabinH: 0.11, hood: 0, drop: 0.05, nose: 0.11, lamps: 'round', grille: 'none' } },

  // Sedan. The Commuter keeps the body as drawn.
  // Kreis S: lower, with an upright boxy greenhouse and quad lamps in an upright shark nose.
  kreis: { body: 'sedan', shape: { body: 0.22, lift: 0.08, cabinZ: -0.08, cabinLen: 0.56, cabinH: 0.22, taper: 0.84, fastback: 0.2, hood: 0, drop: 0.025, nose: 0.02, quad: true } },
}
