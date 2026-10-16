import { BufferAttribute, CapsuleGeometry, Color, CylinderGeometry, InstancedBufferAttribute, MeshStandardMaterial, SphereGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HAIR, SKIN } from './people'
import { at, headParts, paint } from './peopleGeo'

// The nightclub's people (the bouncer at the rope and the rooftop dancers),
// built from the townspeople's own parts so they look as detailed as the
// people walking past. Dancers need arms that move, so each arm is its own
// instance (sleeve, bare arm and hand) swinging from the shoulder, and the
// hair rides the head. Figure 0 is always the bouncer: bald, shades and an
// earpiece. Two tints per figure (shirt and skin on an arm, skin and hair on
// a head) and the bouncer-only parts come from per-instance attributes the
// material reads, so the club still draws in four calls.

// Room for the bouncer and the most dancers a club ever has.
export const CLUB_FIGURES = 16

// Which tint a vertex takes (the `part` attribute): the instance colour, the
// `alt` colour, its own colour only on the bouncer, or `alt` on everyone else.
const OWN = 0
const ALT = 1
const BOUNCER = 2
const NOT_BOUNCER = 3

const tag = (g: BufferGeometry, part: number) => {
  const n = g.getAttribute('position').count
  g.setAttribute('part', new BufferAttribute(new Float32Array(n).fill(part), 1))
  return g
}

// The same skin for a figure's head and both arms.
export const skinOf = (i: number) => (i === 0 ? '#a86f4c' : SKIN[(i * 7) % SKIN.length])

// Shoulder to hand, hanging down from the shoulder at the origin: a short
// sleeve (shirt), the bare arm and a hand (skin). The bouncer's waving arm
// wears door staff's hi-vis band round the sleeve, so he reads at night.
export const ARM_LEN = 0.2
export function clubArmGeo() {
  const g = mergeGeometries([
    tag(paint(new SphereGeometry(0.036, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff'), OWN),
    tag(paint(at(new CylinderGeometry(0.036, 0.032, 0.07, 8, 1, true), 0, -0.035, 0), '#ffffff'), OWN),
    tag(paint(at(new CapsuleGeometry(0.025, 0.15, 2, 7), 0, -0.1, 0), '#ffffff'), ALT),
    tag(paint(new SphereGeometry(0.027, 7, 5).scale(0.9, 1.15, 0.75).translate(0, -ARM_LEN, 0.004), '#f4f4f4'), ALT),
    tag(paint(at(new CylinderGeometry(0.0375, 0.0365, 0.024, 10, 1, true), 0, -0.046, 0), '#ffd23f'), BOUNCER),
  ])!
  return looks(g, CLUB_FIGURES * 2, (i) => ({ alt: skinOf(i >> 1), bouncer: i === 1 }))
}

// The townsperson's head (face, ears, neck), with hair on top, and the
// bouncer's shades and earpiece with its coiled wire.
export function clubHeadGeo() {
  const g = mergeGeometries([
    ...headParts(false).map((p) => tag(p, OWN)),
    tag(paint(new SphereGeometry(0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.025, -0.02), '#ffffff'), NOT_BOUNCER),
    // Wraparound shades: a dark lens band across the eyes and thin arms back to the ears.
    tag(paint(new CylinderGeometry(0.086, 0.084, 0.024, 18, 1, true, -0.68, 1.36).translate(0, 0.014, 0), '#0c0c10'), BOUNCER),
    tag(paint(new CylinderGeometry(0.0825, 0.0825, 0.006, 20, 1, true, -1.5, 3.0).translate(0, 0.02, 0), '#0c0c10'), BOUNCER),
    // An earpiece in the right ear, its clear coil running down into the collar.
    tag(paint(at(new SphereGeometry(0.011, 6, 4), 0.093, -0.006, 0.01), '#141414'), BOUNCER),
    tag(paint(new CylinderGeometry(0.0035, 0.0035, 0.085, 5).rotateZ(-0.35).translate(0.081, -0.05, -0.006), '#dfe6ea'), BOUNCER),
  ])!
  return looks(g, CLUB_FIGURES, (i) => ({ alt: i === 0 ? SKIN[0] : HAIR[(i * 5 + 1) % HAIR.length], bouncer: i === 0 }))
}

const col = new Color()
function looks(g: BufferGeometry, n: number, of: (i: number) => { alt: string; bouncer: boolean }) {
  const a = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const l = of(i)
    col.set(l.alt)
    a.set([col.r, col.g, col.b, l.bouncer ? 1 : 0], i * 4)
  }
  g.setAttribute('alt', new InstancedBufferAttribute(a, 4))
  return g
}

// Vertex colours times the right tint; the parts a figure doesn't wear fold
// away to nothing.
export function clubFigureMat() {
  const m = new MeshStandardMaterial({ vertexColors: true })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nattribute vec4 alt;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if ((part > ${BOUNCER - 0.5} && part < ${BOUNCER + 0.5} && alt.w < 0.5) || (part > ${NOT_BOUNCER - 0.5} && alt.w > 0.5)) transformed = vec3(0.0);`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        if (part > ${BOUNCER - 0.5} && part < ${BOUNCER + 0.5}) vColor.xyz = color.xyz;
        else if (part > ${ALT - 0.5}) vColor.xyz = color.xyz * alt.xyz;`,
      )
  }
  m.customProgramCacheKey = () => 'club-figure'
  return m
}
