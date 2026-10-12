import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace,
  Vector3, type Group, type PerspectiveCamera, type InstancedMesh, type Mesh, type PointLight, type Points, type SpotLight,
} from 'three'
import { CarModel, carSize } from './CarModel'
import { holdTown } from './renderGate'
import { holdPageTint } from './pageTint'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { lookFor } from './look'
import { LAYER, decal } from './layers'
import { concreteTex, corrugatedTex, glowTex, shutterTex } from './textures'
import { signTexture } from './signTexture'
import { ToolChest, TyreStack, useFitCamera } from './ArcadeScenery'
import { tickSkins, withSkin } from './skins'
import { MODS, SKINNED_SLOTS, carDef, fittedMods, modFits, modSkinNumber, skinNumber, type Body, type Finish, type SkinnedSlot } from '../game/data'
import { dropTier, type CrateDef, type CrateDrop, type CrateId } from '../game/crates'
import { calmFlashing } from '../game/flashing'
import { bumpSound, crashSound } from '../lib/arcadeSound'
import { crateSfx, sfx } from '../lib/sound'
import { landClink } from '../lib/crateClinks'
import { PartPrize } from './PartPrize'

// The Crate Depot: a warehouse loading bay at night where crates are opened. The crate sits on a
// hazard-striped lift under a work lamp, racking full of stock either side, a forklift parked up,
// the roller door half open to the street and the depot's neon sign on the back wall.

// Crate size (metres) and where its floor sits on the lift.
const S = 1.5
const LIFT = 0.14
// Opening timeline (seconds from the tap).
const CHARGE = 1.15
const RISE = 0.25
const SETTLE = 2.35
export const REVEAL_AT = SETTLE

// How exciting a prize is, as a glow colour: coins, a part or jackpot, a gem part, a car.
export const TIER_GLOW = ['#4fc3f7', '#b388ff', '#ff4fd8', '#ffb300'] as const

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

const cache = new Map<string, CanvasTexture>()
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(...repeat)
  }
  cache.set(key, t)
  return t
}

// Sawn planks: long grain lines, a couple of knots and darker end grain, tinted by the material colour.
const plankTex = () =>
  canvasTex('crate-plank', 256, 64, (g) => {
    const r = rng(11)
    g.fillStyle = '#e9e1d4'
    g.fillRect(0, 0, 256, 64)
    for (let i = 0; i < 46; i++) {
      const y = r() * 64
      g.strokeStyle = `rgba(90,60,30,${0.08 + r() * 0.16})`
      g.lineWidth = 0.6 + r() * 1.4
      g.beginPath()
      g.moveTo(0, y)
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.2)
      g.stroke()
    }
    for (let k = 0; k < 2; k++) {
      const x = 40 + r() * 170, y = 14 + r() * 36
      for (let j = 4; j > 0; j--) {
        g.strokeStyle = `rgba(80,48,20,${0.12 + j * 0.06})`
        g.beginPath()
        g.ellipse(x, y, j * 3.2, j * 1.6, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    const grd = g.createLinearGradient(0, 0, 0, 64)
    grd.addColorStop(0, 'rgba(0,0,0,0.18)')
    grd.addColorStop(0.12, 'rgba(0,0,0,0)')
    grd.addColorStop(0.88, 'rgba(0,0,0,0)')
    grd.addColorStop(1, 'rgba(0,0,0,0.22)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 64)
  })

// Yellow and black chevrons for the lift's rim and the floor markings.
const hazardTex = (rx = 1) =>
  canvasTex(`hazard-${rx}`, 128, 32, (g) => {
    g.fillStyle = '#ffc400'
    g.fillRect(0, 0, 128, 32)
    g.fillStyle = '#1b1b1b'
    for (let x = -32; x < 160; x += 32) {
      g.beginPath()
      g.moveTo(x, 32)
      g.lineTo(x + 16, 32)
      g.lineTo(x + 48, 0)
      g.lineTo(x + 32, 0)
      g.closePath()
      g.fill()
    }
  }, [rx, 1])

// A stencilled shipping label: the crate's name over a barcode and a FRAGILE glass.
const labelTex = (name: string, ink: string) =>
  canvasTex(`crate-label-${name}-${ink}`, 256, 128, (g) => {
    g.fillStyle = 'rgba(245,238,220,0.92)'
    g.fillRect(6, 6, 244, 116)
    g.strokeStyle = ink
    g.lineWidth = 4
    g.strokeRect(10, 10, 236, 108)
    g.fillStyle = ink
    g.font = '900 30px "Arial Black", Impact, system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(name.toUpperCase(), 128, 50, 220)
    const r = rng(name.length * 7 + 3)
    for (let x = 24; x < 150; x += 3) if (r() > 0.35) g.fillRect(x, 66, r() > 0.5 ? 2 : 1, 36)
    g.font = '700 14px system-ui, sans-serif'
    g.fillText('FRAGILE', 196, 82)
    g.beginPath()
    g.moveTo(186, 90)
    g.lineTo(206, 90)
    g.lineTo(200, 104)
    g.lineTo(192, 104)
    g.closePath()
    g.fill()
  })

// A dollar sign stamped on the big coin.
const dollarTex = () =>
  canvasTex('crate-dollar', 128, 128, (g) => {
    g.fillStyle = '#e65100'
    g.font = '900 104px "Arial Black", Impact, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('$', 64, 70)
  })

// ---------------------------------------------------------------------------------------------
// The crate

type CrateParts = { root: Group | null; lid: Group | null; panels: (Group | null)[]; bands: (Group | null)[]; core: Mesh | null; light: PointLight | null }

function Plank({ w, h, d, pos, mat, rot = 0 }: { w: number; h: number; d: number; pos: [number, number, number]; mat: MeshStandardMaterial; rot?: number }) {
  return (
    <mesh position={pos} rotation-z={rot} material={mat} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  )
}

// One side: four boards with gaps (the glow shows through them), a frame and a diagonal brace.
// Hinged on its bottom edge so it can fall open; built facing +z in the panel's own space.
function Panel({ wood, frame, crystal }: { wood: MeshStandardMaterial; frame: MeshStandardMaterial; crystal: boolean }) {
  const boards = 4
  const bh = (S - 0.04) / boards
  return (
    <group>
      {Array.from({ length: boards }, (_, i) => (
        <Plank key={i} w={S - 0.02} h={bh - 0.035} d={0.06} pos={[0, 0.02 + bh * (i + 0.5), 0]} mat={wood} />
      ))}
      {[-1, 1].map((sd) => <Plank key={sd} w={0.13} h={S} d={0.05} pos={[sd * (S / 2 - 0.065), S / 2, 0.05]} mat={frame} />)}
      <Plank w={0.13} h={S} d={0.05} pos={[0, S / 2, 0.05]} mat={frame} />
      {!crystal && <Plank w={0.11} h={Math.hypot(S * 0.42, S * 0.86)} d={0.04} pos={[-S / 4 + 0.02, S / 2, 0.09]} mat={frame} rot={-0.46} />}
      {!crystal && <Plank w={0.11} h={Math.hypot(S * 0.42, S * 0.86)} d={0.04} pos={[S / 4 - 0.02, S / 2, 0.09]} mat={frame} rot={0.46} />}
    </group>
  )
}

// Each crate's boards wear one of the car skins, livelier the rarer the crate: Street the
// pulsing Hexcore honeycomb, Garage Overclock's racing circuits, Gold the glinting Gold Leaf
// flakes and Diamond the Prismatic holo foil. Drawn in the crate's own space (see withSkin).
const CRATE_SKIN: Record<CrateId, number> = {
  street: skinNumber('hexcore'), garage: skinNumber('overclock'), gold: modSkinNumber('goldleaf'), diamond: skinNumber('prismatic'),
}
const SKIN_SCALE = 0.5

function CrateModel({ def, glow, parts }: { def: CrateDef; glow: string; parts: React.RefObject<CrateParts> }) {
  const crystal = def.id === 'diamond'
  const gold = def.id === 'gold'
  // Where the crate is, so its pattern rides along with it as it drops, hops and sways.
  const origin = useMemo(() => ({ value: new Vector3() }), [])
  const mats = useMemo(() => {
    const map = plankTex()
    const n = CRATE_SKIN[def.id]
    const wood = new MeshStandardMaterial({ map: crystal ? null : map, color: def.look.wood, roughness: crystal ? 0.15 : gold ? 0.35 : 0.7, metalness: crystal ? 0.35 : gold ? 0.55 : 0.05 })
    wood.onBeforeCompile = (sh) => withSkin(sh, String(n), false, { origin, scale: SKIN_SCALE })
    wood.customProgramCacheKey = () => `crate-skin-${n}`
    const frame = crystal
      ? new MeshStandardMaterial({ color: '#f5f7fa', metalness: 0.55, roughness: 0.28, emissive: '#cfd8dc', emissiveIntensity: 0.25 })
      : new MeshStandardMaterial({ map, color: new Color(def.look.wood).multiplyScalar(gold ? 0.8 : 0.72), roughness: 0.8, metalness: gold ? 0.5 : 0 })
    const band = new MeshStandardMaterial({ color: def.look.band, metalness: gold || crystal ? 1 : 0.75, roughness: gold ? 0.22 : 0.4 })
    const bolt = new MeshStandardMaterial({ color: gold ? '#ffe082' : '#b0bec5', metalness: 1, roughness: 0.3 })
    const core = new MeshBasicMaterial({ color: glow, toneMapped: false, transparent: true, opacity: 0.0 })
    return { wood, frame, band, bolt, core }
  }, [def, glow, crystal, gold])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const p = parts.current
  useFrame(() => {
    tickSkins()
    p.root?.getWorldPosition(origin.value)
  })
  const label = useMemo(() => labelTex(def.name, def.id === 'garage' ? '#f5f5f5' : '#3e2723'), [def])
  // Panels: front (+z), back, left, right; each hinged at its bottom outside edge.
  const sides: { pos: [number, number, number]; ry: number }[] = [
    { pos: [0, 0, S / 2], ry: 0 }, { pos: [0, 0, -S / 2], ry: Math.PI }, { pos: [-S / 2, 0, 0], ry: -Math.PI / 2 }, { pos: [S / 2, 0, 0], ry: Math.PI / 2 },
  ]
  return (
    <group ref={(o) => void (p.root = o)}>
      {/* Skids and the floor of the crate. */}
      {[-0.55, 0, 0.55].map((x) => <Plank key={x} w={0.16} h={0.12} d={S + 0.08} pos={[x * S, 0.06, 0]} mat={mats.frame} />)}
      <Plank w={S} h={0.04} d={S} pos={[0, 0.13, 0]} mat={mats.frame} />
      {/* The glow inside: a bright core that lights up through the gaps, and its light. */}
      <mesh ref={(o) => void (p.core = o)} position-y={S / 2 + 0.1} material={mats.core}>
        <boxGeometry args={[S * 0.86, S * 0.86, S * 0.86]} />
      </mesh>
      <pointLight ref={(o) => void (p.light = o)} position-y={S * 0.6} color={glow} intensity={0} distance={7} decay={1.6} />
      {sides.map((sd, i) => (
        <group key={i} position={[sd.pos[0], 0.15, sd.pos[2]]} rotation-y={sd.ry}>
          <group ref={(o) => void (p.panels[i] = o)}>
            <Panel wood={mats.wood} frame={mats.frame} crystal={crystal} />
            {/* Steel bands and corner brackets ride on the panels. */}
            <group ref={(o) => void (p.bands[i] = o)}>
              {[0.24, S - 0.3].map((y) => (
                <mesh key={y} position={[0, y, 0.105]} material={mats.band} castShadow>
                  <boxGeometry args={[S + 0.02, 0.08, 0.02]} />
                </mesh>
              ))}
              {[-1, 1].map((sx) => [0.12, S - 0.12].map((y) => (
                <group key={`${sx}${y}`} position={[sx * (S / 2 - 0.05), y, 0.11]}>
                  <mesh material={mats.band}><boxGeometry args={[0.16, 0.16, 0.02]} /></mesh>
                  {[-0.04, 0.04].map((b) => <mesh key={b} position={[b, b, 0.016]} material={mats.bolt}><cylinderGeometry args={[0.018, 0.018, 0.02, 8]} /></mesh>)}
                </group>
              )))}
            </group>
            {i === 0 && (
              <>
                <mesh position={[0, S * 0.55, 0.125]}>
                  <planeGeometry args={[0.72, 0.36]} />
                  <meshStandardMaterial map={label} transparent roughness={0.9} {...decal()} />
                </mesh>
                {(gold || crystal) && (
                  <mesh position={[0, S * 0.86, 0.17]} rotation-z={Math.PI / 4}>
                    <octahedronGeometry args={[0.1]} />
                    <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.4} metalness={0.4} roughness={0.1} toneMapped={false} />
                  </mesh>
                )}
              </>
            )}
            {/* Rope handles on the left and right sides. */}
            {i >= 2 && (
              <mesh position={[0, S * 0.62, 0.13]} rotation-x={Math.PI / 2}>
                <torusGeometry args={[0.13, 0.022, 6, 14, Math.PI]} />
                <meshStandardMaterial color="#c8a165" roughness={1} />
              </mesh>
            )}
          </group>
        </group>
      ))}
      {/* The lid: boards across, two battens, a band and stencilled arrows. */}
      <group ref={(o) => void (p.lid = o)} position-y={S + 0.15}>
        {Array.from({ length: 5 }, (_, i) => <Plank key={i} w={S + 0.08} h={0.06} d={(S + 0.08) / 5 - 0.03} pos={[0, 0.03, -S / 2 - 0.04 + ((S + 0.08) / 5) * (i + 0.5)]} mat={mats.wood} />)}
        {[-0.32, 0.32].map((x) => <Plank key={x} w={0.14} h={0.05} d={S + 0.08} pos={[x * S, 0.085, 0]} mat={mats.frame} />)}
        <mesh position={[0, 0.115, 0]} material={mats.band}><boxGeometry args={[0.08, 0.012, S + 0.1]} /></mesh>
        {[-1, 1].map((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (S / 2 - 0.02), 0.03, sz * (S / 2 - 0.02)]} material={mats.band}><boxGeometry args={[0.14, 0.09, 0.14]} /></mesh>
        )))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The depot

function Racking({ x, flip, seed }: { x: number; flip: boolean; seed: number }) {
  const boxes = useMemo(() => {
    const r = rng(seed)
    const out: { p: [number, number, number]; s: [number, number, number]; c: string; tex: boolean }[] = []
    for (let level = 0; level < 3; level++) {
      for (let bay = 0; bay < 3; bay++) {
        let z = -5.8 + bay * 2.2 + 0.1
        while (z < -5.8 + bay * 2.2 + 1.9) {
          const w = 0.5 + r() * 0.5
          const h = 0.4 + r() * 0.55
          const wood = r() > 0.45
          out.push({
            p: [x + (flip ? -1 : 1) * (0.1 + r() * 0.1), 0.18 + level * 1.55 + h / 2, z + w / 2],
            s: [0.8 + r() * 0.2, h, w],
            c: wood ? ['#b7844f', '#a1703f', '#c79a64'][Math.floor(r() * 3)] : ['#c9a46b', '#b8915a', '#d7b98a', '#2e7d4f'][Math.floor(r() * 4)],
            tex: wood,
          })
          z += w + 0.06
        }
      }
    }
    return out
  }, [x, flip, seed])
  const map = plankTex()
  return (
    <group>
      {/* Orange uprights and blue beams, like real pallet racking. */}
      {[-5.8, -3.6, -1.4, 0.8].map((z) => [-0.55, 0.55].map((dx) => (
        <mesh key={`${z}${dx}`} position={[x + dx, 2.4, z]} castShadow>
          <boxGeometry args={[0.09, 4.8, 0.09]} />
          <meshStandardMaterial color="#ff6d00" roughness={0.6} />
        </mesh>
      )))}
      {[0.12, 1.67, 3.22].map((y) => [-0.55, 0.55].map((dx) => (
        <mesh key={`${y}${dx}`} position={[x + dx, y, -2.5]}>
          <boxGeometry args={[0.07, 0.14, 6.7]} />
          <meshStandardMaterial color="#1565c0" roughness={0.5} />
        </mesh>
      )))}
      {[0.2, 1.75, 3.3].map((y) => (
        <mesh key={y} position={[x, y, -2.5]} receiveShadow>
          <boxGeometry args={[1.1, 0.03, 6.6]} />
          <meshStandardMaterial color="#8d6e63" map={map} />
        </mesh>
      ))}
      {boxes.map((b, i) => (
        <mesh key={i} position={b.p} castShadow receiveShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} map={b.tex ? map : null} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Forklift({ x, z, ry }: { x: number; z: number; ry: number }) {
  const yellow = '#ffb300'
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.1, 0.7, 1.6]} /><meshStandardMaterial color={yellow} roughness={0.45} /></mesh>
      <mesh position={[0, 0.62, -0.75]} castShadow><boxGeometry args={[1.05, 0.62, 0.4]} /><meshStandardMaterial color="#37474f" roughness={0.6} /></mesh>
      <mesh position={[0, 1.02, -0.05]}><boxGeometry args={[0.55, 0.12, 0.5]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0, 1.3, -0.3]}><boxGeometry args={[0.55, 0.5, 0.1]} /><meshStandardMaterial color="#212121" /></mesh>
      {/* Overhead guard. */}
      {[-0.48, 0.48].map((dx) => [-0.55, 0.4].map((dz) => (
        <mesh key={`${dx}${dz}`} position={[dx, 1.55, dz]}><boxGeometry args={[0.06, 1.3, 0.06]} /><meshStandardMaterial color="#263238" /></mesh>
      )))}
      <mesh position={[0, 2.2, -0.08]}><boxGeometry args={[1.02, 0.05, 1.05]} /><meshStandardMaterial color="#263238" /></mesh>
      {/* Mast and forks. */}
      {[-0.32, 0.32].map((dx) => <mesh key={dx} position={[dx, 1.35, 0.88]} castShadow><boxGeometry args={[0.1, 2.5, 0.1]} /><meshStandardMaterial color="#455a64" metalness={0.5} roughness={0.4} /></mesh>)}
      <mesh position={[0, 0.35, 0.95]}><boxGeometry args={[0.8, 0.4, 0.06]} /><meshStandardMaterial color="#455a64" metalness={0.5} /></mesh>
      {[-0.25, 0.25].map((dx) => <mesh key={dx} position={[dx, 0.17, 1.45]}><boxGeometry args={[0.12, 0.05, 1.0]} /><meshStandardMaterial color="#546e7a" metalness={0.6} roughness={0.35} /></mesh>)}
      {[[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.55], [0.5, -0.55]].map(([dx, dz]) => (
        <mesh key={`${dx}${dz}`} position={[dx, 0.24, dz]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.24, 0.24, 0.2, 14]} /><meshStandardMaterial color="#1c1c1c" roughness={0.9} /></mesh>
      ))}
      <mesh position={[0.3, 2.28, -0.4]}><cylinderGeometry args={[0.07, 0.07, 0.08, 10]} /><meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={2} toneMapped={false} /></mesh>
    </group>
  )
}

function Drum({ x, z, color, tip = 0 }: { x: number; z: number; color: string; tip?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={tip}>
      <mesh position-y={0.45} castShadow><cylinderGeometry args={[0.3, 0.3, 0.9, 16]} /><meshStandardMaterial color={color} metalness={0.35} roughness={0.5} /></mesh>
      {[0.15, 0.45, 0.75].map((y) => <mesh key={y} position-y={y}><torusGeometry args={[0.305, 0.015, 4, 20]} /><meshStandardMaterial color={color} metalness={0.4} roughness={0.45} /></mesh>)}
      <mesh position={[0.12, 0.905, 0.05]}><cylinderGeometry args={[0.04, 0.04, 0.02, 8]} /><meshStandardMaterial color="#9e9e9e" metalness={0.8} /></mesh>
    </group>
  )
}

function Pallet({ x, z, ry = 0, stack = 1 }: { x: number; z: number; ry?: number; stack?: number }) {
  const map = plankTex()
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      {Array.from({ length: stack }, (_, k) => (
        <group key={k} position-y={k * 0.15}>
          {[-0.45, 0, 0.45].map((dz) => <mesh key={dz} position={[0, 0.05, dz]}><boxGeometry args={[1.2, 0.09, 0.1]} /><meshStandardMaterial color="#a1887f" map={map} /></mesh>)}
          {[-0.5, -0.25, 0, 0.25, 0.5].map((dx) => <mesh key={dx} position={[dx, 0.12, 0]}><boxGeometry args={[0.18, 0.025, 1.0]} /><meshStandardMaterial color="#bcaaa4" map={map} /></mesh>)}
        </group>
      ))}
    </group>
  )
}

// An industrial lamp hanging on a chain: a dark shade, a hot bulb and a faint cone of light.
function HangingLamp({ x, z, y = 5.4, beam = true }: { x: number; z: number; y?: number; beam?: boolean }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={1.4}><cylinderGeometry args={[0.012, 0.012, 2.8, 4]} /><meshStandardMaterial color="#263238" /></mesh>
      <mesh><coneGeometry args={[0.42, 0.32, 18, 1, true]} /><meshStandardMaterial color="#2e3b43" metalness={0.6} roughness={0.4} side={DoubleSide} /></mesh>
      <mesh position-y={-0.08}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color="#fff8e1" emissive="#ffd180" emissiveIntensity={3} toneMapped={false} /></mesh>
      {beam && (
        <mesh position-y={-y / 2} renderOrder={3}>
          <coneGeometry args={[1.5, y, 24, 1, true]} />
          <meshBasicMaterial color="#ffe0a3" transparent opacity={0.045} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

function Depot() {
  const neon = useMemo(() => signTexture('CRATE DEPOT', '#140c22', '#ff4fd8'), [])
  const sub = useMemo(() => signTexture('LOADING BAY 3', '#263238', '#ffc400'), [])
  return (
    <group>
      {/* Concrete floor with its painted walkways and the lift's hazard ring. */}
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.land} receiveShadow>
        <planeGeometry args={[36, 26]} />
        <meshStandardMaterial map={concreteTex(9, 7)} color="#9aa3a8" roughness={0.75} metalness={0.05} />
      </mesh>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, LAYER.paint, 0]}>
          <planeGeometry args={[0.12, 22]} />
          <meshStandardMaterial color="#ffd600" roughness={0.7} {...decal()} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.paint, 0]}>
        <ringGeometry args={[1.75, 1.95, 48]} />
        <meshStandardMaterial map={hazardTex(16)} roughness={0.7} {...decal()} />
      </mesh>
      {/* The lift the crate stands on. */}
      <mesh position-y={LIFT / 2} receiveShadow castShadow>
        <cylinderGeometry args={[1.45, 1.5, LIFT, 40]} />
        <meshStandardMaterial color="#455a64" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position-y={LIFT + 0.002} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[1.42, 40]} />
        <meshStandardMaterial color="#5b6a73" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position-y={LIFT / 2}>
        <cylinderGeometry args={[1.505, 1.505, LIFT * 0.6, 40, 1, true]} />
        <meshStandardMaterial map={hazardTex(12)} side={DoubleSide} />
      </mesh>
      {/* Back wall, the roller door and the neon sign. */}
      <mesh position={[0, 4, -7]} receiveShadow>
        <boxGeometry args={[30, 8, 0.2]} />
        <meshStandardMaterial map={corrugatedTex(10, 3)} color="#6f7f8a" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.45, -6.85]}>
        <boxGeometry args={[30, 0.9, 0.12]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <group position={[-6.2, 0, -6.86]}>
        <mesh position={[0, 2.95, 0]}><boxGeometry args={[3.4, 2.1, 0.08]} /><meshStandardMaterial map={shutterTex()} color="#b0bec5" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 1.0, -0.2]}><planeGeometry args={[3.2, 1.9]} /><meshBasicMaterial color="#1a2a4a" /></mesh>
        <mesh position={[0, 0.9, -0.15]}><planeGeometry args={[3.0, 0.6]} /><meshBasicMaterial map={glowTex()} color="#7aa7ff" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} /></mesh>
        {[-1.75, 1.75].map((dx) => <mesh key={dx} position={[dx, 2, 0.04]}><boxGeometry args={[0.14, 4, 0.14]} /><meshStandardMaterial map={hazardTex(1)} /></mesh>)}
      </group>
      <group position={[0, 3.3, -6.84]}>
        <mesh><boxGeometry args={[5.4, 1.5, 0.12]} /><meshStandardMaterial color="#120a1e" /></mesh>
        <mesh position-z={0.07}><planeGeometry args={[5.1, 1.25]} /><meshBasicMaterial map={neon} toneMapped={false} color="#ffffff" /></mesh>
        {/* Neon tube border. */}
        {[[0, 0.7, 5.3, 0.05], [0, -0.7, 5.3, 0.05], [-2.65, 0, 0.05, 1.4], [2.65, 0, 0.05, 1.4]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.1]}><boxGeometry args={[w, h, 0.05]} /><meshBasicMaterial color="#00e5ff" toneMapped={false} /></mesh>
        ))}
      </group>
      <mesh position={[5.9, 3.0, -6.84]}><planeGeometry args={[2.2, 0.55]} /><meshStandardMaterial map={sub} roughness={0.6} /></mesh>
      {/* Side walls fading into the dark. */}
      {[-13, 13].map((x) => (
        <mesh key={x} position={[x, 4, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[26, 8]} />
          <meshStandardMaterial map={corrugatedTex(8, 3)} color="#55626b" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
      {/* Roof trusses. */}
      {[-4, 0, 4].map((z) => (
        <group key={z} position={[0, 7.4, z - 2]}>
          <mesh><boxGeometry args={[26, 0.2, 0.2]} /><meshStandardMaterial color="#37474f" metalness={0.5} /></mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[-11 + i * 2, -0.35, 0]} rotation-z={i % 2 ? 0.6 : -0.6}><boxGeometry args={[0.06, 0.9, 0.06]} /><meshStandardMaterial color="#37474f" /></mesh>
          ))}
        </group>
      ))}
      <Racking x={-8} flip={false} seed={7} />
      <Racking x={8} flip seed={23} />
      <Forklift x={4.6} z={-3.2} ry={-0.7} />
      <Pallet x={-4.4} z={-4.6} stack={4} ry={0.2} />
      <Pallet x={3.2} z={1.8} ry={-0.3} />
      <Drum x={-4.2} z={-2.2} color="#1565c0" />
      <Drum x={-3.6} z={-2.6} color="#c62828" />
      <Drum x={-4.6} z={-2.9} color="#2e7d32" />
      <TyreStack x={4.2} z={-5.6} n={5} band="#ffc400" />
      <ToolChest x={-5.8} z={-5.9} ry={0.15} />
      {/* A traffic cone and a broom by the lift. */}
      <group position={[2.4, 0, 1.4]}>
        <mesh position-y={0.25}><coneGeometry args={[0.16, 0.5, 14]} /><meshStandardMaterial color="#ff6d00" /></mesh>
        <mesh position-y={0.28}><cylinderGeometry args={[0.1, 0.12, 0.08, 14]} /><meshStandardMaterial color="#fafafa" /></mesh>
        <mesh position-y={0.02}><boxGeometry args={[0.36, 0.04, 0.36]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
      <HangingLamp x={0} z={0} y={5.6} beam={false} />
      <HangingLamp x={-6} z={-3} />
      <HangingLamp x={6} z={-3} />
    </group>
  )
}

// Specks of dust turning slowly in the work lamp's beam.
function Dust() {
  const ref = useRef<Points>(null)
  const pos = useMemo(() => {
    const r = rng(5)
    const a = new Float32Array(160 * 3)
    for (let i = 0; i < 160; i++) {
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * 1.9
      a[i * 3] = Math.cos(ang) * rad
      a[i * 3 + 1] = 0.3 + r() * 5
      a[i * 3 + 2] = Math.sin(ang) * rad
    }
    return a
  }, [])
  useFrame((_, dt) => {
    const p = ref.current
    if (!p) return
    p.rotation.y += dt * 0.05
    const arr = p.geometry.attributes.position.array as Float32Array
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] += dt * 0.06
      if (arr[i] > 5.3) arr[i] = 0.3
    }
    p.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial size={0.035} color="#fff3d6" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </points>
  )
}

// ---------------------------------------------------------------------------------------------
// The prize

type CarLook = { body: Body; model: string; color: string; finish?: Finish | null; stripe?: string | null; mods?: string[] | null; skin?: string | null; modSkin?: Partial<Record<SkinnedSlot, string>> | null }

function PrizeCar({ look }: { look: CarLook }) {
  const sc = 2.3 / carSize(look.body).len
  return (
    <group scale={sc}>
      <CarModel body={look.body} model={look.model} color={look.color} finish={look.finish} stripe={look.stripe} mods={look.mods} skin={look.skin} modSkin={look.modSkin} />
    </group>
  )
}

// A shower of gold coins thrown out of the crate: each one tumbles through the
// air, bounces once or twice, then slides to a stop lying flat on the floor.
const COINS = 110
// Coins, or for a rare or legendary pull cut gems (a six-sided table cut), thrown the same way.
const SHAPES = {
  coin: { r: 0.11, h: 0.025 },
  gem: { r: 0.1, h: 0.07 },
}
// How a shower is thrown, picked at random each opening (a big win always heaps up a pile).
// Each sets how many fly, every piece's launch and delay, and the note its clink rings at.
export type BurstPattern = 'fountain' | 'spiral' | 'ring' | 'rain' | 'pile'
export const BURST_PATTERNS: BurstPattern[] = ['fountain', 'spiral', 'ring', 'rain']
type Launch = { vx: number; vy: number; vz: number; delay: number; tune?: number }
const BURSTS: Record<BurstPattern, { n: number; launch: (i: number, n: number, r: () => number) => Launch }> = {
  // Up and out in a loose spray, tipped toward the camera.
  fountain: { n: 70, launch: (i, n, r) => {
    const a = r() * Math.PI * 2, sp = 1.2 + r() * 2.6
    return { vx: Math.cos(a) * sp, vy: 4.5 + r() * 3.5, vz: Math.sin(a) * sp * 0.7 + 0.6, delay: (i / n) * 0.5 }
  } },
  // One after another round a turning arm that reaches further each time; the clinks climb.
  spiral: { n: 70, launch: (i, n, r) => {
    const k = i / n, a = k * Math.PI * 3.2, sp = 0.9 + k * 2.8
    return { vx: Math.cos(a) * sp, vy: 5.2 + r() * 0.6, vz: Math.sin(a) * sp * 0.8 + 0.2, delay: k * 0.9, tune: 0.8 + k * 0.5 }
  } },
  // All at once, evenly round two rings, so they land as a splash of two circles ringing in fifths.
  ring: { n: 72, launch: (i, n) => {
    const inner = i % 2 === 0, a = (i / n) * Math.PI * 2 + (inner ? 0.09 : 0), sp = inner ? 1.65 : 2.6
    return { vx: Math.cos(a) * sp, vy: 5, vz: Math.sin(a) * sp * 0.85 + 0.15, delay: inner ? 0.07 : 0, tune: inner ? 1.5 : 1 }
  } },
  // Shot high out of sight, then raining down scattered over a second and a bit: a steady patter.
  rain: { n: 70, launch: (i, n, r) => {
    const a = r() * Math.PI * 2, sp = 0.4 + r() * 1.9
    return { vx: Math.cos(a) * sp, vy: 10 + r() * 1.5, vz: Math.sin(a) * sp * 0.75 + 0.35, delay: (i / n) * 1.2 + r() * 0.1 }
  } },
  // A big win: a heavy, low heave in two waves that heaps up round the crate, with deeper clinks.
  pile: { n: 110, launch: (i, n, r) => {
    const a = r() * Math.PI * 2, sp = 0.2 + r() * r() * 2.4
    return { vx: Math.cos(a) * sp, vy: 3.4 + r() * 2.4, vz: Math.sin(a) * sp * 0.8 + 0.25, delay: (i % 2) * 0.35 + (i / n) * 0.35, tune: 0.72 + r() * 0.18 }
  } },
}
// Snap an angle to the nearest face-up/face-down orientation.
const flatOf = (a: number) => Math.round(a / Math.PI) * Math.PI
// What a thrown coin lands on at (x, z): the crate's floor, one of the four sides lying open
// around it (hinged 0.15 up, tipped just short of flat so the far end rises a little), the lift
// or the depot floor.
const CRATE_FLOOR = LIFT + 0.15
function groundAt(x: number, z: number) {
  const ax = Math.abs(x), az = Math.abs(z)
  const h = S / 2
  if (ax < h && az < h) return CRATE_FLOOR
  const out = ax >= h && az < h ? ax - h : az >= h && ax < h ? az - h : -1
  if (out >= 0 && out < S) return CRATE_FLOOR + 0.08 + out * 0.07
  return Math.hypot(x, z) < 1.5 ? LIFT : 0
}
function CoinBurst({ start, gems = false, big = false }: { start: React.RefObject<number | null>; gems?: boolean; big?: boolean }) {
  const { r: COIN_R, h: COIN_H } = SHAPES[gems ? 'gem' : 'coin']
  const ref = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  const run = useRef<number | null>(null)
  const shown = useRef(0)
  const coins = useMemo(() => {
    const r = rng(41)
    return Array.from({ length: COINS }, () => ({
      vx: 0, vy: 0, vz: 0, delay: 0, tune: undefined as number | undefined,
      // Flip rate (end over end) and a slower wobble, both in radians/second.
      flip: (8 + r() * 10) * (r() < 0.5 ? -1 : 1), wob: (r() - 0.5) * 6, yaw: r() * Math.PI * 2,
      x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, rx: r() * 6, rz: 0, wx: 0, wz: 0, bounces: 0, rest: false, fl: 0, live: false,
      // How high it sits on the pieces that settled under it, and when it settled (-1 while flying).
      lift: 0, settled: -1,
    }))
  }, [])
  useFrame((state, rawDt) => {
    const m = ref.current
    if (!m || start.current == null) return
    const dt = Math.min(rawDt, 1 / 30)
    const t = state.clock.elapsedTime - start.current
    // A new crate opening throws the whole shower again.
    if (run.current !== start.current) {
      run.current = start.current
      const pattern: BurstPattern = big ? 'pile' : BURST_PATTERNS[Math.floor(Math.random() * BURST_PATTERNS.length)]
      const { n, launch } = BURSTS[pattern]
      const r = rng(Math.floor(Math.random() * 1e6))
      shown.current = n
      coins.forEach((c, i) => Object.assign(c, { live: false, lift: 0, settled: -1, tune: undefined }, i < n ? launch(i, n, r) : {}))
    }
    coins.forEach((c, i) => {
      if (i >= shown.current || t < c.delay) {
        tmp.position.set(0, -10, 0)
        tmp.updateMatrix()
        m.setMatrixAt(i, tmp.matrix)
        return
      }
      if (!c.live) Object.assign(c, { live: true, x: 0, y: S * 0.8, z: 0, sx: c.vx, sy: c.vy, sz: c.vz, wx: c.flip, wz: c.wob, bounces: 0, rest: false })
      const floor = groundAt(c.x, c.z)
      if (!c.rest) {
        c.sy -= 14 * dt
        c.x += c.sx * dt
        c.y += c.sy * dt
        c.z += c.sz * dt
        c.rx += c.wx * dt
        c.rz += c.wz * dt
        // How high the tilted coin's lowest rim sits above its centre.
        const reach = COIN_R * Math.min(1, Math.hypot(Math.sin(c.rx), Math.sin(c.rz))) + COIN_H / 2
        if (c.y < floor + reach && c.sy < 0) {
          c.y = floor + reach
          c.bounces++
          // A soft clink as each one first lands; the bounces after stay quiet.
          if (c.bounces === 1) landClink(gems, -c.sy, c.tune)
          // Each hit loses most of the spin and height; after a couple it lies down.
          c.sy = Math.abs(c.sy) * (c.bounces === 1 ? 0.38 : 0.22)
          c.sx *= 0.55
          c.sz *= 0.55
          c.wx *= 0.4
          c.wz *= 0.3
          if (c.bounces >= 3 || c.sy < 0.8) Object.assign(c, { rest: true, fl: floor, settled: t })
        }
      } else {
        // Slide to a stop and settle flat: no more spinning on the floor.
        const k = 1 - Math.exp(-12 * dt)
        c.sx *= 1 - Math.min(1, 6 * dt)
        c.sz *= 1 - Math.min(1, 6 * dt)
        const nx = c.x + c.sx * dt, nz = c.z + c.sz * dt
        const under = groundAt(nx, nz)
        // It follows a gentle slope, stops against a step up and drops off an edge again.
        if (under > c.fl + 0.04) c.sx = c.sz = 0
        else {
          c.x = nx
          c.z = nz
          if (under < c.fl - 0.04) Object.assign(c, { rest: false, sy: 0, bounces: 2, lift: 0, settled: -1 })
          else c.fl = under
        }
        c.rx += (flatOf(c.rx) - c.rx) * k
        c.rz += (flatOf(c.rz) - c.rz) * k
        // Lie on top of any piece that settled here first, so a heap stacks up instead of
        // pieces sinking into each other. Once it stops sliding, where it sits is fixed.
        if (Math.abs(c.sx) + Math.abs(c.sz) > 0.02 || t - c.settled < 0.3) {
          let top = 0
          for (let j = 0; j < shown.current; j++) {
            const o = coins[j]
            if (o === c || !o.rest || o.settled < 0 || o.settled > c.settled || (o.settled === c.settled && j > i)) continue
            if (Math.abs(o.fl - c.fl) < 0.04 && Math.hypot(o.x - c.x, o.z - c.z) < COIN_R * 1.5) top = Math.max(top, o.lift + COIN_H * 0.95)
          }
          c.lift += (top - c.lift) * Math.min(1, 20 * dt)
        }
        const reach = COIN_R * Math.min(1, Math.hypot(Math.sin(c.rx), Math.sin(c.rz))) + COIN_H / 2
        c.y = c.fl + c.lift + reach
      }
      tmp.position.set(c.x, c.y, c.z)
      tmp.rotation.set(c.rx, c.yaw, c.rz, 'YXZ')
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COINS]} castShadow frustumCulled={false}>
      {gems ? (
        <>
          <cylinderGeometry args={[COIN_R * 0.62, COIN_R, COIN_H, 6]} />
          <meshStandardMaterial color="#35a8ff" metalness={0.35} roughness={0.08} emissive="#0d5fb3" emissiveIntensity={0.55} flatShading />
        </>
      ) : (
        <>
          <cylinderGeometry args={[COIN_R, COIN_R, COIN_H, 16]} />
          <meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.25} emissive="#ff8f00" emissiveIntensity={0.25} />
        </>
      )}
    </instancedMesh>
  )
}

// A stack of gold coins with a big coin standing on top.
function CoinPile() {
  return (
    <group>
      {Array.from({ length: 4 }, (_, k) => Array.from({ length: 6 - k }, (_, i) => {
        const a = (i / (6 - k)) * Math.PI * 2 + k
        return (
          <mesh key={`${k}${i}`} position={[Math.cos(a) * (0.42 - k * 0.1), 0.03 + k * 0.05, Math.sin(a) * (0.42 - k * 0.1)]} rotation={[0.1 * Math.sin(i), a, 0.1]}>
            <cylinderGeometry args={[0.16, 0.16, 0.05, 18]} />
            <meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.22} />
          </mesh>
        )
      }))}
      <group position-y={0.62}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.42, 0.42, 0.08, 32]} />
          <meshStandardMaterial color="#ffca28" metalness={1} roughness={0.18} emissive="#ff8f00" emissiveIntensity={0.25} />
        </mesh>
        {[1, -1].map((sd) => (
          <group key={sd} rotation-y={sd < 0 ? Math.PI : 0}>
            <mesh position-z={0.045}><ringGeometry args={[0.28, 0.34, 32]} /><meshStandardMaterial color="#ff8f00" metalness={1} roughness={0.25} /></mesh>
            <mesh position-z={0.046}><planeGeometry args={[0.36, 0.36]} /><meshBasicMaterial map={dollarTex()} transparent toneMapped={false} /></mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// Confetti and sparks thrown up when the lid blows.
const BITS = 140
function Burst({ start, glow }: { start: React.RefObject<number | null>; glow: string }) {
  const ref = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  const bits = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: BITS }, () => {
      const a = r() * Math.PI * 2, sp = 0.8 + r() * 3
      return { vx: Math.cos(a) * sp, vy: 5 + r() * 6, vz: Math.sin(a) * sp, rx: r() * 6, ry: r() * 6, w: 0.5 + r() }
    })
  }, [])
  const colors = useMemo(() => {
    const palette = [glow, '#ffffff', '#ffd54f', glow, '#ff4081', '#69f0ae']
    return bits.map((_, i) => new Color(palette[i % palette.length]))
  }, [bits, glow])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    colors.forEach((c, i) => m.setColorAt(i, c))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [colors])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = start.current == null ? -1 : state.clock.elapsedTime - start.current
    m.visible = t >= 0 && t < 4
    if (!m.visible) return
    bits.forEach((b, i) => {
      // Fall slows like paper once it's past the top of its throw.
      const drag = Math.min(t, 0.6) + Math.max(0, t - 0.6) * 0.25
      const y = S + b.vy * drag - 9 * drag * drag
      tmp.position.set(b.vx * drag * 1.2, Math.max(0.03, y), b.vz * drag * 1.2)
      tmp.rotation.set(b.rx + t * 7 * b.w, b.ry + t * 5, t * 3)
      tmp.scale.setScalar(Math.max(0, 1 - t / 4))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BITS]} frustumCulled={false} visible={false}>
      <planeGeometry args={[0.09, 0.05]} />
      <meshBasicMaterial side={DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------------------------

export type CratePhase = 'idle' | 'wait' | 'open'

export function CrateScene(props: StageProps & { run: number }) {
  useEffect(() => holdTown(), [])
  useEffect(() => holdPageTint('#120c1c'), [])
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  // Wide screens dock the crate picker on the right, so the crate sits left of centre; tall
  // ones dock it along the bottom, so the crate sits high.
  const wide = size.width >= 900 && size.width > size.height * 1.25
  useFitCamera([0, 0.42, 1], [0, 1.5, -0.6], wide ? 5 : 2.5, wide ? 3 : 2.9)
  // Where the camera sits before an opening pushes it in (useFitCamera has just placed it).
  const base = useRef(new Vector3())
  useLayoutEffect(() => {
    base.current.copy(camera.position)
    const cam = camera as PerspectiveCamera
    if (wide) cam.setViewOffset(size.width, size.height, size.width * 0.13, 0, size.width, size.height)
    else cam.setViewOffset(size.width, size.height, 0, size.height * 0.13, size.width, size.height)
    return () => cam.clearViewOffset()
  }, [camera, size, wide])
  const look = useMemo(() => {
    const l = lookFor(1, 0)
    l.grade.exposure = 1.15
    l.grade.saturation = 1.05
    l.grade.vibrance = 0.15
    l.grade.bloom = 1.25
    l.grade.threshold = 0.55
    l.grade.vignette = 0.5
    return l
  }, [])
  const spot = useRef<SpotLight>(null)
  useEffect(() => {
    spot.current?.target.position.set(0, 0, 0)
    spot.current?.target.updateMatrixWorld()
  }, [])
  return (
    <>
      <color attach="background" args={['#120c1c']} />
      <fog attach="fog" args={['#120c1c', 12, 30]} />
      <hemisphereLight args={['#6b7cc0', '#2a1d14', 0.55]} />
      <ambientLight intensity={0.12} />
      {/* The work lamp right over the lift. */}
      <spotLight ref={spot} position={[0, 7, 1.2]} angle={0.5} penumbra={0.6} intensity={140} distance={18} decay={1.8} color="#ffe8c2" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <pointLight position={[-6, 4.6, -3]} intensity={10} distance={9} color="#ffd18a" />
      <pointLight position={[6, 4.6, -3]} intensity={10} distance={9} color="#ffd18a" />
      <pointLight position={[0, 4.1, -5.8]} intensity={6} distance={8} color="#ff4fd8" />
      <pointLight position={[-6.2, 1.2, -7.6]} intensity={5} distance={6} color="#7aa7ff" />
      <SkyEnv />
      <PostFx look={look} />
      <Depot />
      <Dust />
      <Stage key={props.run} {...props} base={base} />
    </>
  )
}

type StageProps = {
  def: CrateDef
  phase: CratePhase
  drop: CrateDrop | null
  // The car to show for a part prize (yours, wearing the new part) or a car prize.
  prizeCar: CarLook | null
  onReveal: () => void
  // Bumped to jump to the end of the opening.
  skip: number
}

// One crate on the lift, from dropping in to its prize: remounted for every crate.
function Stage({ def, phase, drop, prizeCar, onReveal, skip, base }: StageProps & { base: React.RefObject<Vector3> }) {
  const camera = useThree((s) => s.camera)
  const tier = drop ? dropTier(drop) : 0
  const glow = drop ? TIER_GLOW[tier] : def.look.glow
  const parts = useRef<CrateParts>({ root: null, lid: null, panels: [], bands: [], core: null, light: null })
  const prize = useRef<Group>(null)
  const beam = useRef<Mesh>(null)
  const flash = useRef<PointLight>(null)
  const burstAt = useRef<number | null>(null)
  const coinAt = useRef<number | null>(null)
  const st = useRef({ born: -1, openAt: -1, lid: { y: 0, vy: 0, x: 0, vx: 0, rx: 0, landed: false }, revealed: false, hops: 0, skipped: skip })
  const coins = drop?.kind === 'coins' || drop?.kind === 'dupe' || drop?.kind === 'skindupe'
  // Rare and legendary pulls (cars, gem parts, epic and legendary skins) throw gems instead.
  const gems = !coins && tier >= 2
  // A jackpot or a legendary pull heaps its shower into a pile.
  const big = (drop?.kind === 'coins' && drop.jackpot) || tier >= 3
  // A part shows the part itself; cars and paints show the car.
  const part = drop?.kind === 'mod' ? drop.mod : null
  const showCar = (drop?.kind === 'car' || drop?.kind === 'dupe' || drop?.kind === 'skin' || drop?.kind === 'skindupe') && !!prizeCar

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const now = state.clock.elapsedTime
    if (s.born < 0) s.born = now
    const p = parts.current
    const root = p.root
    if (!root) return
    // Drop in from above on arrival, with a little bounce.
    const age = now - s.born
    const fall = Math.min(1, age / 0.55)
    let y = LIFT + (1 - fall * fall) * 5
    if (fall >= 1) y = LIFT + Math.abs(Math.sin(Math.min(1, (age - 0.55) / 0.35) * Math.PI)) * 0.12 * Math.max(0, 1 - (age - 0.55) / 0.35)
    if (fall >= 1 && s.hops === 0) {
      s.hops = 1
      bumpSound()
    }
    let shake = 0
    let charge = 0
    if (phase === 'open' && s.openAt < 0) {
      s.openAt = now
      crateSfx.charge(CHARGE)
    }
    if (skip !== s.skipped) {
      s.skipped = skip
      if (s.openAt > 0) s.openAt = Math.min(s.openAt, now - SETTLE)
    }
    const t = s.openAt > 0 ? now - s.openAt : -1
    if (phase === 'wait') shake = 0.012
    if (phase === 'idle') root.rotation.y = Math.sin(now * 0.6) * 0.18
    if (t >= 0) {
      charge = Math.min(1, t / CHARGE)
      shake = t < CHARGE ? 0.01 + charge * charge * 0.06 : 0
      // Hops as it strains, each with a knock.
      const hop = [0.35, 0.68, 0.95].findIndex((h) => t >= h && t < h + 0.16)
      if (hop >= 0) {
        y += Math.sin(((t - [0.35, 0.68, 0.95][hop]) / 0.16) * Math.PI) * (0.06 + hop * 0.04)
        if (s.hops < hop + 2) {
          s.hops = hop + 2
          bumpSound()
        }
      }
      if (t >= CHARGE && burstAt.current == null) {
        burstAt.current = now
        if (coins || gems) coinAt.current = now + 0.15
        crashSound()
        sfx.boost()
        s.lid = { y: 0, vy: 6.5, x: 0, vx: 1.6, rx: 0, landed: false }
      }
    }
    root.position.set((Math.random() - 0.5) * shake, y, (Math.random() - 0.5) * shake)
    if (t < 0 && phase !== 'idle') root.rotation.y *= 0.9
    // The glow building inside.
    const after = burstAt.current == null ? -1 : now - burstAt.current
    const coreMat = p.core?.material as MeshBasicMaterial | undefined
    if (coreMat) coreMat.opacity = after >= 0 ? Math.max(0, 1 - after * 1.5) : charge * 0.95
    if (p.light) p.light.intensity = after >= 0 ? 6 + Math.max(0, 30 * (1 - after * 2)) : charge * 14
    // Reduce flashing: a softer, slower glow instead of the white burst.
    if (flash.current) flash.current.intensity = after >= 0 ? (calmFlashing() ? Math.max(0, 14 * (1 - after * 1.2)) : Math.max(0, 60 * (1 - after * 3))) : 0
    // Burst: the lid flies, the sides fall open, the bands snap away.
    if (after >= 0) {
      const L = s.lid
      if (!L.landed) {
        L.vy -= 16 * dt
        L.y += L.vy * dt
        L.x += L.vx * dt
        L.rx += dt * 5
        const floor = -(S + 0.15) - y + 0.04
        if (L.y < floor) {
          L.y = floor
          L.landed = true
          bumpSound()
        }
      }
      if (p.lid) {
        p.lid.position.set(L.x * 0.6, S + 0.15 + L.y, -L.x)
        p.lid.rotation.set(L.landed ? 0 : -L.rx, L.rx * 0.3, L.landed ? 0.05 : L.rx * 0.2)
      }
      const k = Math.min(1, after / 0.42)
      const open = k < 1 ? 1 - (1 - k) * (1 - k) : 1
      const bounce = after > 0.42 && after < 0.7 ? Math.sin(((after - 0.42) / 0.28) * Math.PI) * 0.12 : 0
      p.panels.forEach((g) => g && g.rotation.set(open * 1.5 - bounce, 0, 0))
      p.bands.forEach((g) => g && g.scale.setScalar(Math.max(0.001, 1 - after * 6)))
      if (beam.current) {
        beam.current.visible = true
        beam.current.scale.set(1, Math.min(1, after * 4), 1)
        ;(beam.current.material as MeshBasicMaterial).opacity = Math.max(0.12, 0.7 * (1 - after * 0.6))
      }
      // The prize rises out of the box and turns slowly; a coin prize spins as it rises,
      // then stops facing the camera.
      const g = prize.current
      if (g) {
        const r = Math.min(1, Math.max(0, (after - RISE) / 0.9))
        const ease = r < 1 ? 1 - Math.pow(1 - r, 3) + Math.sin(r * Math.PI) * 0.12 : 1
        g.visible = r > 0
        g.position.y = LIFT + 0.2 + ease * 0.5
        g.scale.setScalar(Math.max(0.01, ease))
        g.rotation.y = coins && !showCar ? Math.pow(1 - r, 3) * Math.PI * 4 : -0.6 + after * 0.55
      }
      if (!s.revealed && after > SETTLE - CHARGE) {
        s.revealed = true
        crateSfx.reveal(tier, coins)
        onReveal()
      }
      // Camera kick at the burst, then a slow push in.
      const kick = Math.max(0, 1 - after * 4) * 0.08
      const b = base.current
      camera.position.set(b.x + (Math.random() - 0.5) * kick, b.y + (Math.random() - 0.5) * kick - Math.min(after, 2) * 0.12, b.z - Math.min(after, 2) * 0.35)
    } else {
      camera.position.copy(base.current)
      if (beam.current) beam.current.visible = false
      if (prize.current) prize.current.visible = false
    }
  })

  return (
    <>
      <pointLight ref={flash} position={[0, 2.2, 0.6]} intensity={0} distance={12} color={glow} />
      <CrateModel key={`${def.id}-${glow}`} def={def} glow={glow} parts={parts} />
      {/* Light beam up out of the crate. */}
      <mesh ref={beam} position-y={LIFT + 4} visible={false} renderOrder={4}>
        <cylinderGeometry args={[0.55, 0.9, 8, 24, 1, true]} />
        <meshBasicMaterial color={glow} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={LIFT + 0.01} renderOrder={2}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial map={glowTex()} color={glow} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Burst start={burstAt} glow={glow} />
      {(coins || gems) && <CoinBurst start={coinAt} gems={gems} big={big} />}
      <group ref={prize} visible={false}>
        {showCar && prizeCar && <PrizeCar look={prizeCar} />}
        {coins && !showCar && <CoinPile />}
        {part && <PartPrize id={part} body={prizeCar?.body} tint={prizeCar?.color ?? '#90a4ae'} />}
        {/* A slowly turning ring of light under the prize. */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[1.05, 1.2, 48]} />
          <meshBasicMaterial color={glow} transparent opacity={0.8} toneMapped={false} side={DoubleSide} />
        </mesh>
      </group>
    </>
  )
}


// The car a prize shows: a new car in its colour, or your car wearing the part it won.
// `mine` is the car to show a paint on: the one you have selected, or your race car.
export function prizeLook(drop: CrateDrop | null, cars: { uid: string; model: string; color: string; finish?: Finish; stripe?: string | null; mods?: string[] }[], mine?: string | null): CarLook | null {
  if (!drop) return null
  if (drop.kind === 'skin' || drop.kind === 'skindupe') return skinLook(drop.skin, drop.part, cars, mine)
  if (drop.kind === 'car') return { body: carDef(drop.model).body, model: drop.model, color: drop.color }
  if (drop.kind === 'dupe') {
    const d = carDef(drop.model)
    return { body: d.body, model: d.id, color: d.colors[0] }
  }
  if (drop.kind === 'mod') {
    const car = cars.find((c) => c.uid === drop.car)
    if (!car) return null
    const d = carDef(car.model)
    // The new part goes first so it wins its slot; the rest of the car's fitted parts stay on.
    const mods = Object.values(fittedMods([drop.mod, ...(car.mods ?? [])], d.body))
    return { body: d.body, model: car.model, color: car.color, finish: car.finish, stripe: car.stripe, mods }
  }
  return null
}

// The showiest part for a slot on this body: the dearest one that fits.
const bestPart = (slot: SkinnedSlot, body: Body) =>
  MODS.filter((m) => m.slot === slot && modFits(m, body)).sort((a, b) => b.coins + b.bucks * 1000 - (a.coins + a.bucks * 1000))[0]?.id
// A skin prize, on one of the player's cars. A car paint covers the bare body with no parts on,
// so the whole car moves; a mod paint goes on a fully kitted car (every paintable part slot
// filled), and only those parts move while the body keeps its own colour.
function skinLook(id: string, part: boolean, cars: { uid: string; model: string; color: string; finish?: Finish; stripe?: string | null; mods?: string[] }[], mine?: string | null): CarLook {
  const owned = cars.filter((c) => !carDef(c.model).parked)
  const car = owned.find((c) => c.uid === mine) ?? owned[0] ?? { model: 'civic', color: '#eceff1' }
  const d = carDef(car.model)
  const look: CarLook = { body: d.body, model: car.model, color: car.color, finish: car.finish, stripe: car.stripe }
  if (!part) return { ...look, mods: [], skin: id }
  const have = fittedMods(car.mods ?? [], d.body)
  const kit = SKINNED_SLOTS.map((sl) => have[sl] ?? bestPart(sl, d.body)).filter((m): m is string => !!m)
  const fitted = fittedMods(kit, d.body)
  const slots = SKINNED_SLOTS.filter((sl) => fitted[sl])
  return { ...look, mods: Object.values(fitted), modSkin: Object.fromEntries(slots.map((sl) => [sl, id])) }
}
