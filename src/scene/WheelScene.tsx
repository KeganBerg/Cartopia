// The Daily Spin: a giant show wheel in a tyre shop at night. A real tyre with tread and raised
// sidewall lettering round a chrome rim, eight glossy slices between the spokes, each holding its
// prize (coins, cut gems, a real car part, a skin-wrapped orb, a crowned gem pile), chase lights
// on the lip and a rubber flapper up top that kicks as each peg passes. It stands on a steel
// A-frame on a hazard-ringed plinth, with tyre racks, tool chests and a neon sign behind.
// The spin itself is driven from the panel (ui/Wheel.tsx) through `drive`.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, ExtrudeGeometry, InstancedMesh, LatheGeometry, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, SRGBColorSpace, Shape, Vector2, type Group, type PerspectiveCamera, type Points, type SpotLight,
} from 'three'
import { holdTown } from './renderGate'
import { holdPageTint } from './pageTint'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { lookFor } from './look'
import { LAYER, decal } from './layers'
import { concreteTex, corrugatedTex, shutterTex } from './textures'
import { signTexture } from './signTexture'
import { ToolChest, Tyre, TyreStack, useFitCamera } from './ArcadeScenery'
import { Dust, HangingLamp, hazardTex } from './CrateScene'
import { BoltOn } from './PartPrize'
import { tickSkins, withSkin } from './skins'
import { skinNumber } from '../game/data'
import { WHEEL, TIER_COLOR, gemPile, wheelCoins, type WheelSlice } from '../game/wheel'
import { calmFlashing } from '../game/flashing'

// What the panel moves: the wheel's turn (degrees, clockwise as you look at it), when the flapper
// last hit a peg (seconds, performance clock) and the slice that won (-1 while spinning).
export type WheelDrive = { angle: number; kick: number; won: number }

const N = WHEEL.length
const STEP = (Math.PI * 2) / N
// Wheel centre height and sizes (metres).
const CY = 2.45
const FACE = 1.58 // slice radius
const HUB = 0.42
const TYRE_IN = 1.66
const TYRE_OUT = 2.12

// ---------------------------------------------------------------------------------------------
// Textures

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}
const DISPLAY = "'Lilita One', 'Arial Black', Impact, sans-serif"

// Raised white sidewall lettering, laid out round a ring (RingGeometry maps the canvas flat).
function sidewallTex() {
  return canvas(1024, 1024, (g) => {
    g.translate(512, 512)
    const r = 512 * ((TYRE_IN + TYRE_OUT) / 2 / TYRE_OUT) - 6
    const text = 'CARTOPIA  ★  DAILY SPIN  ★  RADIAL T/S  ★  '
    g.font = `46px ${DISPLAY}`
    g.fillStyle = '#b8c2c9'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const chars = [...text, ...text]
    const step = (Math.PI * 2) / chars.length
    chars.forEach((ch, i) => {
      g.save()
      g.rotate(i * step)
      g.translate(0, -r)
      g.fillText(ch, 0, 0)
      g.restore()
    })
  })
}

// A gold coin face: rim, a raised ring and the $ in the middle.
function coinTex() {
  return canvas(128, 128, (g) => {
    const grd = g.createRadialGradient(50, 44, 10, 64, 64, 64)
    grd.addColorStop(0, '#fff3a6')
    grd.addColorStop(0.6, '#ffc533')
    grd.addColorStop(1, '#c47c00')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    g.strokeStyle = '#a35f00'
    g.lineWidth = 6
    g.beginPath()
    g.arc(64, 64, 46, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#9a5800'
    g.font = `bold 70px ${DISPLAY}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$', 64, 68)
  })
}

// The centre cap: red enamel, a white star and a chrome ring.
function capTex() {
  return canvas(256, 256, (g) => {
    const grd = g.createRadialGradient(100, 90, 10, 128, 128, 128)
    grd.addColorStop(0, '#ff8a80')
    grd.addColorStop(0.55, '#e53935')
    grd.addColorStop(1, '#8e1414')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    g.translate(128, 132)
    g.fillStyle = '#ffffff'
    g.shadowColor = 'rgba(0,0,0,.4)'
    g.shadowOffsetY = 6
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 34 : 82
      const a = (i * Math.PI) / 5 - Math.PI / 2
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  })
}

// A slice's amount: chunky white numbers with a navy outline, as on the HUD.
function labelTex(text: string) {
  return canvas(256, 96, (g) => {
    g.font = `76px ${DISPLAY}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 16
    g.strokeStyle = '#14213d'
    g.strokeText(text, 128, 52)
    g.fillStyle = '#ffffff'
    g.fillText(text, 128, 52)
  })
}

// ---------------------------------------------------------------------------------------------
// Materials and shapes shared by the wheel

const chrome = new MeshStandardMaterial({ color: '#e9eef2', metalness: 1, roughness: 0.16 })
const darkChrome = new MeshStandardMaterial({ color: '#5d6a75', metalness: 0.9, roughness: 0.3 })
const rubber = new MeshStandardMaterial({ color: '#1f2226', roughness: 0.86 })
const gold = new MeshStandardMaterial({ color: '#ffc533', metalness: 0.85, roughness: 0.22, emissive: '#5a3a00', emissiveIntensity: 0.25 })
const gemMat = new MeshPhysicalMaterial({ color: '#1e88e5', metalness: 0.35, roughness: 0.08, clearcoat: 1, emissive: '#0b3d91', emissiveIntensity: 0.12, flatShading: true })
const steel = new MeshStandardMaterial({ color: '#455a64', metalness: 0.65, roughness: 0.4 })
const bulbOn = new MeshStandardMaterial({ color: '#fff6c2', emissive: '#ffd54f', emissiveIntensity: 2.6, toneMapped: false })
const bulbOff = new MeshStandardMaterial({ color: '#fff6c2', emissive: '#ffb300', emissiveIntensity: 0.5, toneMapped: false })

// A cut gem: a flat table, a crown and a pointed pavilion (eight facets).
const gemGeo = new LatheGeometry([new Vector2(0, 0.075), new Vector2(0.07, 0.075), new Vector2(0.12, 0.03), new Vector2(0.11, 0.0), new Vector2(0, -0.11)], 8)

// The tyre's cross-section: a rounded block between the bead seats, turned round the axle.
const tyreGeo = new LatheGeometry([
  [TYRE_IN, -0.25], [TYRE_IN + 0.18, -0.29], [TYRE_OUT - 0.1, -0.3], [TYRE_OUT - 0.02, -0.24], [TYRE_OUT, -0.1],
  [TYRE_OUT, 0.1], [TYRE_OUT - 0.02, 0.24], [TYRE_OUT - 0.1, 0.3], [TYRE_IN + 0.18, 0.29], [TYRE_IN, 0.25],
].map(([x, y]) => new Vector2(x, y)), 120)

function wedgeGeo(i: number) {
  const a0 = Math.PI / 2 - i * STEP
  const a1 = a0 - STEP
  const s = new Shape()
  s.moveTo(Math.cos(a0) * HUB, Math.sin(a0) * HUB)
  s.lineTo(Math.cos(a0) * FACE, Math.sin(a0) * FACE)
  s.absarc(0, 0, FACE, a0, a1, true)
  s.lineTo(Math.cos(a1) * HUB, Math.sin(a1) * HUB)
  s.absarc(0, 0, HUB, a1, a0, false)
  return new ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 })
}

// ---------------------------------------------------------------------------------------------
// Prizes on the slices (each drawn upright along its slice, top towards the rim)

function Coin({ x = 0, y = 0, z = 0, tilt = 0 }: { x?: number; y?: number; z?: number; tilt?: number }) {
  const face = useMemo(() => new MeshStandardMaterial({ map: coinTex(), metalness: 0.6, roughness: 0.3 }), [])
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, tilt]} material={[gold, face, face]} castShadow>
      <cylinderGeometry args={[0.13, 0.13, 0.035, 28]} />
    </mesh>
  )
}

function CoinPile({ n }: { n: number }) {
  const spots: [number, number, number, number][] = n === 1 ? [[0, 0, 0, 0]]
    : n === 2 ? [[-0.08, -0.03, 0, -0.2], [0.08, 0.03, 0.03, 0.25]]
    : [[-0.15, -0.06, 0, -0.3], [0.15, -0.06, 0.01, 0.3], [0, 0.07, 0.04, 0], [-0.07, -0.12, 0.06, 0.15], [0.08, -0.13, 0.07, -0.1]]
  return <group>{spots.map(([x, y, z, t], i) => <Coin key={i} x={x} y={y} z={z} tilt={t} />)}</group>
}

function Gems({ n }: { n: number }) {
  const spots: [number, number, number][] = n === 1 ? [[0, 0, 0]] : n === 3 ? [[-0.13, -0.05, 0], [0.13, -0.05, 0], [0, 0.09, 0.04]]
    : [[-0.18, -0.08, 0], [0, -0.1, 0.02], [0.18, -0.08, 0], [-0.09, 0.07, 0.05], [0.09, 0.07, 0.05]]
  return (
    <group>
      {spots.map(([x, y, z], i) => (
        <mesh key={i} geometry={gemGeo} material={gemMat} position={[x, y, z + 0.06]} rotation={[Math.PI / 2 - 0.5, 0.3 * i, 0]} castShadow />
      ))}
    </group>
  )
}

function Crown() {
  return (
    <group position={[0, 0.2, 0.06]} scale={0.8}>
      <mesh material={gold}><cylinderGeometry args={[0.15, 0.13, 0.08, 20, 1, true]} /></mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.14, 0.08, Math.sin(a) * 0.14]}>
            <mesh material={gold}><coneGeometry args={[0.035, 0.1, 6]} /></mesh>
            <mesh position-y={0.06} material={gemMat}><sphereGeometry args={[0.02, 8, 6]} /></mesh>
          </group>
        )
      })}
    </group>
  )
}

function SkinOrb() {
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ color: '#ffffff', metalness: 0.4, roughness: 0.25 })
    const n = skinNumber('prismatic')
    m.onBeforeCompile = (sh) => withSkin(sh, String(n))
    m.customProgramCacheKey = () => `wheel-orb-${n}`
    return m
  }, [])
  useFrame(() => tickSkins())
  return (
    <group>
      <mesh material={mat} castShadow><sphereGeometry args={[0.2, 32, 24]} /></mesh>
      <mesh position={[0, 0, 0]} rotation-x={Math.PI / 2} material={chrome}><torusGeometry args={[0.21, 0.015, 8, 40]} /></mesh>
    </group>
  )
}

function Prize({ s }: { s: WheelSlice }) {
  if (s.kind === 'coins') return <CoinPile n={s.mult < 0.5 ? 1 : s.mult < 1 ? 2 : 3} />
  if (s.kind === 'gems') return <Gems n={gemPile(s.gems)} />
  if (s.kind === 'jackpot') return <group><Crown /><group position-y={-0.08}><Gems n={5} /></group></group>
  if (s.kind === 'part') return <group rotation={[0.85, -0.55, 0.1]} scale={0.34}><BoltOn id="gtwing" body="sports" tint="#e53935" /></group>
  return <SkinOrb />
}

const amount = (s: WheelSlice, level: number) =>
  s.kind === 'coins' ? wheelCoins(s.mult, level).toLocaleString() : s.kind === 'gems' || s.kind === 'jackpot' ? `×${s.gems}` : null

// ---------------------------------------------------------------------------------------------
// The wheel

function Slices({ level, drive }: { level: number; drive: WheelDrive }) {
  const mats = useMemo(() => WHEEL.map((s, i) => new MeshPhysicalMaterial({
    color: new Color(TIER_COLOR[s.tier]).multiplyScalar(i % 2 ? 0.86 : 1), roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08,
    emissive: TIER_COLOR[s.tier], emissiveIntensity: 0,
  })), [])
  const geos = useMemo(() => WHEEL.map((_, i) => wedgeGeo(i)), [])
  const labels = useMemo(() => WHEEL.map((s) => {
    const t = amount(s, level)
    return t ? labelTex(t) : null
  }), [level])
  useEffect(() => () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); labels.forEach((l) => l?.dispose()) }, [geos, mats, labels])
  useFrame(({ clock }) => {
    mats.forEach((m, i) => {
      m.emissiveIntensity = i === drive.won ? 0.35 + 0.3 * Math.sin(clock.elapsedTime * 6) : 0
    })
  })
  return (
    <group>
      {WHEEL.map((s, i) => {
        // The slice's middle, clockwise from the top.
        const mid = -i * STEP - STEP / 2
        return (
          <group key={s.id}>
            <mesh geometry={geos[i]} material={mats[i]} receiveShadow />
            <group rotation-z={mid}>
              <group position={[0, 1.13, 0.16]}><Prize s={s} /></group>
              {labels[i] && (
                <mesh position={[0, 0.7, 0.1]}>
                  <planeGeometry args={[0.62, 0.23]} />
                  <meshBasicMaterial map={labels[i]!} transparent toneMapped={false} />
                </mesh>
              )}
            </group>
          </group>
        )
      })}
    </group>
  )
}

function Tread() {
  const ref = useRef<InstancedMesh>(null)
  const n = 84
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    for (let i = 0; i < n * 2; i++) {
      const a = ((Math.floor(i / 2) + (i % 2) * 0.5) / n) * Math.PI * 2
      const side = i % 2 ? 1 : -1
      o.position.set(Math.sin(a) * (TYRE_OUT + 0.012), Math.cos(a) * (TYRE_OUT + 0.012), side * 0.13)
      o.rotation.set(0, 0, -a + side * 0.35)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n * 2]} material={rubber} castShadow>
      <boxGeometry args={[0.07, 0.05, 0.2]} />
    </instancedMesh>
  )
}

function Bulbs() {
  const n = 24
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.PI / n
        return (
          <mesh key={i} position={[Math.sin(a) * 1.625, Math.cos(a) * 1.625, 0.16]} material={i % 2 ? bulbOff : bulbOn}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        )
      })}
    </group>
  )
}

// Swaps which half of the bulbs is lit, for the chase.
function useChase() {
  useFrame(({ clock }) => {
    if (calmFlashing()) {
      bulbOn.emissiveIntensity = bulbOff.emissiveIntensity = 1.8
      return
    }
    const on = Math.floor(clock.elapsedTime * 5) % 2 === 0
    bulbOn.emissiveIntensity = on ? 2.6 : 0.5
    bulbOff.emissiveIntensity = on ? 0.5 : 2.6
  })
}

function BigWheel({ level, drive }: { level: number; drive: WheelDrive }) {
  const spin = useRef<Group>(null)
  const side = useMemo(() => sidewallTex(), [])
  const cap = useMemo(() => capTex(), [])
  useEffect(() => () => { side.dispose(); cap.dispose() }, [side, cap])
  useChase()
  useFrame(() => {
    if (spin.current) spin.current.rotation.z = (-drive.angle * Math.PI) / 180
  })
  return (
    <group position={[0, CY, 0]}>
      <group ref={spin}>
        {/* The tyre, its tread and the raised sidewall lettering. */}
        <mesh geometry={tyreGeo} material={rubber} rotation-x={Math.PI / 2} castShadow receiveShadow />
        <Tread />
        <mesh position-z={0.301}>
          <ringGeometry args={[TYRE_IN + 0.06, TYRE_OUT - 0.06, 96]} />
          <meshStandardMaterial map={side} transparent roughness={0.7} depthWrite={false} />
        </mesh>
        {/* Chrome rim: the barrel inside the tyre, the lip and its chase lights. */}
        <mesh rotation-x={Math.PI / 2} material={darkChrome}><cylinderGeometry args={[TYRE_IN, TYRE_IN, 0.5, 72, 1, true]} /></mesh>
        <mesh position-z={0.12} material={chrome}><ringGeometry args={[FACE - 0.01, TYRE_IN + 0.01, 96]} /></mesh>
        <mesh position-z={0.13} material={chrome}><torusGeometry args={[TYRE_IN - 0.01, 0.035, 10, 96]} /></mesh>
        <mesh position-z={0.13} material={chrome}><torusGeometry args={[FACE, 0.025, 8, 96]} /></mesh>
        <Bulbs />
        <mesh position-z={-0.25} material={darkChrome}><circleGeometry args={[TYRE_IN, 48]} /></mesh>
        <Slices level={level} drive={drive} />
        {/* Spokes on the slice edges, a peg at each end for the flapper. */}
        {WHEEL.map((_, i) => (
          <group key={i} rotation-z={-i * STEP}>
            <mesh position={[0, (HUB + FACE) / 2, 0.17]} material={chrome} castShadow>
              <boxGeometry args={[0.09, FACE - HUB, 0.08]} />
            </mesh>
            <mesh position={[0, (HUB + FACE) / 2, 0.212]} material={darkChrome}>
              <boxGeometry args={[0.025, FACE - HUB - 0.1, 0.01]} />
            </mesh>
            <group position={[0, FACE - 0.08, 0.22]}>
              <mesh rotation-x={Math.PI / 2} material={chrome}><cylinderGeometry args={[0.035, 0.035, 0.22, 12]} /></mesh>
              <mesh position-z={0.12}><sphereGeometry args={[0.045, 12, 10]} /><meshStandardMaterial color="#e53935" roughness={0.3} /></mesh>
            </group>
          </group>
        ))}
        {/* Hub: chrome, five lug nuts and the enamel star cap. */}
        <mesh position-z={0.15} rotation-x={Math.PI / 2} material={chrome} castShadow><cylinderGeometry args={[HUB + 0.02, HUB + 0.06, 0.16, 48]} /></mesh>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2
          return <mesh key={i} position={[Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0.26]} rotation-x={Math.PI / 2} material={darkChrome}><cylinderGeometry args={[0.045, 0.045, 0.06, 6]} /></mesh>
        })}
        <mesh position-z={0.3}><circleGeometry args={[0.22, 40]} /><meshPhysicalMaterial map={cap} clearcoat={1} roughness={0.25} /></mesh>
        <mesh position-z={0.3} material={chrome}><torusGeometry args={[0.22, 0.02, 8, 40]} /></mesh>
      </group>
    </group>
  )
}

// The rubber flapper on its bracket above the wheel: kicked back by each peg, springing home.
function Flapper({ drive }: { drive: WheelDrive }) {
  const pivot = useRef<Group>(null)
  const shape = useMemo(() => {
    const s = new Shape()
    s.moveTo(0, 0)
    s.lineTo(-0.11, -0.05)
    s.quadraticCurveTo(-0.07, -0.3, 0, -0.42)
    s.quadraticCurveTo(0.07, -0.3, 0.11, -0.05)
    s.closePath()
    return new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 })
  }, [])
  useEffect(() => () => shape.dispose(), [shape])
  useFrame(() => {
    const p = pivot.current
    if (!p) return
    const t = performance.now() / 1000 - drive.kick
    // A sharp knock that rings out (a damped spring).
    p.rotation.z = t >= 0 && t < 0.6 ? 0.42 * Math.exp(-t * 9) * Math.cos(t * 30) : 0
  })
  const top = CY + TYRE_OUT + 0.14
  return (
    <group position={[0, top, 0.3]}>
      {/* The bracket: an arm off the frame and the hinge. */}
      <mesh position={[0, 0.1, -0.3]} material={steel}><boxGeometry args={[0.1, 0.1, 0.75]} /></mesh>
      <mesh rotation-x={Math.PI / 2} material={chrome}><cylinderGeometry args={[0.06, 0.06, 0.16, 16]} /></mesh>
      <group ref={pivot}>
        <mesh geometry={shape} position-z={-0.03} castShadow><meshPhysicalMaterial color="#ffc400" roughness={0.35} clearcoat={0.8} /></mesh>
        <mesh position={[0, -0.12, 0.05]}><circleGeometry args={[0.04, 16]} /><meshStandardMaterial color="#fff3b0" /></mesh>
      </group>
    </group>
  )
}

// The steel A-frame and plinth the wheel stands on.
function Stand() {
  return (
    <group>
      <mesh position-y={0.09} receiveShadow castShadow><cylinderGeometry args={[1.5, 1.6, 0.18, 48]} /><meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position-y={0.09}><cylinderGeometry args={[1.605, 1.605, 0.1, 48, 1, true]} /><meshStandardMaterial map={hazardTex(14)} side={DoubleSide} /></mesh>
      <mesh position-y={0.182} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[1.48, 48]} /><meshStandardMaterial color="#56656e" metalness={0.75} roughness={0.45} /></mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * 0.62, 1.32, -0.45]} rotation-z={sd * 0.2} material={steel} castShadow><boxGeometry args={[0.14, 2.5, 0.14]} /></mesh>
          <mesh position={[sd * 0.62, 0.22, -0.45]} material={steel}><boxGeometry args={[0.4, 0.06, 0.4]} /></mesh>
        </group>
      ))}
      {/* Axle through the hub, and the frame's arm up to the flapper. */}
      <mesh position={[0, CY, -0.4]} rotation-x={Math.PI / 2} material={chrome}><cylinderGeometry args={[0.1, 0.1, 0.4, 16]} /></mesh>
      <mesh position={[0, CY + 1.2, -0.45]} material={steel}><boxGeometry args={[0.12, 2.3, 0.12]} /></mesh>
    </group>
  )
}

// Tyre racks either side: uprights, beams and rows of tyres standing in them.
function TyreRack({ x, flip }: { x: number; flip: boolean }) {
  const bands = ['#e53935', '#ffc400', '#fafafa', '#43a047', '#1e88e5']
  return (
    <group position={[x, 0, -3.2]} rotation-y={flip ? -0.35 : 0.35}>
      {[-1.6, 1.6].map((dx) => <mesh key={dx} position={[dx, 2, 0]} castShadow><boxGeometry args={[0.1, 4, 0.1]} /><meshStandardMaterial color="#ff6d00" roughness={0.6} /></mesh>)}
      {[0.1, 1.45, 2.8].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0]}><boxGeometry args={[3.3, 0.1, 0.5]} /><meshStandardMaterial color="#1565c0" roughness={0.5} /></mesh>
          {Array.from({ length: 6 }, (_, i) => <Tyre key={i} x={-1.25 + i * 0.5} z={0} y={y + 0.05} r={0.42} w={0.26} band={bands[(i + Math.round(y)) % bands.length]} />)}
        </group>
      ))}
    </group>
  )
}

// On a phone the top bar already says Daily Spin and covers the sign, so it's left out.
function Shop({ wide }: { wide: boolean }) {
  const neon = useMemo(() => signTexture('DAILY SPIN', '#140c22', '#ffc400'), [])
  const sub = useMemo(() => signTexture('TYRES · RIMS · PRIZES', '#263238', '#4fc3f7'), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.land} receiveShadow>
        <planeGeometry args={[36, 26]} />
        <meshStandardMaterial map={concreteTex(9, 7)} color="#9aa3a8" roughness={0.75} metalness={0.05} />
      </mesh>
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, LAYER.paint, 2]}>
          <planeGeometry args={[0.12, 12]} />
          <meshStandardMaterial color="#ffd600" roughness={0.7} {...decal()} />
        </mesh>
      ))}
      {/* Back wall, neon sign, a roller door and the shop's strip lights. */}
      <mesh position={[0, 4, -6]} receiveShadow>
        <boxGeometry args={[30, 8, 0.2]} />
        <meshStandardMaterial map={corrugatedTex(10, 3)} color="#5c6b78" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.45, -5.85]}><boxGeometry args={[30, 0.9, 0.12]} /><meshStandardMaterial color="#37474f" /></mesh>
      {wide && <group position={[0, 6.35, -5.84]}>
        <mesh><boxGeometry args={[5.8, 1.5, 0.12]} /><meshStandardMaterial color="#120a1e" /></mesh>
        <mesh position-z={0.07}><planeGeometry args={[5.5, 1.25]} /><meshBasicMaterial map={neon} toneMapped={false} /></mesh>
        {[[0, 0.7, 5.7, 0.05], [0, -0.7, 5.7, 0.05], [-2.85, 0, 0.05, 1.4], [2.85, 0, 0.05, 1.4]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.1]}><boxGeometry args={[w, h, 0.05]} /><meshBasicMaterial color="#ff4fd8" toneMapped={false} /></mesh>
        ))}
      </group>}
      <mesh position={[6.4, 4.6, -5.84]}><planeGeometry args={[2.6, 0.6]} /><meshStandardMaterial map={sub} roughness={0.6} /></mesh>
      <group position={[-7.4, 0, -5.86]}>
        <mesh position={[0, 2.6, 0]}><boxGeometry args={[3.4, 2.6, 0.08]} /><meshStandardMaterial map={shutterTex()} color="#b0bec5" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 0.65, -0.2]}><planeGeometry args={[3.2, 1.3]} /><meshBasicMaterial color="#1a2a4a" /></mesh>
        {[-1.75, 1.75].map((dx) => <mesh key={dx} position={[dx, 2, 0.04]}><boxGeometry args={[0.14, 4, 0.14]} /><meshStandardMaterial map={hazardTex(1)} /></mesh>)}
      </group>
      {[-13, 13].map((x) => (
        <mesh key={x} position={[x, 4, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[26, 8]} />
          <meshStandardMaterial map={corrugatedTex(8, 3)} color="#4d5962" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
      <TyreRack x={-5.6} flip={false} />
      <TyreRack x={5.6} flip />
      <TyreStack x={-3.1} z={-1.2} n={5} band="#ffc400" />
      <TyreStack x={-3.6} z={-0.4} n={3} band="#e53935" />
      <TyreStack x={3.3} z={-1.0} n={4} band="#4fc3f7" />
      <ToolChest x={3.9} z={-4.6} ry={-0.2} />
      <ToolChest x={-3.8} z={-4.8} ry={0.25} color="#1565c0" />
      {/* A tyre leaning on the plinth and a traffic cone. */}
      <Tyre x={1.95} z={0.9} r={0.36} w={0.24} band="#ffc400" ry={0.9} />
      <group position={[-2.1, 0, 1.2]}>
        <mesh position-y={0.25}><coneGeometry args={[0.16, 0.5, 14]} /><meshStandardMaterial color="#ff6d00" /></mesh>
        <mesh position-y={0.28}><cylinderGeometry args={[0.1, 0.12, 0.08, 14]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <mesh position-y={0.02}><boxGeometry args={[0.36, 0.04, 0.36]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
      <HangingLamp x={-4.5} z={-2} />
      <HangingLamp x={4.5} z={-2} />
    </group>
  )
}

// Confetti thrown off the wheel when it lands, in the winning slice's colour and gold.
function Confetti({ drive, color }: { drive: WheelDrive; color: string }) {
  const ref = useRef<Points>(null)
  const n = 220
  const state = useMemo(() => ({ pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 3), t: -1, shown: -1 }), [])
  useFrame((_, dt) => {
    const p = ref.current
    if (!p) return
    if (drive.won >= 0 && state.shown !== drive.won) {
      state.shown = drive.won
      state.t = 0
      const a = new Color(color), b = new Color('#ffd54f'), c = new Color('#ffffff')
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3
        state.pos.set([0, CY + 1.4, 0.6], i * 3)
        state.vel.set([Math.cos(ang) * sp, 2 + Math.random() * 4, 1 + Math.random() * 2], i * 3)
        const k = [a, b, c][i % 3]
        state.col.set([k.r, k.g, k.b], i * 3)
      }
      p.geometry.attributes.color.needsUpdate = true
    }
    if (drive.won < 0) state.shown = -1
    if (state.t < 0) { p.visible = false; return }
    p.visible = true
    state.t += Math.min(dt, 0.05)
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < n; i++) {
      state.vel[i * 3 + 1] -= 6 * d
      state.vel[i * 3] *= 0.985
      for (let k = 0; k < 3; k++) state.pos[i * 3 + k] += state.vel[i * 3 + k] * d
      if (state.pos[i * 3 + 1] < 0.02) { state.pos[i * 3 + 1] = 0.02; state.vel[i * 3] = state.vel[i * 3 + 1] = state.vel[i * 3 + 2] = 0 }
    }
    p.geometry.attributes.position.needsUpdate = true
    if (state.t > 6) state.t = -1
  })
  return (
    <points ref={ref} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[state.pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[state.col, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} vertexColors toneMapped={false} />
    </points>
  )
}

export function WheelScene({ level, drive, wonColor }: { level: number; drive: WheelDrive; wonColor: string }) {
  useEffect(() => holdTown(), [])
  useEffect(() => holdPageTint('#120c1c'), [])
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  // Wide screens dock the controls on the right, so the wheel sits left of centre; tall ones
  // dock them along the bottom, so it sits high.
  const wide = size.width >= 900 && size.width > size.height * 1.25
  useFitCamera([0, 0.1, 1], [0, CY + 0.25, 0], wide ? 4.6 : 2.45, wide ? 2.95 : 2.85)
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera
    if (wide) cam.setViewOffset(size.width, size.height, size.width * 0.16, 0, size.width, size.height)
    else cam.setViewOffset(size.width, size.height, 0, size.height * 0.17, size.width, size.height)
    return () => cam.clearViewOffset()
  }, [camera, size, wide])
  const look = useMemo(() => {
    const l = lookFor(1, 0)
    l.grade.exposure = 1.15
    l.grade.saturation = 1.1
    l.grade.vibrance = 0.2
    l.grade.bloom = 0.9
    l.grade.threshold = 0.72
    l.grade.vignette = 0.5
    return l
  }, [])
  const spot = useRef<SpotLight>(null)
  useEffect(() => {
    spot.current?.target.position.set(0, CY, 0)
    spot.current?.target.updateMatrixWorld()
  }, [])
  return (
    <>
      <color attach="background" args={['#120c1c']} />
      <fog attach="fog" args={['#120c1c', 13, 30]} />
      <hemisphereLight args={['#6b7cc0', '#2a1d14', 0.6]} />
      <ambientLight intensity={0.15} />
      <spotLight ref={spot} position={[0, 7.5, 6]} angle={0.45} penumbra={0.6} intensity={220} distance={20} decay={1.8} color="#fff1d6" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <pointLight position={[-3.5, 3, 2.5]} intensity={12} distance={9} color="#ff4fd8" />
      <pointLight position={[3.5, 3, 2.5]} intensity={12} distance={9} color="#4fc3f7" />
      <pointLight position={[0, 6.35, -5]} intensity={6} distance={8} color="#ffc400" />
      <SkyEnv />
      <PostFx look={look} />
      <Shop wide={wide} />
      <Dust />
      <Stand />
      <BigWheel level={level} drive={drive} />
      <Flapper drive={drive} />
      <Confetti drive={drive} color={wonColor} />
      {/* A soft glow pooled on the floor under the wheel. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.paint + 0.01, 0.6]}>
        <circleGeometry args={[2.4, 40]} />
        <meshBasicMaterial color="#ffd180" transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}
