import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, Object3D } from 'three'
import type { Group, InstancedMesh } from 'three'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { CLUB } from './clubLayout'
import { driveClubLeds } from './clubLeds'

// The moving parts of the nightclub, shown only while it's open: people
// dancing on the rooftop floor, the bouncer at the door and two searchlights
// sweeping the sky. Instanced meshes (four draws for every figure) that Batch
// leaves alone, so they can move.

const SHIRTS = ['#ff2bd6', '#00e5ff', '#ffea00', '#76ff03', '#ff6d00', '#fafafa', '#7c4dff', '#ff1744', '#18ffff', '#f50057']
const PANTS = ['#212121', '#263238', '#3949ab', '#1a237e', '#4e342e', '#37474f']
const SKIN = ['#f5d0b5', '#e0ac8a', '#c68863', '#8d5a3b', '#5c3a24', '#f1c27d']
// Townspeople proportions, drawn at the same size as the ones walking about.
const SCALE = 1.3
const HIP = 0.24

// One beam material for every club; its strength follows the night. The beam
// is brightest at the lamp and fades out into the sky.
const beamMat = new MeshBasicMaterial({ color: '#d9c8ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false })
if (typeof document !== 'undefined') {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, '#000000')
  grad.addColorStop(1, '#ffffff')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
  beamMat.alphaMap = new CanvasTexture(c)
}

type Props = { lvl: number; roofY: number; roofZ: number; floorY: number; floorZ: number; floorW: number; floorD: number }

export function ClubLife({ lvl, roofY, roofZ, floorY, floorZ, floorW, floorD }: Props) {
  // More dancers as the club levels up: 5 at level 1, 10 at level 10.
  const dancers = 5 + Math.floor(lvl / 2)
  const n = dancers + 1 // the last figure is the bouncer
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const beams = useRef<Group[]>([])
  const dummy = useMemo(() => new Object3D(), [])
  // The spot each figure stands on, so a merged club keeps them in one piece on the floor.
  const spot = useMemo(() => new Float32Array(n * 3), [n])
  const feet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray(i * 3, i * 3 + 3) }), [spot])
  const armFeet = useMemo(() => ({ noBatch: true, feet: (i: number) => spot.subarray((i >> 1) * 3, (i >> 1) * 3 + 3) }), [spot])

  // Spots spread over the floor in a loose grid, the same every load.
  const spots = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(dancers * (floorW / floorD)))
    const rows = Math.ceil(dancers / cols)
    return Array.from({ length: dancers }, (_, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      const jx = Math.sin(i * 12.9898) * 0.12
      const jz = Math.cos(i * 78.233) * 0.08
      return [((c + 0.5) / cols - 0.5) * floorW * 0.8 + jx, floorZ + ((r + 0.5) / rows - 0.5) * floorD * 0.6 + jz] as const
    })
  }, [dancers, floorW, floorD, floorZ])

  useLayoutEffect(() => {
    const color = new Color()
    for (let i = 0; i < n; i++) {
      const bouncer = i === dancers
      torso.current?.setColorAt(i, color.set(bouncer ? '#151515' : SHIRTS[i % SHIRTS.length]))
      head.current?.setColorAt(i, color.set(SKIN[(i * 7) % SKIN.length]))
      arms.current?.setColorAt(i * 2, color.set(bouncer ? '#151515' : SHIRTS[i % SHIRTS.length]))
      arms.current?.setColorAt(i * 2 + 1, color)
      color.set(bouncer ? '#151515' : PANTS[i % PANTS.length])
      legs.current?.setColorAt(i * 2, color)
      legs.current?.setColorAt(i * 2 + 1, color)
    }
    for (const m of [torso.current, head.current, arms.current, legs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [n, dancers])

  useFrame(({ clock }) => {
    driveClubLeds()
    const t = torso.current
    const hd = head.current
    const ar = arms.current
    const lg = legs.current
    if (!t || !hd || !ar || !lg) return
    const open = isNight()
    const night = nightAmount(dayPhase())
    for (const b of beams.current) {
      if (!b) continue
      b.visible = night > 0.05
      const k = b.userData.k as number
      const sd = k === 0 ? -1 : 1
      // Sweep up and away from the club (out to the side and back), never
      // down across the roof.
      b.rotation.z = -sd * (0.3 + Math.sin(clock.elapsedTime * 0.5 + k * 2.2) * 0.25)
      b.rotation.x = -0.1 + Math.cos(clock.elapsedTime * 0.37 + k) * 0.15
    }
    beamMat.opacity = night * 0.3
    const count = open ? n : 0
    t.count = hd.count = count
    ar.count = lg.count = count * 2
    if (!open) return
    const time = clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const bouncer = i === dancers
      let x: number, z: number, heading: number, bob: number, lift: number, wave: number
      if (bouncer) {
        // Arms folded, watching the line.
        x = CLUB.doorX - 0.34
        z = CLUB.doorZ + 0.22
        heading = Math.PI / 2 + Math.sin(time * 0.4) * 0.5
        bob = 0
        lift = 0.6
        wave = 0
      } else {
        const beat = time * 5.6 + i * 1.7
        x = spots[i][0] + Math.sin(time * 0.7 + i) * 0.05
        z = spots[i][1] + Math.cos(time * 0.6 + i * 2) * 0.04
        heading = i * 1.3 + Math.sin(time * 1.4 + i) * 0.9
        bob = Math.abs(Math.sin(beat)) * 0.07
        // Some wave their arms in the air, some keep them low and pump.
        lift = i % 3 === 0 ? 2.6 : i % 3 === 1 ? 2.2 + Math.sin(beat) * 0.5 : 1.1 + Math.sin(beat * 2) * 0.4
        wave = Math.sin(beat * 0.5) * 0.25
      }
      const baseY = bouncer ? 0 : floorY
      const sx = x / SCALE
      const sz = z / SCALE
      const y = baseY / SCALE + HIP + bob
      spot.set([sx, baseY / SCALE, sz], i * 3)
      const sin = Math.sin(heading)
      const cos = Math.cos(heading)
      dummy.rotation.set(0, heading, 0)
      dummy.scale.set(bouncer ? 1.25 : 1, 1, bouncer ? 1.25 : 1)
      dummy.position.set(sx, y + 0.08, sz)
      dummy.updateMatrix()
      t.setMatrixAt(i, dummy.matrix)
      dummy.scale.set(1, 1, 1)
      dummy.position.set(sx, y + 0.29, sz)
      dummy.updateMatrix()
      hd.setMatrixAt(i, dummy.matrix)
      // Arms hang from the shoulders and swing up (lift) to either side.
      for (const side of [-1, 1]) {
        const a = side * (lift + (side > 0 ? wave : -wave))
        const ox = side * 0.1
        const dx = Math.sin(a) * 0.09
        const dy = -Math.cos(a) * 0.09
        dummy.position.set(sx + cos * (ox + dx), y + 0.2 + dy, sz - sin * (ox + dx))
        dummy.rotation.set(0, heading, a, 'YXZ')
        dummy.updateMatrix()
        ar.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
        // Legs from the floor up to the hip, bending with the bounce.
        dummy.position.set(sx + cos * side * 0.045, baseY / SCALE + (HIP + bob) / 2, sz - sin * side * 0.045)
        dummy.rotation.set(0, heading, 0)
        dummy.scale.set(1, (HIP + bob) / HIP, 1)
        dummy.updateMatrix()
        lg.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
        dummy.scale.set(1, 1, 1)
      }
    }
    for (const m of [t, hd, ar, lg]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <group scale={SCALE}>
        <instancedMesh ref={torso} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
          <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={head} args={[undefined, undefined, n]} frustumCulled={false} userData={feet}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={arms} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={armFeet}>
          <boxGeometry args={[0.045, 0.18, 0.045]} />
          <meshStandardMaterial />
        </instancedMesh>
        <instancedMesh ref={legs} args={[undefined, undefined, n * 2]} frustumCulled={false} userData={armFeet}>
          <boxGeometry args={[0.055, HIP, 0.055]} />
          <meshStandardMaterial />
        </instancedMesh>
      </group>
      {/* Searchlights on the roof, sweeping the sky (left out of preview framing). */}
      {[-1, 1].map((sd, k) => (
        <group key={sd} position={[sd * CLUB.lampX, roofY + 0.24, roofZ + CLUB.lampZ]} userData={{ noFit: true }}>
          <group
            ref={(el) => {
              if (el) beams.current[k] = el
            }}
            userData={{ k }}
            visible={false}
          >
            {/* A tall cone, its narrow end at the lamp. */}
            <mesh position-y={3.5} userData={{ noBatch: true }}>
              <cylinderGeometry args={[0.5, 0.05, 7, 12, 1, true]} />
              <primitive object={beamMat} attach="material" dispose={null} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}
