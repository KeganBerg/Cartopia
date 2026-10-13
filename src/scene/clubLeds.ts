import { Color, MeshStandardMaterial } from 'three'
import { clubPulse, CUES, type ClubPulse, type CueKind } from '../lib/clubBeat'
import { isNight } from '../game/clock'
import { calmFlashing } from '../game/flashing'
import { nightAmount, dayPhase } from './dayNight'
import { ledGridTex, ledPaneTex, windowTex } from './textures'

// The nightclub's LED windows: every window shows the same colour of the
// rainbow, and on every kick they all move on to the next colour together
// and flash (clubBeat.ts). Between kicks each of the club's tracks (a new
// one every night) plays the lights its own way (LOOKS). The big front window is a grid of LED cells in that
// same colour. Dark by day and while closed. Two shared materials, kept out of
// Batch by `live`, so the cost is the same for any number of windows.

export const RAINBOW = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#00b0ff', '#d500f9']

// The lights are worked out for the moment the frame reaches the screen,
// about one frame after it's drawn, so they show with the note you hear.
export const SHOWN_MS = 16
export const shownNow = () => performance.now() + SHOWN_MS

// How each track plays the lights between kicks, as how much each part of the
// music flashes them: w for the upper windows (and the Vanguard penthouse), f
// for the big front LED window. The colour itself only moves on the kick.
type Look = { w: Partial<Record<CueKind, number>>; f: Partial<Record<CueKind, number>> }
export const LOOKS: Look[] = [
  // Deep: the windows swell with the rolling bass; the front breathes with the organ chords.
  { w: { kick: 1.5, bass: 0.7 }, f: { kick: 1, bass: 0.5, stab: 0.8 } },
  // Piano: the front window sparkles on every piano chord.
  { w: { kick: 1.5, stab: 0.4 }, f: { kick: 0.7, stab: 1.6 } },
  // Garage: the windows pop on the claps; the front flutters with the swung hats.
  { w: { kick: 1.4, clap: 1 }, f: { kick: 0.7, hat: 1.1, open: 0.6, clap: 0.5 } },
  // Acid: the front strobes with the squelchy line, hardest on its accents.
  { w: { kick: 1.4, acid: 0.5 }, f: { kick: 0.7, acid: 1.6 } },
  // Disco: the off-beat open hats pump the windows; the front flashes on the chopped chords.
  { w: { kick: 1.3, open: 0.9 }, f: { kick: 0.7, stab: 1.4, open: 0.4 } },
  // Tech: the front window rolls with the off-beat bass; the windows tick with the hats.
  { w: { kick: 1.4, hat: 0.7 }, f: { kick: 0.7, bass: 1.3, stab: 0.6 } },
  // Electro swing: the windows bounce on the off-beat piano; the front plays the trumpet line.
  { w: { kick: 1.4, stab: 0.7, clap: 0.5 }, f: { kick: 0.7, lead: 1.3, stab: 0.5 } },
  // Trance: the front races with the arpeggio; the windows pump on the rolling bass.
  { w: { kick: 1.5, bass: 0.4 }, f: { kick: 0.6, lead: 1.2, open: 0.3 } },
  // Liquid drum and bass: the windows crack on the snares; the front glows with the keys and bells.
  { w: { kick: 1.5, clap: 1.2 }, f: { kick: 0.8, stab: 0.9, lead: 0.7 } },
  // Dubstep: the front throbs with the wobble; the snare slams the windows.
  { w: { kick: 1.6, clap: 1.3 }, f: { kick: 0.9, bass: 1.4 } },
  // Synthwave: the windows glow with the pads; the front follows the melody.
  { w: { kick: 1.4, stab: 0.6, clap: 0.6 }, f: { kick: 0.6, lead: 1.4 } },
  // Reggaeton: the windows bounce on the dembow; the front plinks with the hook.
  { w: { kick: 1.3, clap: 0.9 }, f: { kick: 0.7, lead: 1.3, clap: 0.4 } },
  // Hardstyle: everything hits on the kick; the front screams with the lead.
  { w: { kick: 1.7, bass: 0.3 }, f: { kick: 1.2, lead: 1 } },
  // Amapiano: the windows bounce with the log drum; the front rings with the marimba.
  { w: { kick: 1.3, bass: 0.9 }, f: { kick: 0.6, lead: 1.2, stab: 0.5 } },
]
// No groove (the muted pulse, Rave Mode): the kick alone.
const KICK: Look = { w: { kick: 1.6 }, f: { kick: 1.4 } }

const lookOf = (p: ClubPulse) => LOOKS[p.groove] ?? KICK
// Reduce flashing: a steady glow, no flashes (flashing.ts).
const CALM_GLOW = 0.3
function flashOf(p: ClubPulse, mix: Partial<Record<CueKind, number>>) {
  if (calmFlashing()) return CALM_GLOW
  let v = 0
  for (const k of CUES) v += (mix[k] ?? 0) * p.env[k]
  // Rave Mode's drop flashes everything.
  return Math.max(v, p.groove < 0 ? 1.6 * p.flash : 0)
}

// The colour the club's windows show right now, and how brightly (0 by day,
// about 0.75 at night between notes, up to about 2.3 on a kick). Anything that
// lights up with the club (the Vanguard Tower's penthouse) reads it here so it
// shows the exact same colour on the same beat. Tag such a material
// `userData.clubLed` so clubLeds.test.tsx checks it stays in step.
export function clubLedColor(out = new Color(), now = shownNow()) {
  const step = clubPulse(now).step
  // Reduce flashing moves the colour on every fourth kick (once a bar), not every kick.
  return out.set(RAINBOW[(calmFlashing() ? Math.floor(step / 4) : step) % RAINBOW.length])
}
export function clubLedGlow(now = shownNow()) {
  const lit = isNight() ? nightAmount(dayPhase()) : 0
  const p = clubPulse(now)
  return lit * (0.75 + flashOf(p, lookOf(p).w))
}

export const ledWindow = new MeshStandardMaterial({ map: windowTex(), emissiveMap: ledPaneTex(), emissive: new Color('#000000'), emissiveIntensity: 1 })
ledWindow.userData.live = true
ledWindow.userData.clubLed = true

export const ledFront = new MeshStandardMaterial({ map: ledGridTex(false), emissiveMap: ledGridTex(true), emissive: new Color('#000000'), emissiveIntensity: 1, roughness: 0.35 })
ledFront.userData.live = true
ledFront.userData.clubLed = true

const tmp = new Color()

// Once a frame (ClubLife).
export function driveClubLeds(now = shownNow()) {
  const p = clubPulse(now)
  const lit = isNight() ? nightAmount(dayPhase()) : 0
  const look = lookOf(p)
  clubLedColor(tmp, now)
  ledWindow.emissive.copy(tmp).multiplyScalar(lit * (0.75 + flashOf(p, look.w)))
  ledFront.emissive.copy(tmp).multiplyScalar(lit * (0.9 + flashOf(p, look.f)))
}
