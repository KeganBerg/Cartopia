import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, Matrix4, Object3D, type BufferGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useMergeScale } from './mergeScale'
import { HAIR, PANTS, SKIN } from './people'
import { ARC, ARC0, TRACK } from './speedwayLayout'
import { armMatrix, seatMatrix, seatParts, fanBody, speedwayStands } from './speedwayCrowd'

// The moving parts of the Speedway, seen through its glass walls: race cars
// lapping the track nose to tail, and fans standing at their grandstand seats
// (speedwayCrowd.ts) who throw their arms up as the cars come past and when
// the wave goes round. Instanced meshes that Batch leaves alone (noBatch), a
// handful of draws however big the block. Cars, seats and fans are true size:
// a merged block draws more of them, not bigger ones (keepInstances in
// keepShape.ts keeps each one round its `feet`).

// Seat colours, one a row from the front (the deck's two rows last).
const SEAT_COLORS = ['#1e88e5', '#fdd835', '#e53935', '#1e88e5', '#fdd835']
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

// Seat cushion and back, facing +z (the track); white takes the row's colour.
let seatGeo: BufferGeometry | null = null
function seatShape() {
  if (seatGeo) return seatGeo
  const { shell, post } = seatParts()
  seatGeo = mergeGeometries([...shell.map((g) => paint(g, '#ffffff')), paint(post, '#455a64')])!
  return seatGeo
}

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

export function SpeedwayLife({ lvl }: { lvl: number }) {
  const [sx, , sz] = useMergeScale()
  // A bigger block has a longer track and longer terraces: fill them, don't grow anyone.
  const k = (sx + sz) / 2
  const cars = Math.round((2 + Math.ceil(lvl / 2)) * k)
  const { seats, aisles, fans } = useMemo(() => speedwayStands(lvl, k), [k, lvl])
  const ns = seats.length, na = aisles.length, n = fans.length

  const body = useRef<InstancedMesh>(null)
  const seatMesh = useRef<InstancedMesh>(null)
  const stairMesh = useRef<InstancedMesh>(null)
  const shirt = useRef<InstancedMesh>(null)
  const pants = useRef<InstancedMesh>(null)
  const skin = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const hands = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const arm = useMemo(() => new Matrix4(), [])
  // Where each car is, so a merged block keeps it whole on that spot.
  const carSpot = useMemo(() => new Float32Array(cars * 3), [cars])
  const carFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => carSpot.subarray(i * 3, i * 3 + 3) }), [carSpot])
  const seatSpot = useMemo(() => Float32Array.from(seats.flatMap(({ a, r, y }) => [Math.sin(a) * r, y, Math.cos(a) * r])), [seats])
  const stairSpot = useMemo(() => Float32Array.from(aisles.flatMap(({ a, r, y }) => [Math.sin(a) * r, y, Math.cos(a) * r])), [aisles])
  const seatFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => seatSpot.subarray(i * 3, i * 3 + 3) }), [seatSpot])
  const stairFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => stairSpot.subarray(i * 3, i * 3 + 3) }), [stairSpot])
  // A fan is kept whole round their seat's spot; both arms round the same one.
  const fanFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => seatSpot.subarray(fans[i] * 3, fans[i] * 3 + 3) }), [seatSpot, fans])
  const armFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => seatSpot.subarray(fans[i >> 1] * 3, fans[i >> 1] * 3 + 3) }), [seatSpot, fans])
  // Each fan's seat transform: the body is drawn with exactly it, the arms off it.
  const fanAt = useMemo(() => fans.map((s) => seatMatrix(seats[s], sx, sz)), [fans, seats, sx, sz])

  // Seats and stair nosings don't move: placed once, facing the track as the block draws it.
  useLayoutEffect(() => {
    const m = new Matrix4()
    for (const [mesh, list, hex] of [[seatMesh.current, seats, ''], [stairMesh.current, aisles, '#fafafa']] as const) {
      if (!mesh) continue
      list.forEach((seat, i) => {
        mesh.setMatrixAt(i, seatMatrix(seat, sx, sz, m))
        mesh.setColorAt(i, c.set(hex || SEAT_COLORS[seat.row]))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [seats, aisles, sx, sz])

  // Fans stand still at their seats: placed once, coloured once.
  useLayoutEffect(() => {
    fanAt.forEach((m, i) => {
      for (const mesh of [shirt.current, pants.current, skin.current, hair.current]) mesh?.setMatrixAt(i, m)
      const tee = SHIRTS[(i * 5 + 1) % SHIRTS.length]
      shirt.current?.setColorAt(i, c.set(tee))
      arms.current?.setColorAt(i * 2, c)
      arms.current?.setColorAt(i * 2 + 1, c)
      pants.current?.setColorAt(i, c.set(PANTS[i % PANTS.length]))
      skin.current?.setColorAt(i, c.set(SKIN[(i * 7 + 2) % SKIN.length]))
      hands.current?.setColorAt(i * 2, c)
      hands.current?.setColorAt(i * 2 + 1, c)
      hair.current?.setColorAt(i, c.set(HAIR[(i * 3) % HAIR.length]))
    })
    for (const mesh of [shirt.current, pants.current, skin.current, hair.current, arms.current, hands.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [fanAt])

  useLayoutEffect(() => {
    for (let i = 0; i < cars; i++) body.current?.setColorAt(i, c.set(PAINT[(i * 3) % PAINT.length]))
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [cars])

  useFrame(({ clock }) => {
    const b = body.current
    if (!b) return
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

    // Arms: down at their sides, thrown up as a car comes past and as the
    // wave sweeps the stands. Feet stay on the step.
    const ar = arms.current, hn = hands.current
    if (!ar || !hn) return
    const sweep = ((time / 7) % 1) * 1.6 - 0.3
    for (let i = 0; i < n; i++) {
      const s = seats[fans[i]]
      let near = Math.PI
      for (let j = 0; j < cars; j++) {
        const d = Math.abs(((((s.a - Math.atan2(carSpot[j * 3], carSpot[j * 3 + 2])) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
        if (d < near) near = d
      }
      const pep = (i * 0.618) % 1
      const w = Math.exp(-((((s.a - ARC0) / ARC - sweep) / 0.07) ** 2))
      const cheer = Math.min(1, Math.max(w, Math.exp(-((near / 0.4) ** 2)) * (0.5 + pep * 0.5)))
      for (const side of [-1, 1] as const) {
        const wave = Math.sin(time * 9 + i * 2 + side)
        armMatrix(side, cheer, wave, arm)
        arm.premultiply(fanAt[i])
        ar.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), arm)
        hn.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), arm)
      }
    }
    ar.instanceMatrix.needsUpdate = true
    hn.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[raceCar(), undefined, cars]} frustumCulled={false} castShadow userData={carFeet}>
        <meshStandardMaterial vertexColors roughness={0.35} metalness={0.2} />
      </instancedMesh>
      <instancedMesh name="speedway-seats" ref={seatMesh} args={[seatShape(), undefined, ns]} frustumCulled={false} userData={seatFeet}>
        <meshStandardMaterial vertexColors roughness={0.6} />
      </instancedMesh>
      {/* Stair nosings: a white strip at the front of each step in the aisles. */}
      <instancedMesh ref={stairMesh} args={[undefined, undefined, na]} frustumCulled={false} userData={stairFeet}>
        <boxGeometry args={[0.09, 0.008, 0.02]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh name="fan-shirt" ref={shirt} args={[fanBody().shirt, undefined, n]} frustumCulled={false} userData={fanFeet}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh name="fan-pants" ref={pants} args={[fanBody().pants, undefined, n]} frustumCulled={false} userData={fanFeet}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh name="fan-skin" ref={skin} args={[fanBody().skin, undefined, n]} frustumCulled={false} userData={fanFeet}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh name="fan-hair" ref={hair} args={[fanBody().hair, undefined, n]} frustumCulled={false} userData={fanFeet}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh name="fan-arms" ref={arms} args={[fanBody().arm, undefined, n * 2]} frustumCulled={false} userData={armFeet}>
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh name="fan-hands" ref={hands} args={[fanBody().hand, undefined, n * 2]} frustumCulled={false} userData={armFeet}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
    </group>
  )
}
