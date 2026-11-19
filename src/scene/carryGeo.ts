import { BoxGeometry, BufferAttribute, CapsuleGeometry, ConeGeometry, CylinderGeometry, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, SphereGeometry, TorusGeometry, type BufferGeometry, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { at, headParts, paint } from './peopleGeo'

// What townspeople carry out of the shops, and the arms they carry it with.
// Every item is in one instanced geometry and each person shows just theirs
// (a per-instance `pick` hides the rest in the vertex shader), and the body and
// hands hold both arm poses the same way (a per-instance `carry`), so carrying
// costs no extra draws. Sizes are the townspeople's own model units: a figure
// is ~0.69 tall and ~0.17 across the shoulders before the town draws it 1.3x.

// Tag every vertex of a part with a number the shader picks by.
function mark(g: BufferGeometry, name: string, v: number) {
  g.setAttribute(name, new BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(v), 1))
  return g
}
const merged = (parts: BufferGeometry[], name: string, v: number) => parts.map((g) => mark(g, name, v))

// Arms: 1 hanging at the sides, 2 held out in front (carrying something in both hands).
const DOWN = 1
const HOLD = 2
// Shoulder, in the torso's frame, and how far the held arms reach forward from straight down.
const SHOULDER = 0.128
const REACH = Math.PI / 3
const ARM = 0.196
// Where held hands end up, in the torso's frame (the head's is 0.21 higher).
export const HELD = { x: 0.092, y: SHOULDER - ARM * Math.cos(REACH), z: ARM * Math.sin(REACH) }

export function torsoCarryGeo() {
  return mergeGeometries([
    ...merged([paint(new CapsuleGeometry(0.085, 0.16, 3, 10), '#ffffff'), paint(at(new CylinderGeometry(0.088, 0.088, 0.022, 10, 1, true), 0, -0.085, 0), '#3a3a3a')], 'pose', 0),
    ...merged([-1, 1].map((s) => paint(at(new CapsuleGeometry(0.028, 0.14, 2, 6), s * 0.107, 0.03, 0, s * 0.12), '#f2f2f2')), 'pose', DOWN),
    // Held out: from the shoulder, forward and a touch inwards.
    ...merged([-1, 1].map((s) => paint(new CapsuleGeometry(0.028, 0.14, 2, 6).translate(0, -ARM / 2, 0).rotateX(-REACH).rotateZ(s * 0.06).translate(s * 0.104, SHOULDER, 0), '#f2f2f2')), 'pose', HOLD),
  ])!
}

// The head carries the hands (see peopleGeo): hanging, or out in front holding on.
export function headCarryGeo() {
  const head = headParts(false)
  const hand = (x: number, y: number, z: number) => paint(at(new SphereGeometry(0.026, 6, 5), x, y, z), '#ffffff')
  const dy = -(0.36 - 0.15) // torso frame to head frame
  return mergeGeometries([
    ...merged(head, 'pose', 0),
    ...merged([-1, 1].map((s) => hand(s * 0.118, -0.285, 0.005)), 'pose', DOWN),
    ...merged([-1, 1].map((s) => hand(s * HELD.x, HELD.y + dy - 0.012, HELD.z + 0.008)), 'pose', HOLD),
  ])!
}

// Items, by id. `side`: hung from one hand at the side (a suitcase), else held out in front in both.
type Item = { id: number; side?: boolean; parts: () => BufferGeometry[] }
const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) => paint(new BoxGeometry(w, h, d).translate(x, y, z), c)
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, c: string, seg = 10) => paint(new CylinderGeometry(rt, rb, h, seg).translate(x, y, z), c)
const ball = (r: number, x: number, y: number, z: number, c: string) => paint(new SphereGeometry(r, 8, 6).translate(x, y, z), c)
// A paper bag with its top folded over.
const bag = (w: number, h: number, d: number, c: string, fold: string) => [box(w, h, d, 0, 0, 0, c), box(w + 0.004, 0.018, d + 0.004, 0, h / 2 - 0.02, 0, fold)]

const ITEM_LIST: Record<string, Item> = {
  // A pizza box with the shop's red roundel on the lid.
  pizza: { id: 0, parts: () => [box(0.2, 0.034, 0.2, 0, 0, 0, '#ecd9b4'), box(0.202, 0.004, 0.202, 0, 0.004, 0, '#c9b089'), cyl(0.045, 0.045, 0.003, 0, 0.018, 0, '#d84315', 14)] },
  // Pink donut box, a window in the lid showing two glazed donuts.
  donut: { id: 1, parts: () => [box(0.17, 0.06, 0.12, 0, 0, 0, '#f48fb1'), box(0.11, 0.003, 0.07, 0, 0.031, 0, '#fff8e1'), ...[-0.03, 0.03].map((x) => paint(new TorusGeometry(0.018, 0.009, 6, 10).rotateX(Math.PI / 2).translate(x, 0.034, 0), '#c77d3a'))] },
  // White takeout carton with its wire handle.
  diner: { id: 2, parts: () => [paint(new CylinderGeometry(0.06, 0.045, 0.09, 4).rotateY(Math.PI / 4).translate(0, 0, 0), '#fafafa'), box(0.06, 0.004, 0.012, 0, 0.046, 0, '#e0e0e0'), paint(new TorusGeometry(0.035, 0.003, 4, 10, Math.PI).translate(0, 0.045, 0), '#9e9e9e'), box(0.026, 0.026, 0.002, 0, 0, 0.0395, '#c62828')] },
  // Paper coffee cup: sleeve and lid.
  coffee: { id: 3, parts: () => [cyl(0.03, 0.023, 0.1, 0, 0, 0, '#fafafa'), cyl(0.0285, 0.026, 0.035, 0, -0.005, 0, '#8d6e63'), cyl(0.033, 0.033, 0.012, 0, 0.054, 0, '#3e2723')] },
  // A cold drink with a straw.
  gas: { id: 4, parts: () => [cyl(0.032, 0.024, 0.11, 0, 0, 0, '#29b6f6'), cyl(0.033, 0.033, 0.008, 0, 0.058, 0, '#fafafa'), paint(new CylinderGeometry(0.004, 0.004, 0.08, 5).rotateZ(0.2).translate(0.006, 0.09, 0), '#e53935')] },
  // Striped popcorn bucket, heaped.
  cinema: { id: 5, parts: () => [cyl(0.05, 0.036, 0.11, 0, 0, 0, '#e53935', 12), ...[0, 1, 2, 3, 4, 5].map((i) => paint(new BoxGeometry(0.014, 0.11, 0.004).translate(0, 0, 0.044).rotateY((i * Math.PI) / 3), '#fafafa')), ...[[0, 0], [0.02, 0.015], [-0.02, 0.012], [0.012, -0.02], [-0.016, -0.016]].map(([x, z], i) => ball(0.02, x, 0.06 + (i ? 0 : 0.012), z, '#fff3b0'))] },
  // Bowling ball, hung from a finger grip.
  bowling: { id: 6, side: true, parts: () => [ball(0.05, 0, -0.05, 0, '#6a1b9a'), ...[[-0.012, 0], [0.012, 0], [0, 0.018]].map(([x, y]) => paint(new CylinderGeometry(0.007, 0.007, 0.006, 6).rotateX(Math.PI / 2).translate(x, -0.05 + y, 0.048), '#1a1a1a'))] },
  // Suitcase: handle, corner bumpers, a luggage strap.
  motel: { id: 7, side: true, parts: () => [box(0.16, 0.12, 0.05, 0, -0.08, 0, '#795548'), box(0.045, 0.012, 0.012, 0, -0.012, 0, '#3e2723'), box(0.012, 0.122, 0.052, 0.04, -0.08, 0, '#5d4037'), box(0.012, 0.122, 0.052, -0.04, -0.08, 0, '#5d4037'), box(0.162, 0.01, 0.052, 0, -0.135, 0, '#3e2723')] },
  // Waffle cone with a pink scoop and a cherry.
  icecream: { id: 8, parts: () => [paint(new ConeGeometry(0.022, 0.07, 8).rotateX(Math.PI).translate(0, -0.01, 0), '#d7a35c'), ball(0.028, 0, 0.032, 0, '#f48fb1'), ball(0.008, 0, 0.062, 0, '#c62828')] },
  // Two tacos in a cardboard tray.
  tacos: { id: 9, parts: () => [box(0.14, 0.02, 0.09, 0, -0.01, 0, '#d7b98e'), ...[-0.032, 0.032].flatMap((x) => [paint(new CylinderGeometry(0.03, 0.03, 0.08, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(x, 0.024, 0), '#ffca28'), box(0.012, 0.012, 0.07, x, 0.03, 0, '#66bb6a')])] },
  // Grocery bag with a baguette and greens poking out.
  market: { id: 10, parts: () => [...bag(0.13, 0.15, 0.09, '#c8a165', '#a8834a'), paint(new CylinderGeometry(0.014, 0.014, 0.1, 6).rotateZ(0.25).translate(0.03, 0.075, 0), '#e0b16a'), ball(0.026, -0.03, 0.08, 0.01, '#43a047'), ball(0.022, -0.005, 0.085, -0.02, '#7cb342')] },
  // Hot dog in a bun with a line of mustard.
  hotdog: { id: 11, parts: () => [paint(new CapsuleGeometry(0.018, 0.08, 3, 8).rotateZ(Math.PI / 2), '#e0a052'), paint(new CapsuleGeometry(0.011, 0.1, 3, 6).rotateZ(Math.PI / 2).translate(0, 0.012, 0), '#a1442a'), box(0.09, 0.004, 0.006, 0, 0.024, 0, '#fdd835')] },
  // Briefcase with brass clasps.
  offices: { id: 12, side: true, parts: () => [box(0.16, 0.11, 0.04, 0, -0.075, 0, '#4e342e'), box(0.05, 0.012, 0.012, 0, -0.012, 0, '#3e2723'), ...[-0.05, 0.05].map((x) => box(0.016, 0.01, 0.004, x, -0.03, 0.021, '#c9a227'))] },
  // Burgers in a striped paper bag.
  burger: { id: 13, parts: () => [...bag(0.12, 0.13, 0.08, '#fafafa', '#e0e0e0'), box(0.122, 0.03, 0.082, 0, -0.02, 0, '#e53935')] },
}
export const ITEM_SHAPES: Record<string, { id: number; side: boolean }> = Object.fromEntries(Object.entries(ITEM_LIST).map(([k, v]) => [k, { id: v.id, side: !!v.side }]))

export function itemsGeo() {
  return mergeGeometries(Object.values(ITEM_LIST).flatMap((it) => merged(it.parts(), 'shape', it.id)))!
}

// A vertex-coloured material that hides what this instance doesn't show:
// parts whose `shape` isn't the instance's `pick`, or the arm pose it isn't in.
const HIDE = {
  pose: { vert: 'attribute float pose;\nattribute float carry;', test: '(pose > 0.5 && pose < 1.5 && carry > 0.5) || (pose > 1.5 && carry < 0.5)' },
  shape: { vert: 'attribute float shape;\nattribute float pick;', test: 'abs(shape - pick) > 0.5' },
}
function hiding<M extends Material>(m: M, by: keyof typeof HIDE): M {
  const h = HIDE[by]
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\n${h.vert}`).replace('#include <begin_vertex>', `#include <begin_vertex>\nif (${h.test}) transformed = vec3(0.0);`)
  }
  m.customProgramCacheKey = () => `hide-${by}`
  return m
}
export const poseMaterial = () => hiding(new MeshStandardMaterial({ vertexColors: true }), 'pose')
// Its shadow, so the hidden arms cast none.
export const poseDepth = () => hiding(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), 'pose')
export const itemMaterial = () => hiding(new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), 'shape')
