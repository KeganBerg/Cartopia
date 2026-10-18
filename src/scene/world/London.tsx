import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, IcosahedronGeometry, PlaneGeometry, SphereGeometry, type BufferGeometry, type Group } from 'three'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Sparkles, Water, archTop, frustum, gable, glow, person, prop, rand, useProp, type Built, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// UK, Clocktower Embankment: a night race along the river. Left: Georgian terraces in brick and
// pastel stucco with black railings and bright doors, corner pubs with hanging signs and flower
// baskets, little shops under striped awnings, an underground station with its roundel, then the
// long Gothic palace with its great clock tower and the square royal tower; further on the royal
// palace behind its gilded gates with guards in red tunics and bearskins, and a covered market
// with its stalls. Behind: mansion blocks, white stucco crescents, a steepled church, stone
// offices and a sea of slate roofs and chimney pots. Black cabs and red buses at the kerb, red
// phone and pillar boxes, people in coats under umbrellas. Right: the embankment wall, plane trees
// and dolphin lamps, river cruisers and river buses, and across the water the far bank's wharves,
// theatres and towers, the giant observation wheel and the white keep of the castle; ahead the
// twin-towered bascule bridge, the cathedral dome and the glass towers of the city.

const SANDSTONE: Look = { c: '#d6c08c', r: 0.85 }
const SAND_D: Look = { c: '#b9a272', r: 0.9 }
const SLATE: Look = { c: '#4f5b5c', r: 0.6, m: 0.2 }
const WIN: Look = { c: '#ffffff', use: glowMats.window }
const WARM = glow('#ffd889', 0.15, 1.6)
const IRON: Look = { c: '#1d2022', r: 0.5, m: 0.5 }
const GOLD: Look = { c: '#d9a83a', r: 0.3, m: 0.7 }
const RED: Look = { c: '#c8102e', r: 0.45 }
const WHITE: Look = { c: '#f2efe8', r: 0.7 }
// Satin cast iron for the props repeated down the mile: plain finishes, so they fold
// into each prop's one painted mesh instead of costing a draw of their own in every stretch.
const IRON_P: Look = { c: '#1d2022', r: 0.55, m: 0.2 }
const GRANITE: Look = { c: '#8f8a80', r: 0.9 }
const BRONZE: Look = { c: '#4a5440', r: 0.55, m: 0.2 }
// Gilding that stays plain (no metal), for the repeated props.
const GILT: Look = { c: '#d8ab45', r: 0.4 }
const DARK: Look = { c: '#1a1a1c', r: 0.8 }
const PORTLAND: Look = { c: '#e4ddcb', r: 0.85 }
const PORT_D: Look = { c: '#c9c0aa', r: 0.9 }
const LEAD: Look = { c: '#6b7378', r: 0.6 }
const LEAF = ['#3f5f34', '#4a6b3b', '#36532e']

// Where things stand. Left (+x): the pavement, the front row from FRONT, the back gardens, the
// back row from BACK, the roofs beyond. Right (-x): the embankment, the river, the far bank at FB.
const FRONT = EDGE + 1.9
const BACK = EDGE + 9.9
const RX = -(EDGE + 1.6)
const FB = -38

// The same PropKit, moved (dx, dz), turned ry, scaled sc and lifted dy, so a piece built at its
// own origin can be dropped into a bigger prop (a pair of houses, a child among adults).
const sphGeos = new Map<string, SphereGeometry>()
const icoGeos = new Map<number, IcosahedronGeometry>()
function xf(k: PropKit, dx: number, dz: number, ry = 0, sc = 1, dy = 0): PropKit {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const P = (p: V3): V3 => [dx + (p[0] * c + p[2] * s) * sc, dy + p[1] * sc, dz + (-p[0] * s + p[2] * c) * sc]
  const R = (r?: V3): V3 => (r ? [r[0], r[1] + ry, r[2]] : [0, ry, 0])
  const S = (v: V3): V3 => [v[0] * sc, v[1] * sc, v[2] * sc]
  const o = {
    add: (l: Look, g: BufferGeometry, p: V3, r?: V3, sz: V3 = [1, 1, 1]) => (k.add(l, g, P(p), R(r), S(sz)), o),
    box: (l: Look, sz: V3, p: V3, r?: V3) => (k.box(l, S(sz), P(p), R(r)), o),
    cyl: (l: Look, rt: number, rb: number, h: number, p: V3, r?: V3, n = 10) => (k.cyl(l, rt * sc, rb * sc, h * sc, P(p), R(r), n), o),
    rod: (l: Look, a: V3, b: V3, rad: number, n = 6) => (k.rod(l, P(a), P(b), rad * sc, n), o),
    sphere: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], w = 10, h = 6, cap = Math.PI) => {
      const key = `${w}|${h}|${cap}`
      let g = sphGeos.get(key)
      if (!g) sphGeos.set(key, (g = new SphereGeometry(1, w, h, 0, Math.PI * 2, 0, cap)))
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    ico: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], detail = 1) => {
      let g = icoGeos.get(detail)
      if (!g) {
        icoGeos.set(detail, (g = new IcosahedronGeometry(1, detail)))
        g.computeVertexNormals()
      }
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    cone: (l: Look, rad: number, h: number, p: V3, r?: V3, n = 10) => (k.cone(l, rad * sc, h * sc, P(p), R(r), n), o),
    torus: (l: Look, R0: number, t: number, p: V3, r?: V3, arc?: number, seg?: number, tube?: number) => (k.torus(l, R0 * sc, t * sc, P(p), R(r), arc, seg, tube), o),
  }
  return o as unknown as PropKit
}

// A flat pane facing +z (turned ry): glass, frames and lettering that are only ever seen from
// the front, 4 corners instead of a box's 24.
const QUAD = new PlaneGeometry(1, 1)
// A little lumpy ball (flowers, fruit, leaves in a window box), 24 corners.
const BLOB = new SphereGeometry(1, 5, 3)
const blob = (k: PropKit, look: Look, r: number, p: V3, sy = 1) => k.add(look, BLOB, p, [0, 0, 0], [r, r * sy, r])
// An iron railing bar, seen from the front: a pane, with a diamond pane for its gilt tip.
function bar(k: PropKit, look: Look, w: number, h: number, p: V3, tip?: Look) {
  pane(k, look, w, h, p)
  if (tip) k.add(tip, QUAD, [p[0], p[1] + h / 2, p[2] + 0.002], [0, 0, Math.PI / 4], [w * 1.6, w * 1.6, 1])
}
function pane(k: PropKit, look: Look, w: number, h: number, p: V3, ry = 0) {
  k.add(look, QUAD, p, [0, ry, 0], [w, h, 1])
}

// Shop, pub and station names in a little blocky type, each pixel row merged into one bar. Reads
// along +x (turned by ry), facing +z, centred on p.
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  W: '101101111111101', X: '101101010101101', Y: '101101010010010', '1': '010110010010111', '2': '110001010100111', '7': '111001010010010',
}
function text(k: PropKit, look: Look, str: string, p: V3, px: number, ry = 0) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const W = str.length * 4 - 1
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]]
    if (!g) continue
    for (let row = 0; row < 5; row++) {
      let col = 0
      while (col < 3) {
        if (g[row * 3 + col] !== '1') {
          col++
          continue
        }
        let e = col
        while (e < 3 && g[row * 3 + e] === '1') e++
        const u = (i * 4 + (col + e) / 2 - W / 2) * px
        pane(k, look, (e - col) * px, px, [p[0] + u * c, p[1] + (2 - row) * px, p[2] - u * s], ry)
        col = e
      }
    }
  }
}

// A pointed Gothic window opening, lit, in a stone frame, facing +z on a face at z = f.
function lancet(k: PropKit, x: number, y: number, f: number, w: number, h: number) {
  k.box(SAND_D, [w + 0.1, h + 0.06, 0.04], [x, y + h / 2, f + 0.005])
  k.box(WIN, [w, h, 0.03], [x, y + h / 2, f + 0.012])
  k.box(WIN, [w * 0.72, w * 0.72, 0.03], [x, y + h, f + 0.012], [0, 0, Math.PI / 4])
  k.box(SANDSTONE, [0.03, h + w * 0.4, 0.04], [x, y + h / 2 + 0.1, f + 0.02])
  // Tracery: a transom and a hood mould over the point.
  k.box(SANDSTONE, [w, 0.03, 0.04], [x, y + h * 0.55, f + 0.02])
  k.box(SAND_D, [w * 0.8, 0.05, 0.05], [x - w * 0.275, y + h + w * 0.275, f + 0.03], [0, 0, Math.PI / 4])
  k.box(SAND_D, [w * 0.8, 0.05, 0.05], [x + w * 0.275, y + h + w * 0.275, f + 0.03], [0, 0, -Math.PI / 4])
}

// One bay of the palace front, 3 wide, facing +z: buttresses with pinnacles, two storeys of
// tall lit windows, carved panels between, a pierced parapet and the steep slate roof.
function palaceBay(k: PropKit) {
  const W = 3
  const H = 6
  const f = 2
  k.box(SANDSTONE, [W, H, 4], [0, H / 2, 0])
  for (const s of [-1, 1]) {
    k.box(SANDSTONE, [0.3, H + 0.4, 0.3], [s * (W / 2 - 0.15), (H + 0.4) / 2, f + 0.1])
    frustum(k, SANDSTONE, 0.3, 0.3, 1.1, 0, [s * (W / 2 - 0.15), H + 0.4, f + 0.1])
    // Little pinnacles at the buttress's shoulders.
    for (const t of [-1, 1]) frustum(k, SANDSTONE, 0.1, 0.1, 0.5, 0, [s * (W / 2 - 0.15) + t * 0.19, H + 0.25, f + 0.1])
  }
  for (const x of [-0.75, 0, 0.75]) {
    lancet(k, x, 0.8, f, 0.36, 1.6)
    lancet(k, x, 3.4, f, 0.36, 1.6)
    for (let i = 0; i < 3; i++) k.box(SAND_D, [0.36, 0.05, 0.03], [x, 2.75 + i * 0.18, f + 0.008])
  }
  k.box(SAND_D, [W, 0.1, 0.1], [0, 2.6, f + 0.04])
  k.box(SAND_D, [W, 0.14, 0.14], [0, H, f + 0.05])
  for (let i = 0; i < 6; i++) k.box(SANDSTONE, [0.22, 0.35, 0.12], [-W / 2 + 0.25 + i * 0.5, H + 0.25, f - 0.02])
  frustum(k, SLATE, W, 3.4, 2.2, 0.3, [0, H, -0.2])
  for (let i = 0; i < 6; i++) k.cyl(IRON, 0.02, 0.02, 0.4, [-W / 2 + 0.25 + i * 0.5, H + 2.4, -0.2], undefined, 4)
}

// The great clock tower: a tall shaft of panelled stone, the four lit clock faces, the belfry
// and the gilded spire.
function clockTower(k: PropKit) {
  const w = 3
  k.box(SAND_D, [w + 0.4, 1.2, w + 0.4], [0, 0.6, 0])
  k.box(SANDSTONE, [w, 15, w], [0, 8.7, 0])
  for (const [dx, dz] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    for (let i = 0; i < 6; i++) {
      const y = 2.2 + i * 2.1
      for (const t of [-0.75, 0, 0.75]) k.box(i % 2 ? WIN : SAND_D, [dz ? 0.32 : 0.03, 1.4, dz ? 0.03 : 0.32], [dx * (w / 2 + 0.005) + (dz ? t : 0), y, dz * (w / 2 + 0.005) + (dx ? t : 0)])
    }
    for (const t of [-1.3, 1.3]) k.box(SANDSTONE, [dz ? 0.22 : 0.18, 15, dz ? 0.18 : 0.22], [dx * (w / 2 + 0.06) + (dz ? t : 0), 8.7, dz * (w / 2 + 0.06) + (dx ? t : 0)])
  }
  // Clock stage, wider, with a lit face on each side.
  k.box(SANDSTONE, [w + 0.7, 3.6, w + 0.7], [0, 18, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    const cx = dx * ((w + 0.7) / 2 + 0.02)
    const cz = dz * ((w + 0.7) / 2 + 0.02)
    k.box(GOLD, [3.2, 3.2, 0.04], [cx, 18, cz], [0, ry, 0])
    k.cyl(WARM, 1.35, 1.35, 0.04, [cx + dx * 0.02, 18, cz + dz * 0.02], [Math.PI / 2, ry, 0], 28)
    k.torus(IRON, 1.35, 0.06, [cx + dx * 0.04, 18, cz + dz * 0.04], [0, ry, 0], Math.PI * 2, 28, 4)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 1.15
      k.box(IRON, [0.06, 0.2, 0.02], [cx + dx * 0.05 + (dz ? Math.sin(a) * r : 0), 18 + Math.cos(a) * r, cz + dz * 0.05 + (dx ? Math.sin(a) * r : 0)], [0, ry, -a])
    }
    k.box(IRON, [0.07, 0.95, 0.02], [cx + dx * 0.06, 18.42, cz + dz * 0.06], [0, ry, 0])
    k.box(IRON, [0.07, 0.65, 0.02], [cx + dx * 0.06 + (dz ? 0.25 : 0), 18.1, cz + dz * 0.06 + (dx ? -0.25 : 0)], [0, ry, dz ? -1.2 : 1.2])
  }
  k.box(SAND_D, [w + 0.9, 0.3, w + 0.9], [0, 19.9, 0])
  // Belfry with pointed openings, the steep iron spire with its gables and the gilded finial.
  k.box(SANDSTONE, [w + 0.3, 2.2, w + 0.3], [0, 21.1, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    for (const t of [-0.9, 0, 0.9]) {
      const x = dx * ((w + 0.3) / 2 + 0.005) + (dz ? t : 0)
      const z = dz * ((w + 0.3) / 2 + 0.005) + (dx ? t : 0)
      k.box({ c: '#2a2a2a', r: 1 }, [dz ? 0.5 : 0.03, 1.2, dz ? 0.03 : 0.5], [x, 21.0, z])
      archTop(k, { c: '#2a2a2a', r: 1 }, 0.5, 0.03, [x, 21.6, z], ry)
    }
    k.box(SLATE, [dz ? 1.2 : 0.6, 1.2, dz ? 0.6 : 1.2], [dx * 1.2, 22.8, dz * 1.2])
  }
  frustum(k, SLATE, w + 0.3, w + 0.3, 6.5, 0.12, [0, 22.2, 0])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(SANDSTONE, [0.3, 1.6, 0.3], [sx * 1.7, 20.8, sz * 1.7])
    frustum(k, GOLD, 0.3, 0.3, 1.0, 0, [sx * 1.7, 21.6, sz * 1.7])
  }
  k.box(GOLD, [0.5, 0.8, 0.5], [0, 29.1, 0])
  frustum(k, GOLD, 0.35, 0.35, 1.8, 0, [0, 29.5, 0])
  k.cyl(GOLD, 0.03, 0.03, 1.0, [0, 31.6, 0], undefined, 5)
}

// The square royal tower at the palace's far end, with corner turrets.
function royalTower(k: PropKit) {
  const w = 5.4
  k.box(SANDSTONE, [w, 20, w], [0, 10, 0])
  k.box(SAND_D, [3, 4.6, 0.1], [0, 2.3, w / 2 + 0.02])
  archTop(k, SAND_D, 3, 0.1, [0, 4.6, w / 2 + 0.02])
  k.box({ c: '#2a2a2a', r: 1 }, [2.4, 4.2, 0.08], [0, 2.1, w / 2 + 0.06])
  for (let i = 0; i < 4; i++) for (const t of [-1.4, 0, 1.4]) lancet(k, t, 6.5 + i * 3.2, w / 2, 0.45, 2.0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cyl(SANDSTONE, 0.55, 0.55, 22.5, [sx * (w / 2), 11.25, sz * (w / 2)], undefined, 8)
    frustum(k, GOLD, 0.8, 0.8, 1.8, 0, [sx * (w / 2), 22.5, sz * (w / 2)])
  }
  for (let i = 0; i < 9; i++) k.box(SANDSTONE, [0.32, 0.6, 0.2], [-w / 2 + 0.6 + i * 0.53, 20.3, w / 2 - 0.08])
  k.cyl(IRON, 0.07, 0.07, 6, [0, 23, 0], undefined, 6)
}

// A white-framed sash window on a face at z = f: frame, lit glass, the meeting rail and the
// glazing bar, and a stone sill.
function sash(k: PropKit, x: number, y: number, h: number, f: number, rail = true) {
  pane(k, WHITE, 0.5, h + 0.08, [x, y + h / 2, f + 0.004])
  pane(k, WIN, 0.42, h, [x, y + h / 2, f + 0.008])
  if (rail) pane(k, WHITE, 0.42, 0.04, [x, y + h / 2, f + 0.012])
  pane(k, WHITE, 0.03, h, [x, y + h / 2, f + 0.012])
  k.box(WHITE, [0.56, 0.05, 0.08], [x, y - 0.03, f + 0.03])
}

// A window box of red and pink geraniums on a sill at (x, y), face at z = f.
function windowBox(k: PropKit, x: number, y: number, f: number) {
  k.box({ c: '#2e4a32', r: 0.8 }, [0.48, 0.1, 0.12], [x, y + 0.05, f + 0.09])
  ;([[-0.15, '#d32f2f'], [0, '#ec6f9a'], [0.15, '#d32f2f']] as const).forEach(([dx, c]) => {
    blob(k, { c: '#3f6b35', r: 1 }, 0.07, [x + dx, y + 0.13, f + 0.09], 0.7)
    blob(k, { c, r: 0.9 }, 0.045, [x + dx + 0.03, y + 0.17, f + 0.12])
  })
}

// The upper floors every terrace house and shop shares, from the string course up: three
// storeys of sashes (iron balconettes or window boxes on the first), the cornice and parapet, a
// slate mansard with its dormer, and the chimney stack with clay pots.
function upper(k: PropKit, brick: Look, W: number, H: number, f: number, boxes: boolean) {
  for (let fl = 0; fl < 3; fl++) for (const x of [-0.55, 0.55]) {
    const y = 1.85 + fl * 1.15
    const h = fl === 2 ? 0.55 : 0.8
    sash(k, x, y, h, f, fl < 2)
    if (fl === 0) {
      if (boxes) windowBox(k, x, y, f)
      else {
        for (let i = 0; i < 3; i++) bar(k, IRON_P, 0.025, 0.28, [x - 0.2 + i * 0.2, y + 0.12, f + 0.16])
        k.box(IRON_P, [0.5, 0.025, 0.025], [x, y + 0.26, f + 0.16])
      }
    }
  }
  k.box(WHITE, [W + 0.06, 0.1, 3.08], [0, H, 0])
  k.box(brick, [W, 0.35, 0.1], [0, H + 0.2, f - 0.05])
  frustum(k, SLATE, W, 2.6, 0.8, 0.3, [0, H, -0.1])
  k.box(SLATE, [0.62, 0.55, 0.6], [0.45, H + 0.42, 0.72])
  pane(k, WIN, 0.4, 0.34, [0.45, H + 0.42, 1.025])
  k.box(SLATE, [0.7, 0.05, 0.66], [0.45, H + 0.72, 0.72])
  k.box(brick, [0.5, 1.0, 0.5], [W / 2 - 0.25, H + 0.5, -0.3])
  for (const [x, h] of [[-0.12, 0.3], [0.1, 0.24]]) k.cyl({ c: '#b5653b', r: 0.9 }, 0.05, 0.065, h, [W / 2 - 0.25 + x, H + 1.0 + h / 2, -0.3], undefined, 5)
}

// A colour darkened to t of itself (door panels in shadow).
const shade = (c: string, t: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

// A terrace house facing +z, 2.2 wide: brick (or a pastel stucco front), a white stucco ground
// floor on the grander ones, a bright panelled door under its fanlight with a brass knob and
// a pillared porch, steps down to the pavement and the area railings with their gate.
type House = { c: string; stucco: boolean; door: string; boxes: boolean }
function terrace(k: PropKit, h: House) {
  const brick: Look = { c: h.c, r: 0.95 }
  const W = 2.2
  const H = 5.4
  const f = 1.5
  k.box(brick, [W, H, 3], [0, H / 2, 0])
  if (h.stucco) k.box(WHITE, [W + 0.02, 1.5, 3.02], [0, 0.75, 0])
  k.box(WHITE, [W + 0.04, 0.12, 3.06], [0, 1.52, 0])
  // The door: panels, fanlight, brass knob and letter plate, a house number.
  const door: Look = { c: h.door, r: 0.35 }
  k.box(door, [0.46, 0.9, 0.04], [-0.5, 0.57, f + 0.01])
  for (const y of [0.4, 0.78]) for (const x of [-0.6, -0.4]) pane(k, { c: shade(h.door, 0.7), r: 0.35 }, 0.13, 0.26, [x, y, f + 0.032])
  k.box(GILT, [0.05, 0.05, 0.03], [-0.36, 0.6, f + 0.04])
  k.box(GILT, [0.14, 0.03, 0.02], [-0.5, 0.62, f + 0.035])
  k.box(WHITE, [0.56, 0.05, 0.06], [-0.5, 1.03, f + 0.02])
  archTop(k, WIN, 0.44, 0.03, [-0.5, 1.055, f + 0.012])
  k.box(WHITE, [0.1, 0.07, 0.01], [-0.5, 1.33, f + 0.006])
  // Door steps out to the pavement.
  k.box({ c: '#d9d4c8', r: 0.9 }, [0.7, 0.12, 0.45], [-0.5, 0.06, f + 0.225])
  if (h.stucco) {
    // Pillared porch: two columns and a cornice over the door.
    for (const s of [-1, 1]) k.cyl(WHITE, 0.06, 0.07, 1.2, [-0.5 + s * 0.33, 0.8, f + 0.38], [0, Math.PI / 4, 0], 6)
    k.box(WHITE, [0.9, 0.14, 0.5], [-0.5, 1.55, f + 0.25])
  }
  pane(k, WHITE, 0.58, 0.83, [0.45, 0.75, f + 0.004])
  pane(k, WIN, 0.5, 0.75, [0.45, 0.75, f + 0.008])
  pane(k, WHITE, 0.03, 0.75, [0.45, 0.75, f + 0.012])
  pane(k, WHITE, 0.5, 0.04, [0.45, 0.85, f + 0.012])
  upper(k, brick, W, H, f, h.boxes)
  // Area railings along the pavement, open at the steps, gold-tipped gate posts.
  for (let i = 0; i < 11; i++) {
    const x = -W / 2 + 0.1 + i * 0.2
    if (x > -0.85 && x < -0.15) continue
    bar(k, IRON_P, 0.025, 0.55, [x, 0.28, f + 0.45])
  }
  for (const x of [-0.85, -0.15]) {
    k.box(IRON_P, [0.05, 0.7, 0.05], [x, 0.35, f + 0.45])
    k.box(GILT, [0.05, 0.05, 0.05], [x, 0.72, f + 0.45], [Math.PI / 4, 0, Math.PI / 4])
  }
  k.box(IRON_P, [0.25, 0.03, 0.03], [-0.975, 0.52, f + 0.45])
  k.box(IRON_P, [1.25, 0.03, 0.03], [0.475, 0.52, f + 0.45])
}
// Houses go up in pairs (one prop, half the draws), never two alike side by side.
const PAIRS: [House, House][] = [
  [{ c: '#8a4b36', stucco: false, door: '#141414', boxes: true }, { c: '#8a4b36', stucco: true, door: '#9b1b2a', boxes: false }],
  [{ c: '#a65b3e', stucco: false, door: '#1f3c5b', boxes: false }, { c: '#c9a86a', stucco: false, door: '#2e5d4b', boxes: true }],
  [{ c: '#7b4535', stucco: true, door: '#141414', boxes: false }, { c: '#b58a5a', stucco: false, door: '#9b1b2a', boxes: true }],
  [{ c: '#e7c4c4', stucco: true, door: '#1f3c5b', boxes: true }, { c: '#c6d8de', stucco: true, door: '#c9a227', boxes: false }],
  [{ c: '#efe2b2', stucco: true, door: '#2e5d4b', boxes: false }, { c: '#7b4535', stucco: false, door: '#141414', boxes: true }],
]

// A pub on the corner, 4.4 wide, facing +z: the painted timber front with its big lit windows
// and gilt name, a lantern each side of the door, flower baskets, a barrel or two to lean on,
// and the hanging sign on its iron bracket.
function pub(k: PropKit, name: string, paint: string, brickC: string, sign: string) {
  const W = 4.4
  const H = 4.8
  const f = 1.5
  const br: Look = { c: brickC, r: 0.95 }
  const pt: Look = { c: paint, r: 0.45 }
  k.box(br, [W, H, 3], [0, H / 2, 0])
  k.box(pt, [W, 1.7, 0.12], [0, 0.85, f + 0.06])
  for (const x of [-2.1, -0.75, 0.75, 2.1]) {
    k.box(pt, [0.2, 1.75, 0.2], [x, 0.875, f + 0.1])
    k.box(GILT, [0.22, 0.05, 0.22], [x, 1.5, f + 0.1])
  }
  for (const x of [-1.42, 1.42]) {
    pane(k, WIN, 1.1, 0.95, [x, 0.92, f + 0.124])
    pane(k, pt, 1.1, 0.04, [x, 1.12, f + 0.128])
    for (const dx of [-0.37, 0, 0.37]) pane(k, pt, 0.03, 0.95, [x + dx, 0.92, f + 0.128])
    pane(k, { c: '#14110f', r: 0.6 }, 1.1, 0.3, [x, 0.24, f + 0.124])
  }
  // Door with a fanlight, a lantern each side on a curly bracket.
  pane(k, { c: '#2a1a12', r: 0.6 }, 0.62, 1.05, [0, 0.55, f + 0.124])
  pane(k, WIN, 0.62, 0.22, [0, 1.24, f + 0.124])
  for (const s of [-1, 1]) {
    k.box(IRON_P, [0.03, 0.03, 0.2], [s * 0.5, 1.42, f + 0.22])
    k.box(WARM, [0.1, 0.16, 0.1], [s * 0.5, 1.3, f + 0.3])
    k.cone(IRON_P, 0.08, 0.08, [s * 0.5, 1.42, f + 0.3], undefined, 4)
  }
  // Fascia and its gilt name.
  k.box(pt, [W, 0.38, 0.22], [0, 1.9, f + 0.11])
  k.box(pt, [W + 0.1, 0.07, 0.3], [0, 2.12, f + 0.12])
  text(k, GILT, name, [0, 1.9, f + 0.225], 0.05)
  // Upstairs: sashes, window boxes, the cornice, parapet, slate roof and chimneys.
  for (const y of [2.45, 3.55]) for (const x of [-1.4, 0, 1.4]) {
    sash(k, x, y, 0.8, f)
    if (y < 3) windowBox(k, x, y, f)
  }
  k.box(WHITE, [W + 0.06, 0.12, 3.08], [0, H, 0])
  k.box(br, [W, 0.4, 0.1], [0, H + 0.24, f - 0.05])
  frustum(k, SLATE, W, 2.6, 0.9, 0.3, [0, H, -0.1])
  for (const x of [-1.8, 1.8]) {
    k.box(br, [0.5, 1.1, 0.5], [x, H + 0.55, -0.4])
    for (const dx of [-0.1, 0.1]) k.cyl({ c: '#b5653b', r: 0.9 }, 0.05, 0.065, 0.28, [x + dx, H + 1.24, -0.4], undefined, 5)
  }
  // Hanging baskets between the first-floor windows.
  for (const x of [-2.05, -0.7, 0.7, 2.05]) {
    k.box(IRON_P, [0.025, 0.025, 0.36], [x, 2.62, f + 0.18])
    k.box(IRON_P, [0.012, 0.18, 0.012], [x, 2.53, f + 0.35])
    blob(k, { c: '#3f6b35', r: 1 }, 0.17, [x, 2.35, f + 0.35], 0.8)
    ;(['#e84a7a', '#d32f2f', '#8e5bd1', '#f2efe8', '#e84a7a'] as const).forEach((c, i) => {
      const a = i * 1.3
      blob(k, { c, r: 0.9 }, 0.055, [x + Math.cos(a) * 0.15, 2.3 + (i % 2) * 0.1, f + 0.35 + Math.sin(a) * 0.15])
    })
  }
  // The hanging sign: bracket, chains, a framed board painted both sides with a gilt crown.
  const sx = W / 2 - 0.25
  k.box(IRON_P, [0.04, 0.04, 0.8], [sx, 2.95, f + 0.4])
  k.rod(IRON_P, [sx, 2.65, f + 0.01], [sx, 2.95, f + 0.5], 0.015, 4)
  for (const dz of [0.28, 0.72]) k.box(IRON_P, [0.01, 0.12, 0.01], [sx, 2.87, f + dz])
  k.box({ c: '#2a1a12', r: 0.6 }, [0.05, 0.66, 0.54], [sx, 2.48, f + 0.5])
  for (const s of [-1, 1]) {
    const x = sx + s * 0.032
    k.box({ c: sign, r: 0.7 }, [0.012, 0.56, 0.44], [x, 2.48, f + 0.5])
    k.box(GILT, [0.014, 0.07, 0.24], [x, 2.38, f + 0.5])
    for (const dz of [-0.09, 0, 0.09]) k.box(GILT, [0.014, dz ? 0.1 : 0.14, 0.05], [x, 2.47 + (dz ? 0 : 0.02), f + 0.5 + dz])
    k.box({ c: '#c62828', r: 0.7 }, [0.016, 0.03, 0.22], [x, 2.43, f + 0.5])
  }
  // Barrels to lean on and a chalkboard.
  for (const x of [-1.4, 1.4]) {
    k.cyl({ c: '#6d4a2c', r: 0.9 }, 0.15, 0.17, 0.48, [x, 0.24, f + 0.45], undefined, 8)
    for (const y of [0.1, 0.38]) k.cyl(IRON_P, 0.172, 0.172, 0.03, [x, y, f + 0.45], undefined, 8)
  }
  for (const s of [-1, 1]) k.box(DARK, [0.34, 0.5, 0.02], [0.3, 0.25, f + 1.0 + s * 0.07], [s * 0.15, 0, 0])
  for (let i = 0; i < 3; i++) k.box(WHITE, [0.22 - i * 0.04, 0.02, 0.01], [0.3, 0.38 - i * 0.08, f + 1.08], [-0.15, 0, 0])
}

// People at the townspeople's true size (kit person()), in coats against the drizzle: some
// with umbrellas up, a bowler hat, a briefcase, a pint raised outside the pub.
const PS = 1.3
const SKIN = ['#f3cfb0', '#e8b48e', '#c98e66', '#8a5a3c', '#f6dcc4', '#5c3a26']
const HAIR = ['#3b2a1e', '#8a5a2b', '#d8b46a', '#1c1c1c', '#a0522d', '#9e9e9e']
type Folk = Dress & { coat?: boolean; brolly?: string; bowler?: boolean; bag?: boolean; pint?: boolean; scale?: number }
function folk(k: PropKit, d: Folk, x: number, z: number, ry: number) {
  const kk = d.scale ? xf(k, x, z, ry, d.scale) : k
  const [px, pz, pr] = d.scale ? [0, 0, 0] : [x, z, ry]
  // An umbrella or a pint goes in the raised right hand.
  person(kk, { ...d, wave: d.wave || !!d.brolly || d.pint }, px, pz, pr)
  const c = Math.cos(pr)
  const s = Math.sin(pr)
  const at = (u: number, y: number, w: number): V3 => [px + (u * c + w * s) * PS, y * PS, pz + (-u * s + w * c) * PS]
  if (d.coat) kk.cyl({ c: d.top, r: 0.9 }, 0.088 * PS, 0.11 * PS, 0.17 * PS, at(0, 0.2, 0), [0, pr, 0], 7)
  if (d.bowler) {
    kk.sphere(DARK, 0.083 * PS, at(0, 0.655, 0), [1, 0.85, 1], 8, 3, Math.PI / 2)
    kk.cyl(DARK, 0.12 * PS, 0.12 * PS, 0.01 * PS, at(0, 0.655, 0), [0, pr, 0], 10)
  }
  if (d.bag) kk.box({ c: '#4a2e1c', r: 0.7 }, [0.03 * PS, 0.13 * PS, 0.18 * PS], at(-0.13, 0.2, 0.01), [0, pr, 0])
  if (d.brolly) {
    kk.rod(DARK, at(0.16, 0.7, 0.02), at(0.05, 0.98, 0), 0.008 * PS, 4)
    kk.sphere({ c: d.brolly, r: 0.6 }, 0.26 * PS, at(0.05, 0.86, 0), [1, 0.42, 1], 8, 3, Math.PI / 2)
    kk.cone(DARK, 0.01 * PS, 0.05 * PS, at(0.05, 0.99, 0), undefined, 4)
  }
  if (d.pint) {
    kk.cyl({ c: '#c98a2a', r: 0.3 }, 0.024 * PS, 0.02 * PS, 0.08 * PS, at(0.16, 0.78, 0.02), undefined, 6)
    kk.cyl({ c: '#f6f1e2', r: 0.6 }, 0.024 * PS, 0.024 * PS, 0.015 * PS, at(0.16, 0.825, 0.02), undefined, 6)
  }
}
// A small dog on a lead.
function dog(k: PropKit, x: number, z: number, ry: number, c: string, to: V3) {
  const kk = xf(k, x, z, ry)
  const fur: Look = { c, r: 0.95 }
  kk.box(fur, [0.1, 0.09, 0.24], [0, 0.15, 0])
  for (const [u, w] of [[-0.035, 0.09], [0.035, 0.09], [-0.035, -0.09], [0.035, -0.09]]) kk.box(fur, [0.03, 0.11, 0.03], [u, 0.055, w])
  kk.box(fur, [0.09, 0.09, 0.1], [0, 0.23, 0.15])
  kk.box(fur, [0.05, 0.04, 0.06], [0, 0.21, 0.22])
  kk.box(DARK, [0.02, 0.02, 0.02], [0, 0.22, 0.255])
  for (const u of [-0.035, 0.035]) kk.box(fur, [0.025, 0.05, 0.03], [u, 0.28, 0.13])
  kk.rod(fur, [0, 0.18, -0.12], [0, 0.27, -0.19], 0.012, 4)
  k.rod({ c: '#c62828', r: 0.6 }, [x + Math.sin(ry) * 0.18, 0.24, z + Math.cos(ry) * 0.18], to, 0.006, 3)
}
const COATS = ['#2b3a55', '#7a1f2b', '#b8a07a', '#3d3d3d', '#2e5d4b', '#5a4632', '#1f1f24', '#8a6a9a']
// Walkers on the pavement, built round (0, 0) facing +z.
function walkersA(k: PropKit) {
  folk(k, { top: COATS[1], low: '#1f1f24', skin: SKIN[0], hair: HAIR[1], coat: true, brolly: '#c62828' }, -0.18, 0.05, 0)
  folk(k, { top: COATS[2], low: '#3d3d3d', skin: SKIN[4], hair: HAIR[3], coat: true, bowler: true, bag: true, brolly: '#1a1a1c' }, 0.18, -0.08, 0)
}
function walkersB(k: PropKit) {
  folk(k, { top: COATS[4], low: '#2b2b30', skin: SKIN[2], hair: HAIR[0], coat: true, hat: 'cap', hatC: '#6b5a44' }, 0.05, 0, 0)
  dog(k, -0.25, 0.45, 0, '#c9a46a', [0.05 - 0.12 * PS, 0.29 * PS, 0.013])
  folk(k, { top: COATS[0], low: '#3d3d3d', skin: SKIN[5], hair: HAIR[3], coat: true, brolly: '#1f3c7a' }, 0.15, -1.1, Math.PI)
}
function walkersC(k: PropKit) {
  folk(k, { top: COATS[6], low: '#2b3a55', skin: SKIN[1], hair: HAIR[2], coat: true, hat: 'scarf', hatC: '#7a1f2b' }, -0.22, 0, 0.15)
  folk(k, { top: '#f2c230', low: '#2b3a55', skin: SKIN[1], hair: HAIR[2], wave: true, scale: 0.72 }, 0.02, 0.2, 0.2)
  folk(k, { top: COATS[3], low: '#1f1f24', skin: SKIN[3], hair: HAIR[3], coat: true, brolly: '#2e7d32' }, 0.26, -0.05, -0.1)
}
// Drinkers outside the pub, in the pub's own frame (front at z = 1.5).
function drinkers(k: PropKit) {
  folk(k, { top: '#3d3d3d', low: '#2b3a55', skin: SKIN[0], hair: HAIR[4], pint: true }, -1.75, 2.25, Math.PI / 2)
  folk(k, { top: '#7a1f2b', low: '#1f1f24', skin: SKIN[2], hair: HAIR[0], robe: true }, -1.3, 2.3, -Math.PI / 2)
  folk(k, { top: '#2e5d4b', low: '#3d3d3d', skin: SKIN[4], hair: HAIR[5], pint: true, hat: 'cap', hatC: '#4a4a4a' }, 1.6, 2.25, -Math.PI / 2 - 0.4)
}

// A shop, 2.2 wide, in the same row as the houses: a painted shopfront, its lit window and door,
// the fascia with its name, a striped awning on brackets, and its wares out on the pavement.
type Shop = { name: string; brick: string; paint: string; awn: string; kind: 'bakery' | 'books' | 'cafe' | 'flowers' | 'chips' | 'news' }
function shop(k: PropKit, s: Shop) {
  const W = 2.2
  const H = 5.4
  const f = 1.5
  const brick: Look = { c: s.brick, r: 0.95 }
  const pt: Look = { c: s.paint, r: 0.45 }
  const awn: Look = { c: s.awn, r: 0.8 }
  k.box(brick, [W, H, 3], [0, H / 2, 0])
  k.box(pt, [W, 1.55, 0.08], [0, 0.775, f + 0.04])
  for (const x of [-1.02, 1.02]) k.box(pt, [0.16, 1.9, 0.14], [x, 0.95, f + 0.07])
  pane(k, WIN, 1.25, 0.95, [-0.3, 0.9, f + 0.084])
  pane(k, pt, 0.03, 0.95, [-0.3, 0.9, f + 0.088])
  pane(k, pt, 1.25, 0.03, [-0.3, 1.2, f + 0.088])
  pane(k, { c: '#14110f', r: 0.6 }, 1.25, 0.32, [-0.3, 0.2, f + 0.084])
  pane(k, { c: '#2a1a12', r: 0.6 }, 0.44, 1.1, [0.68, 0.58, f + 0.084])
  pane(k, WIN, 0.3, 0.45, [0.68, 0.85, f + 0.088])
  // Fascia and name.
  k.box(pt, [W, 0.34, 0.16], [0, 1.73, f + 0.08])
  k.box(pt, [W + 0.06, 0.05, 0.22], [0, 1.92, f + 0.09])
  text(k, { c: '#f2e6c8', r: 0.6 }, s.name, [0, 1.73, f + 0.165], 0.045)
  // The awning: stripes sloping out from under the fascia, a scalloped valance, two brackets.
  for (let i = 0; i < 9; i++) {
    const x = -0.98 + i * 0.245
    const l = i % 2 ? WHITE : awn
    k.box(l, [0.245, 0.025, 0.82], [x, 1.37, f + 0.42], [0.42, 0, 0])
    k.box(l, [0.245, 0.12, 0.02], [x, 1.14, f + 0.8])
  }
  for (const x of [-1.0, 1.0]) k.rod(IRON_P, [x, 1.0, f + 0.12], [x, 1.22, f + 0.78], 0.012, 4)
  upper(k, brick, W, H, f, s.kind === 'flowers' || s.kind === 'cafe')
  // Wares.
  const z = f + 0.42
  if (s.kind === 'books') {
    k.box({ c: '#6d4a2c', r: 0.9 }, [1.1, 0.04, 0.42], [-0.3, 0.5, z])
    for (const x of [-0.8, 0.2]) k.box({ c: '#6d4a2c', r: 0.9 }, [0.04, 0.5, 0.38], [x, 0.25, z])
    ;['#c62828', '#1f3c7a', '#2e7d32', '#f2c230', '#6a1b9a', '#e8e2cc', '#bf360c', '#37474f', '#00838f'].forEach((c, i) => k.box({ c, r: 0.8 }, [0.09, 0.15 + (i % 3) * 0.02, 0.12], [-0.78 + i * 0.11, 0.6, z + ((i % 2) - 0.5) * 0.14]))
  } else if (s.kind === 'flowers') {
    ;(['#d32f2f', '#f2c230', '#ec6f9a', '#f2efe8', '#8e5bd1', '#ff8f00'] as const).forEach((c, i) => {
      const x = -0.85 + (i % 3) * 0.32
      const y = i < 3 ? 0 : 0.28
      const zz = z + (i < 3 ? 0.18 : -0.12)
      if (i >= 3) k.box({ c: '#6d4a2c', r: 0.9 }, [0.34, 0.28, 0.3], [x, 0.14, zz])
      k.cyl({ c: '#2e4a32', r: 0.6 }, 0.1, 0.08, 0.22, [x, y + 0.11, zz], undefined, 7)
      blob(k, { c: '#3f6b35', r: 1 }, 0.12, [x, y + 0.3, zz], 0.8)
      for (let j = 0; j < 3; j++) blob(k, { c, r: 0.9 }, 0.06, [x + (j - 1) * 0.07, y + 0.36 + (j % 2) * 0.04, zz + 0.04])
    })
  } else if (s.kind === 'cafe') {
    for (const x of [-0.75, 0.05]) {
      k.cyl(IRON_P, 0.2, 0.2, 0.025, [x, 0.48, z + 0.05], undefined, 10)
      k.cyl(IRON_P, 0.02, 0.02, 0.47, [x, 0.24, z + 0.05], undefined, 5)
      k.cyl(IRON_P, 0.12, 0.12, 0.02, [x, 0.01, z + 0.05], undefined, 8)
      k.box(WHITE, [0.08, 0.06, 0.08], [x + 0.05, 0.52, z + 0.05])
      for (const s2 of [-1, 1]) {
        k.box(IRON_P, [0.2, 0.025, 0.2], [x + s2 * 0.3, 0.3, z + 0.05])
        k.box(IRON_P, [0.025, 0.3, 0.2], [x + s2 * 0.4, 0.45, z + 0.05])
        for (const dx of [-0.08, 0.08]) k.box(IRON_P, [0.02, 0.3, 0.02], [x + s2 * 0.3 + dx, 0.15, z + 0.05])
      }
    }
  } else if (s.kind === 'news') {
    k.box({ c: '#2e4a32', r: 0.7 }, [0.9, 0.6, 0.3], [-0.4, 0.3, z - 0.05])
    ;['#f2efe8', '#e8e2cc', '#f2c230', '#f2efe8'].forEach((c, i) => k.box({ c, r: 0.9 }, [0.2, 0.02, 0.26], [-0.72 + i * 0.22, 0.62, z - 0.05], [0.25, 0, 0]))
  }
  if (s.kind !== 'flowers') {
    // An A-board with chalk strokes.
    const bx = s.kind === 'books' ? 0.68 : 0.5
    for (const s2 of [-1, 1]) k.box(DARK, [0.32, 0.48, 0.02], [bx, 0.24, f + 1.05 + s2 * 0.07], [s2 * 0.15, 0, 0])
    for (let i = 0; i < 3; i++) k.box(WHITE, [0.2 - i * 0.04, 0.02, 0.01], [bx, 0.37 - i * 0.08, f + 1.13], [-0.15, 0, 0])
  }
}
const SHOPS: [Shop, Shop][] = [
  [{ name: 'BAKERY', brick: '#8a4b36', paint: '#5a2a1e', awn: '#c62828', kind: 'bakery' }, { name: 'BOOKS', brick: '#a65b3e', paint: '#1d3b2a', awn: '#2e7d32', kind: 'books' }],
  [{ name: 'TEA ROOM', brick: '#c9a86a', paint: '#2b3a55', awn: '#1f3c7a', kind: 'cafe' }, { name: 'FLORIST', brick: '#7b4535', paint: '#2e4a32', awn: '#ec6f9a', kind: 'flowers' }],
  [{ name: 'CHIPPY', brick: '#b58a5a', paint: '#1f3c7a', awn: '#f2c230', kind: 'chips' }, { name: 'NEWS', brick: '#8a4b36', paint: '#7a1f2b', awn: '#c62828', kind: 'news' }],
]

// An underground station, 4.4 wide: oxblood glazed tile, three arched windows above, the
// entrance below its name band, and the red and blue roundel on a post at the kerb.
function station(k: PropKit) {
  const W = 4.4
  const H = 3.6
  const f = 1.5
  const tile: Look = { c: '#7a1e1e', r: 0.35 }
  const tileD: Look = { c: '#5e1515', r: 0.35 }
  k.box(tile, [W, H, 3], [0, H / 2, 0])
  for (const x of [-2.1, -0.72, 0.72, 2.1]) k.box(tileD, [0.22, H, 0.1], [x, H / 2, f + 0.05])
  // Ground floor: the lit entrance, two side windows.
  pane(k, WIN, 1.2, 1.3, [0, 0.65, f + 0.004])
  k.box(DARK, [1.2, 0.08, 0.04], [0, 0.62, f + 0.03])
  for (const x of [-1.42, 1.42]) {
    pane(k, WIN, 0.95, 0.9, [x, 0.85, f + 0.004])
    k.box(tileD, [0.95, 0.04, 0.04], [x, 1.0, f + 0.03])
  }
  // The name band.
  k.box({ c: '#1b2a6b', r: 0.5 }, [W - 0.1, 0.36, 0.08], [0, 1.6, f + 0.06])
  text(k, WHITE, 'UNDERGROUND', [0, 1.6, f + 0.105], 0.06)
  // Arched windows above, each with its glazing bars and tiled surround.
  for (const x of [-1.42, 0, 1.42]) {
    k.box(tileD, [1.05, 1.0, 0.04], [x, 2.45, f + 0.012])
    archTop(k, tileD, 1.05, 0.04, [x, 2.95, f + 0.012])
    pane(k, WIN, 0.9, 0.9, [x, 2.45, f + 0.036])
    archTop(k, WIN, 0.9, 0.03, [x, 2.9, f + 0.03])
    for (const dx of [-0.22, 0.22]) pane(k, WHITE, 0.025, 1.3, [x + dx, 2.6, f + 0.05])
    pane(k, WHITE, 0.9, 0.025, [x, 2.6, f + 0.05])
  }
  k.box(tileD, [W + 0.1, 0.2, 3.1], [0, H, 0])
  for (let i = 0; i < 14; i++) k.box(tileD, [0.12, 0.1, 0.08], [-2.1 + i * 0.323, H - 0.15, f + 0.05])
  k.box({ c: '#5a5a5a', r: 0.8 }, [W, 0.05, 3], [0, H + 0.12, 0])
  // The roundel on its post, facing the oncoming race (local -x is down the road).
  const rx = -1.9
  const rz = f + 1.25
  k.cyl(IRON_P, 0.04, 0.05, 2.0, [rx, 1.0, rz], undefined, 6)
  k.torus({ c: '#d32f2f', r: 0.5 }, 0.25, 0.065, [rx, 2.15, rz], [0, Math.PI / 2, 0], Math.PI * 2, 18, 4)
  k.cyl(WHITE, 0.2, 0.2, 0.02, [rx, 2.15, rz], [0, 0, Math.PI / 2], 14)
  k.box({ c: '#1b2a6b', r: 0.5 }, [0.06, 0.13, 0.72], [rx, 2.15, rz])
  for (const s of [-1, 1]) pane(k, WHITE, 0.5, 0.035, [rx + s * 0.032, 2.15, rz], s * Math.PI / 2)
  // A roundel on the wall too, beside the door.
  k.torus({ c: '#d32f2f', r: 0.5 }, 0.2, 0.05, [0.98, 1.2, f + 0.06], [0, 0, 0], Math.PI * 2, 16, 4)
  k.box({ c: '#1b2a6b', r: 0.5 }, [0.56, 0.1, 0.04], [0.98, 1.2, f + 0.1])
}

// A black cab, facing +z: the tall rounded cabin, the lit TAXI sign, round headlamps.
function cab(k: PropKit) {
  const body: Look = { c: '#151517', r: 0.35 }
  const glass: Look = { c: '#2e3a44', r: 0.2 }
  const chrome: Look = { c: '#b9bcbf', r: 0.35 }
  k.box(body, [0.95, 0.42, 2.1], [0, 0.37, 0])
  k.box(body, [0.9, 0.46, 1.3], [0, 0.8, -0.2])
  k.box(body, [0.86, 0.06, 1.24], [0, 1.05, -0.2])
  k.box(body, [0.9, 0.1, 0.55], [0, 0.6, 0.72], [-0.12, 0, 0])
  k.box(glass, [0.82, 0.36, 0.03], [0, 0.82, 0.46], [-0.2, 0, 0])
  k.box(glass, [0.82, 0.3, 0.03], [0, 0.82, -0.86])
  for (const s of [-1, 1]) {
    for (const z of [0.15, -0.35, -0.75]) k.box(glass, [0.02, 0.3, 0.34], [s * 0.452, 0.82, z])
    k.box(chrome, [0.02, 0.02, 0.1], [s * 0.48, 0.52, -0.1])
    k.box(body, [0.1, 0.06, 0.03], [s * 0.5, 0.72, 0.4])
    k.cyl({ c: '#f6f1e2', r: 0.3 }, 0.07, 0.07, 0.04, [s * 0.32, 0.5, 1.05], [Math.PI / 2, 0, 0], 8)
    k.box({ c: '#b71c1c', r: 0.5 }, [0.1, 0.1, 0.02], [s * 0.36, 0.48, -1.06])
  }
  k.box(chrome, [0.36, 0.22, 0.03], [0, 0.42, 1.06])
  k.box(chrome, [0.97, 0.07, 0.08], [0, 0.2, 1.07])
  k.box(chrome, [0.97, 0.07, 0.08], [0, 0.2, -1.07])
  k.box({ c: '#ffb300', r: 0.4 }, [0.3, 0.09, 0.1], [0, 1.12, 0.25])
  text(k, DARK, 'TAXI', [0, 1.12, 0.302], 0.015, 0)
  for (const z of [0.68, -0.68]) for (const s of [-1, 1]) {
    k.cyl({ c: '#111111', r: 0.9 }, 0.19, 0.19, 0.13, [s * 0.43, 0.19, z], [0, 0, Math.PI / 2], 10)
    k.cyl(chrome, 0.09, 0.09, 0.14, [s * 0.43, 0.19, z], [0, 0, Math.PI / 2], 8)
  }
}

// A red telephone box with its glazing bars and lit name band, and a red pillar box beside it.
function phoneBox(k: PropKit) {
  k.box(RED, [0.5, 1.2, 0.5], [0, 0.6, 0])
  k.box(RED, [0.56, 0.08, 0.56], [0, 0.04, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    k.box(WIN, [0.34, 0.75, 0.02], [dx * 0.251, 0.6, dz * 0.251], [0, ry, 0])
    for (const y of [0.4, 0.6, 0.8]) k.box(RED, [0.34, 0.02, 0.03], [dx * 0.255, y, dz * 0.255], [0, ry, 0])
    k.box(WARM, [0.32, 0.07, 0.02], [dx * 0.255, 1.08, dz * 0.255], [0, ry, 0])
  }
  k.box(RED, [0.56, 0.06, 0.56], [0, 1.23, 0])
  k.cyl(RED, 0.28, 0.28, 0.5, [0, 1.26, 0], [Math.PI / 2, 0, 0], 12)
  k.cyl(RED, 0.28, 0.28, 0.5, [0, 1.26, 0], [0, 0, Math.PI / 2], 12)
  // The pillar box: a red drum on a black plinth, a domed cap with a rim, the dark letter slot.
  const px = 0.75
  k.cyl({ c: '#151515', r: 0.6 }, 0.19, 0.2, 0.12, [px, 0.06, 0], undefined, 12)
  k.cyl(RED, 0.17, 0.17, 0.85, [px, 0.545, 0], undefined, 12)
  k.cyl(RED, 0.2, 0.2, 0.05, [px, 0.99, 0], undefined, 12)
  k.sphere(RED, 0.18, [px, 1.01, 0], [1, 0.7, 1], 12, 5, Math.PI / 2)
  k.box({ c: '#141414', r: 0.6 }, [0.16, 0.025, 0.04], [px, 0.86, 0.16])
  k.box({ c: '#f2efe8', r: 0.6 }, [0.1, 0.07, 0.02], [px, 0.7, 0.165])
}

// A red double-decker bus with the open rear platform and its stairs, lit inside, facing +z.
function bus(k: PropKit) {
  const BLACK: Look = { c: '#151515', r: 0.6 }
  // Lower deck stops short of the back for the open platform; the upper deck runs over it.
  k.box(RED, [1.1, 1.0, 3.9], [0, 0.75, 0.25])
  k.box(RED, [0.55, 1.0, 0.5], [-0.275, 0.75, -1.95])
  k.box(RED, [1.1, 0.9, 4.3], [0, 1.75, -0.05])
  k.box(RED, [1.12, 0.12, 4.32], [0, 1.26, -0.02])
  k.box(WHITE, [1.12, 0.08, 4.32], [0, 1.32, -0.02])
  k.box(RED, [1.04, 0.06, 4.2], [0, 2.22, -0.05])
  for (const s of [-1, 1]) {
    k.box(WIN, [0.02, 0.4, 3.5], [s * 0.555, 0.98, 0.2])
    k.box(WIN, [0.02, 0.42, 3.9], [s * 0.555, 1.85, -0.05])
    // Window pillars, on the side the race sees.
    if (s < 0) for (let i = 0; i <= 6; i++) {
      k.box(RED, [0.03, 0.42, 0.06], [s * 0.565, 0.98, -1.55 + i * 0.583])
      k.box(RED, [0.03, 0.44, 0.06], [s * 0.565, 1.85, -2.0 + i * 0.65])
    }
  }
  // The platform: floor, the grab pole, the stairs climbing to the top deck.
  k.box({ c: '#3a3a3a', r: 0.9 }, [0.55, 0.06, 0.5], [0.275, 0.3, -1.95])
  k.box({ c: '#2a2a2a', r: 0.9 }, [0.02, 0.9, 0.5], [0.0, 0.8, -1.95])
  k.rod({ c: '#e8e2cc', r: 0.4 }, [0.5, 0.33, -2.16], [0.5, 1.2, -2.16], 0.025, 6)
  for (let i = 0; i < 4; i++) k.box(BLACK, [0.45, 0.04, 0.12], [0.3, 0.45 + i * 0.2, -2.12 + i * 0.12])
  k.box(WIN, [0.4, 0.3, 0.02], [-0.3, 1.0, -2.21])
  k.box(WIN, [0.9, 0.36, 0.02], [0, 1.85, -2.21])
  // Front: windscreens, the destination blind in its dark box, grille and lamps.
  k.box(WIN, [0.95, 0.42, 0.02], [0, 1.85, 2.11])
  k.box(WIN, [0.95, 0.4, 0.02], [0, 0.98, 2.21])
  k.box({ c: '#101010', r: 0.6 }, [0.8, 0.2, 0.02], [0, 2.1, 2.105])
  k.box(WARM, [0.7, 0.12, 0.02], [0, 2.1, 2.115])
  k.box({ c: '#101010', r: 0.6 }, [0.42, 0.28, 0.02], [0, 0.55, 2.21])
  for (let i = 0; i < 4; i++) k.box({ c: '#9e9e9e', r: 0.5 }, [0.36, 0.025, 0.02], [0, 0.45 + i * 0.065, 2.22])
  for (const s of [-1, 1]) {
    k.box(WARM, [0.12, 0.1, 0.02], [s * 0.38, 0.45, 2.21])
    k.rod(BLACK, [s * 0.55, 1.15, 2.1], [s * 0.7, 1.2, 2.0], 0.012, 4)
    k.box(BLACK, [0.03, 0.14, 0.09], [s * 0.71, 1.12, 2.0])
  }
  k.box(BLACK, [1.12, 0.2, 4.42], [0, 0.18, 0])
  for (const z of [1.4, -1.3]) for (const s of [-1, 1]) {
    k.cyl({ c: '#111111', r: 0.9 }, 0.26, 0.26, 0.16, [s * 0.5, 0.26, z], [0, 0, Math.PI / 2], 14)
    k.cyl({ c: '#9e9e9e', r: 0.45 }, 0.12, 0.12, 0.17, [s * 0.5, 0.26, z], [0, 0, Math.PI / 2], 10)
  }
}

// Kerbside furniture on the left pavement: a Victorian lamp post with its glass lantern and
// ladder bar, a black litter bin with a gilt band, and a pair of bollards.
function street(k: PropKit) {
  k.cyl(IRON_P, 0.1, 0.13, 0.3, [0, 0.15, 0], undefined, 8)
  for (let i = 0; i < 3; i++) k.cyl(IRON_P, 0.11 - i * 0.015, 0.11 - i * 0.015, 0.04, [0, 0.33 + i * 0.1, 0], undefined, 8)
  k.cyl(IRON_P, 0.04, 0.055, 2.0, [0, 1.4, 0], undefined, 6)
  k.box(IRON_P, [0.42, 0.03, 0.03], [0, 2.1, 0])
  for (const s of [-1, 1]) k.sphere(IRON_P, 0.025, [s * 0.21, 2.1, 0], [1, 1, 1], 5, 3)
  k.cyl(IRON_P, 0.06, 0.04, 0.12, [0, 2.45, 0], undefined, 6)
  frustum(k, WARM, 0.24, 0.24, 0.32, 1.35, [0, 2.5, 0])
  for (const [dx, dz] of [[0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14]]) k.box(IRON_P, [0.02, 0.34, 0.02], [dx, 2.67, dz])
  frustum(k, IRON_P, 0.36, 0.36, 0.14, 0.2, [0, 2.83, 0])
  k.sphere(IRON_P, 0.04, [0, 2.99, 0], [1, 1, 1], 5, 3)
  // The bin.
  k.cyl(IRON_P, 0.15, 0.13, 0.55, [0, 0.275, 1.2], undefined, 8)
  k.cyl(GILT, 0.153, 0.153, 0.04, [0, 0.45, 1.2], undefined, 8)
  k.sphere(IRON_P, 0.15, [0, 0.55, 1.2], [1, 0.45, 1], 8, 3, Math.PI / 2)
  // Bollards.
  for (const z of [-1.0, -1.7]) {
    k.cyl(IRON_P, 0.06, 0.075, 0.5, [0, 0.25, z], undefined, 8)
    k.cyl(IRON_P, 0.08, 0.08, 0.04, [0, 0.43, z], undefined, 8)
    k.sphere(IRON_P, 0.06, [0, 0.5, z], [1, 0.8, 1], 6, 3, Math.PI / 2)
  }
}

// A cabman's shelter on the embankment pavement, long side to the road (+x): a little green
// timber hut on a plinth, lit windows over dark panels, a gabled roof with its vent and a lamp.
function shelter(k: PropKit) {
  const green: Look = { c: '#2f5a3a', r: 0.6 }
  const greenD: Look = { c: '#203f29', r: 0.6 }
  k.box(greenD, [1.1, 0.15, 2.2], [0, 0.075, 0])
  k.box(green, [1.0, 1.4, 2.1], [0, 0.85, 0])
  for (const s of [-1, 1]) {
    for (const z of [-0.65, 0, 0.65]) {
      pane(k, WIN, 0.45, 0.42, [s * 0.505, 1.18, z], s * Math.PI / 2)
      pane(k, WHITE, 0.03, 0.42, [s * 0.509, 1.18, z], s * Math.PI / 2)
      pane(k, greenD, 0.5, 0.5, [s * 0.505, 0.5, z], s * Math.PI / 2)
    }
    for (const x of [-0.5, 0.5]) k.box(greenD, [0.08, 1.42, 0.08], [x, 0.85, s * 1.04])
  }
  k.box(greenD, [1.06, 0.1, 2.16], [0, 1.5, 0])
  gable(k, { c: '#3b3f42', r: 0.7 }, 2.4, 1.35, 0.45, [0, 1.55, 0], Math.PI / 2)
  k.box(green, [0.3, 0.3, 0.3], [0, 2.05, 0])
  gable(k, { c: '#3b3f42', r: 0.7 }, 0.45, 0.45, 0.15, [0, 2.2, 0], Math.PI / 2)
  k.box(DARK, [0.45, 0.95, 0.03], [0, 0.62, -1.065])
  pane(k, WIN, 0.3, 0.25, [0, 0.92, -1.082], Math.PI)
  k.box(IRON_P, [0.04, 0.04, 0.25], [0.6, 1.62, 1.0])
  k.box(WARM, [0.12, 0.16, 0.12], [0.7, 1.52, 1.0])
}

// A plane tree with mottled bark and a broad crown.
function plane(k: PropKit) {
  k.cyl({ c: '#8a8270', r: 1 }, 0.12, 0.16, 2.4, [0, 1.2, 0], undefined, 7)
  for (const [x, z] of [[0.5, 0.2], [-0.4, -0.3]]) k.rod({ c: '#8a8270', r: 1 }, [0, 2.0, 0], [x, 2.8, z], 0.07, 5)
  ;[[0, 3.2, 0, 1.2], [0.8, 2.9, 0.2, 0.85], [-0.7, 3.0, -0.3, 0.85], [0, 3.7, 0.1, 0.8]].forEach(([x, y, z, r], i) => k.ico({ c: LEAF[i % 3], r: 1 }, r, [x, y, z], [1, 0.8, 1], 1))
}

// A dolphin lamp on the embankment wall: two cast-iron fish coiled round the foot, a fluted
// column with collars, the glass globe and its little crown.
function dolphinLamp(k: PropKit, z: number) {
  k.box(GRANITE, [0.42, 0.22, 0.42], [0, 1.21, z])
  k.cyl(IRON_P, 0.12, 0.16, 0.42, [0, 1.53, z], undefined, 6)
  for (const s of [-1, 1]) {
    k.torus(IRON_P, 0.13, 0.045, [s * 0.15, 1.6, z], [0, Math.PI / 2, s * 0.6], Math.PI * 1.4, 6, 3)
    k.sphere(IRON_P, 0.07, [s * 0.2, 1.42, z], [1, 0.8, 1.3], 5, 3)
  }
  k.cyl(IRON_P, 0.045, 0.06, 1.5, [0, 2.48, z], undefined, 6)
  k.cyl(IRON_P, 0.075, 0.075, 0.06, [0, 2.9, z], undefined, 6)
  k.cyl(IRON_P, 0.09, 0.05, 0.12, [0, 3.28, z], undefined, 6)
  k.sphere(WARM, 0.2, [0, 3.5, z])
  k.cyl(IRON_P, 0.06, 0.1, 0.08, [0, 3.72, z], undefined, 6)
  k.cone(IRON_P, 0.05, 0.16, [0, 3.84, z], undefined, 4)
}

// A 24-metre stretch of the embankment: the granite river wall, two dolphin lamps, and a
// slatted bench between the plane trees whose cast-iron ends are kneeling camels.
function embankment(k: PropKit) {
  k.box({ c: '#9a9488', r: 0.9 }, [0.6, 1.0, 24], [0, 0.5, 0])
  k.box({ c: '#b5ae9f', r: 0.9 }, [0.7, 0.12, 24], [0, 1.04, 0])
  for (const z of [-6, 6]) dolphinLamp(k, z)
  const wood: Look = { c: '#7a5634', r: 0.9 }
  const bx = 0.75
  const bz = 0
  for (let i = 0; i < 3; i++) k.box(wood, [0.11, 0.035, 1.4], [bx - 0.11 + i * 0.13, 0.42, bz])
  for (let i = 0; i < 2; i++) k.box(wood, [0.03, 0.11, 1.4], [bx - 0.2 - i * 0.04, 0.58 + i * 0.16, bz], [0, 0, 0.25])
  for (const s of [-1, 1]) {
    const z = bz + s * 0.72
    // The camel: legs folded under, the body, its hump under the arm, neck and head.
    k.box(IRON_P, [0.4, 0.06, 0.06], [bx, 0.03, z])
    k.box(IRON_P, [0.06, 0.38, 0.05], [bx + 0.15, 0.22, z])
    k.box(IRON_P, [0.06, 0.38, 0.05], [bx - 0.15, 0.22, z])
    k.sphere(IRON_P, 0.13, [bx - 0.02, 0.5, z], [1.5, 0.75, 0.35], 6, 4)
    k.sphere(IRON_P, 0.09, [bx - 0.06, 0.6, z], [1, 1, 0.5], 6, 3, Math.PI / 2)
    k.rod(IRON_P, [bx + 0.14, 0.52, z], [bx + 0.24, 0.7, z], 0.035, 5)
    k.box(IRON_P, [0.12, 0.06, 0.05], [bx + 0.28, 0.71, z])
    k.box(IRON_P, [0.05, 0.42, 0.04], [bx - 0.24, 0.7, z], [0, 0, 0.25])
  }
}

// An embankment statue on its granite plinth: a horseman, sword raised, his horse stepping out
// towards the oncoming race.
function statue(k: PropKit) {
  k.box(GRANITE, [1.4, 0.3, 1.9], [0, 0.15, 0])
  k.box({ c: '#9a958a', r: 0.9 }, [1.15, 1.6, 1.75], [0, 1.1, 0])
  k.box(GRANITE, [1.35, 0.15, 1.95], [0, 1.95, 0])
  k.box(BRONZE, [0.04, 0.25, 0.7], [0.58, 1.15, 0])
  // The horse, one pair of legs lifted, its weight on the hind legs.
  const y = 2.03
  k.sphere(BRONZE, 0.56, [0, y + 0.98, -0.05], [0.48, 0.52, 1], 12, 8)
  k.sphere(BRONZE, 0.24, [0, y + 1.0, 0.38], [1, 1.05, 1], 8, 6)
  k.sphere(BRONZE, 0.24, [0, y + 1.05, -0.45], [0.95, 1.1, 1], 8, 6)
  for (const s of [-1, 1]) {
    k.rod(BRONZE, [s * 0.13, y + 0.85, 0.35], [s * 0.13, y + 0.32, 0.45], 0.075, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.32, 0.45], [s * 0.13, y, 0.32], 0.055, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.95, -0.45], [s * 0.13, y + 0.65, -0.72], 0.07, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.65, -0.72], [s * 0.1, y + 0.4, -0.88], 0.055, 6)
  }
  k.rod(BRONZE, [0, y + 1.1, -0.45], [0, y + 1.62, -0.66], 0.16, 7)
  k.box(BRONZE, [0.2, 0.24, 0.48], [0, y + 1.66, -0.84], [-0.5, 0, 0])
  k.box(BRONZE, [0.05, 0.14, 0.08], [0, y + 1.82, -0.6])
  k.rod(BRONZE, [0, y + 1.0, 0.55], [0, y + 0.45, 0.78], 0.08, 6)
  // The rider.
  k.box(BRONZE, [0.34, 0.12, 0.3], [0, y + 1.24, 0.05])
  for (const s of [-1, 1]) k.rod(BRONZE, [s * 0.15, y + 1.24, 0.05], [s * 0.26, y + 0.88, -0.05], 0.05, 5)
  frustum(k, BRONZE, 0.3, 0.22, 0.55, 0.7, [0, y + 1.28, 0.1])
  k.sphere(BRONZE, 0.1, [0, y + 1.93, 0.08], [1, 1.1, 1], 8, 6)
  k.rod(BRONZE, [0.14, y + 1.75, 0.08], [0.22, y + 2.1, -0.15], 0.04, 5)
  k.rod(BRONZE, [0.22, y + 2.1, -0.15], [0.24, y + 2.7, -0.3], 0.02, 4)
  k.rod(BRONZE, [-0.14, y + 1.75, 0.08], [-0.18, y + 1.45, -0.3], 0.04, 5)
}

// A river cruiser moored at the wall: white hull with a navy band, a long glazed saloon lit
// from inside, the open top deck with its rail and benches, and the little wheelhouse.
function cruiser(k: PropKit) {
  const L = 13
  const navy: Look = { c: '#1f2d4a', r: 0.6 }
  k.box(WHITE, [2.6, 0.7, L], [0, 0.3, 0])
  k.box(navy, [2.64, 0.18, L + 0.02], [0, 0.18, 0])
  // Pointed bow: a three-sided prism, one corner forward.
  k.cyl(WHITE, 1.5, 1.5, 0.7, [0, 0.3, L / 2 + 0.75], undefined, 3)
  k.cyl(navy, 1.51, 1.51, 0.18, [0, 0.18, L / 2 + 0.75], undefined, 3)
  k.box(WHITE, [2.2, 0.85, L - 2.5], [0, 1.08, -0.6])
  for (const s of [-1, 1]) {
    k.box(WIN, [0.02, 0.5, L - 3], [s * 1.101, 1.12, -0.6])
    for (let i = 0; i <= 5; i++) k.box(WHITE, [0.04, 0.5, 0.1], [s * 1.11, 1.12, -0.6 - (L - 3) / 2 + i * ((L - 3) / 5)])
    k.box(navy, [0.04, 0.05, L - 2.5], [s * 1.11, 1.47, -0.6])
  }
  k.box({ c: '#cfd3d6', r: 0.7 }, [2.24, 0.06, L - 2.4], [0, 1.53, -0.6])
  // Top deck rail and benches, the wheelhouse forward.
  for (const s of [-1, 1]) {
    k.box(WHITE, [0.04, 0.04, L - 2.5], [s * 1.08, 1.98, -0.6])
    for (let i = 0; i <= 7; i++) k.box(WHITE, [0.03, 0.42, 0.03], [s * 1.08, 1.77, -0.6 - (L - 2.5) / 2 + i * ((L - 2.5) / 7)])
  }
  for (let i = 0; i < 5; i++) k.box({ c: '#3f6fa8', r: 0.7 }, [1.6, 0.25, 0.4], [0, 1.68, -5 + i * 1.6])
  k.box(WHITE, [1.6, 0.8, 1.2], [0, 1.95, 4.0])
  k.box(WIN, [1.4, 0.32, 0.02], [0, 2.1, 4.61])
  k.box(navy, [1.7, 0.08, 1.3], [0, 2.38, 4.0])
  k.box(WARM, [0.12, 0.12, 0.12], [0, 2.48, 4.0])
  k.cyl({ c: '#c8102e', r: 0.6 }, 0.07, 0.09, 0.6, [0, 1.85, -5.8], undefined, 8)
  for (const z of [-4.5, 0, 4.5]) k.torus({ c: '#e65100', r: 0.7 }, 0.18, 0.05, [1.34, 0.42, z], [0, Math.PI / 2, 0], Math.PI * 2, 10, 4)
}

// A river bus, the fast catamaran: twin dark hulls, a long low cabin with a band of lit
// windows, a raised wheelhouse and a red stripe.
function riverBus(k: PropKit) {
  const navy: Look = { c: '#1b2433', r: 0.6 }
  for (const s of [-1, 1]) {
    k.box(navy, [0.7, 0.45, 7.6], [s * 0.85, 0.15, 0])
    k.cone(navy, 0.35, 1.0, [s * 0.85, 0.15, 4.3], [Math.PI / 2, 0, 0], 4)
  }
  k.box(WHITE, [2.4, 0.3, 7.4], [0, 0.5, -0.1])
  k.box(WHITE, [2.2, 0.8, 5.6], [0, 1.05, -0.6])
  k.box({ c: '#c8102e', r: 0.6 }, [2.24, 0.08, 5.64], [0, 0.72, -0.6])
  for (const s of [-1, 1]) k.box(WIN, [0.02, 0.42, 5.2], [s * 1.101, 1.08, -0.6])
  k.box(WIN, [2.0, 0.4, 0.02], [0, 1.08, 2.21])
  k.box(WHITE, [1.4, 0.5, 1.4], [0, 1.7, 1.0])
  k.box(WIN, [1.2, 0.26, 0.02], [0, 1.75, 1.71])
  k.box(navy, [1.5, 0.06, 1.5], [0, 1.98, 1.0])
  k.cyl(WHITE, 0.03, 0.03, 0.6, [0, 2.3, 0.8], undefined, 4)
  k.box(WARM, [0.1, 0.1, 0.1], [0, 2.62, 0.8])
}

// The back row, front at z = 2: a red brick mansion block with stone bands, bays and gables;
// a tall white stucco pair with porches and a first-floor balcony; a steepled church; a
// Portland stone office with its columns.
function mansion(k: PropKit) {
  const brick: Look = { c: '#9a4632', r: 0.95 }
  const H = 7.4
  k.box(brick, [6, H, 4], [0, H / 2, 0])
  k.box(PORTLAND, [6.04, 1.1, 4.04], [0, 0.55, 0])
  for (let fl = 1; fl < 6; fl++) k.box(PORTLAND, [6.06, 0.08, 4.06], [0, 0.45 + fl * 1.15, 0])
  for (const bx of [-1.9, 1.9]) {
    k.box(brick, [1.7, H - 1.1, 0.5], [bx, 1.1 + (H - 1.1) / 2, 2.25])
    for (let fl = 1; fl < 6; fl++) {
      const y = 0.7 + fl * 1.15
      pane(k, PORTLAND, 0.95, 0.85, [bx, y, 2.504])
      pane(k, WIN, 0.8, 0.72, [bx, y, 2.508])
      pane(k, PORTLAND, 0.03, 0.72, [bx, y, 2.512])
    }
    // A shaped gable over each bay.
    k.box(brick, [1.7, 0.9, 0.3], [bx, H + 0.45, 2.15])
    k.box(brick, [1.0, 0.5, 0.3], [bx, H + 1.15, 2.15])
    k.cyl(PORTLAND, 0.3, 0.3, 0.3, [bx, H + 1.4, 2.15], [Math.PI / 2, 0, 0], 8)
    k.box(PORTLAND, [1.8, 0.08, 0.36], [bx, H + 0.02, 2.15])
  }
  for (let fl = 1; fl < 6; fl++) {
    const y = 0.7 + fl * 1.15
    pane(k, WIN, 0.55, 0.7, [0, y, 2.004])
    k.box(PORTLAND, [0.65, 0.07, 0.06], [0, y - 0.38, 2.03])
  }
  k.box({ c: '#2a1a12', r: 0.6 }, [0.6, 0.9, 0.03], [0, 0.45, 2.012])
  k.box(PORTLAND, [1.0, 0.12, 0.4], [0, 1.0, 2.2])
  for (const x of [-1.9, 1.9]) pane(k, WIN, 1.2, 0.6, [x, 0.6, 2.504])
  frustum(k, SLATE, 6, 4, 1.2, 0.4, [0, H, -0.2])
  for (const x of [-2.6, 0, 2.6]) {
    k.box(brick, [0.5, 1.6, 0.6], [x, H + 0.8, -0.6])
    for (const dx of [-0.12, 0.12]) k.cyl({ c: '#b5653b', r: 0.9 }, 0.05, 0.065, 0.28, [x + dx, H + 1.74, -0.6], undefined, 5)
  }
}
function stuccoPair(k: PropKit) {
  const H = 6.6
  k.box(WHITE, [6, H, 4], [0, H / 2, 0])
  for (let fl = 1; fl < 5; fl++) k.box({ c: '#dcd6ca', r: 0.8 }, [6.04, 0.08, 4.04], [0, 0.4 + fl * 1.2, 0])
  for (const hx of [-1.5, 1.5]) {
    // Columned porch, door under its fanlight.
    for (const s of [-1, 1]) k.cyl(WHITE, 0.08, 0.09, 1.3, [hx - 0.75 + s * 0.38, 0.65, 2.5], undefined, 6)
    k.box(WHITE, [1.0, 0.18, 0.6], [hx - 0.75, 1.38, 2.3])
    k.box({ c: '#141414', r: 0.4 }, [0.45, 0.95, 0.03], [hx - 0.75, 0.5, 2.012])
    archTop(k, WIN, 0.45, 0.03, [hx - 0.75, 1.0, 2.012])
    for (let fl = 0; fl < 5; fl++) for (const x of fl ? [-0.75, 0, 0.75] : [0.3, 0.9]) {
      const y = 0.4 + fl * 1.2 + (fl ? 0.2 : 0.1)
      const h = fl === 1 ? 0.95 : fl === 4 ? 0.55 : 0.75
      pane(k, WIN, 0.42, h, [hx + x, y + h / 2, 2.004])
      pane(k, WHITE, 0.03, h, [hx + x, y + h / 2, 2.008])
      if (fl > 1) k.box({ c: '#dcd6ca', r: 0.8 }, [0.56, 0.08, 0.06], [hx + x, y + h + 0.06, 2.03])
    }
  }
  // The first-floor balcony with its iron rail, running across both houses.
  k.box(WHITE, [6, 0.1, 0.5], [0, 1.6, 2.25])
  k.box(IRON_P, [6, 0.03, 0.03], [0, 2.05, 2.48])
  for (let i = 0; i < 30; i++) bar(k, IRON_P, 0.02, 0.45, [-2.95 + i * 0.2, 1.83, 2.48])
  k.box({ c: '#dcd6ca', r: 0.8 }, [6.1, 0.22, 4.1], [0, H, 0])
  k.box(WHITE, [6, 0.5, 0.12], [0, H + 0.35, 1.94])
  for (const x of [-2.2, 2.2]) {
    k.box(WHITE, [0.6, 1.4, 0.5], [x, H + 0.7, -0.4])
    for (const dx of [-0.15, 0, 0.15]) k.cyl({ c: '#b5653b', r: 0.9 }, 0.045, 0.06, 0.26, [x + dx, H + 1.53, -0.4], undefined, 5)
  }
  // Black railings along the front.
  k.box(IRON_P, [6, 0.03, 0.03], [0, 0.55, 2.95])
  for (let i = 0; i < 24; i++) bar(k, IRON_P, 0.025, 0.6, [-2.9 + i * 0.25, 0.3, 2.95])
}
function church(k: PropKit) {
  const st: Look = PORTLAND
  k.box(st, [3.6, 4.4, 4], [-1.1, 2.2, 0])
  gable(k, SLATE, 3.8, 4.2, 1.4, [-1.1, 4.4, 0], Math.PI / 2)
  for (const z of [-1.2, 0, 1.2]) {
    pane(k, WIN, 0.6, 1.6, [-1.1 + z, 2.1, 2.004])
    archTop(k, WIN, 0.6, 0.03, [-1.1 + z, 2.9, 2.012])
  }
  k.box(PORT_D, [3.64, 0.2, 4.04], [-1.1, 4.3, 0])
  // The tower: plain stages up to the belfry, then the stepped spire Wren liked.
  const tx = 1.9
  k.box(st, [2.2, 6.4, 2.2], [tx, 3.2, 0.6])
  k.box({ c: '#2a1a12', r: 0.7 }, [0.7, 1.3, 0.03], [tx, 0.65, 1.712])
  archTop(k, { c: '#2a1a12', r: 0.7 }, 0.7, 0.03, [tx, 1.3, 1.712])
  k.box(PORT_D, [2.3, 0.15, 2.3], [tx, 3.2, 0.6])
  k.cyl({ c: '#2a3a52', r: 0.6 }, 0.55, 0.55, 0.05, [tx, 4.5, 1.72], [Math.PI / 2, 0, 0], 12)
  k.cyl(GILT, 0.5, 0.5, 0.05, [tx, 4.5, 1.73], [Math.PI / 2, 0, 0], 12)
  k.box(DARK, [0.04, 0.4, 0.02], [tx, 4.6, 1.76])
  k.box(PORT_D, [2.4, 0.2, 2.4], [tx, 6.4, 0.6])
  k.box(st, [1.7, 1.6, 1.7], [tx, 7.3, 0.6])
  for (const [dx, dz, ry] of [[0, 0.86, 0], [0.86, 0, Math.PI / 2], [-0.86, 0, Math.PI / 2]] as const) {
    k.box(DARK, [0.5, 0.9, 0.03], [tx + dx, 7.2, 0.6 + dz], [0, ry, 0])
    archTop(k, DARK, 0.5, 0.03, [tx + dx, 7.65, 0.6 + dz], ry)
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cone(st, 0.12, 0.5, [tx + sx * 0.85, 8.35, 0.6 + sz * 0.85], undefined, 6)
  k.box(PORT_D, [1.9, 0.15, 1.9], [tx, 8.15, 0.6])
  k.cyl(st, 0.65, 0.7, 0.9, [tx, 8.65, 0.6], undefined, 8)
  k.cyl(st, 0.45, 0.5, 0.8, [tx, 9.5, 0.6], undefined, 8)
  k.cyl(st, 0.3, 0.33, 0.7, [tx, 10.25, 0.6], undefined, 8)
  k.cone(st, 0.26, 1.6, [tx, 11.4, 0.6], undefined, 8)
  k.sphere(GILT, 0.09, [tx, 12.25, 0.6], [1, 1, 1], 6, 4)
  k.box(GILT, [0.03, 0.5, 0.03], [tx, 12.55, 0.6])
  k.box(GILT, [0.3, 0.05, 0.03], [tx, 12.7, 0.6])
}
function office(k: PropKit) {
  const H = 8.2
  k.box(PORTLAND, [6, H, 4], [0, H / 2, 0])
  // Rusticated base, giant columns through the middle floors, cornice and attic.
  for (let i = 0; i < 5; i++) k.box(PORT_D, [6.04, 0.04, 4.04], [0, 0.4 + i * 0.4, 0])
  for (const x of [-2.25, -0.75, 0.75, 2.25]) {
    pane(k, WIN, 0.75, 1.0, [x, 0.9, 2.004])
    archTop(k, WIN, 0.75, 0.03, [x, 1.4, 2.012])
    for (const y of [2.6, 3.8, 5.0]) {
      pane(k, WIN, 0.65, 0.85, [x, y, 2.004])
      k.box(PORT_D, [0.8, 0.08, 0.08], [x, y + 0.5, 2.04])
    }
    pane(k, WIN, 0.6, 0.55, [x, 7.2, 2.004])
  }
  for (const x of [-3, -1.5, 0, 1.5, 3]) {
    k.cyl(PORTLAND, 0.2, 0.22, 3.8, [x, 4.0, 2.2], undefined, 8)
    k.box(PORT_D, [0.5, 0.2, 0.5], [x, 6.0, 2.2])
    k.box(PORT_D, [0.5, 0.15, 0.5], [x, 2.05, 2.2])
  }
  k.box(PORT_D, [6.3, 0.35, 4.6], [0, 6.3, 0.15])
  k.box(PORT_D, [6.2, 0.2, 4.3], [0, H, 0])
  for (let i = 0; i < 12; i++) k.box(PORTLAND, [0.12, 0.4, 0.12], [-2.75 + i * 0.5, H + 0.3, 1.9])
  k.box(PORT_D, [6.1, 0.08, 0.2], [0, H + 0.52, 1.9])
  k.box({ c: '#2a1a12', r: 0.7 }, [0.5, 0.3, 0.02], [0, 1.8, 2.012])
  k.cyl(IRON_P, 0.025, 0.025, 2.2, [0, H + 1.6, 0], undefined, 4)
  k.box({ c: '#c62828', r: 0.8 }, [0.02, 0.4, 0.6], [0, H + 2.4, 0.3])
}
const BACKS: [(k: PropKit) => void, number][] = [[mansion, 3], [stuccoPair, 3], [church, 1], [office, 2]]

// The roofs beyond the back row: a 48-long stretch of slate roofs, chimney stacks and lit
// attic windows, plane tree crowns between and a spire or two (x away from the road).
function roofs(k: PropKit, seed: number) {
  const r = rand(seed)
  const walls = ['#8a4b36', '#a65b3e', '#7b4535', '#c9a86a', '#e4ddcb', '#b58a5a']
  for (let row = 0; row < 3; row++) {
    for (let z = -24; z < 24;) {
      const w = 2.4 + r() * 2.2
      const d = 3 + r() * 1.5
      const h = 4.5 + row * 1.6 + r() * 2.5
      const x = row * 5 + d / 2 + r() * 0.6
      const wall: Look = { c: walls[Math.floor(r() * walls.length)], r: 0.95 }
      k.box(wall, [d, h, w], [x, h / 2, z + w / 2])
      if (r() < 0.75) gable(k, SLATE, w + 0.1, d + 0.2, 1.1, [x, h, z + w / 2], Math.PI / 2)
      else frustum(k, SLATE, d, w, 0.6, 0.6, [x, h, z + w / 2])
      k.box(wall, [0.5, 1.4, 0.4], [x + d / 4, h + 0.7, z + 0.4])
      k.cyl({ c: '#b5653b', r: 0.9 }, 0.05, 0.06, 0.25, [x + d / 4, h + 1.5, z + 0.4], undefined, 5)
      if (row < 2) for (let fl = 1; fl < h - 1; fl += 1.3) for (const dz of [-0.5, 0.5]) if (r() < 0.6) pane(k, WIN, 0.4, 0.55, [x - d / 2 - 0.005, fl + 0.4, z + w / 2 + dz * (w / 2.6)], -Math.PI / 2)
      z += w + 0.1
    }
  }
  for (let i = 0; i < 10; i++) {
    const x = 3.8 + (i % 2) * 5 + r() * 0.6
    const z = -22 + i * 4.6 + r()
    const rad = 1.2 + r() * 0.6
    k.cyl({ c: '#6d5a48', r: 1 }, 0.15, 0.2, 5, [x, 2.5, z], undefined, 5)
    k.ico({ c: LEAF[i % 3], r: 1 }, rad, [x, 5 + rad * 0.3, z], [1, 0.85, 1], 0)
  }
  const sz = -10 + r() * 20
  k.box(PORTLAND, [1.6, 9, 1.6], [12.5, 4.5, sz])
  k.cone(SLATE, 1.0, 5, [12.5, 11.5, sz], [0, Math.PI / 4, 0], 4)
}

// The royal palace behind its gates, in its own frame (built along x, the road at +z): the long
// Portland stone front with its portico, balcony and flag, the forecourt, black and gold
// railings with the gilded centre gates, sentry boxes and the guards in their bearskins.
function guard(k: PropKit, x: number, z: number, ry: number, march = false) {
  person(k, { top: '#c8102e', low: '#15151f', skin: SKIN[march ? 1 : 0], hair: HAIR[0], wave: march }, x, z, ry)
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const at = (u: number, y: number, w: number): V3 => [x + (u * c + w * s) * PS, y * PS, z + (-u * s + w * c) * PS]
  k.cyl({ c: '#111114', r: 1 }, 0.09 * PS, 0.098 * PS, 0.24 * PS, at(0, 0.75, -0.005), [0, ry, 0], 8)
  k.sphere({ c: '#111114', r: 1 }, 0.09 * PS, at(0, 0.87, -0.005), [1, 0.5, 1], 8, 3, Math.PI / 2)
  k.box(WHITE, [0.19 * PS, 0.03 * PS, 0.19 * PS], at(0, 0.3, 0), [0, ry, 0])
  for (let i = 0; i < 3; i++) k.box(GILT, [0.015 * PS, 0.015 * PS, 0.01 * PS], at(0, 0.36 + i * 0.05, 0.086), [0, ry, 0])
  k.box({ c: '#111114', r: 0.8 }, [0.016 * PS, 0.03 * PS, 0.01 * PS], at(0, 0.59, 0.08), [0, ry, 0])
  // The rifle at the shoulder.
  k.rod({ c: '#3a2a20', r: 0.7 }, at(-0.14, 0.27, 0.03), at(-0.14, 0.82, 0.06), 0.012 * PS, 4)
}
function sentryBox(k: PropKit, x: number, z: number) {
  const box: Look = { c: '#1e2128', r: 0.6 }
  k.box(box, [0.8, 0.08, 0.7], [x, 0.04, z])
  k.box(box, [0.8, 1.55, 0.06], [x, 0.85, z - 0.32])
  for (const s of [-1, 1]) k.box(box, [0.06, 1.55, 0.7], [x + s * 0.37, 0.85, z])
  k.box({ c: '#0e0f12', r: 1 }, [0.68, 1.5, 0.02], [x, 0.84, z - 0.28])
  gable(k, box, 0.9, 0.8, 0.35, [x, 1.62, z], 0)
  k.box({ c: '#c8102e', r: 0.6 }, [0.82, 0.05, 0.72], [x, 1.62, z])
  k.box(GILT, [0.16, 0.16, 0.02], [x, 1.78, z + 0.36], [0, 0, Math.PI / 4])
}
function royalPalace(k: PropKit) {
  const L = 30
  const fz = -6.5
  const H = 7.2
  k.box(PORTLAND, [L, H, 5], [0, H / 2, fz - 2.5])
  for (let i = 1; i < 6; i++) k.box(PORT_D, [L + 0.02, 0.04, 5.02], [0, i * 0.4, fz - 2.5])
  k.box(PORT_D, [L + 0.1, 0.2, 5.1], [0, 2.4, fz - 2.5])
  k.box(PORT_D, [L + 0.2, 0.3, 5.2], [0, H - 0.15, fz - 2.5])
  // End pavilions, a little forward.
  for (const s of [-1, 1]) {
    k.box(PORTLAND, [3.6, H + 0.4, 0.6], [s * 13.2, (H + 0.4) / 2, fz + 0.3])
    for (const dx of [-1.4, 1.4]) k.box(PORT_D, [0.3, H - 2.6, 0.2], [s * 13.2 + dx, 2.4 + (H - 2.6) / 2, fz + 0.65])
    gable(k, PORTLAND, 3.8, 0.7, 1.0, [s * 13.2, H + 0.4, fz + 0.3])
  }
  // Windows: arched below, tall pedimented ones on the main floor, small ones above.
  for (let x = -11; x <= 11; x += 1.6) {
    if (Math.abs(x) < 3.6) continue
    const f = fz + 0.012
    pane(k, WIN, 0.62, 1.1, [x, 0.95, f - 0.008])
    archTop(k, WIN, 0.62, 0.03, [x, 1.5, f])
    pane(k, WIN, 0.66, 1.5, [x, 3.55, f - 0.008])
    k.box(PORT_D, [0.86, 0.1, 0.1], [x, 4.4, f + 0.04])
    gable(k, PORT_D, 0.9, 0.12, 0.22, [x, 4.45, f + 0.04])
    pane(k, WIN, 0.6, 0.85, [x, 5.6, f - 0.008])
  }
  for (const s of [-1, 1]) for (const dx of [-0.8, 0.8]) for (const y of [0.95, 3.55, 5.6]) pane(k, WIN, 0.6, y > 3 && y < 4 ? 1.5 : 0.9, [s * 13.2 + dx, y, fz + 0.604])
  // The portico: six giant columns, a pediment, the balcony with its red and gold drape.
  for (let i = 0; i < 6; i++) {
    const x = -3 + i * 1.2
    k.cyl(PORTLAND, 0.24, 0.27, 4.3, [x, 4.75, fz + 0.9], undefined, 8)
    k.box(PORT_D, [0.65, 0.25, 0.65], [x, 6.95, fz + 0.9])
  }
  k.box(PORTLAND, [7.6, 0.5, 1.4], [0, 7.3, fz + 0.4])
  gable(k, PORTLAND, 7.8, 1.4, 1.5, [0, 7.55, fz + 0.4])
  k.box(PORT_D, [7.2, 2.4, 0.2], [0, 1.2, fz + 0.1])
  for (const x of [-2.4, 0, 2.4]) {
    pane(k, WIN, 1.1, 1.8, [x, 1.0, fz + 0.204])
    pane(k, WIN, 0.9, 1.6, [x, 3.4, fz + 0.004])
  }
  k.box(PORT_D, [7.6, 0.15, 1.6], [0, 2.6, fz + 0.8])
  for (let i = 0; i < 24; i++) k.box(PORTLAND, [0.1, 0.4, 0.1], [-3.6 + i * 0.31, 2.88, fz + 1.55])
  k.box(PORT_D, [7.6, 0.08, 0.16], [0, 3.1, fz + 1.55])
  k.box({ c: '#a5121e', r: 0.8 }, [2.6, 0.55, 0.03], [0, 2.85, fz + 1.62])
  k.box(GILT, [2.6, 0.06, 0.035], [0, 2.6, fz + 1.62])
  // Balustrade along the roof, urns, and the flag on its pole.
  for (let x = -14.5; x <= 14.5; x += 0.75) k.box(PORTLAND, [0.12, 0.45, 0.12], [x, H + 0.22, fz - 0.15])
  k.box(PORT_D, [L, 0.1, 0.25], [0, H + 0.5, fz - 0.15])
  for (const x of [-9, -5, 5, 9]) {
    k.cyl(PORTLAND, 0.12, 0.18, 0.35, [x, H + 0.72, fz - 0.15], undefined, 8)
    k.sphere(PORTLAND, 0.16, [x, H + 0.95, fz - 0.15], [1, 1.2, 1], 8, 4)
  }
  k.cyl(WHITE, 0.05, 0.06, 4.0, [0, H + 2.0 + 1.5, fz - 2], undefined, 6)
  for (const [dx, dy, c] of [[0.45, 0.35, '#c8102e'], [1.35, 0.35, '#e0b84a'], [0.45, -0.35, '#1f3c7a'], [1.35, -0.35, '#c8102e']] as const) k.box({ c, r: 0.8 }, [0.9, 0.7, 0.04], [dx + 0.05, H + 4.6 + dy, fz - 2])
  // The forecourt, its railings and gates, sentry boxes and guards.
  for (let x = -15; x <= 15; x += 0.5) {
    if (Math.abs(x) < 1.9 || Math.abs(Math.abs(x) - 9) < 0.45) continue
    bar(k, IRON_P, 0.035, 1.4, [x, 0.7, 0.2], GILT)
  }
  for (const y of [0.15, 1.2]) k.box(IRON_P, [30, 0.04, 0.04], [0, y, 0.2])
  for (const x of [-2.3, 2.3, -9.6, -8.4, 8.4, 9.6]) {
    const big = Math.abs(x) < 3
    k.box(PORTLAND, [big ? 0.8 : 0.5, big ? 2.4 : 1.8, big ? 0.8 : 0.5], [x, big ? 1.2 : 0.9, 0.2])
    k.box(PORT_D, [big ? 0.95 : 0.6, 0.15, big ? 0.95 : 0.6], [x, big ? 2.45 : 1.85, 0.2])
    if (big) {
      k.box(WARM, [0.3, 0.4, 0.3], [x, 2.75, 0.2])
      frustum(k, IRON_P, 0.4, 0.4, 0.25, 0.1, [x, 2.95, 0.2])
    } else k.sphere(GILT, 0.15, [x, 2.05, 0.2], [1, 1, 1], 6, 4)
  }
  // The centre gates: iron leaves, gilded crests and scrolls.
  for (let x = -1.85; x <= 1.86; x += 0.15) bar(k, IRON_P, 0.03, 1.9, [x, 0.95, 0.2], GILT)
  for (const y of [0.2, 1.0, 1.85]) k.box(IRON_P, [3.8, 0.05, 0.05], [0, y, 0.2])
  for (const s of [-1, 1]) {
    k.torus(GILT, 0.3, 0.04, [s * 0.95, 1.42, 0.22], [0, 0, 0], Math.PI * 2, 14, 4)
    k.box(GILT, [0.3, 0.3, 0.03], [s * 0.95, 1.42, 0.22], [0, 0, Math.PI / 4])
  }
  k.torus(GILT, 0.45, 0.05, [0, 1.9, 0.22], [0, 0, 0], Math.PI, 14, 4)
  k.box(GILT, [0.35, 0.3, 0.04], [0, 2.15, 0.22])
  for (const s of [-1, 1]) {
    sentryBox(k, s * 3.6, -1.2)
    guard(k, s * 3.6, -0.6, 0)
  }
  guard(k, -6.2, -3.4, Math.PI / 2, true)
  guard(k, -5.5, -3.4, Math.PI / 2, true)
  guard(k, 6.5, -4.6, 0)
}

// The covered market, in its own frame like the palace: brick end pavilions with lunettes,
// an iron colonnade under a glazed barrel roof, the lit hall inside, its name over the door.
const BARREL = new CylinderGeometry(1, 1, 1, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2)
function market(k: PropKit) {
  const L = 28
  const fz = -3.6
  const D = 3.6
  const brick: Look = { c: '#8a4b36', r: 0.95 }
  const iron: Look = { c: '#2f4a3a', r: 0.5 }
  k.box({ c: '#3a2e26', r: 0.9 }, [L - 6, 0.06, D], [0, 0.03, fz - D / 2])
  k.box(WIN, [L - 6, 3.0, 0.04], [0, 1.6, fz - D + 0.1])
  for (const s of [-1, 1]) {
    const x = s * (L / 2 - 1.5)
    k.box(brick, [3, 5.4, D + 0.4], [x, 2.7, fz - D / 2])
    k.box(PORTLAND, [3.04, 0.15, D + 0.44], [x, 0.9, fz - D / 2])
    k.box(PORTLAND, [3.2, 0.2, D + 0.5], [x, 5.4, fz - D / 2])
    gable(k, brick, 3.2, 0.4, 1.2, [x, 5.5, fz + 0.0])
    k.box(WIN, [1.6, 2.2, 0.03], [x, 2.3, fz + 0.212])
    archTop(k, WIN, 1.6, 0.03, [x, 3.4, fz + 0.212])
    k.box(PORTLAND, [1.9, 0.12, 0.1], [x, 1.2, fz + 0.25])
    for (const dx of [-0.4, 0, 0.4]) k.box(PORTLAND, [0.04, 2.6, 0.04], [x + dx, 2.5, fz + 0.23])
    k.cyl(PORTLAND, 0.4, 0.4, 0.04, [x, 5.85, fz + 0.21], [Math.PI / 2, 0, 0], 10)
  }
  // Colonnade and arches.
  for (let x = -11; x <= 11; x += 2) {
    k.cyl(iron, 0.09, 0.11, 3.2, [x, 1.6, fz], undefined, 6)
    k.box(iron, [0.26, 0.14, 0.26], [x, 3.2, fz])
    if (x < 11) k.torus(iron, 0.95, 0.05, [x + 1, 3.25, fz], [0, 0, 0], Math.PI, 10, 3)
  }
  k.box(iron, [L - 6, 0.12, 0.14], [0, 3.3, fz])
  k.box(iron, [L - 6, 0.3, 0.14], [0, 4.25, fz])
  // The glazed barrel roof and its ribs.
  k.add({ c: '#a9c2c8', r: 0.25 }, BARREL, [0, 4.4, fz - D / 2], [0, 0, 0], [L - 6, D / 2, D / 2])
  for (let x = -10; x <= 10; x += 2) k.torus(iron, D / 2, 0.04, [x, 4.4, fz - D / 2], [0, Math.PI / 2, 0], Math.PI, 10, 3)
  k.box(iron, [L - 6, 0.08, 0.08], [0, 4.4 + D / 2, fz - D / 2])
  // Name board over the middle bay.
  k.box({ c: '#1d3b2a', r: 0.5 }, [3.2, 0.5, 0.08], [0, 3.85, fz + 0.1])
  text(k, GILT, 'MARKET', [0, 3.85, fz + 0.145], 0.07)
  // Stalls inside under the lights.
  for (let x = -9; x <= 9; x += 3) {
    k.box({ c: '#6d4a2c', r: 0.9 }, [1.6, 0.7, 0.8], [x, 0.35, fz - D + 0.7])
    k.box({ c: ['#c62828', '#f2c230', '#2e7d32', '#ff8f00'][Math.abs(x / 3) % 4], r: 0.9 }, [1.5, 0.12, 0.7], [x, 0.76, fz - D + 0.7])
  }
}
// A market stall facing +z: a trestle of produce under a striped canopy on four poles.
function stall(k: PropKit, stripe: string, goods: string[]) {
  const wood: Look = { c: '#6d4a2c', r: 0.9 }
  k.box(wood, [1.5, 0.05, 0.7], [0, 0.55, 0])
  k.box(wood, [1.5, 0.5, 0.04], [0, 0.3, 0.33])
  for (const x of [-0.72, 0.72]) for (const z of [-0.33, 0.33]) k.cyl(IRON_P, 0.02, 0.02, 1.5, [x, 0.75, z], undefined, 4)
  for (let i = 0; i < 6; i++) k.box(i % 2 ? WHITE : { c: stripe, r: 0.8 }, [0.26, 0.03, 0.9], [-0.65 + i * 0.26, 1.52, 0.05], [0.18, 0, 0])
  for (let i = 0; i < 6; i++) k.box(i % 2 ? WHITE : { c: stripe, r: 0.8 }, [0.26, 0.12, 0.02], [-0.65 + i * 0.26, 1.38, 0.5])
  // Crates of produce, rows of fruit in each.
  goods.forEach((c, i) => {
    const x = -0.55 + (i % 4) * 0.37
    const z = i < 4 ? 0.15 : -0.18
    const y = i < 4 ? 0.6 : 0.7
    k.box({ c: '#a9875a', r: 0.9 }, [0.34, 0.1, 0.28], [x, y, z])
    for (let j = 0; j < 4; j++) blob(k, { c, r: 0.8 }, 0.055, [x - 0.09 + (j % 2) * 0.18, y + 0.08, z - 0.06 + Math.floor(j / 2) * 0.12])
  })
  k.box({ c: '#f2efe8', r: 0.8 }, [0.2, 0.12, 0.01], [0.4, 0.75, 0.36], [-0.3, 0, 0])
  for (const x of [-0.4, 0.3]) k.box({ c: '#a9875a', r: 0.9 }, [0.4, 0.25, 0.3], [x, 0.125, -0.1])
}
// Shoppers between the stalls.
function shoppers(k: PropKit) {
  folk(k, { top: COATS[7], low: '#2b2b30', skin: SKIN[0], hair: HAIR[2], coat: true, bag: true }, -0.2, 0, Math.PI / 2)
  folk(k, { top: COATS[5], low: '#3d3d3d', skin: SKIN[3], hair: HAIR[3], hat: 'cap', hatC: '#2b2b30' }, 0.25, 0.3, -2.4)
}

// The castle keep on the far bank, built facing +z: the white tower with its four corner
// turrets under lead cupolas, curtain walls and drum towers, the gatehouse and the flag.
function castle(k: PropKit) {
  const stone: Look = { c: '#ddd6c4', r: 0.9 }
  const stoneD: Look = { c: '#bfb7a2', r: 0.9 }
  const W = 7
  const D = 8
  const H = 8.5
  k.box(stone, [W, H, D], [0, H / 2, -3])
  for (const x of [-W / 2 + 0.1, -1.2, 1.2, W / 2 - 0.1]) k.box(stoneD, [0.3, H, 0.3], [x, H / 2, -3 + D / 2 + 0.1])
  for (let fl = 0; fl < 3; fl++) for (const x of [-2.3, 0, 2.3]) {
    const y = 2 + fl * 2.2
    pane(k, WIN, 0.4, 0.8, [x, y, -3 + D / 2 + 0.004])
    archTop(k, WIN, 0.4, 0.03, [x, y + 0.4, -3 + D / 2 + 0.012])
  }
  for (let i = 0; i < 9; i++) k.box(stone, [0.45, 0.5, 0.3], [-W / 2 + 0.4 + i * 0.775, H + 0.25, -3 + D / 2 - 0.15])
  for (let i = 0; i < 9; i++) k.box(stone, [0.3, 0.5, 0.45], [W / 2 - 0.15, H + 0.25, -3 - D / 2 + 0.4 + i * 0.9])
  for (const [sx, sz, round] of [[-1, 1, false], [1, 1, true], [-1, -1, false], [1, -1, false]] as const) {
    const x = sx * (W / 2)
    const z = -3 + sz * (D / 2)
    if (round) k.cyl(stone, 0.95, 0.95, H + 2, [x, (H + 2) / 2, z], undefined, 10)
    else k.box(stone, [1.5, H + 2, 1.5], [x, (H + 2) / 2, z])
    k.sphere(LEAD, 0.85, [x, H + 2, z], [1, 1.3, 1], 8, 4, Math.PI / 2)
    k.cyl(LEAD, 0.08, 0.2, 0.5, [x, H + 3.3, z], undefined, 6)
    k.box(GILT, [0.04, 0.6, 0.04], [x, H + 3.8, z])
  }
  k.cyl(WHITE, 0.04, 0.05, 3, [0, H + 1.5, -3], undefined, 5)
  k.box({ c: '#c8102e', r: 0.8 }, [1.4, 0.8, 0.04], [0.72, H + 2.6, -3])
  k.box({ c: '#f2efe8', r: 0.8 }, [1.4, 0.18, 0.05], [0.72, H + 2.6, -3])
  k.box({ c: '#f2efe8', r: 0.8 }, [0.18, 0.8, 0.05], [0.72, H + 2.6, -3])
  // The curtain wall: front with a gatehouse, sides back to the keep, drum towers at corners.
  const wf = 5.5
  for (const [x0, x1] of [[-10, -1.6], [1.6, 10]]) {
    k.box(stoneD, [x1 - x0, 3.4, 1], [(x0 + x1) / 2, 1.7, wf])
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.7) k.box(stoneD, [0.4, 0.45, 1], [x, 3.6, wf])
  }
  for (const s of [-1, 1]) {
    k.box(stoneD, [1, 3.4, 12], [s * 10, 1.7, wf - 6])
    for (let z = wf - 11.7; z < wf; z += 0.7) k.box(stoneD, [1, 0.45, 0.4], [s * 10, 3.6, z])
    k.cyl(stone, 1.4, 1.5, 4.6, [s * 10, 2.3, wf], undefined, 10)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      k.box(stone, [0.45, 0.5, 0.35], [s * 10 + Math.cos(a) * 1.3, 4.85, wf + Math.sin(a) * 1.3], [0, -a, 0])
    }
    k.cyl(stone, 1.0, 1.1, 5.4, [s * 1.6, 2.7, wf + 0.3], undefined, 10)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      k.box(stone, [0.4, 0.5, 0.3], [s * 1.6 + Math.cos(a) * 0.95, 5.65, wf + 0.3 + Math.sin(a) * 0.95], [0, -a, 0])
    }
    for (const y of [2, 3.6]) k.box(WIN, [0.12, 0.45, 0.03], [s * 1.6, y, wf + 1.37])
  }
  k.box(stoneD, [2.2, 4.4, 1.2], [0, 2.2, wf + 0.1])
  k.box(DARK, [1.4, 2.0, 0.03], [0, 1.0, wf + 0.712])
  archTop(k, DARK, 1.4, 0.03, [0, 2.0, wf + 0.712])
  for (let i = 0; i < 4; i++) k.box(stoneD, [0.35, 0.45, 1.2], [-0.8 + i * 0.53, 4.62, wf + 0.1])
}

// A 48-long stretch of the far bank, built in its own frame with +x towards the race: the
// granite river wall with lamps along it, a promenade of plane trees, then wharves, theatres and
// glass offices with lit windows, and taller towers behind.
const WALL_FB: Look = { c: '#9a9488', r: 0.9 }
function farBank(k: PropKit, seed: number, build: boolean) {
  const r = rand(seed)
  k.box({ c: '#8d8a82', r: 0.95 }, [70, 0.06, 48.2], [-35, 0.03, 0])
  k.box(WALL_FB, [0.6, 1.0, 48.2], [-0.3, 0.5, 0])
  k.box({ c: '#b5ae9f', r: 0.9 }, [0.7, 0.1, 48.2], [-0.3, 1.03, 0])
  for (let z = -20; z < 24; z += 8) {
    k.cyl(IRON_P, 0.05, 0.07, 1.8, [-0.3, 1.95, z], undefined, 6)
    k.sphere(WIN, 0.18, [-0.3, 2.95, z], [1, 1, 1], 6, 4)
  }
  for (let z = -21; z < 24; z += 6) {
    k.cyl({ c: '#8a8270', r: 1 }, 0.12, 0.16, 2.2, [-2.2, 1.1, z], undefined, 6)
    k.ico({ c: LEAF[Math.floor(r() * 3)], r: 1 }, 1.2, [-2.2, 3.0, z], [1, 0.85, 1], 0)
    k.ico({ c: LEAF[Math.floor(r() * 3)], r: 1 }, 0.8, [-2.0, 3.6, z + 0.4], [1, 0.85, 1], 0)
  }
  if (!build) {
    k.box({ c: '#5f7f45', r: 1 }, [16, 0.04, 46], [-12, 0.07, 0])
    for (let i = 0; i < 8; i++) {
      const x = -6 - r() * 16
      const z = -20 + i * 5.5
      k.cyl({ c: '#6d5a48', r: 1 }, 0.14, 0.18, 2.2, [x, 1.1, z], undefined, 5)
      k.ico({ c: LEAF[i % 3], r: 1 }, 1.4 + r() * 0.5, [x, 3.0, z], [1, 0.85, 1], 0)
    }
    // Behind the park, the long stone front of the old county hall with its lit windows and a
    // little cupola, and towers beyond.
    k.box(PORTLAND, [7, 7, 40], [-26, 3.5, 0])
    k.box(PORT_D, [7.2, 0.3, 40.2], [-26, 7, 0])
    frustum(k, LEAD, 7, 40, 1.4, 0.6, [-26, 7.15, 0])
    for (let y = 1; y < 6.5; y += 1.4) for (let z = -19; z < 19.5; z += 1.3) pane(k, WIN, 0.6, 0.8, [-22.495, y + 0.4, z], Math.PI / 2)
    for (let i = 0; i < 6; i++) k.cyl(PORTLAND, 0.25, 0.28, 4, [-22.2, 3.6, -3 + i * 1.2], undefined, 6)
    k.box(PORTLAND, [3, 4, 3], [-26, 9.5, 0])
    k.cyl(LEAD, 1.2, 1.4, 1.2, [-26, 12.1, 0], undefined, 8)
    k.cone(LEAD, 0.9, 1.6, [-26, 13.5, 0], undefined, 8)
    for (const z of [-14, 2, 15]) {
      const h = 14 + r() * 8
      k.box({ c: '#56677a', r: 0.3 }, [5, h, 5], [-36, h / 2, z])
      for (let y = 1.5; y < h - 0.5; y += 1.4) pane(k, WIN, 4.4, 0.45, [-33.495, y, z], Math.PI / 2)
    }
    return
  }
  const brickC = ['#7b4535', '#8a4b36', '#a65b3e', '#6d3a2c']
  for (let z = -24; z < 23.5;) {
    const w = Math.min(5 + r() * 4, 24 - z)
    const kind = Math.floor(r() * 3)
    const cz = z + w / 2
    if (kind === 0) {
      // A brick warehouse: arched windows in rows, a loading door and its hoist, a sign.
      const h = 5 + r() * 3
      const look: Look = { c: brickC[Math.floor(r() * 4)], r: 0.95 }
      k.box(look, [5, h, w - 0.2], [-6.5, h / 2, cz])
      for (let y = 1; y < h - 0.8; y += 1.25) for (let dz = -w / 2 + 0.8; dz < w / 2 - 0.5; dz += 0.9) pane(k, WIN, 0.45, 0.6, [-3.995, y + 0.3, cz + dz], Math.PI / 2)
      k.box({ c: '#3a2a20', r: 0.9 }, [0.04, 1.6, 0.8], [-3.98, h / 2 + 0.5, cz])
      k.box({ c: '#3a2a20', r: 0.9 }, [0.8, 0.12, 0.12], [-3.6, h - 0.4, cz])
      k.box({ c: '#5a5a5a', r: 0.8 }, [5.1, 0.25, w - 0.1], [-6.5, h, cz])
      if (r() < 0.6) {
        k.box({ c: '#2a2420', r: 0.8 }, [0.1, 0.9, 2.8], [-4.4, h + 0.6, cz])
        for (const s of [-1, 1]) k.box(IRON_P, [0.06, 0.4, 0.06], [-4.4, h + 0.1, cz + s * 1.2])
        text(k, WIN, 'WHARF', [-4.34, h + 0.6, cz], 0.12, Math.PI / 2)
      }
    } else if (kind === 1) {
      // A concrete theatre: stacked horizontal terraces, lit glass between.
      for (let i = 0; i < 3; i++) {
        const y = i * 2
        k.box({ c: '#9e9a92', r: 0.95 }, [6 - i * 1.2, 0.6, w - 0.2], [-7 - i * 0.6, y + 1.7, cz])
        pane(k, WIN, w - 0.6, 1.4, [-4.01 - i * 1.2, y + 0.7, cz], Math.PI / 2)
        k.box({ c: '#8a8680', r: 0.95 }, [5.8 - i * 1.2, 1.4, w - 0.4], [-7.1 - i * 0.6, y + 0.7, cz])
      }
    } else {
      // A glass office, banded with lit floors.
      const h = 8 + r() * 5
      k.box({ c: '#4b5a66', r: 0.3 }, [5, h, w - 0.2], [-6.5, h / 2, cz])
      for (let y = 1; y < h - 0.4; y += 1.1) pane(k, WIN, w - 0.5, 0.5, [-3.995, y, cz], Math.PI / 2)
      for (let dz = -w / 2 + 0.6; dz < w / 2 - 0.3; dz += 1.0) k.box({ c: '#3a4650', r: 0.4 }, [0.06, h, 0.06], [-3.98, h / 2, cz + dz])
    }
    z += w
  }
  // Towers behind.
  for (let i = 0; i < 4; i++) {
    const z = -18 + i * 12 + r() * 3
    const h = 13 + r() * 10
    const w = 4 + r() * 2
    const glassy = r() < 0.6
    const tx = -16 - r() * 4
    k.box(glassy ? { c: '#56677a', r: 0.3 } : PORT_D, [w, h, w], [tx, h / 2, z])
    for (let y = 1.5; y < h - 0.5; y += 1.4) pane(k, WIN, w - 0.6, 0.45, [tx + w / 2 + 0.005, y, z], Math.PI / 2)
  }
}

export default function London({ len, race }: WorldProps) {
  const bayP = useProp('london-bay-d2', palaceBay)
  const clockP = useProp('london-clock', clockTower)
  const royalP = useProp('london-royal-d2', royalTower)
  const pairs = useMemo(() => PAIRS.map(([a, b], i) => prop(`london-pair-d3-${i}`, (k) => {
    terrace(xf(k, -1.1, 0), a)
    terrace(xf(k, 1.1, 0), b)
  })), [])
  const shops = useMemo(() => SHOPS.map(([a, b], i) => prop(`london-shops-d3-${i}`, (k) => {
    shop(xf(k, -1.1, 0), a)
    shop(xf(k, 1.1, 0), b)
  })), [])
  const pubs = useMemo(() => [['THE KINGS ARMS', '#1f4a3a', '#7b4535', '#1f3c7a'], ['THE OLD BELL', '#5a1a1e', '#8a4b36', '#2e5d4b']].map(([n, p, b, s], i) => prop(`london-pub-d3-${i}`, (k) => pub(k, n, p, b, s))), [])
  const stationP = useProp('london-station-d3', station)
  const drinkP = useProp('london-drinkers-d3', drinkers)
  const walkers = useMemo(() => [walkersA, walkersB, walkersC].map((f, i) => prop(`london-walkers-d3-${i}`, f)), [])
  const backs = useMemo(() => BACKS.map(([make], i) => prop(`london-back-d3-${i}`, make)), [])
  const roofP = useMemo(() => [11, 23].map((s) => prop(`london-roofs-d3-${s}`, (k) => roofs(k, s))), [])
  const banks = useMemo(() => [[5, true], [9, true], [13, false]].map(([s, b]) => prop(`london-farbank-d3-${s}`, (k) => farBank(k, s as number, b as boolean))), [])
  const phoneP = useProp('london-phone-d2', phoneBox)
  const busP = useProp('london-bus-d2', bus)
  const cabP = useProp('london-cab-d3', cab)
  const streetP = useProp('london-street-d3', street)
  const planeP = useProp('london-plane', plane)
  const embP = useProp('london-embankment-24', embankment)
  const statueP = useProp('london-statue', statue)
  const boatP = useProp('london-cruiser', cruiser)
  const rbusP = useProp('london-riverbus-d3', riverBus)
  const palaceP = useProp('london-palace-d3', royalPalace)
  const marketP = useProp('london-market-d3', market)
  const stalls = useMemo(() => [
    ['#2e7d32', ['#d32f2f', '#ff8f00', '#7cb342', '#f2c230', '#8e24aa', '#d32f2f', '#7cb342', '#ff8f00']],
    ['#c62828', ['#f2c230', '#e8e2cc', '#ff8f00', '#f2c230', '#7cb342', '#ec6f9a', '#d32f2f', '#e8e2cc']],
  ].map(([c, g], i) => prop(`london-stall-d3-${i}`, (k) => stall(k, c as string, g as string[]))), [])
  const shopperP = useProp('london-shoppers-d3', shoppers)
  const castleP = useProp('london-castle-d3', castle)
  const shelterP = useProp('london-shelter-d3', shelter)
  const p0 = race * 0.3
  const p1 = p0 + 66
  // The royal palace's gates, the market, the wheel and the castle across the river.
  const g0 = race * 0.5
  const g1 = g0 + 30
  const m0 = race * 0.72
  const m1 = m0 + 28
  const wz = race * 0.62
  const cz = race * 0.88

  const geo = useMemo(() => {
    const r = rand(1031)
    const bays: Spot[] = []
    for (let z = p0 + 3; z < p1 - 3; z += 3) bays.push({ x: EDGE + 1.9 + 2, z, ry: -Math.PI / 2 })
    const zones: [number, number][] = [[p0 - 6, p1 + 5], [g0 - 0.5, g1 + 0.5], [m0 - 0.5, m1 + 0.5]]
    const hit = (a: number, b: number, zs = zones) => zs.find(([c, d]) => a < d && b > c)
    // The front row: blocks of houses and shops, a pub on the corner, now and then a station,
    // a side street between blocks.
    const rows: Spot[][] = PAIRS.map(() => [])
    const shopRows: Spot[][] = SHOPS.map(() => [])
    const pubRows: Spot[][] = [[], []]
    const stations: Spot[] = []
    const drinks: Spot[] = []
    const fx = FRONT + 1.5
    let lastPair = -1
    let nPub = 0
    let sinceStation = 2
    for (let z = -14; z < len + 40;) {
      const n = 3 + Math.floor(r() * 4)
      let jumped = false
      for (let i = 0; i < n; i++) {
        const h = hit(z, z + 4.4)
        if (h) {
          z = h[1]
          jumped = true
          break
        }
        const spot = { x: fx, z: z + 2.2, ry: -Math.PI / 2 }
        const last = i === n - 1
        if (last && r() < 0.6) {
          pubRows[nPub % 2].push(spot)
          drinks.push(spot)
          nPub++
        } else if (i === 1 && sinceStation > 4 && r() < 0.5) {
          stations.push(spot)
          sinceStation = 0
        } else if (r() < 0.3) shopRows[Math.floor(r() * SHOPS.length)].push(spot)
        else {
          let p = Math.floor(r() * PAIRS.length)
          if (p === lastPair) p = (p + 1) % PAIRS.length
          lastPair = p
          rows[p].push(spot)
        }
        z += 4.4
      }
      if (jumped) continue
      sinceStation++
      z += 1.8
    }
    // Back gardens: plane trees between the rows.
    const trees: Spot[] = []
    for (let z = -12; z < len + 40; z += 4 + r() * 3) if (!hit(z - 2, z + 2, zones.slice(1))) trees.push({ x: FRONT + 5.3 + r() * 0.6, z, ry: r() * 6, s: 0.9 + r() * 0.3 })
    // The back row, unbroken but for the royal palace.
    const back: Spot[][] = BACKS.map(() => [])
    const wsum = BACKS.reduce((n, b) => n + b[1], 0)
    for (let z = -16, last = -1; z < len + 50;) {
      if (hit(z, z + 6, [[g0 - 0.5, g1 + 0.5]])) {
        z = g1 + 0.5
        continue
      }
      let i = 0
      for (let t = r() * wsum; i < BACKS.length - 1 && (t -= BACKS[i][1]) > 0;) i++
      if (i === last) i = (i + 1) % BACKS.length
      last = i
      back[i].push({ x: BACK + 2, z: z + 3, ry: -Math.PI / 2 })
      z += 6.3
    }
    const roofs: Spot[][] = [[], []]
    for (let z = -10, i = 0; z < len + 80; z += 48, i++) roofs[i % 2].push({ x: BACK + 5, z })
    // The left pavement: buses, cabs, phone boxes, lamps and people, nothing on top of another,
    // only people in front of the pubs and the landmarks.
    const pubZones: [number, number][] = drinks.map((s) => [s.z - 2.4, s.z + 2.4])
    // The race's crowds stand at the start and the finish.
    const crowd: [number, number][] = [[-8, 15], [race - 11, race + 6]]
    const quiet = [...zones, ...pubZones, ...crowd]
    const cabs: Spot[] = []
    const buses: Spot[] = []
    const phones: Spot[] = []
    const street: Spot[] = []
    const folks: Spot[][] = [[], [], []]
    for (let z = -8; z < len + 36;) {
      const roll = r()
      const busy = (l: number) => hit(z, z + l, quiet)
      if (roll < 0.12 && !busy(4.6)) {
        buses.push({ x: EDGE + 0.75, z: z + 2.3, ry: 0 })
        z += 4.6
      } else if (roll < 0.3 && !busy(2.2)) {
        cabs.push({ x: EDGE + 0.6, z: z + 1.1, ry: r() < 0.7 ? 0 : Math.PI })
        z += 2.2
      } else if (roll < 0.42 && !busy(1.2)) {
        phones.push({ x: EDGE + 0.75, z: z + 0.3, ry: -Math.PI / 2 })
        z += 1.4
      } else if (roll < 0.62 && !hit(z, z + 3, [zones[0], ...crowd])) {
        street.push({ x: EDGE + 0.3, z: z + 1.8 })
        z += 3.2
      } else if (!hit(z, z + 1.2, crowd)) {
        const k = Math.floor(r() * 3)
        folks[k].push({ x: EDGE + 0.62, z: z + 0.6, ry: r() < 0.5 ? 0 : Math.PI })
        z += 1.4
      }
      z += 0.5 + r() * 2.2
    }
    // The palace's own pavement gets its tourists too.
    for (let z = p0 + 2; z < p1; z += 6 + r() * 4) folks[Math.floor(r() * 3)].push({ x: EDGE + 0.62, z, ry: r() < 0.5 ? 0 : Math.PI })
    // The embankment: wall stretches, plane trees, and walkers on the river side.
    const embs: Spot[] = []
    const etrees: Spot[] = []
    for (let z = -14; z < len + 40; z += 6) {
      if ((z + 14) % 24 === 0) embs.push({ x: RX - 1.6, z: z + 12 })
      if (Math.abs(z + 3 - p0) > 3) etrees.push({ x: RX - 0.4, z: z + 3, ry: r() * 6, s: 0.9 + r() * 0.25 })
    }
    // A cabman's shelter every so often, midway between two benches.
    const shelters: Spot[] = []
    for (let z = 34; z < len + 30; z += 72) if (Math.abs(z - p0) > 6 && !hit(z - 2, z + 2, crowd)) shelters.push({ x: RX - 0.35, z })
    for (let z = 4; z < len + 36; z += 5 + r() * 6) {
      if (Math.abs(z - p0) < 3 || hit(z - 1, z + 1, crowd) || shelters.some((sh) => Math.abs(sh.z - z) < 2)) continue
      folks[Math.floor(r() * 3)].push({ x: -(EDGE + 0.85), z, ry: r() < 0.5 ? 0 : Math.PI })
    }
    // The market: stalls in rows on the forecourt, shoppers between them.
    const stallRows: Spot[][] = [[], []]
    const shop2: Spot[] = []
    for (let z = m0 + 1.5, i = 0; z < m1 - 1; z += 2.4, i++) {
      stallRows[i % 2].push({ x: FRONT + 1.7, z, ry: -Math.PI / 2 })
      if (i % 2 === 0) shop2.push({ x: FRONT + 0.6, z: z + 1.2, ry: r() * 6 })
    }
    // The far bank, a stretch at a time; parkland round the wheel and the castle.
    const bank: Spot[][] = [[], [], []]
    for (let z = -14, i = 0; z < len + 80; z += 48, i++) {
      const c = z + 24
      const park = Math.abs(c - wz) < 30 || Math.abs(c - cz) < 30
      bank[park ? 2 : i % 2].push({ x: FB, z: c })
    }
    return { bays, rows, shopRows, pubRows, stations, drinks, trees, back, roofs, cabs, buses, phones, street, folks, embs, etrees, shelters, stallRows, shop2, bank }
  }, [len, race, p0, p1, g0, g1, m0, m1, wz, cz])

  const L = len + 60
  const mid = len / 2 + 5
  return (
    <>
      <Batch version={`london-d3:${len}`} cell={24} freeze prune>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.95, 0.012, mid]}>
          <planeGeometry args={[1.9, L]} />
          <meshStandardMaterial color="#8c8d8a" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[RX - 0.4, 0.012, mid]}>
          <planeGeometry args={[2.6, L]} />
          <meshStandardMaterial color="#9a9a94" />
        </mesh>
        {/* Granite kerbs either side, back gardens' lawns behind the front row. */}
        <mesh position={[EDGE + 0.07, 0.03, mid]}>
          <boxGeometry args={[0.14, 0.06, L]} />
          <meshStandardMaterial color="#a8a49a" />
        </mesh>
        <mesh position={[-(EDGE + 0.07), 0.03, mid]}>
          <boxGeometry args={[0.14, 0.06, L]} />
          <meshStandardMaterial color="#a8a49a" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[FRONT + 5.5, 0.008, mid]}>
          <planeGeometry args={[5, L]} />
          <meshStandardMaterial color="#56703f" />
        </mesh>
        <group position={[EDGE + 1.9, 0, p0 - 2.4]}><PropMesh parts={clockP} /></group>
        <group position={[EDGE + 4.8, 0, p1 + 0.3]} rotation-y={-Math.PI / 2}><PropMesh parts={royalP} /></group>
        <group position={[RX - 0.15, 0, p0]} rotation-y={-1.2}><PropMesh parts={statueP} /></group>
        {[race * 0.16, race * 0.78].map((z) => (
          <group key={z}>
            <group position={[RX - 3.3, 0, z]}><PropMesh parts={boatP} /></group>
            {/* The gangway down from the wall. */}
            <mesh position={[RX - 1.95, 0.8, z + 2]} rotation-z={0.25}>
              <boxGeometry args={[1.0, 0.06, 0.7]} />
              <meshStandardMaterial color="#8a8d90" />
            </mesh>
          </group>
        ))}
        {/* The royal palace and its forecourt. */}
        <mesh rotation-x={-Math.PI / 2} position={[FRONT + 3.35, 0.014, (g0 + g1) / 2]}>
          <planeGeometry args={[6.9, 30]} />
          <meshStandardMaterial color="#cdbfa6" />
        </mesh>
        <group position={[FRONT, 0, (g0 + g1) / 2]} rotation-y={-Math.PI / 2}><PropMesh parts={palaceP} /></group>
        {/* The market's cobbled forecourt and its hall. */}
        <mesh rotation-x={-Math.PI / 2} position={[FRONT + 1.8, 0.014, (m0 + m1) / 2]}>
          <planeGeometry args={[3.6, 28]} />
          <meshStandardMaterial color="#7f7a72" />
        </mesh>
        <group position={[FRONT, 0, (m0 + m1) / 2]} rotation-y={-Math.PI / 2}><PropMesh parts={marketP} /></group>
        <group position={[FB - 12, 0, cz]} rotation-y={Math.PI / 2}><PropMesh parts={castleP} /></group>
      </Batch>
      <Many parts={bayP} at={geo.bays} />
      {pairs.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      {shops.map((h, i) => <Many key={i} parts={h} at={geo.shopRows[i]} />)}
      {pubs.map((h, i) => <Many key={i} parts={h} at={geo.pubRows[i]} />)}
      <Many parts={stationP} at={geo.stations} />
      <Many parts={drinkP} at={geo.drinks} near={70} />
      {backs.map((h, i) => <Many key={i} parts={h} at={geo.back[i]} />)}
      {roofP.map((h, i) => <Many key={i} parts={h} at={geo.roofs[i]} />)}
      <Many parts={planeP} at={geo.trees} near={90} />
      <Many parts={phoneP} at={geo.phones} near={80} />
      <Many parts={busP} at={geo.buses} near={90} />
      <Many parts={cabP} at={geo.cabs} near={80} />
      <Many parts={streetP} at={geo.street} near={80} />
      {walkers.map((h, i) => <Many key={i} parts={h} at={geo.folks[i]} near={70} />)}
      {stalls.map((h, i) => <Many key={i} parts={h} at={geo.stallRows[i]} near={80} />)}
      <Many parts={shopperP} at={geo.shop2} near={70} />
      <Many parts={embP} at={geo.embs} />
      <Many parts={planeP} at={geo.etrees} />
      <Many parts={shelterP} at={geo.shelters} near={90} />
      {banks.map((h, i) => <Many key={i} parts={h} at={geo.bank[i]} />)}
      <Water x={RX - 42} z={len / 2} w={80} d={len + 240} id="london" color="#5f7684" rough={0.2} />
      <Sparkles edge={RX - 2} />
      <Boats len={len} boats={[{ x: RX - 10, v: 0.9, parts: rbusP }, { x: RX - 17, v: -0.6, parts: boatP }, { x: RX - 23, v: 1.1, parts: rbusP }]} />
      <Wheel x={FB - 8} z={wz} />
      <FarLondon />
    </>
  )
}

// Boats under way on the river, up and down stream, looping round the mile.
function Boats({ len, boats }: { len: number; boats: { x: number; v: number; parts: Built }[] }) {
  const refs = useRef<(Group | null)[]>([])
  const st = useMemo(() => boats.map((b, i) => ({ ...b, z: ((i + 0.3) / boats.length) * (len + 60) })), [boats, len])
  useFrame((_, dt) => {
    st.forEach((b, i) => {
      b.z += b.v * dt
      if (b.z > len + 70) b.z -= len + 90
      if (b.z < -20) b.z += len + 90
      refs.current[i]?.position.set(b.x, 0, b.z)
    })
  })
  return (
    <>
      {st.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[b.x, 0, b.z]} rotation-y={b.v < 0 ? Math.PI : 0}>
          <PropMesh parts={b.parts} />
        </group>
      ))}
    </>
  )
}

// The giant observation wheel on the far bank, its lit pods turning slowly.
function Wheel({ x, z }: { x: number; z: number }) {
  const R = 15
  const frame = useProp('london-wheel-frame', (k) => {
    const white: Look = { c: '#e8ecef', r: 0.5, m: 0.3 }
    for (const s of [-1, 1]) k.rod(white, [0, 0.5, s * 7], [0, R + 2, 0], 0.4, 8)
    k.box({ c: '#7d7f80', r: 0.8 }, [3, 1, 16], [0, 0.5, 0])
  })
  const wheel = useProp('london-wheel', (k) => {
    const white: Look = { c: '#e8ecef', r: 0.5, m: 0.3 }
    const pod = glow('#cfefff', 0.25, 1.3)
    k.torus(white, R, 0.22, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 6)
    k.torus(white, R - 1.2, 0.14, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 5)
    k.torus(glow('#5ab7ff', 0.2, 1.5), R - 0.6, 0.08, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 4)
    k.cyl(white, 0.9, 0.9, 1.6, [0, 0, 0], [0, 0, Math.PI / 2], 12)
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      k.rod(white, [0, 0, 0], [0, Math.cos(a) * (R - 1.2), Math.sin(a) * (R - 1.2)], 0.04, 4)
      k.sphere(pod, 0.55, [0.7, Math.cos(a) * (R + 0.4), Math.sin(a) * (R + 0.4)], [0.8, 0.7, 1.3], 10, 6)
    }
  })
  const spin = useRef<Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.x += dt * 0.03
  })
  return (
    <group position={[x, 0, z]} rotation-y={0.6}>
      <PropMesh parts={frame} />
      <group ref={spin} position={[0, R + 2, 0]}><PropMesh parts={wheel} /></group>
    </group>
  )
}

// What rides along ahead, always about 60 to 85 out: the bascule bridge across the river with
// its leaves raised, the cathedral dome, the gherkin and the shard among the city's towers.
function FarLondon() {
  const parts = useProp('london-far-d3', (k) => {
    const blue: Look = { c: '#5b8fb3', r: 0.5 }
    const stone: Look = { c: '#c9c0a8', r: 0.85 }
    const z = 72
    const towers = [-15, -29]
    for (const tx of towers) {
      k.box({ c: '#7d7a72', r: 0.9 }, [6, 3, 5.5], [tx, 1.5, z])
      k.box(stone, [4.4, 13, 4.4], [tx, 9.5, z])
      for (let i = 0; i < 3; i++) for (const dx of [-0.8, 0.8]) {
        k.box(WIN, [0.45, 1.3, 0.1], [tx + dx, 6.5 + i * 3, z - 2.25])
        archTop(k, WIN, 0.45, 0.1, [tx + dx, 7.15 + i * 3, z - 2.25])
      }
      archTop(k, { c: '#22303a', r: 1 }, 2.6, 0.1, [tx, 3.6, z - 2.25])
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.cyl(stone, 0.55, 0.55, 15, [tx + sx * 2.2, 10.5, z + sz * 2.2], undefined, 8)
        frustum(k, SLATE, 1.3, 1.3, 2.2, 0, [tx + sx * 2.2, 18, z + sz * 2.2])
        k.cyl(GOLD, 0.05, 0.05, 0.9, [tx + sx * 2.2, 20.6, z + sz * 2.2], undefined, 4)
      }
      frustum(k, SLATE, 4.6, 4.6, 3.6, 0.2, [tx, 16, z])
      k.cyl(GOLD, 0.07, 0.07, 1.6, [tx, 20.4, z], undefined, 4)
    }
    // The road deck out to both banks, the leaves raised between the towers, the high walkways.
    for (const [a, b] of [[-3, -12.8], [-31.2, -41]]) k.box(blue, [Math.abs(b - a), 0.9, 4], [(a + b) / 2, 4.6, z])
    for (const s of [-1, 1]) {
      const hx = s < 0 ? -17.2 : -26.8
      k.box(blue, [5.2, 0.6, 3.8], [hx - s * 2.4 * Math.cos(0.9), 4.6 + 2.4 * Math.sin(0.9), z], [0, 0, s * 0.9])
    }
    for (const dz of [-1.3, 1.3]) k.box(blue, [12, 1.5, 0.9], [-22, 15.5, z + dz])
    for (let i = 0; i < 8; i++) k.rod(blue, [-27 + i * 1.4, 14.9, z - 1.3], [-26.3 + i * 1.4, 16.1, z - 1.3], 0.08, 4)
    // The chains from each tower down to the banks, hangers to the deck.
    for (const [a, b] of [[-15, -3], [-29, -41]] as const) {
      const pts = 6
      for (let i = 0; i < pts; i++) {
        const p = (t: number): V3 => [a + (b - a) * t, 15 - Math.sin(t * Math.PI * 0.9) * 6 - t * 4, z - 2.4]
        k.rod(blue, p(i / pts), p((i + 1) / pts), 0.25, 6)
        k.rod(blue, p(i / pts), [p(i / pts)[0], 5, z - 2.4], 0.06, 4)
      }
      k.box(stone, [2.2, 6, 2.2], [b, 3, z])
      frustum(k, SLATE, 2.2, 2.2, 1.6, 0, [b, 6, z])
    }
    // The cathedral dome on the left: drum, colonnade, dome, lantern, ball and cross.
    const dx = 13
    const dz = 64
    k.box(PORTLAND, [12, 6, 6], [dx + 2, 3, dz])
    for (const s of [-1, 1]) {
      k.box(PORTLAND, [2.6, 9, 2.6], [dx + 2 + s * 4.5, 4.5, dz - 3])
      k.cyl(PORTLAND, 0.9, 1.0, 1.4, [dx + 2 + s * 4.5, 9.7, dz - 3], undefined, 8)
      k.cone(LEAD, 0.9, 1.6, [dx + 2 + s * 4.5, 11.2, dz - 3], undefined, 8)
    }
    k.cyl(PORTLAND, 4.4, 4.6, 4, [dx, 8, dz + 3], undefined, 16)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      k.cyl(PORT_D, 0.18, 0.18, 3, [dx + Math.cos(a) * 4.75, 8, dz + 3 + Math.sin(a) * 4.75], undefined, 5)
    }
    k.cyl(PORT_D, 4.9, 4.9, 0.3, [dx, 9.6, dz + 3], undefined, 16)
    k.cyl(PORTLAND, 4.0, 4.0, 1.4, [dx, 10.4, dz + 3], undefined, 16)
    k.sphere(LEAD, 4.0, [dx, 11.1, dz + 3], [1, 1.1, 1], 16, 6, Math.PI / 2)
    k.cyl(PORTLAND, 0.7, 0.8, 1.8, [dx, 16.4, dz + 3], undefined, 8)
    k.cone(LEAD, 0.8, 1.0, [dx, 17.8, dz + 3], undefined, 8)
    k.sphere(GILT, 0.3, [dx, 18.5, dz + 3], [1, 1, 1], 8, 5)
    k.box(GILT, [0.1, 0.9, 0.1], [dx, 19.2, dz + 3])
    k.box(GILT, [0.5, 0.1, 0.1], [dx, 19.35, dz + 3])
    // The gherkin: a tapering egg of glass with its spiral bands.
    k.sphere({ c: '#4e6b72', r: 0.3 }, 3.2, [7, 9.5, 82], [1, 3.2, 1], 12, 8)
    for (let i = 0; i < 9; i++) k.torus(glow('#bfe6ff', 0.05, 0.8), 3.15 * Math.sin(((i + 1) / 10) * Math.PI), 0.08, [7, 9.5 + Math.cos(((i + 1) / 10) * Math.PI) * 10.2, 82], [Math.PI / 2, 0, 0.3], Math.PI * 2, 12, 3)
    // The shard: a tall glass spike across the river.
    frustum(k, glow('#6f8aa3', 0.2, 0.3), 7, 7, 34, 0.05, [-11, 0, 86])
    for (let y = 3; y < 30; y += 2.6) frustum(k, glow('#ffe7b0', 0.05, 1.0), 7.06 * (1 - y / 35.8), 7.06 * (1 - y / 35.8), 0.25, 0.99, [-11, y, 86])
    // The city's towers and cranes, behind the dome and over the far bank.
    const rr = rand(31)
    for (let i = 0; i < 12; i++) {
      const left = i < 7
      const x = left ? 20 + i * 4.5 + rr() * 2 : -34 - (i - 7) * 6
      const zz = 66 + rr() * 14
      const h = 12 + rr() * 16
      const w = 3.5 + rr() * 2
      k.box(glow('#5c6f82', 0.35, 0.35), [w, h, w], [x, h / 2, zz])
      for (let y = 2; y < h - 1; y += 2) k.box(glow('#ffe7b0', 0.05, 1.2), [w * 0.88, 0.2, 0.1], [x, y, zz - w / 2 - 0.06])
    }
    for (const [x, zz, h] of [[26, 74, 24], [-40, 78, 22]] as const) {
      k.box({ c: '#e8b830', r: 0.6 }, [0.5, h, 0.5], [x, h / 2, zz])
      k.box({ c: '#e8b830', r: 0.6 }, [12, 0.5, 0.5], [x - 3, h, zz])
      k.box({ c: '#d0d0d0', r: 0.6 }, [1.2, 1.0, 1.0], [x + 2.5, h - 0.3, zz])
      k.rod({ c: '#888888', r: 0.6 }, [x - 7, h, zz], [x - 7, h - 6, zz], 0.03, 3)
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
