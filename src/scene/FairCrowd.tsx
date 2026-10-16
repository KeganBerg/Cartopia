import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial, Object3D, SphereGeometry, type InstancedMesh } from 'three'
import { headGeo, legGeo, paint, PERSON, torsoGeo } from './peopleGeo'
import { HAIR, SHIRTS, SKIN } from './people'

// The funfair's visitors: townspeople (peopleGeo.ts, faces and all) at their
// true size, more of them as the fair levels up. Some stand at the stalls and
// carts, some stroll the lane past the stalls and out to the gate. Instanced
// meshes that Batch leaves alone (four draws for the whole crowd), kept on
// their feet when the fair merges (userData.feet, see keepShape.ts).

const SCALE = PERSON.scale
const HIP = PERSON.leg
const TORSO = torsoGeo()
const HEAD = headGeo()
const LEG = legGeo(HIP)
const HAIR_GEO = paint(new SphereGeometry(0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, 0.025, -0.02), '#ffffff')
const mat = new MeshStandardMaterial({ vertexColors: true })
const PANTS = ['#37474f', '#1565c0', '#4e342e', '#263238', '#5d4037', '#283593']

// A visitor from `lvl` on: standing at (x, z) facing `face` (0 is +z), or
// walking the path from `walk` (0..1 of the way along it) at `speed`.
export type Visitor = { lvl: number; x?: number; z?: number; face?: number; walk?: number; speed?: number }

// The lane in front of the stalls and across the front by the gate, walked
// there and back.
export const FAIR_PATH: [number, number][] = [[-1.08, -0.62], [-1.08, 1.64], [-0.1, 1.64]]

const segs = FAIR_PATH.slice(1).map((p, i) => Math.hypot(p[0] - FAIR_PATH[i][0], p[1] - FAIR_PATH[i][1]))
const LONG = segs.reduce((a, b) => a + b, 0)
// Where along the path (0..1 there, 1..2 back), and which way they face.
function along(u: number): [number, number, number] {
  const t = u % 2
  const back = t > 1
  let d = (back ? 2 - t : t) * LONG
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const [ax, az] = FAIR_PATH[i]
      const [bx, bz] = FAIR_PATH[i + 1]
      const k = Math.min(1, d / segs[i])
      const dx = (bx - ax) * (back ? -1 : 1)
      const dz = (bz - az) * (back ? -1 : 1)
      return [ax + (bx - ax) * k, az + (bz - az) * k, Math.atan2(dx, dz)]
    }
    d -= segs[i]
  }
  return [FAIR_PATH[0][0], FAIR_PATH[0][1], 0]
}

export function FairCrowd({ lvl, visitors }: { lvl: number; visitors: Visitor[] }) {
  const here = useMemo(() => visitors.filter((v) => v.lvl <= lvl), [lvl, visitors])
  const n = here.length
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const spot = useMemo(() => new Float32Array(Math.max(1, n) * 3), [n])
  const feet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray(i * 3, i * 3 + 3) }), [spot])
  const legFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray((i >> 1) * 3, (i >> 1) * 3 + 3) }), [spot])

  useLayoutEffect(() => {
    const c = new Color()
    for (let i = 0; i < n; i++) {
      torso.current?.setColorAt(i, c.set(SHIRTS[(i * 3 + 1) % SHIRTS.length]))
      head.current?.setColorAt(i, c.set(SKIN[(i * 5 + 2) % SKIN.length]))
      hair.current?.setColorAt(i, c.set(HAIR[(i * 7 + 3) % HAIR.length]))
      c.set(PANTS[i % PANTS.length])
      legs.current?.setColorAt(i * 2, c)
      legs.current?.setColorAt(i * 2 + 1, c)
    }
    for (const m of [torso.current, head.current, hair.current, legs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
    place(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const set = (m: InstancedMesh, k: number, x: number, y: number, z: number, h: number, pitch = 0) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(pitch, h, 0, 'YXZ')
    dummy.updateMatrix()
    m.setMatrixAt(k, dummy.matrix)
  }
  function place(time: number) {
    const t = torso.current, hd = head.current, hr = hair.current, lg = legs.current
    if (!t || !hd || !hr || !lg) return
    for (let i = 0; i < n; i++) {
      const v = here[i]
      let x: number, z: number, face: number, stride = 0, bob = 0
      if (v.walk != null) {
        const [px, pz, h] = along(v.walk + (time * (v.speed ?? 0.05)))
        x = px
        z = pz
        face = h
        const step = time * 7 * (0.8 + (v.speed ?? 0.05) * 4) + i
        stride = Math.sin(step) * 0.42
        bob = Math.abs(Math.cos(step)) * 0.012
      } else {
        x = v.x ?? 0
        z = v.z ?? 0
        face = (v.face ?? 0) + Math.sin(time * 0.4 + i * 1.7) * 0.12
        // Shifting their weight now and then.
        bob = Math.max(0, Math.sin(time * 0.9 + i * 2.3)) * 0.006
      }
      const sx = x / SCALE, sz = z / SCALE
      spot.set([sx, 0, sz], i * 3)
      const hip = HIP + bob
      set(t, i, sx, hip + PERSON.torso, sz, face)
      set(hd, i, sx, hip + PERSON.head, sz, face)
      set(hr, i, sx, hip + PERSON.hair, sz, face)
      const sin = Math.sin(face), cos = Math.cos(face)
      for (const side of [-1, 1]) {
        const k = i * 2 + (side > 0 ? 1 : 0)
        const a = stride * side
        // Swung from the hip: the middle of the leg sits half a leg below it.
        const lx = side * 0.045
        const fwd = -Math.sin(a) * HIP * 0.5
        const down = Math.cos(a) * HIP * 0.5
        set(lg, k, sx + cos * lx + sin * fwd, hip - down, sz - sin * lx + cos * fwd, face, a)
      }
    }
    for (const m of [t, hd, hr, lg]) m.instanceMatrix.needsUpdate = true
  }

  useFrame(({ clock }) => place(clock.elapsedTime))

  if (!n) return null
  return (
    <group scale={SCALE}>
      <instancedMesh ref={torso} args={[TORSO, mat, n]} frustumCulled={false} castShadow userData={feet} dispose={null} />
      <instancedMesh ref={head} args={[HEAD, mat, n]} frustumCulled={false} userData={feet} dispose={null} />
      <instancedMesh ref={hair} args={[HAIR_GEO, mat, n]} frustumCulled={false} userData={feet} dispose={null} />
      <instancedMesh ref={legs} args={[LEG, mat, n * 2]} frustumCulled={false} userData={legFeet} dispose={null} />
    </group>
  )
}
