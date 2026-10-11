import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, Vector3, type Group, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Object3D, ShaderMaterial, type InstancedMesh, type Points } from 'three'
import { PLOT, PLOT_MAX, PLOT_MIN, TILE, buildingDef } from '../game/data'
import { BuildingModel, LightPool } from './BuildingModel'
import { Batch } from './Batch'
import { Box, Cone, Cyl, rand } from './RaceVenues'
import { glowMats, onNight } from './dayNight'
import { kitMat, Kit } from './kit'
import { oak, pine, birch, bush, rock, tuft, flower, log, stump, heap, mushroom, reeds, crop, pumpkin, shade } from './flora'
import { PAL, SEASON } from './season'
import { gravelTex, waterTex } from './textures'
import { toWorld } from './grid'
import { LAYER } from './layers'

// Everything past the edge of the player's land: wild meadow on the plots they
// could still buy (cleared the moment they buy one), a split-rail fence along
// the town line with lanterns where roads leave town, and beyond the last plot
// a forest ring with a farm and a lake. All static and instanced, so the
// countryside costs a couple of dozen draws, and none when it's off screen.

const HALF_TILE = TILE / 2
const PLOT_W = PLOT * TILE
// World edge of plot index p (west/north side), with the grid centred on the origin.
const edge = (p: number) => toWorld(p * PLOT, 0)[0] - HALF_TILE
const RANGE_LO = edge(PLOT_MIN)
const RANGE_HI = edge(PLOT_MAX + 1)
// The forest runs out this far; the outer ground ends well past it.
const FAR = 92

export type Spot = { x: number; z: number; ry?: number; s?: number; sy?: number; tint?: string }

// Shapes are made once per page, after the season is known.
let shapes: ReturnType<typeof makeShapes> | null = null
function makeShapes() {
  return {
    oakA: oak(0), oakB: oak(2), pine: pine(), birch: birch(), bush: bush(), rock: rock(), tuft: tuft(), flower: flower(),
    log: log(), stump: stump(), heap: heap(), mushroom: mushroom(), reeds: reeds(), crop: crop(), pumpkin: pumpkin(),
  }
}
const getShapes = () => (shapes ??= makeShapes())
export type Shape = keyof ReturnType<typeof makeShapes>

// Lots of copies of one baked model as a single instanced draw.
function Many({ geo, spots }: { geo: BufferGeometry; spots: Spot[] }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    spots.forEach((p, i) => {
      const k = p.s ?? 1
      o.position.set(p.x, 0, p.z)
      o.rotation.set(0, p.ry ?? 0, 0)
      o.scale.set(k, k * (p.sy ?? 1), k)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(p.tint ?? '#ffffff'))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    m.computeBoundingBox()
  }, [spots])
  if (!spots.length) return null
  return <instancedMesh key={spots.length} ref={ref} args={[geo, kitMat, spots.length]} receiveShadow raycast={() => null} userData={{ noBatch: true }} />
}

export function Scatter({ sets }: { sets: Partial<Record<Shape, Spot[]>> }) {
  const s = getShapes()
  return (
    <>
      {(Object.keys(sets) as Shape[]).map((k) => <Many key={k} geo={s[k]} spots={sets[k]!} />)}
    </>
  )
}

export const push = (sets: Partial<Record<Shape, Spot[]>>, k: Shape, p: Spot) => (sets[k] ??= []).push(p)

const GRASS = PAL.bare ? ['#e3e9ee', '#d5dde3', '#c9b98f'] : SEASON === 'fall' ? ['#8c9a43', '#a3a050', '#7d8a3a', '#b5a55a'] : [shade(PAL.ground, -0.08), shade(PAL.ground, 0.04), PAL.grassSpeckle[0], PAL.grassSpeckle[2]]
const BLOOMS = SEASON === 'spring' ? ['#fff59d', '#ffffff', '#f8bbd0', '#ce93d8', '#ffffff'] : SEASON === 'summer' ? ['#fdd835', '#ffffff', '#ec407a', '#ab47bc', '#ff7043'] : []
const TINT = ['#ffffff', '#f2f2f2', '#e6e6e6', '#fafafa']

// Dress a patch of wild ground: grass, a stand of trees, bushes, rocks and
// whatever the season leaves lying about. `keep` says whether a point is clear.
function dress(sets: Partial<Record<Shape, Spot[]>>, r: () => number, x0: number, z0: number, w: number, d: number, keep: (x: number, z: number, pad: number) => boolean, trees: number) {
  const at = (pad: number) => {
    for (let t = 0; t < 6; t++) {
      const x = x0 + r() * w, z = z0 + r() * d
      if (keep(x, z, pad)) return [x, z] as const
    }
    return null
  }
  const area = (w * d) / 256
  for (let i = 0; i < 36 * area; i++) {
    const p = at(0.2)
    if (p) push(sets, 'tuft', { x: p[0], z: p[1], ry: r() * 6, s: 1.3 + r() * 1.1, sy: 1 + r() * 1.1, tint: GRASS[i % GRASS.length] })
  }
  // Wildflowers grow in drifts.
  if (BLOOMS.length) {
    for (let c = 0; c < 3 * area; c++) {
      const p = at(0.5)
      if (!p) continue
      const col = BLOOMS[Math.floor(r() * BLOOMS.length)]
      for (let i = 0; i < 14; i++) {
        const x = p[0] + (r() - 0.5) * 2.4, z = p[1] + (r() - 0.5) * 2.4
        if (keep(x, z, 0.1)) push(sets, 'flower', { x, z, ry: r() * 6, s: 0.8 + r() * 0.6, tint: r() < 0.8 ? col : BLOOMS[0] })
      }
    }
  }
  // A stand of trees, mostly around one or two spots.
  const centres = [at(2), at(2), at(2)].filter(Boolean) as (readonly [number, number])[]
  for (let i = 0; i < trees && centres.length; i++) {
    const [cx, cz] = centres[i % centres.length]
    const x = cx + (r() - 0.5) * 7, z = cz + (r() - 0.5) * 7
    if (!keep(x, z, 1.2)) continue
    const k = r()
    const kind: Shape = k < 0.3 ? 'oakA' : k < 0.55 ? 'oakB' : k < 0.85 ? 'pine' : 'birch'
    push(sets, kind, { x, z, ry: r() * 6, s: 1 + r() * 0.7, tint: TINT[i % 4] })
  }
  for (let i = 0; i < 8 * area; i++) {
    const p = at(0.6)
    if (p) push(sets, 'bush', { x: p[0], z: p[1], ry: r() * 6, s: 0.8 + r() * 0.8, tint: TINT[i % 4] })
  }
  for (let i = 0; i < 3 * area; i++) {
    const p = at(0.5)
    if (p) push(sets, 'rock', { x: p[0], z: p[1], ry: r() * 6, s: 0.7 + r() * 1.4, sy: 0.7 + r() * 0.6, tint: TINT[i % 4] })
  }
  if (r() < 0.4 * area) {
    const p = at(1)
    if (p) push(sets, 'log', { x: p[0], z: p[1], ry: r() * 6, s: 0.8 + r() * 0.4 })
  }
  if (r() < 0.4 * area) {
    const p = at(0.4)
    if (p) push(sets, 'stump', { x: p[0], z: p[1], ry: r() * 6, s: 0.9 + r() * 0.5 })
  }
  if (SEASON === 'fall' || SEASON === 'winter') {
    for (let i = 0; i < 4 * area; i++) {
      const p = at(0.4)
      if (p) push(sets, 'heap', { x: p[0], z: p[1], ry: r() * 6, s: 0.8 + r() * 0.8 })
    }
  }
  if ((SEASON === 'fall' || SEASON === 'spring') && r() < 0.5 * area) {
    const p = at(0.6)
    if (p) for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      push(sets, 'mushroom', { x: p[0] + Math.cos(a) * 0.35, z: p[1] + Math.sin(a) * 0.35, ry: a, s: 0.8 + r() * 0.6 })
    }
  }
}

// The farm and the lake sit in clearings in the forest.
const FARM = { x0: 62, x1: 104, z0: -30, z1: 22 }
const LAKE = { x: -82, z: -14, rx: 17, rz: 11 }
const inFarm = (x: number, z: number, pad: number) => x > FARM.x0 - pad && x < FARM.x1 + pad && z > FARM.z0 - pad && z < FARM.z1 + pad
const inLake = (x: number, z: number, pad: number) => ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((z - LAKE.z) / (LAKE.rz + pad)) ** 2 < 1

// Forest beyond the last plot: a ragged tree line, then thick woods, with
// meadow round the clearings and the farm's crops. Never changes, so it's made once.
let forest: Partial<Record<Shape, Spot[]>> | null = null
function forestSpots() {
  if (forest) return forest
  const r = rand(977)
  const out: Partial<Record<Shape, Spot[]>> = {}
  const step = 4
  for (let x = -FAR; x < FAR; x += step)
    for (let z = -FAR; z < FAR; z += step) {
      const jx = x + (r() - 0.5) * step * 0.9, jz = z + (r() - 0.5) * step * 0.9
      const past = Math.max(RANGE_LO - jx, jx - RANGE_HI, RANGE_LO - jz, jz - RANGE_HI)
      const rr = r()
      if (past < 1.5 || inFarm(jx, jz, 3) || inLake(jx, jz, 3)) continue
      if (rr > (past < 6 ? 0.4 : 0.92)) continue
      const k = r()
      const kind: Shape = k < 0.28 ? 'oakA' : k < 0.5 ? 'oakB' : k < 0.88 ? 'pine' : 'birch'
      push(out, kind, { x: jx, z: jz, ry: r() * 6, s: 1.6 + r() * 1.2, tint: TINT[Math.floor(r() * 4)] })
      if (r() < 0.2) push(out, 'bush', { x: jx + 1.5, z: jz + 1, ry: r() * 6, s: 1.2 + r() * 0.8 })
      if (r() < 0.3) push(out, 'tuft', { x: jx - 1.3, z: jz + 1.4, ry: r() * 6, s: 1.6, sy: 1.3, tint: GRASS[Math.floor(r() * GRASS.length)] })
      if (r() < 0.06) push(out, 'rock', { x: jx + 1.6, z: jz - 1.5, ry: r() * 6, s: 1.2 + r() * 1.5 })
    }
  // Meadow edges round the clearings, reeds at the water.
  const clear = (x: number, z: number) => (inFarm(x, z, 1.5) && !inFarm(x, z, -0.5)) || (inLake(x, z, 3) && !inLake(x, z, 0.6))
  for (let i = 0; i < 1600; i++) {
    const x = 56 + r() * 52, z = -34 + r() * 60
    if (clear(x, z)) push(out, 'tuft', { x, z, ry: r() * 6, s: 1.3 + r(), sy: 1 + r() * 0.8, tint: GRASS[i % GRASS.length] })
    const lx = LAKE.x - 22 + r() * 44, lz = LAKE.z - 16 + r() * 32
    if (clear(lx, lz)) push(out, inLake(lx, lz, 1.4) ? 'reeds' : 'tuft', { x: lx, z: lz, ry: r() * 6, s: 1 + r() * 0.8, sy: 1 + r() * 0.6, tint: inLake(lx, lz, 1.4) ? '#ffffff' : GRASS[i % GRASS.length] })
  }
  // The farm's two fields, and pumpkins by the lane in the fall.
  for (const [fx, fz, w, d] of [[66, -26, 16, 20], [86, -26, 15, 20]] as const)
    for (let x = fx + 0.6; x < fx + w; x += 1)
      for (let z = fz + 0.4; z < fz + d; z += 0.5) push(out, 'crop', { x: x + (r() - 0.5) * 0.08, z: z + (r() - 0.5) * 0.1, ry: r() * 6, s: 1.1 + r() * 0.5 })
  if (SEASON === 'fall') for (let i = 0; i < 70; i++) push(out, 'pumpkin', { x: 66 + r() * 14, z: r() * 6 - 0.5, ry: r() * 6, s: 0.9 + r() * 0.9 })
  return (forest = out)
}

// Unbought plots as wild meadow: one instanced draw per kind of thing for the
// lot. Trees keep back from the town line so they never hide the player's buildings.
function Wilds({ land }: { land: string[] }) {
  const sets = useMemo(() => {
    const owned = new Set(land)
    const sets: Partial<Record<Shape, Spot[]>> = {}
    const ownedAt = (x: number, z: number) => {
      const px = Math.floor((x - RANGE_LO) / PLOT_W) + PLOT_MIN
      const pz = Math.floor((z - RANGE_LO) / PLOT_W) + PLOT_MIN
      return owned.has(`${px},${pz}`)
    }
    const keep = (x: number, z: number, pad: number) => !ownedAt(x - pad, z - pad) && !ownedAt(x + pad, z - pad) && !ownedAt(x - pad, z + pad) && !ownedAt(x + pad, z + pad) && !ownedAt(x, z)
    for (let px = PLOT_MIN; px <= PLOT_MAX; px++)
      for (let pz = PLOT_MIN; pz <= PLOT_MAX; pz++) {
        if (owned.has(`${px},${pz}`)) continue
        const r = rand(1 + (px - PLOT_MIN) * 31 + (pz - PLOT_MIN) * 7)
        dress(sets, r, edge(px), edge(pz), PLOT_W, PLOT_W, keep, 7 + Math.floor(r() * 7))
      }
    return sets
  }, [land])
  return <Scatter sets={sets} />
}

// The forest is only drawn once the view reaches past the last plot, so a phone
// looking at its town pays nothing for it. The view is taken as a circle round
// the point the camera looks at, wide enough to cover the screen's corners.
const look = new Vector3()
function Forest() {
  const ref = useRef<Group>(null)
  const sets = useMemo(forestSpots, [])
  useFrame(({ camera, size, controls }) => {
    const g = ref.current
    if (!g) return
    const t = (controls as unknown as { target?: Vector3 } | null)?.target ?? look.set(0, 0, 0)
    // Ground seen from the tilted camera stretches the screen's height.
    const reach = Math.hypot(size.width / 2, size.height / 2 / 0.6) / camera.zoom
    g.visible = Math.max(Math.abs(t.x), Math.abs(t.z)) + reach > RANGE_HI + 1
  })
  return (
    <group ref={ref}>
      <Scatter sets={sets} />
      <Farm />
      <Lake />
    </group>
  )
}

// A family farm in the eastern clearing: two fields in the season's crop, a
// red barn with a silo, the farmhouse (its windows light up at night), hay
// bales, and pumpkins by the road in the fall.
function Farm() {
  const soil = SEASON === 'winter' ? '#e6edf2' : '#6d4c41'
  return (
    <group>
      {[[74, -16, 16, 20], [93.5, -16, 15, 20]].map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, -0.035, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={soil} />
        </mesh>
      ))}
      <Batch version={1}>
        {/* Farm lane between the fields and the yard. */}
        <mesh rotation-x={-Math.PI / 2} position={[83, -0.03, 2.5]}>
          <planeGeometry args={[42, 2.2]} />
          <meshStandardMaterial map={gravelTex(10, 0.5)} color="#b49a7c" />
        </mesh>
        <group position={[72, 0, 10]}>
          <BuildingModel def={buildingDef('house')} />
        </group>
        <group position={[75, 0, 10]}>
          <BuildingModel def={buildingDef('house')} />
        </group>
        {/* Red barn with a gable roof and white trim, a silo beside it. */}
        <group position={[88, 0, 12]} rotation-y={Math.PI / 2}>
          <Box p={[0, 1.1, 0]} s={[3.4, 2.2, 4.8]} c="#b71c1c" />
          <group position-y={2.2} scale={[1, 0.6, 1]}>
            <mesh rotation-z={Math.PI / 4}>
              <boxGeometry args={[2.4, 2.4, 4.78]} />
              <meshStandardMaterial color="#b71c1c" flatShading />
            </mesh>
          </group>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.85, 2.77, 0]} rotation-z={-sd * 0.54}>
              <boxGeometry args={[2.15, 0.1, 5.1]} />
              <meshStandardMaterial color={SEASON === 'winter' ? '#f4f8fb' : '#5d4037'} flatShading />
            </mesh>
          ))}
          <Box p={[0, 3.26, 0]} s={[0.14, 0.1, 5.1]} c="#3e2723" />
          <Box p={[-1.71, 0.75, 0]} s={[0.03, 1.5, 1.6]} c="#8e1414" />
          <Box p={[-1.73, 1.52, 0]} s={[0.02, 0.08, 1.7]} c="#fafafa" />
          <Box p={[-1.73, 0.75, -0.82]} s={[0.02, 1.55, 0.08]} c="#fafafa" />
          <Box p={[-1.73, 0.75, 0.82]} s={[0.02, 1.55, 0.08]} c="#fafafa" />
          <Box p={[-1.73, 1.9, 0]} s={[0.02, 0.5, 0.6]} c="#3e2723" />
          <Cyl p={[0.6, 1.9, 3.6]} r={0.75} h={3.8} c="#cfd8dc" seg={12} />
          {[0.8, 1.8, 2.8].map((y) => <Cyl key={y} p={[0.6, y, 3.6]} r={0.77} h={0.06} c="#90a4ae" seg={12} />)}
          <Cone p={[0.6, 4.05, 3.6]} r={0.8} h={0.5} c="#90a4ae" seg={12} />
        </group>
        {/* Hay bales and a tractor in the yard. */}
        {[[80, 8, 0.3], [81, 9.2, 1.4], [80.4, 8.6, 0.9]].map(([x, z, ry], i) => (
          <Cyl key={i} p={[x, i === 2 ? 0.78 : 0.28, z]} r={0.28} h={0.5} c={i ? '#d4b45a' : '#e0c068'} seg={10} rot={[Math.PI / 2, ry, 0]} />
        ))}
        <group position={[84, 0, 6]} rotation-y={0.6}>
          <Box p={[0, 0.42, 0.15]} s={[0.5, 0.35, 0.9]} c="#2e7d32" />
          <Box p={[0, 0.78, -0.2]} s={[0.46, 0.4, 0.4]} c="#2e7d32" />
          <Box p={[0, 0.98, -0.2]} s={[0.5, 0.04, 0.44]} c="#fdd835" />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <Cyl p={[sd * 0.32, 0.32, -0.25]} r={0.32} h={0.16} c="#212121" seg={12} rot={[0, 0, Math.PI / 2]} />
              <Cyl p={[sd * 0.27, 0.17, 0.45]} r={0.17} h={0.1} c="#212121" seg={10} rot={[0, 0, Math.PI / 2]} />
            </group>
          ))}
        </group>
        {/* Post-and-wire fence round the fields. */}
        {Array.from({ length: 30 }, (_, i) => 66 + i * 1.3).map((x) => (
          <Box key={x} p={[x, 0.3, -26.6]} s={[0.07, 0.6, 0.07]} c="#8d6e63" />
        ))}
        <Box p={[85.5, 0.45, -26.6]} s={[39, 0.03, 0.03]} c="#6d4c41" />
        <Box p={[85.5, 0.25, -26.6]} s={[39, 0.03, 0.03]} c="#6d4c41" />
        {/* Mailbox at the lane's end. */}
        <group position={[64, 0, 1.2]}>
          <Box p={[0, 0.4, 0]} s={[0.05, 0.8, 0.05]} c="#8d6e63" />
          <Box p={[0, 0.85, 0]} s={[0.3, 0.15, 0.2]} c="#455a64" />
          <Box p={[0.12, 0.95, 0.02]} s={[0.04, 0.12, 0.02]} c="#e53935" />
        </group>
      </Batch>
      <LightPool r={2.2} x={73.5} z={11.6} y={0.02} />
    </group>
  )
}

// A lake in the western clearing with a little dock and a rowboat; it ices
// over in winter.
function Lake() {
  const map = useMemo(() => waterTex('lake', LAKE.rx / 4, LAKE.rz / 4), [])
  const frozen = SEASON === 'winter'
  useFrame((_, dt) => {
    if (frozen) return
    map.offset.x += dt * 0.01
    map.offset.y += dt * 0.004
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[LAKE.x, -0.044, LAKE.z]} scale={[LAKE.rx + 1.2, LAKE.rz + 1.2, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color={frozen ? '#cfd8dc' : '#b6a27a'} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[LAKE.x, -0.032, LAKE.z]} scale={[LAKE.rx, LAKE.rz, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial map={map} color={frozen ? '#dcecf7' : '#ffffff'} roughness={frozen ? 0.15 : 0.25} metalness={0.05} />
      </mesh>
      <Batch version={1}>
        {/* Wooden dock from the town-side shore. */}
        <group position={[LAKE.x + LAKE.rx - 2.5, 0, LAKE.z + 2]}>
          <Box p={[0, 0.16, 0]} s={[4.6, 0.08, 1.1]} c="#8d6e63" />
          {[-2, -0.6, 0.8].map((x) => [-0.5, 0.5].map((z) => <Cyl key={`${x}${z}`} p={[x, 0.1, z]} r={0.06} h={0.4} c="#5d4037" seg={6} />))}
          {[-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8].map((x) => <Box key={x} p={[x, 0.205, 0]} s={[0.04, 0.01, 1.1]} c="#6d4c41" />)}
        </group>
        {!frozen && (
          <group position={[LAKE.x + LAKE.rx - 4.6, 0, LAKE.z + 3.4]} rotation-y={0.3}>
            <Box p={[0, 0.06, 0]} s={[1.5, 0.16, 0.6]} c="#eceff1" />
            <Box p={[0, 0.16, 0]} s={[1.36, 0.06, 0.46]} c="#1565c0" />
            <Box p={[0, 0.18, 0]} s={[0.12, 0.04, 0.5]} c="#8d6e63" />
            <Box p={[0.15, 0.22, 0.32]} s={[0.9, 0.02, 0.04]} c="#8d6e63" />
          </group>
        )}
        {/* A cabin on the far shore. */}
        <group position={[LAKE.x - 6, 0, LAKE.z - LAKE.rz - 4]} rotation-y={0.2}>
          <BuildingModel def={buildingDef('house')} />
        </group>
      </Batch>
    </group>
  )
}

// Split-rail fence along the town line, broken where a road leaves town. Each
// gap gets two lantern posts and a gravel lane running off into the country,
// so roads look like they go somewhere.
const post = new BoxGeometry(0.09, 0.62, 0.09)
const rail = new BoxGeometry(1, 0.05, 0.04)
const lamp = new CylinderGeometry(0.05, 0.06, 1.1, 6)

function TownLine({ land, roads }: { land: string[]; roads: string[] }) {
  const built = useMemo(() => {
    const owned = new Set(land)
    const road = new Set(roads)
    const k = new Kit()
    const gates: { x: number; z: number; along: boolean; out: number }[] = []
    const wood = SEASON === 'winter' ? '#6d5a50' : '#8d6e63'
    const fenceRun = (x0: number, z0: number, alongX: boolean, len: number) => {
      for (let t = 0; t <= len + 1e-6; t += 1.6) {
        const x = alongX ? x0 + t : x0, z = alongX ? z0 : z0 + t
        k.add(post, wood, x, 0.31, z)
        if (t + 1.6 <= len + 1e-6)
          for (const y of [0.22, 0.46]) k.add(rail, wood, alongX ? x + 0.8 : x, y, alongX ? z : z + 0.8, alongX ? 0 : Math.PI / 2, 1.62, 1, 1, 0, 0)
      }
    }
    for (const key of land) {
      const [px, pz] = key.split(',').map(Number)
      const x0 = edge(px), z0 = edge(pz)
      // [neighbour dx, dz, fence along x?, fixed coordinate, tile on the edge]
      const sides = [
        [0, -1, true, z0, (i: number) => [px * PLOT + i, pz * PLOT]],
        [0, 1, true, z0 + PLOT_W, (i: number) => [px * PLOT + i, pz * PLOT + PLOT - 1]],
        [-1, 0, false, x0, (i: number) => [px * PLOT, pz * PLOT + i]],
        [1, 0, false, x0 + PLOT_W, (i: number) => [px * PLOT + PLOT - 1, pz * PLOT + i]],
      ] as const
      for (const [dx, dz, alongX, fixed, tileAt] of sides) {
        if (owned.has(`${px + dx},${pz + dz}`)) continue
        // Walk the edge tile by tile; fence the stretches between road exits.
        let runStart = 0
        for (let i = 0; i <= PLOT; i++) {
          const exit = i < PLOT && road.has(tileAt(i).join(','))
          if (i === PLOT || exit) {
            const len = (i - runStart) * TILE - (exit ? 0.3 : 0) - (runStart > 0 ? 0.3 : 0)
            const from = (alongX ? x0 : z0) + runStart * TILE + (runStart > 0 ? 0.3 : 0)
            if (len > 0.5) fenceRun(alongX ? from : fixed, alongX ? fixed : from, alongX, len)
            if (exit) {
              const c = (alongX ? x0 : z0) + i * TILE + HALF_TILE
              gates.push({ x: alongX ? c : fixed, z: alongX ? fixed : c, along: alongX, out: alongX ? dz : dx })
            }
            runStart = i + 1
          }
        }
      }
    }
    return { geo: k.geometry(), gates }
  }, [land, roads])
  useEffect(() => () => built.geo?.dispose(), [built])
  const gravel = useMemo(() => gravelTex(0.5, 4), [])
  return (
    <group>
      {built.geo && <mesh geometry={built.geo} material={kitMat} receiveShadow castShadow raycast={() => null} userData={{ noBatch: true }} />}
      {built.gates.map((g, i) => {
        const ux = g.along ? 0 : g.out, uz = g.along ? g.out : 0
        return (
          <group key={i} position={[g.x, 0, g.z]}>
            {/* Gravel lane heading out of town. */}
            <mesh rotation-x={-Math.PI / 2} rotation-z={g.along ? 0 : Math.PI / 2} position={[ux * 7, LAYER.land, uz * 7]}>
              <planeGeometry args={[1.6, 14]} />
              <meshStandardMaterial map={gravel} color="#b49a7c" />
            </mesh>
            {[-1, 1].map((sd) => {
              const px = g.along ? sd * (HALF_TILE + 0.15) : 0
              const pz = g.along ? 0 : sd * (HALF_TILE + 0.15)
              return (
                <group key={sd} position={[px, 0, pz]}>
                  <mesh geometry={lamp} position-y={0.55} castShadow>
                    <meshStandardMaterial color="#5d4037" />
                  </mesh>
                  <mesh position-y={1.16}>
                    <boxGeometry args={[0.16, 0.18, 0.16]} />
                    <primitive object={glowMats.bulb} attach="material" dispose={null} />
                  </mesh>
                  <mesh position-y={1.28}>
                    <coneGeometry args={[0.14, 0.1, 4]} />
                    <meshStandardMaterial color="#263238" />
                  </mesh>
                  <LightPool r={0.9} y={0.025} />
                </group>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

// Fireflies drifting over the lawns and meadows on spring and summer nights.
// One draw of points; they bob about in the vertex shader.
const FLY = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float seed;
varying float vBlink;
void main() {
  vec3 p = position;
  float t = uTime * 0.6 + seed * 17.0;
  p.x += sin(t * 0.7 + seed) * 0.9;
  p.z += cos(t * 0.5 + seed * 2.0) * 0.9;
  p.y += 0.35 + sin(t * 1.3) * 0.25;
  vBlink = smoothstep(0.2, 1.0, sin(t * 2.1 + seed * 5.0) * 0.5 + 0.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * (0.6 + vBlink);
}`
const FLY_FRAG = /* glsl */ `
uniform float uNight;
varying float vBlink;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vBlink * uNight;
  gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * a, a);
}`

function Fireflies({ small }: { small: boolean }) {
  const ref = useRef<Points>(null)
  const mat = useMemo(() => new ShaderMaterial({
    vertexShader: FLY, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 6 } },
  }), [])
  const geo = useMemo(() => {
    const n = small ? 140 : 260
    const r = rand(5150)
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = RANGE_LO + r() * (RANGE_HI - RANGE_LO)
      pos[i * 3 + 2] = RANGE_LO + r() * (RANGE_HI - RANGE_LO)
      seed[i] = r() * 10
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('seed', new BufferAttribute(seed, 1))
    return g
  }, [small])
  useEffect(() => onNight((n) => {
    mat.uniforms.uNight.value = Math.max(0, (n - 0.4) / 0.6)
    if (ref.current) ref.current.visible = n > 0.4
  }), [mat])
  useFrame(({ clock, camera, gl }) => {
    if (!ref.current?.visible) return
    mat.uniforms.uTime.value = clock.elapsedTime
    // Points don't scale with an orthographic zoom on their own.
    mat.uniforms.uScale.value = Math.min(14, Math.max(3, camera.zoom * 0.16)) * gl.getPixelRatio()
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />
}

export function Outskirts({ land, roads, small }: { land: string[]; roads: string[]; small: boolean }) {
  return (
    <group>
      <Wilds land={land} />
      <TownLine land={land} roads={roads} />
      <Forest />
      {(SEASON === 'summer' || SEASON === 'spring') && <Fireflies small={small} />}
    </group>
  )
}
