import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, Object3D, type BufferGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useMergeScale } from './mergeScale'
import { HAIR, PANTS, SKIN } from './people'
import { ARC, ARC0, DECK, TIERS, TRACK, deckAt } from './speedwayLayout'

// The moving parts of the Speedway, seen through its glass walls: race cars
// lapping the track nose to tail, and fans on the terraces who jump up and
// cheer as the cars come past and when the wave goes round. Instanced meshes
// that Batch leaves alone (noBatch), a handful of draws however big the crowd.
// Cars and fans are true size: a merged block draws more of them, not bigger
// ones (keepInstances in keepShape.ts keeps each one round its `feet`).

// Townspeople proportions (peopleGeo.ts PERSON), drawn SCALE bigger. Fans are
// drawn smaller than townspeople (Kegan's call, for this building only) so
// rows of them fit the grandstand.
const SCALE = 1.3 * 0.45
// Hip height sat down: on the seat, legs hanging down out of sight inside the step.
const SEAT = 0.04
const HIP = 0.24
const SHIRTS = ['#e53935', '#fafafa', '#1e88e5', '#fdd835', '#43a047', '#ff7043', '#8e24aa', '#26c6da']
const PAINT = ['#d32f2f', '#1565c0', '#fdd835', '#2e7d32', '#fafafa', '#ff6d00', '#6a1b9a', '#212121', '#00acc1', '#c2185b']

// One lap every ~3 s, the cars nose to tail.
const LAP = 2.1

const c = new Color()
function paint(g: BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g
  c.set(hex)
  const n = geo.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.deleteAttribute('uv')
  return geo
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => paint(new BoxGeometry(w, h, d).translate(x, y, z), hex)

// A GT race car the size of a town sports car, nose to +z, wheels on y = 0.
// White parts take the car's paint (the instance colour); dark ones stay dark.
let carGeo: BufferGeometry | null = null
function raceCar() {
  if (carGeo) return carGeo
  const wheel = (x: number, z: number) => paint(new CylinderGeometry(0.075, 0.075, 0.06, 12).rotateZ(Math.PI / 2).translate(x, 0.075, z), '#1a1a1a')
  carGeo = mergeGeometries([
    box(0.44, 0.1, 0.9, 0, 0.105, 0, '#ffffff'),
    box(0.4, 0.05, 0.16, 0, 0.08, 0.44, '#ffffff'),
    box(0.46, 0.015, 0.2, 0, 0.06, 0.38, '#262626'),
    box(0.32, 0.1, 0.36, 0, 0.205, -0.06, '#1c2430'),
    box(0.28, 0.012, 0.26, 0, 0.26, -0.06, '#ffffff'),
    box(0.06, 0.012, 0.5, 0, 0.161, 0.2, '#f5f5f5'),
    ...[-0.13, 0.13].map((x) => box(0.08, 0.025, 0.012, x, 0.12, 0.454, '#fff8d0')),
    ...[-0.14, 0.14].map((x) => box(0.08, 0.025, 0.012, x, 0.12, -0.454, '#7a0000')),
    ...[-0.14, 0.14].map((x) => box(0.02, 0.1, 0.03, x, 0.205, -0.4, '#262626')),
    box(0.46, 0.02, 0.09, 0, 0.26, -0.41, '#262626'),
    wheel(-0.215, 0.29), wheel(0.215, 0.29), wheel(-0.215, -0.29), wheel(0.215, -0.29),
  ])!
  return carGeo
}

type Fan = { a: number; r: number; y: number; pep: number }

export function SpeedwayLife({ lvl }: { lvl: number }) {
  const [sx, , sz] = useMergeScale()
  // A bigger block has a longer track and longer terraces: fill them, don't grow anyone.
  const k = (sx + sz) / 2
  const cars = Math.round((2 + Math.ceil(lvl / 2)) * k)
  // Fuller stands every level: 18 a row at level 1, 36 at level 10.
  const perRow = Math.round((16 + lvl * 2) * k)
  const fans = useMemo(() => {
    const out: Fan[] = []
    // One seat a fan, along the front of each row, rows staggered.
    const row = (n: number, { r0, y }: { r0: number; y: number }, off: number) => {
      for (let i = 0; i < n; i++) {
        const a = ARC0 + (ARC * (i + 0.25 + off)) / n
        out.push({ a, r: r0 + 0.032, y, pep: ((i * 7 + out.length * 3) % 5) / 5 })
      }
    }
    TIERS.forEach((t, j) => row(perRow, t, j * 0.5))
    if (deckAt(lvl)) DECK.rows.forEach((t, j) => row(perRow - 2, t, 0.25 + j * 0.5))
    return out
  }, [perRow, lvl])
  const n = fans.length

  const body = useRef<InstancedMesh>(null)
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  // Where each car and fan stands, so a merged block keeps them whole on that spot.
  const carSpot = useMemo(() => new Float32Array(cars * 3), [cars])
  const spot = useMemo(() => new Float32Array(n * 3), [n])
  const carFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => carSpot.subarray(i * 3, i * 3 + 3) }), [carSpot])
  const feet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray(i * 3, i * 3 + 3) }), [spot])
  const pairFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray((i >> 1) * 3, (i >> 1) * 3 + 3) }), [spot])

  useLayoutEffect(() => {
    for (let i = 0; i < cars; i++) body.current?.setColorAt(i, c.set(PAINT[(i * 3) % PAINT.length]))
    for (let i = 0; i < n; i++) {
      const shirt = SHIRTS[(i * 5 + 1) % SHIRTS.length]
      torso.current?.setColorAt(i, c.set(shirt))
      head.current?.setColorAt(i, c.set(SKIN[(i * 7 + 2) % SKIN.length]))
      hair.current?.setColorAt(i, c.set(HAIR[(i * 3) % HAIR.length]))
      arms.current?.setColorAt(i * 2, c.set(shirt))
      arms.current?.setColorAt(i * 2 + 1, c)
      legs.current?.setColorAt(i * 2, c.set(PANTS[i % PANTS.length]))
      legs.current?.setColorAt(i * 2 + 1, c)
    }
    for (const m of [body.current, torso.current, head.current, hair.current, arms.current, legs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [cars, n])

  useFrame(({ clock }) => {
    const b = body.current, t = torso.current, hd = head.current, hr = hair.current, ar = arms.current, lg = legs.current
    if (!b || !t || !hd || !hr || !ar || !lg) return
    const time = clock.elapsedTime

    // Cars: evenly spaced round the lap, closing up and dropping back a little,
    // weaving across the lane. Headings follow the track as the block draws it
    // (an oval in a pair), so a car always points down the road.
    const gap = (Math.PI * 2) / cars
    for (let i = 0; i < cars; i++) {
      const a = time * LAP + i * gap + Math.sin(time * 0.7 + i * 1.9) * gap * 0.12
      const r = TRACK.lane + Math.sin(time * 0.9 + i * 2.1) * 0.05
      const x = Math.sin(a) * r, z = Math.cos(a) * r
      carSpot.set([x, 0.06, z], i * 3)
      dummy.position.set(x, 0.06, z)
      dummy.rotation.set(0, Math.atan2(sx * Math.cos(a), -sz * Math.sin(a)), -0.05, 'YXZ')
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      b.setMatrixAt(i, dummy.matrix)
    }
    b.instanceMatrix.needsUpdate = true

    // Fans: up on their feet as a car comes past and as the wave sweeps the
    // stands, arms in the air; sat in their seats in between.
    const wave = ((time / 7) % 1) * 1.6 - 0.3
    for (let i = 0; i < n; i++) {
      const f = fans[i]
      let near = Math.PI
      for (let j = 0; j < cars; j++) {
        const d = Math.abs(((((f.a - Math.atan2(carSpot[j * 3], carSpot[j * 3 + 2])) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        if (d < near) near = d
      }
      const along = (f.a - ARC0) / ARC
      const w = Math.exp(-(((along - wave) / 0.07) ** 2))
      const cheer = Math.min(1, Math.max(w, Math.exp(-((near / 0.45) ** 2)) * (0.6 + f.pep * 0.4), f.pep > 0.75 ? 0.35 : 0))
      const x = Math.sin(f.a) * f.r, z = Math.cos(f.a) * f.r
      const fx = x / SCALE, fy = f.y / SCALE, fz = z / SCALE
      spot.set([fx, fy, fz], i * 3)
      const hip = SEAT + (HIP - SEAT) * cheer + Math.abs(Math.sin(time * 8 + i * 1.3)) * 0.03 * cheer
      const heading = Math.atan2(-x * sx, -z * sz)
      const sin = Math.sin(heading), cos = Math.cos(heading)
      dummy.rotation.set(0, heading, 0)
      dummy.scale.set(1, 1, 1)
      dummy.position.set(fx, fy + hip + 0.08, fz)
      dummy.updateMatrix()
      t.setMatrixAt(i, dummy.matrix)
      dummy.position.set(fx, fy + hip + 0.29, fz)
      dummy.updateMatrix()
      hd.setMatrixAt(i, dummy.matrix)
      dummy.position.set(fx, fy + hip + 0.33, fz)
      dummy.updateMatrix()
      hr.setMatrixAt(i, dummy.matrix)
      for (const side of [-1, 1]) {
        // Arms hang at the sides, and go up and wave as they cheer.
        const lift = 0.2 + cheer * (2.3 + Math.sin(time * 9 + i * 2 + side) * 0.3)
        const a = side * lift
        const dx = Math.sin(a) * 0.09, dy = -Math.cos(a) * 0.09
        const ox = side * 0.1 + dx
        dummy.position.set(fx + cos * ox, fy + hip + 0.2 + dy, fz - sin * ox)
        dummy.rotation.set(0, heading, a, 'YXZ')
        dummy.updateMatrix()
        ar.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
        // Legs hang straight down from the hip: inside the step sat down, on it stood up.
        const ox2 = side * 0.045
        dummy.position.set(fx + cos * ox2, fy + hip - HIP / 2, fz - sin * ox2)
        dummy.rotation.set(0, heading, 0)
        dummy.updateMatrix()
        lg.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
      }
    }
    for (const m of [t, hd, hr, ar, lg]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[raceCar(), undefined, cars]} frustumCulled={false} castShadow userData={carFeet}>
        <meshStandardMaterial vertexColors roughness={0.35} metalness={0.2} />
      </instancedMesh>
      <group scale={SCALE}>
        <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
          <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={hair} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
          <sphereGeometry args={[0.078, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={arms} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={pairFeet}>
          <boxGeometry args={[0.045, 0.18, 0.045]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={pairFeet}>
          <boxGeometry args={[0.055, HIP, 0.055]} />
          <meshStandardMaterial />
        </instancedMesh>
      </group>
    </group>
  )
}
