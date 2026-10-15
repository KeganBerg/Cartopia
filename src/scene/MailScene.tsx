// The friends' inbox (ui/Gifts.tsx) as a doorstep at golden hour: a brick house front with its
// door and porch lamp, a mailbox on a post with its flag up and the postcards sticking out, and
// what friends left piled on the step: a red jerry can for fuel, a parts crate for parts and a
// wrapped present for a town visit. Flat colours, real light.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Group } from 'three'
import { holdTown } from './renderGate'
import { holdPageTint } from './pageTint'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { lookFor } from './look'
import { brickTex, concreteTex } from './textures'
import { useFitCamera } from './ArcadeScenery'

export type Parcel = 'fuel' | 'parts' | 'help'

const SKY = '#f6b77c'
const WOOD = '#8d5a33'

function gearTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#c48a4f'
  g.fillRect(0, 0, 128, 128)
  // Planks.
  g.fillStyle = '#a8703c'
  for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 3)
  // A stencilled gear.
  g.translate(64, 64)
  g.fillStyle = '#3e2a1a'
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4)
    g.fillRect(-7, -38, 14, 16)
  }
  g.beginPath()
  g.arc(0, 0, 26, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#c48a4f'
  g.beginPath()
  g.arc(0, 0, 11, 0, Math.PI * 2)
  g.fill()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
let gear: CanvasTexture | null = null

function JerryCan() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.3, 0.4, 0.14]} /><meshStandardMaterial color="#d32f2f" roughness={0.55} /></mesh>
      {/* Pressed X on each face. */}
      {[-1, 1].map((sd) => [-0.6, 0.6].map((r) => (
        <mesh key={`${sd}${r}`} position={[0, 0.19, sd * 0.072]} rotation-z={r}><boxGeometry args={[0.03, 0.4, 0.004]} /><meshStandardMaterial color="#b71c1c" roughness={0.6} /></mesh>
      )))}
      {/* Three-bar handle and the spout cap. */}
      {[-0.08, 0, 0.08].map((x) => <mesh key={x} position={[x, 0.43, 0]}><boxGeometry args={[0.025, 0.06, 0.03]} /><meshStandardMaterial color="#b71c1c" /></mesh>)}
      <mesh position={[0, 0.465, 0]}><boxGeometry args={[0.2, 0.025, 0.04]} /><meshStandardMaterial color="#b71c1c" /></mesh>
      <mesh position={[0.11, 0.44, 0]}><cylinderGeometry args={[0.03, 0.03, 0.06, 10]} /><meshStandardMaterial color="#ffd54f" roughness={0.4} /></mesh>
    </group>
  )
}

function PartsCrate() {
  const map = useMemo(() => (gear ??= gearTex()), [])
  return (
    <group>
      <mesh position={[0, 0.17, 0]} castShadow><boxGeometry args={[0.38, 0.34, 0.34]} /><meshStandardMaterial map={map} roughness={0.85} /></mesh>
      {/* Corner battens. */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * 0.18, 0.17, sz * 0.16]}><boxGeometry args={[0.035, 0.35, 0.035]} /><meshStandardMaterial color="#6d4527" roughness={0.9} /></mesh>
      )))}
    </group>
  )
}

function Present({ color = '#2f7ff0', ribbon = '#ffd54f' }: { color?: string; ribbon?: string }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[0.32, 0.32, 0.32]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.07, 0.325, 0.325]} /><meshStandardMaterial color={ribbon} roughness={0.5} /></mesh>
      <mesh position={[0, 0.16, 0]}><boxGeometry args={[0.325, 0.325, 0.07]} /><meshStandardMaterial color={ribbon} roughness={0.5} /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.06, 0.36, 0]} rotation-z={sd * 0.7}><torusGeometry args={[0.055, 0.02, 6, 14]} /><meshStandardMaterial color={ribbon} roughness={0.5} /></mesh>
      ))}
    </group>
  )
}

const PRESENTS = [['#2f7ff0', '#ffd54f'], ['#8e44ad', '#ffffff'], ['#43a047', '#ff7043']] as const

// Where each parcel sits on the step and in front of it, nearest the camera last.
const SPOTS: [number, number, number, number][] = [
  [0.15, 0.36, -0.25, 0.3], [0.55, 0.36, -0.2, -0.25], [-0.25, 0.36, -0.15, 0.1],
  [0.35, 0, 0.45, 0.5], [0.85, 0, 0.35, -0.1], [-0.05, 0, 0.6, -0.35],
  [0.25, 0.4, -0.25, 0.9], [0.6, 0.7, -0.2, 0.2],
]

function Pile({ parcels }: { parcels: Parcel[] }) {
  let gifts = 0
  return (
    <group position={[0.4, 0, 0]}>
      {parcels.slice(0, SPOTS.length).map((p, i) => {
        const [x, y, z, ry] = SPOTS[i]
        const [c, r] = PRESENTS[p === 'help' ? gifts++ % PRESENTS.length : 0]
        return (
          <group key={i} position={[x, y, z]} rotation-y={ry}>
            {p === 'fuel' ? <JerryCan /> : p === 'parts' ? <PartsCrate /> : <Present color={c} ribbon={r} />}
          </group>
        )
      })}
    </group>
  )
}

// A rural mailbox on a post. The flag is up when there's post; cards stick out of the door.
function Mailbox({ cards }: { cards: string[] }) {
  const flag = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.z = cards.length ? -0.04 + Math.sin(clock.elapsedTime * 2.2) * 0.04 : -Math.PI / 2
  })
  return (
    <group position={[-1.3, 0, 0.85]} rotation-y={0.38} scale={1.3}>
      <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.1, 1.0, 0.1]} /><meshStandardMaterial color={WOOD} roughness={0.9} /></mesh>
      <mesh position={[0, 1.02, 0]} castShadow><boxGeometry args={[0.36, 0.22, 0.6]} /><meshStandardMaterial color="#1e5fbf" roughness={0.5} /></mesh>
      <mesh position={[0, 1.13, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.18, 0.18, 0.6, 16, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#1e5fbf" roughness={0.5} /></mesh>
      {/* The dark inside, and the door hanging open from its bottom edge when there's post. */}
      <mesh position={[0, 1.06, 0.301]}><planeGeometry args={[0.32, 0.26]} /><meshStandardMaterial color="#0d2a55" roughness={1} /></mesh>
      <group position={[0, 0.91, 0.305]} rotation-x={cards.length ? 1.25 : 0}>
        <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.37, 0.3, 0.015]} /><meshStandardMaterial color="#174a96" roughness={0.5} /></mesh>
      </group>
      {cards.slice(0, 4).map((c, i) => (
        <mesh key={i} position={[-0.06 + i * 0.04, 0.99 + i * 0.03, 0.34]} rotation={[-1.2, 0.0, -0.25 + i * 0.16]}>
          <boxGeometry args={[0.24, 0.17, 0.006]} />
          <meshStandardMaterial color={c} roughness={0.7} />
        </mesh>
      ))}
      <group ref={flag} position={[0.19, 1.05, -0.12]}>
        <mesh position={[0, 0.13, 0]}><boxGeometry args={[0.02, 0.26, 0.03]} /><meshStandardMaterial color="#e53935" /></mesh>
        <mesh position={[0, 0.22, 0.06]}><boxGeometry args={[0.02, 0.09, 0.12]} /><meshStandardMaterial color="#e53935" /></mesh>
      </group>
    </group>
  )
}

function House() {
  const brick = useMemo(() => brickTex(3, 2), [])
  return (
    <group position={[0, 0, -0.9]}>
      <mesh position={[0, 1.6, -0.1]} receiveShadow><boxGeometry args={[8, 3.2, 0.2]} /><meshStandardMaterial map={brick} color="#c9725a" roughness={0.9} /></mesh>
      {/* Door, frame, knob and a window either side. */}
      <mesh position={[0.4, 1.0, 0.005]}><boxGeometry args={[1.0, 2.0, 0.06]} /><meshStandardMaterial color="#f4ede1" roughness={0.7} /></mesh>
      <mesh position={[0.4, 0.98, 0.04]}><boxGeometry args={[0.82, 1.86, 0.04]} /><meshStandardMaterial color="#1f6f5c" roughness={0.6} /></mesh>
      {[[0, 0.55], [0, -0.35]].map(([dx, dy], i) => (
        <mesh key={i} position={[0.4 + dx, 0.98 + dy, 0.065]}><boxGeometry args={[0.6, 0.62, 0.01]} /><meshStandardMaterial color="#185a4a" roughness={0.6} /></mesh>
      ))}
      <mesh position={[0.7, 0.98, 0.08]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color="#e0b44c" metalness={0.6} roughness={0.35} /></mesh>
      {[-1.9, 2.6].map((x) => (
        <group key={x} position={[x, 1.5, 0.01]}>
          <mesh><boxGeometry args={[1.1, 1.0, 0.06]} /><meshStandardMaterial color="#f4ede1" roughness={0.7} /></mesh>
          <mesh position-z={0.035}><boxGeometry args={[0.94, 0.84, 0.01]} /><meshStandardMaterial color="#ffd38a" emissive="#ffb44d" emissiveIntensity={0.55} roughness={0.4} /></mesh>
          <mesh position-z={0.045}><boxGeometry args={[0.04, 0.84, 0.01]} /><meshStandardMaterial color="#f4ede1" /></mesh>
          <mesh position-z={0.045}><boxGeometry args={[0.94, 0.04, 0.01]} /><meshStandardMaterial color="#f4ede1" /></mesh>
          <mesh position={[0, -0.56, 0.12]}><boxGeometry args={[1.2, 0.08, 0.24]} /><meshStandardMaterial color="#f4ede1" roughness={0.7} /></mesh>
        </group>
      ))}
      {/* Porch lamp over the door. */}
      <mesh position={[1.15, 2.05, 0.08]}><boxGeometry args={[0.14, 0.22, 0.14]} /><meshStandardMaterial color="#ffe6a8" emissive="#ffcc66" emissiveIntensity={1.4} /></mesh>
      <mesh position={[1.15, 2.19, 0.08]}><boxGeometry args={[0.18, 0.04, 0.18]} /><meshStandardMaterial color="#263238" /></mesh>
      <pointLight position={[1.15, 2.0, 0.45]} intensity={3} distance={4} color="#ffc773" />
    </group>
  )
}

function Ground() {
  const slab = useMemo(() => concreteTex(4, 2), [])
  return (
    <>
      {/* Porch step, path and lawn. */}
      <mesh position={[0.4, 0.18, -0.5]} receiveShadow castShadow><boxGeometry args={[2.2, 0.36, 0.8]} /><meshStandardMaterial color="#b8b1a6" roughness={0.9} /></mesh>
      <mesh position={[0.4, 0.37, -0.45]} receiveShadow><boxGeometry args={[0.9, 0.02, 0.5]} /><meshStandardMaterial color="#8e3b2f" roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 1.5]} receiveShadow><planeGeometry args={[12, 4]} /><meshStandardMaterial map={slab} roughness={0.95} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#6fae4f" roughness={1} /></mesh>
      {/* Hedges along the wall. */}
      {[-2.6, -1.9, 2.0, 2.7, 3.4].map((x) => (
        <mesh key={x} position={[x, 0.3, -0.55]} castShadow><sphereGeometry args={[0.42, 12, 10]} /><meshStandardMaterial color="#3f8a3a" roughness={1} flatShading /></mesh>
      ))}
    </>
  )
}

// The canvas measures itself while the panel is still scaling in (a transform, so nothing
// re-measures once it's open): match the slot's real size.
function FitSlot() {
  useFrame(({ gl, size, setSize }) => {
    const slot = gl.domElement.closest('.stage-slot')
    if (slot && (Math.abs(slot.clientWidth - size.width) > 1 || Math.abs(slot.clientHeight - size.height) > 1)) setSize(slot.clientWidth, slot.clientHeight)
  })
  return null
}

export function MailScene({ parcels, cards }: { parcels: Parcel[]; cards: string[] }) {
  useEffect(() => holdTown(), [])
  useEffect(() => holdPageTint(SKY), [])
  useFitCamera([0.32, 0.42, 1], [0.1, 0.75, 0.1], 2.5, 1.25)
  const look = useMemo(() => {
    const l = lookFor(0, 0.75)
    l.grade.bloom = 0.35
    l.grade.vignette = 0.35
    return l
  }, [])
  return (
    <>
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 12, 30]} />
      <hemisphereLight args={['#ffd9b0', '#4b6b3a', 0.9]} />
      <directionalLight position={[-4, 6, 5]} intensity={2.4} color="#ffcf99" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
      <SkyEnv />
      <PostFx look={look} />
      <FitSlot />
      <House />
      <Ground />
      <Mailbox cards={cards} />
      <Pile parcels={parcels} />
    </>
  )
}
