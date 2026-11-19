import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, MeshBasicMaterial, Object3D, PlaneGeometry, SphereGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { paint } from './peopleGeo'
import { openDoors, tickDoors } from './doors'
import { dayPhase, nightAmount } from './dayNight'

// The doors townspeople open. A shut door is part of its building's merged
// mesh; while someone walks in or out, a copy of it (in the door's own colour)
// swings out on its hinges, or two glass panels slide apart, over a doorway
// that shows the dim shop inside, lit warm after dark. Three instanced meshes
// cover every open door in town, and draw nothing while none is open.

const MAX = 48
// Door leaf, hinged at x = 0 and reaching to x = 1, 1 tall, standing on y = 0:
// a slab with two raised panels on each face and a brass knob both sides.
function leafGeo() {
  const panel = (y: number, h: number, z: number) => paint(new BoxGeometry(0.66, h, 0.5).translate(0.5, y, z), '#e3e3e3')
  return mergeGeometries([
    paint(new BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0), '#ffffff'),
    ...[0.5, -0.5].flatMap((z) => [panel(0.72, 0.36, z), panel(0.3, 0.36, z)]),
    ...[1, -1].map((s) => paint(new SphereGeometry(0.06, 8, 6).scale(1, 0.7, 1.2).translate(0.86, 0.5, s * 0.95), '#c9a227')),
  ])!
}
// Sliding glass panel, 1 wide from x = 0: a steel frame round tinted glass and a pull bar.
function glassGeo() {
  const bar = (w: number, h: number, x: number, y: number) => paint(new BoxGeometry(w, h, 1).translate(x, y, 0), '#b0bec5')
  return mergeGeometries([
    paint(new BoxGeometry(0.9, 0.9, 0.4).translate(0.5, 0.5, 0), '#4f7f8c'),
    bar(1, 0.06, 0.5, 0.03), bar(1, 0.05, 0.5, 0.975), bar(0.06, 1, 0.03, 0.5), bar(0.06, 1, 0.97, 0.5),
    bar(0.03, 0.3, 0.88, 0.5),
  ])!
}
// The doorway, a little darker towards the ceiling.
function gapGeo() {
  const g = paint(new PlaneGeometry(1, 1, 1, 2).translate(0, 0.5, 0), '#ffffff')
  const pos = g.getAttribute('position')
  const col = g.getAttribute('color')
  for (let i = 0; i < pos.count; i++) {
    const k = 1 - pos.getY(i) * 0.45
    col.setXYZ(i, k, k, k)
  }
  return g
}

const LEAF = leafGeo()
const GLASS = glassGeo()
const GAP = gapGeo()
const THICK = 0.03
// How far a leaf swings open, and how far out from the wall each piece sits so nothing z-fights.
const SWING = 1.62
const GAP_OUT = 0.003
const LEAF_OUT = 0.005
const DAY_IN = new Color('#2b1f17')
const NIGHT_IN = new Color('#f2b45a')

export function DoorLeaves() {
  const leaves = useRef<InstancedMesh>(null)
  const glass = useRef<InstancedMesh>(null)
  const gaps = useRef<InstancedMesh>(null)
  const o = useMemo(() => new Object3D(), [])
  const c = useMemo(() => new Color(), [])
  const gapMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1)
    tickDoors(dt)
    const L = leaves.current, G = glass.current, P = gaps.current
    if (!L || !G || !P) return
    gapMat.color.lerpColors(DAY_IN, NIGHT_IN, nightAmount(dayPhase()) * 0.75)
    let nl = 0, ng = 0, np = 0
    const put = (m: InstancedMesh, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number) => {
      o.position.set(x, y, z)
      o.rotation.set(0, ry, 0)
      o.scale.set(sx, sy, sz)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    for (const { spot: d, open } of openDoors.values()) {
      if (d.kind === 'gate' || open <= 0 || np >= MAX) continue
      const face = Math.atan2(d.nx, d.nz)
      const tx = d.nz, tz = -d.nx
      // Eased, so a door starts and settles gently.
      const e = open * open * (3 - 2 * open)
      put(P, np++, d.x + d.nx * GAP_OUT, d.y, d.z + d.nz * GAP_OUT, face, d.w * 0.98, d.h * 0.98, 1)
      if (d.kind === 'slide') {
        // Two panels part from the middle, sliding along the outside of the wall.
        for (const s of [-1, 1]) {
          const along = s * (d.w / 2) * e
          const x = d.x + tx * (along + (s < 0 ? -d.w / 2 : 0)) + d.nx * (LEAF_OUT + 0.004)
          const z = d.z + tz * (along + (s < 0 ? -d.w / 2 : 0)) + d.nz * (LEAF_OUT + 0.004)
          put(G, ng++, x, d.y, z, face, d.w / 2, d.h, THICK)
        }
        continue
      }
      // Leaves hang from one edge (both, for a double door) and swing out.
      const hinges: [number, number][] = d.kind === 'double' ? [[1, d.w / 2], [-1, d.w / 2]] : [[d.hinge, d.w]]
      const a = e * SWING
      c.set(d.color)
      for (const [h, w] of hinges) {
        // From the hinge towards the other edge, turning out from the wall.
        const ux = -h * tx * Math.cos(a) + d.nx * Math.sin(a)
        const uz = -h * tz * Math.cos(a) + d.nz * Math.sin(a)
        const hx = d.x + (tx * h * d.w) / 2 + d.nx * (LEAF_OUT + THICK / 2)
        const hz = d.z + (tz * h * d.w) / 2 + d.nz * (LEAF_OUT + THICK / 2)
        put(L, nl, hx, d.y, hz, Math.atan2(-uz, ux), w, d.h, THICK)
        L.setColorAt(nl++, c)
      }
    }
    for (const [m, n] of [[L, nl], [G, ng], [P, np]] as const) {
      m.count = n
      m.visible = n > 0
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })

  return (
    <group userData={{ noBatch: true }}>
      <instancedMesh ref={leaves} args={[LEAF, undefined, MAX * 2]} frustumCulled={false} visible={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={glass} args={[GLASS, undefined, MAX * 2]} frustumCulled={false} visible={false}>
        <meshStandardMaterial vertexColors roughness={0.25} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={gaps} args={[GAP, gapMat, MAX]} frustumCulled={false} visible={false} />
    </group>
  )
}
