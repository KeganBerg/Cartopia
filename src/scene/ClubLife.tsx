import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import type { Group, InstancedMesh } from 'three'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { CLUB } from './clubLayout'
import { clubPulse } from '../lib/clubBeat'
import { driveClubLeds, shownNow } from './clubLeds'
import { newDance, stepDance } from './danceClock'
import { legGeo, PERSON, torsoGeo } from './peopleGeo'
import { clubArmGeo, clubFigureMat, clubHeadGeo, skinOf } from './clubPeople'
import { doorNear, type Door } from './clubDoor'

// The moving parts of the nightclub, shown only while it's open: people
// dancing on the rooftop floor, the bouncer at the rope and two searchlights
// sweeping the sky. The people are the townspeople's own detailed parts
// (clubPeople.ts) in instanced meshes (four draws for every figure) that
// Batch leaves alone, so they can move.

const SHIRTS = ['#ff2bd6', '#00e5ff', '#ffea00', '#76ff03', '#ff6d00', '#fafafa', '#7c4dff', '#ff1744', '#18ffff', '#f50057']
const PANTS = ['#212121', '#263238', '#3949ab', '#1a237e', '#4e342e', '#37474f']
// Townspeople proportions, drawn at the same size as the ones walking about.
const SCALE = PERSON.scale
const HIP = PERSON.leg
const TORSO = torsoGeo(false)
const HEAD = clubHeadGeo()
const ARM = clubArmGeo()
const LEG = legGeo(HIP)
const plainMat = new MeshStandardMaterial({ vertexColors: true })
const figureMat = clubFigureMat()
// Where the arms swing from, beside the top of the torso (model units, from the hip).
const SHOULDER_X = 0.107
const SHOULDER_Y = PERSON.torso + 0.1

// The bouncer: a big man in black by his podium on the near side of the red
// carpet (lot units, see clubLayout), across from the head of the line.
const BOUNCER = { x: -1.44, z: 0.74, wide: 1.2, deep: 1.1, arms: 1.25 }
// Where he faces: down the street toward the line, square on to whoever's at
// the front of the rope, and his head turned to the door as he waves them in.
const FACE = { idle: 0.75, line: Math.atan2(CLUB.queueX - BOUNCER.x, CLUB.queueZ - BOUNCER.z), door: 0.65 }
// Seconds his "go on in" wave takes: arm out, hold, back to his hands.
const WAVE = { up: 0.35, hold: 1.4, down: 0.5 }

// An arm's roll (out to the side) and pitch (forward is negative) to point
// its hand along (x, y, z) in the figure's own frame (facing +z).
function aim(x: number, y: number, z: number): [number, number] {
  const l = Math.hypot(x, y, z)
  return [Math.asin(x / l), Math.atan2(-z / l, -y / l)]
}
// Hands clasped in front at the belt (the right arm, on his +x side; the left
// mirrors it), and the right arm swept out toward the door.
const CLASP = aim(-0.11, -0.18, 0.14)
const POINT = aim(0.7, 0.1, 0.7)
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

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
  const dancers = Math.min(5 + Math.floor(lvl / 2), 15)
  const n = dancers + 1 // figure 0 is the bouncer
  const root = useRef<Group>(null)
  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const beams = useRef<Group[]>([])
  const dummy = useMemo(() => new Object3D(), [])
  const dance = useMemo(() => newDance(), [])
  // What the bouncer is up to: where he faces, where he looks, and his door.
  const bouncer = useRef({ heading: 0, look: 0, door: undefined as Door | undefined, seek: 0, waved: 0, wave: -99 })
  const here = useMemo(() => new Vector3(), [])
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

  // Shirts on the torso and the arms' sleeves, trousers on the legs; skin and
  // hair come from the figure's own look (clubPeople.ts).
  useLayoutEffect(() => {
    const color = new Color()
    for (let i = 0; i < n; i++) {
      const b = i === 0
      color.set(b ? '#4a4f5e' : SHIRTS[i % SHIRTS.length])
      torso.current?.setColorAt(i, color)
      arms.current?.setColorAt(i * 2, color)
      arms.current?.setColorAt(i * 2 + 1, color)
      head.current?.setColorAt(i, color.set(skinOf(i)))
      color.set(b ? '#2e3039' : PANTS[i % PANTS.length])
      legs.current?.setColorAt(i * 2, color)
      legs.current?.setColorAt(i * 2 + 1, color)
    }
    for (const m of [torso.current, head.current, arms.current, legs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [n])

  useFrame(({ clock }, dt) => {
    const now = shownNow()
    driveClubLeds(now)
    // The dancers move to the music: down on every beat, up between, on
    // their own smooth count that follows the track (danceClock.ts).
    const music = clubPulse(now)
    stepDance(dance, dt, music.grid, music.bpm, music.env.clap)
    const beats = dance.phase
    const clap = dance.clap
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
    const wall = performance.now() / 1000

    // The bouncer hears from the line at his rope (Townspeople's bouncers()).
    const bc = bouncer.current
    if (!bc.door || wall > bc.seek) {
      root.current?.getWorldPosition(here)
      bc.door = doorNear(here.x, here.z)
      bc.seek = wall + 1
    }
    if (bc.door && bc.door.admitted !== bc.waved) {
      bc.waved = bc.door.admitted
      bc.wave = wall
    }
    const since = wall - bc.wave
    const waving = since < WAVE.up + WAVE.hold + WAVE.down
    const raise = smooth(since / WAVE.up) * (1 - smooth((since - WAVE.up - WAVE.hold) / WAVE.down))
    // Faces the head of the line and waves them toward the door; with no one
    // waiting, keeps an eye up and down the street.
    const waiting = !!bc.door?.waiting
    const faceTo = waving || waiting ? FACE.line : FACE.idle
    const lookTo = waving ? FACE.door * raise : waiting ? Math.sin(time * 0.35) * 0.15 : Math.sin(time * 0.3) * 0.7 + Math.sin(time * 0.71) * 0.2
    bc.heading += (faceTo - bc.heading) * Math.min(1, dt * 3)
    bc.look += (lookTo - bc.look) * Math.min(1, dt * 4)

    const place = (m: InstancedMesh, at: number, x: number, y: number, z: number, h: number, sx = 1, sy = 1, sz = 1) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, h, 0)
      dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      m.setMatrixAt(at, dummy.matrix)
    }
    for (let i = 0; i < n; i++) {
      const isB = i === 0
      let x: number, z: number, heading: number, dip: number, look: number
      // Each arm's roll and pitch, left then right.
      let lr: number, lp: number, rr: number, rp: number
      if (isB) {
        x = BOUNCER.x
        z = BOUNCER.z
        heading = bc.heading
        dip = 0
        look = bc.look
        // Left hand stays at the belt; the right sweeps out toward the door and back.
        lr = -CLASP[0]
        lp = CLASP[1]
        rr = CLASP[0] + (POINT[0] - CLASP[0]) * raise
        rp = CLASP[1] + (POINT[1] - CLASP[1]) * raise
      } else {
        const d = i - 1
        const beat = beats * Math.PI
        x = spots[d][0] + Math.sin(time * 0.7 + i) * 0.05
        z = spots[d][1] + Math.cos(time * 0.6 + i * 2) * 0.04
        heading = i * 1.3 + Math.sin(time * 1.4 + i) * 0.9
        // Knees bend on the beat.
        dip = (1 - Math.sin((beats - Math.floor(beats)) * Math.PI)) * 0.03
        look = Math.sin(time * 0.9 + i * 2.1) * 0.35
        // Some wave their arms in the air, some keep them low and pump, and
        // some throw their hands up on the claps.
        const lift = i % 3 === 0 ? 2.6 - clap * 0.5 : i % 3 === 1 ? 2.2 + Math.sin(beat) * 0.5 : 1.1 + Math.sin(beat * 2) * 0.4 + clap * 1.2
        const wave = Math.sin(beat * 0.5 + i * 1.7) * 0.25
        const pump = i % 3 === 2 ? -0.5 - Math.sin(beat * 2) * 0.3 : -0.15
        lr = -(lift - wave)
        rr = lift + wave
        lp = rp = pump
      }
      const baseY = isB ? 0 : floorY / SCALE
      const sx = x / SCALE
      const sz = z / SCALE
      const hip = baseY + HIP - dip
      spot.set([sx, baseY, sz], i * 3)
      const sin = Math.sin(heading)
      const cos = Math.cos(heading)
      const wide = isB ? BOUNCER.wide : 1
      const deep = isB ? BOUNCER.deep : 1
      place(t, i, sx, hip + PERSON.torso, sz, heading, wide, 1, deep)
      place(hd, i, sx, hip + PERSON.head, sz, heading + look)
      for (const side of [-1, 1]) {
        const k = i * 2 + (side > 0 ? 1 : 0)
        // Arms swing from the shoulders.
        const ox = side * SHOULDER_X * wide
        dummy.position.set(sx + cos * ox, hip + SHOULDER_Y, sz - sin * ox)
        dummy.rotation.set(side > 0 ? rp : lp, heading, side > 0 ? rr : lr, 'YXZ')
        const thick = isB ? BOUNCER.arms : 1
        dummy.scale.set(thick, 1, thick)
        dummy.updateMatrix()
        ar.setMatrixAt(k, dummy.matrix)
        dummy.rotation.set(0, 0, 0, 'XYZ')
        // Legs from the floor up to the hip, bending with the bounce.
        const lx = side * 0.045 * wide
        place(lg, k, sx + cos * lx, baseY + (HIP - dip) / 2, sz - sin * lx, heading, isB ? 1.15 : 1, (HIP - dip) / HIP, isB ? 1.1 : 1)
      }
    }
    for (const m of [t, hd, ar, lg]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={root}>
      <group scale={SCALE}>
        <instancedMesh ref={torso} args={[TORSO, plainMat, n]} frustumCulled={false} userData={feet} dispose={null} />
        <instancedMesh ref={head} args={[HEAD, figureMat, n]} frustumCulled={false} userData={feet} dispose={null} />
        <instancedMesh ref={arms} args={[ARM, figureMat, n * 2]} frustumCulled={false} userData={armFeet} dispose={null} />
        <instancedMesh ref={legs} args={[LEG, plainMat, n * 2]} frustumCulled={false} userData={armFeet} dispose={null} />
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
