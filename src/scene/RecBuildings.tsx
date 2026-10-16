import type { ReactNode } from 'react'
import { CanvasTexture, CatmullRomCurve3, ExtrudeGeometry, Path, RepeatWrapping, SRGBColorSpace, Shape, TubeGeometry, Vector3, type Texture } from 'three'
import { levelLift, type BuildingDef } from '../game/data'
import { growthStage } from '../game/growth'
import { ShellBuilding, BlockCar, Box, Cyl, Sign, Neon, Bulbs, Trims, GOLD, SNOW, type Mat, type NewModelProps, type V3 } from './NewBuildings'
import { Pool as Glow, Lamp, Bench, Tree } from './edgeKit'
import { TrueSize, Upright, useMergeScale } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { PAL } from './season'
import { FairCrowd, type Visitor } from './FairCrowd'
import { awningTex, concreteTex, grassTex, paverTex, sandTex } from './textures'

// Recreation from the third wave of buildings (mini golf, pool, funfair, water park, courts).
// Lots face +z (the front door side), like the rest of the town. Every piece is a
// plain static mesh in the town's shared colours so Batch merges them.
//
// Merged forms: kerbs, rails and pool copings are each one framed mesh (a rect with
// a hole), so they stretch with a pair and grow with a block as a whole instead of
// being taken for props. Rides and towers sit in one <Upright> each.

export const REC_MODELS = new Set(['minigolf', 'pool', 'funfair', 'waterpark', 'court', 'tennis'])

type K = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean }
const TAU = Math.PI * 2
const STRETCH = { stretch: true }
const WHITE = '#fafafa'
const STEEL = '#90a4ae'
const DARK = '#263238'

// ---------- shared pieces ----------

// Pool water: bright aqua with a web of light ripples, tiled per use.
let waterCanvas: CanvasTexture | null = null
const waterMaps = new Map<string, Texture>()
function poolTex(rx: number, ry: number) {
  const key = `${rx}|${ry}`
  const hit = waterMaps.get(key)
  if (hit) return hit
  if (!waterCanvas) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#3fc1ec'
    g.fillRect(0, 0, 128, 128)
    let seed = 4271
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    g.globalAlpha = 0.25
    g.fillStyle = '#7fdcf7'
    for (let i = 0; i < 8; i++) g.fillRect(r() * 128, r() * 128, 30 + r() * 30, 12 + r() * 14)
    g.globalAlpha = 0.6
    g.strokeStyle = '#d4f6ff'
    g.lineWidth = 2
    for (let i = 0; i < 34; i++) {
      const x = r() * 128, y = r() * 128, w = 10 + r() * 16
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + w / 2, y - 4 + r() * 8, x + w, y + r() * 4 - 2)
      g.stroke()
    }
    g.globalAlpha = 1
    waterCanvas = new CanvasTexture(c)
    waterCanvas.colorSpace = SRGBColorSpace
    waterCanvas.wrapS = waterCanvas.wrapT = RepeatWrapping
  }
  const t = waterCanvas.clone()
  t.repeat.set(rx, ry)
  t.needsUpdate = true
  waterMaps.set(key, t)
  return t
}

// A flat sheet facing up (paint, water, a mat).
function Flat({ m, at, s, c, t, rot = 0 }: { m: Mat; at: V3; s: [number, number]; c: string; t?: Texture; rot?: number }) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, rot]} receiveShadow>
      <planeGeometry args={s} />
      {m(c, t)}
    </mesh>
  )
}

// Water filling a basin, `y` up, from x0..x1 and z0..z1.
function Water({ m, x0, x1, z0, z1, y }: { m: Mat; x0: number; x1: number; z0: number; z1: number; y: number }) {
  const w = x1 - x0, d = z1 - z0
  return <Flat m={m} at={[(x0 + x1) / 2, y, (z0 + z1) / 2]} s={[w, d]} c="#ffffff" t={poolTex(Math.max(1, Math.round(w)), Math.max(1, Math.round(d)))} />
}

// A rectangular kerb (pool coping, a lane's bumper rail, a pond edge) as one mesh:
// the rect x0..x1, z0..z1 with a hole `t` in from each side, from y0 up `h`.
const frames = new Map<string, ExtrudeGeometry>()
function frameGeo(w: number, d: number, t: number, h: number) {
  const key = [w, d, t, h].map((v) => v.toFixed(3)).join()
  const hit = frames.get(key)
  if (hit) return hit
  const s = new Shape()
  s.moveTo(-w / 2, -d / 2).lineTo(w / 2, -d / 2).lineTo(w / 2, d / 2).lineTo(-w / 2, d / 2).lineTo(-w / 2, -d / 2)
  const hole = new Path()
  hole.moveTo(-w / 2 + t, -d / 2 + t).lineTo(-w / 2 + t, d / 2 - t).lineTo(w / 2 - t, d / 2 - t).lineTo(w / 2 - t, -d / 2 + t).lineTo(-w / 2 + t, -d / 2 + t)
  s.holes.push(hole)
  const g = new ExtrudeGeometry(s, { depth: h, bevelEnabled: false })
  // Extruded along +z; stood up so it rises along +y.
  g.rotateX(-Math.PI / 2)
  frames.set(key, g)
  return g
}
function Frame({ m, x0, x1, z0, z1, t, y0, h, c, tex }: { m: Mat; x0: number; x1: number; z0: number; z1: number; t: number; y0: number; h: number; c: string; tex?: Texture }) {
  return (
    <mesh position={[(x0 + x1) / 2, y0, (z0 + z1) / 2]} geometry={frameGeo(x1 - x0, z1 - z0, t, h)} castShadow receiveShadow dispose={null}>
      {m(c, tex)}
    </mesh>
  )
}

// A bent tube (a water slide), cached by its points.
const tubes = new Map<string, TubeGeometry>()
function Tube({ m, pts, r, c }: { m: Mat; pts: V3[]; r: number; c: string }) {
  const key = `${r}|${pts.flat().map((v) => v.toFixed(2)).join()}`
  let g = tubes.get(key)
  if (!g) {
    g = new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), pts.length * 8, r, 8, false)
    tubes.set(key, g)
  }
  return (
    <mesh geometry={g} castShadow dispose={null}>
      {m(c)}
    </mesh>
  )
}

// A sun lounger, long along x, head end at -x.
function Lounger({ m, at, c, rot = 0 }: { m: Mat; at: V3; c: string; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      {[-0.17, 0.17].map((x) => <Box key={x} m={m} at={[x, 0.04, 0]} s={[0.03, 0.08, 0.16]} c={WHITE} shadow={false} />)}
      <Box m={m} at={[0.06, 0.095, 0]} s={[0.32, 0.03, 0.17]} c={WHITE} />
      <Box m={m} at={[0.07, 0.115, 0]} s={[0.28, 0.012, 0.15]} c={c} shadow={false} />
      <Box m={m} at={[-0.15, 0.15, 0]} rot={[0, 0, -0.75]} s={[0.17, 0.025, 0.17]} c={c} />
    </group>
  )
}

// A beach umbrella with striped canopy.
function Brolly({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <group position={at} userData={PEOPLE_SIZED}>
      <Cyl m={m} at={[0, 0.015, 0]} r={0.06} h={0.03} c="#eceff1" seg={8} />
      <Cyl m={m} at={[0, 0.3, 0]} r={0.012} h={0.57} c="#eceff1" seg={6} />
      <mesh position={[0, 0.6, 0]} castShadow>
        <coneGeometry args={[0.3, 0.14, 8]} />
        {m('#ffffff', awningTex(c))}
      </mesh>
    </group>
  )
}

// A palm tree, leaning a little.
function Palm({ m, at, s = 1, lean = 0.12 }: { m: Mat; at: V3; s?: number; lean?: number }) {
  const top: V3 = [lean * 0.9, 0.82, 0]
  return (
    <group position={at} scale={s}>
      {[0, 1, 2].map((i) => (
        <Cyl key={i} m={m} at={[lean * 0.3 * i, 0.14 + i * 0.27, 0]} r={0.035 - i * 0.004} r2={0.045 - i * 0.004} h={0.3} c={i % 2 ? '#8d6e63' : '#a1887f'} seg={6} rot={[0, 0, -lean * 0.4]} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} position={top} rotation-y={(i / 6) * TAU}>
          <Box m={m} at={[0.17, -0.03, 0]} rot={[0, 0, -0.35]} s={[0.36, 0.02, 0.1]} c={PAL.fronds[i % 2]} />
        </group>
      ))}
      <mesh position={[top[0], top[1] - 0.04, 0]}><sphereGeometry args={[0.045, 6, 5]} />{m('#6d4c41')}</mesh>
    </group>
  )
}

// Lifeguard chair: a tall white seat on splayed legs, a red cross on the back.
function GuardChair({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot} userData={PEOPLE_SIZED}>
      {[[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].map(([x, z]) => (
        <Box key={`${x}${z}`} m={m} at={[x, 0.24, z]} s={[0.03, 0.48, 0.03]} c={WHITE} />
      ))}
      {[0.12, 0.26].map((y) => <Box key={y} m={m} at={[0, y, 0.1]} s={[0.2, 0.025, 0.025]} c={WHITE} shadow={false} />)}
      <Box m={m} at={[0, 0.49, 0]} s={[0.26, 0.03, 0.24]} c={WHITE} />
      <Box m={m} at={[0, 0.62, -0.11]} s={[0.26, 0.24, 0.025]} c={WHITE} />
      <Box m={m} at={[0, 0.63, -0.096]} s={[0.1, 0.03, 0.006]} c="#e53935" shadow={false} />
      <Box m={m} at={[0, 0.63, -0.096]} s={[0.03, 0.1, 0.007]} c="#e53935" shadow={false} />
      <Cyl m={m} at={[0.11, 0.78, -0.1]} r={0.01} h={0.32} c="#eceff1" seg={5} />
      <mesh position={[0.11, 0.95, -0.1]} castShadow><coneGeometry args={[0.2, 0.09, 8]} />{m('#ffffff', awningTex('#e53935'))}</mesh>
    </group>
  )
}

// A swim ring floating on the water.
function Ring({ m, at, c }: { m: Mat; at: V3; c: string }) {
  return (
    <mesh position={at} rotation-x={-Math.PI / 2}>
      <torusGeometry args={[0.06, 0.022, 6, 12]} />
      {m(c)}
    </mesh>
  )
}

// A low clipped hedge in a planter box.
function Planter({ m, at, w, d = 0.18 }: { m: Mat; at: V3; w: number; d?: number }) {
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.06, 0]} s={[w, 0.12, d]} c="#a1887f" />
      <Box m={m} at={[0, 0.17, 0]} s={[w - 0.04, 0.12, d - 0.04]} c={PAL.bush[0]} />
    </group>
  )
}

// ---------- Putt Putt Cove (mini golf) ----------

const FELT = '#2e9e4a'
const RAIL = '#a1544a'
const FELT_TOP = 0.09

// A fairway: felt on the course, ringed by a bumper rail that stands a little proud.
function Lane({ m, x0, x1, z0, z1 }: { m: Mat; x0: number; x1: number; z0: number; z1: number }) {
  return (
    <group>
      <Box m={m} at={[(x0 + x1) / 2, (0.05 + FELT_TOP) / 2, (z0 + z1) / 2]} s={[x1 - x0, FELT_TOP - 0.05, z1 - z0]} c={FELT} shadow={false} />
      <Frame m={m} x0={x0 - 0.04} x1={x1 + 0.04} z0={z0 - 0.04} z1={z1 + 0.04} t={0.04} y0={0.05} h={0.065} c={RAIL} />
    </group>
  )
}

// The cup with its flag; the tee mat at the other end.
function Hole({ m, at, c }: { m: Mat; at: [number, number]; c: string }) {
  return (
    <group>
      <mesh position={[at[0], FELT_TOP + 0.004, at[1]]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.035, 10]} />{m('#1b1b1b')}</mesh>
      <group position={[at[0], FELT_TOP, at[1]]}>
        <Cyl m={m} at={[0, 0.2, 0]} r={0.008} h={0.4} c={WHITE} seg={5} />
        <Box m={m} at={[0.06, 0.35, 0]} s={[0.12, 0.08, 0.008]} c={c} shadow={false} />
      </group>
    </group>
  )
}
function Tee({ m, at, rot = 0 }: { m: Mat; at: [number, number]; rot?: number }) {
  return <Flat m={m} at={[at[0], FELT_TOP + 0.004, at[1]]} s={[0.16, 0.12]} c="#1b5e20" rot={rot} />
}

function Windmill({ m, bulb }: { m: Mat; bulb: ReactNode }) {
  return (
    <Upright>
      {/* Base with the tunnel the ball rolls through (along z). */}
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.2, 0.11, 0]} s={[0.08, 0.22, 0.36]} c="#bcaaa4" />)}
      <Box m={m} at={[0, 0.25, 0]} s={[0.5, 0.08, 0.38]} c="#bcaaa4" />
      <Cyl m={m} at={[0, 0.52, 0]} r={0.14} r2={0.2} h={0.46} c={WHITE} seg={8} />
      <mesh position={[0, 0.86, 0]} castShadow><coneGeometry args={[0.18, 0.24, 8]} />{m('#d84315')}</mesh>
      <mesh position={[0, 0.5, 0.18]}><planeGeometry args={[0.1, 0.12]} />{bulb}</mesh>
      {/* Sails on the front, stopped at a jaunty angle. */}
      <group position={[0, 0.66, 0.2]} rotation-z={0.35}>
        <Cyl m={m} at={[0, 0, 0]} r={0.035} h={0.06} c={DARK} seg={8} rot={[Math.PI / 2, 0, 0]} />
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-z={(i * Math.PI) / 2}>
            <Box m={m} at={[0, 0.2, 0.03]} s={[0.02, 0.38, 0.015]} c="#6d4c41" shadow={false} />
            <Box m={m} at={[0.05, 0.22, 0.03]} s={[0.08, 0.3, 0.008]} c="#fff8e1" />
          </group>
        ))}
      </group>
    </Upright>
  )
}

function Lighthouse({ m, bulb }: { m: Mat; bulb: ReactNode }) {
  return (
    <Upright>
      {[[-0.1, 0.06, 0.12], [0.12, -0.05, 0.1], [0.02, 0.13, 0.08]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, r * 0.6, z]} castShadow><dodecahedronGeometry args={[r, 0]} />{m('#90a4ae')}</mesh>
      ))}
      <Cyl m={m} at={[0, 0.4, 0]} r={0.08} r2={0.12} h={0.7} c={WHITE} seg={10} />
      {[0.2, 0.44].map((y) => <Cyl key={y} m={m} at={[0, y, 0]} r={0.11 - y * 0.06} r2={0.115 - y * 0.06} h={0.1} c="#e53935" seg={10} />)}
      <Cyl m={m} at={[0, 0.77, 0]} r={0.12} h={0.03} c={DARK} seg={10} />
      <mesh position={[0, 0.84, 0]}><cylinderGeometry args={[0.06, 0.06, 0.11, 8]} />{bulb}</mesh>
      <mesh position={[0, 0.95, 0]} castShadow><coneGeometry args={[0.09, 0.12, 8]} />{m('#e53935')}</mesh>
    </Upright>
  )
}

function PirateShip({ m }: { m: Mat }) {
  return (
    <Upright>
      <Box m={m} at={[0, 0.1, 0]} s={[0.5, 0.14, 0.2]} c="#5d4037" />
      <mesh position={[0.3, 0.1, 0]} rotation-y={Math.PI / 2} castShadow><cylinderGeometry args={[0.115, 0.115, 0.14, 3]} />{m('#5d4037')}</mesh>
      <Box m={m} at={[-0.2, 0.22, 0]} s={[0.14, 0.1, 0.2]} c="#4e342e" />
      <Box m={m} at={[0, 0.172, 0]} s={[0.5, 0.012, 0.21]} c={GOLD} shadow={false} />
      <Cyl m={m} at={[0.04, 0.5, 0]} r={0.015} h={0.72} c="#3e2723" seg={6} />
      {[[0.38, 0.3], [0.62, 0.22]].map(([y, w]) => <Box key={y} m={m} at={[0.04, y, 0.02]} s={[0.012, 0.2, w]} c="#fff8e1" />)}
      <Box m={m} at={[0.04, 0.82, 0.06]} s={[0.01, 0.07, 0.11]} c="#212121" shadow={false} />
      <mesh position={[0.046, 0.82, 0.06]} rotation-y={Math.PI / 2}><circleGeometry args={[0.018, 8]} />{m(WHITE)}</mesh>
      {[-0.08, 0.08].map((x) => <Cyl key={x} m={m} at={[x, 0.1, 0.11]} r={0.02} h={0.06} c="#212121" seg={6} rot={[Math.PI / 2, 0, 0]} />)}
    </Upright>
  )
}

// A rock mountain with a cave the back lane runs into and a waterfall into the lagoon.
function Mountain({ m }: { m: Mat }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} scale={[1, 1, 0.62]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.5, 0.9, 7]} />
        {m('#8d6e63')}
      </mesh>
      <mesh position={[0.12, 0.42, 0.03]} scale={[1, 1, 0.6]} castShadow>
        <cylinderGeometry args={[0.1, 0.34, 0.74, 6]} />
        {m('#a1887f')}
      </mesh>
      <mesh position={[0, 1.0, 0]} scale={[1, 1, 0.62]} castShadow><coneGeometry args={[0.14, 0.14, 7]} />{m(SNOW ? '#f4f8fb' : '#6d4c41')}</mesh>
      {/* The waterfall down the front face into the lagoon: laid on the face left of the
          front ridge (in the rock's unsquashed frame, so it stays flat on it). */}
      <group scale={[1, 1, 0.62]}>
        <group rotation-y={-Math.PI / 7}>
          <Box m={m} at={[0, 0.46, 0.321]} rot={[-0.346, 0, 0]} s={[0.12, 0.72, 0.03]} c="#81d4fa" />
        </group>
      </group>
    </group>
  )
}

function MiniGolf({ k, def, lvl }: { k: K; def: BuildingDef; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const h = 0.95 + levelLift(lvl) * 0.5
  const flags = ['#e53935', '#fdd835', '#1e88e5', '#8e24aa']
  return (
    <group>
      <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={1.2} d={0.95} h0={0.95} x0={-1.32} z0={-0.45} wall="#fff3e0" tex="siding" roof={def.roof} sign={def.sign} signFg="#2e7d32" shopfront={def.roof} grow={0.5}>
        {/* A giant golf ball on its tee, on the clubhouse roof. */}
        <group position={[0.24, h + 0.13, -0.66]}>
          <Cyl m={m} at={[0, 0.02, 0]} r={0.16} h={0.04} c={STEEL} seg={10} />
          <Cyl m={m} at={[0, 0.12, 0]} r={0.09} r2={0.025} h={0.16} c="#ff7043" seg={10} />
          <mesh position={[0, 0.42, 0]} castShadow><sphereGeometry args={[0.26, 16, 12]} />{m('#ffffff')}</mesh>
          {[[0.1, 0.5, 0.21], [-0.12, 0.38, 0.21], [0.2, 0.3, 0.13], [0, 0.6, 0.19], [-0.2, 0.55, 0.1]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}><sphereGeometry args={[0.035, 6, 5]} />{m('#e0e0e0')}</mesh>
          ))}
        </group>
      </ShellBuilding>
      {/* Paved patio in front of the clubhouse, the course beside it. */}
      <Box m={m} at={[-1.31, 0.027, 0.57]} s={[1.26, 0.046, 1.06]} c="#ffffff" t={paverTex(2, 2)} shadow={false} />
      <Box m={m} at={[0.65, 0.027, 0.075]} s={[2.6, 0.046, 2.05]} c="#ffffff" t={grassTex(2, 2)} shadow={false} />
      {/* Hole 1 down the right side, through the windmill. */}
      <Lane m={m} x0={1.4} x1={1.84} z0={-0.86} z1={1.0} />
      <Tee m={m} at={[1.62, 0.9]} />
      <Hole m={m} at={[1.62, -0.74]} c={flags[0]} />
      <group position={[1.62, FELT_TOP, 0.05]}><Windmill m={m} bulb={bulb} /></group>
      {/* Hole 2 along the front, round two bumpers. */}
      <Lane m={m} x0={-0.48} x1={1.18} z0={0.62} z1={1.0} />
      <Tee m={m} at={[1.06, 0.81]} />
      <Hole m={m} at={[-0.36, 0.81]} c={flags[1]} />
      {[[0.55, 0.72], [0.2, 0.9]].map(([x, z]) => <Cyl key={x} m={m} at={[x, FELT_TOP + 0.03, z]} r={0.05} h={0.06} c="#ffca28" seg={10} />)}
      {/* Hole 3 along the back; at Adventure Golf it runs into the mountain's cave. */}
      <Lane m={m} x0={-0.48} x1={1.18} z0={-0.88} z1={-0.52} />
      <Tee m={m} at={[1.06, -0.7]} />
      <Hole m={m} at={[-0.36, -0.7]} c={flags[2]} />
      {st < 3 && <Box m={m} at={[0.4, FELT_TOP + 0.03, -0.7]} rot={[0, 0, 0]} s={[0.24, 0.06, 0.34]} c="#ffca28" />}
      {/* The lagoon in the middle, with the lighthouse on its island. */}
      <Frame m={m} x0={-0.5} x1={1.2} z0={-0.42} z1={0.5} t={0.06} y0={0.05} h={0.07} c="#b0bec5" />
      <Water m={m} x0={-0.44} x1={1.14} z0={-0.36} z1={0.44} y={0.066} />
      <group position={[-0.18, 0.05, 0.02]}><Lighthouse m={m} bulb={bulb} /></group>
      {st >= 2 && <group position={[0.62, 0.05, 0.08]} rotation-y={-0.3}><PirateShip m={m} /></group>}
      {st >= 3 && <group position={[0.62, 0.05, -0.62]}><Mountain m={m} /></group>}
      {st >= 3 && <Hole m={m} at={[0.95, 0.2]} c={flags[3]} />}
      {/* Patio: a putter rack, the ball dispenser, a bench and the lamps. */}
      {!ghost && (
        <group>
          <group position={[-0.85, 0.05, 0.4]}>
            <Box m={m} at={[0, 0.2, 0]} s={[0.04, 0.4, 0.3]} c="#6d4c41" />
            {[-0.1, -0.03, 0.04, 0.11].map((z, i) => <Cyl key={z} m={m} at={[0.03, 0.2, z]} r={0.008} h={0.36} c={flags[i]} seg={5} />)}
          </group>
          <group position={[-1.8, 0.05, 0.3]}>
            <Box m={m} at={[0, 0.16, 0]} s={[0.16, 0.32, 0.16]} c="#ff7043" />
            <mesh position={[0, 0.38, 0]}><sphereGeometry args={[0.09, 10, 8]} />{m('#e1f5fe')}</mesh>
          </group>
          <Bench m={m} at={[-1.75, 0.05, 0.85]} rot={Math.PI / 2} />
          <Lamp m={m} bulb={bulb} at={[-0.72, 0.05, 1.02]} ghost={ghost} />
          <Glow r={0.5} x={-0.18} z={0.02} y={0.072} />
          <Glow r={0.4} x={1.62} z={0.3} y={0.096} />
          <Lamp m={m} bulb={bulb} at={[1.9, 0.05, -0.92]} ghost={ghost} />
          {st >= 2 && <Bulbs from={[-0.6, 1.0, 0.56]} to={[1.3, 1.0, 0.56]} n={11} posts={0.95} sag={0.06} />}
          {st >= 2 && <Lamp m={m} bulb={bulb} at={[1.28, 0.05, -0.45]} ghost={ghost} />}
          {st >= 3 && <Palm m={m} at={[-0.58, 0.05, -0.2]} />}
          {/* In the gap between the front and side lanes, its fronds clear of the windmill's sails. */}
          {st >= 3 && <Palm m={m} at={[1.29, 0.05, 0.9]} s={0.9} lean={-0.12} />}
        </group>
      )}
    </group>
  )
}

// ---------- Splash Pool ----------

function Pool({ k, def, lvl }: { k: K; def: BuildingDef; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const h = 1.0 + levelLift(lvl) * 0.5
  // The basin: water from x0..x1, z0..z1, deck all round it.
  const x0 = -0.62, x1 = 1.62, z0 = st >= 2 ? -0.48 : -0.62, z1 = 0.46
  const lanes = st >= 3 ? 6 : 4
  const lw = (z1 - z0) / lanes
  const ropes = Array.from({ length: lanes - 1 }, (_, i) => z0 + lw * (i + 1))
  return (
    <group>
      <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={1.0} d={1.5} h0={1.0} x0={-1.42} z0={-0.15} wall={def.color} roof={def.roof} sign={def.sign} signFg="#0277bd" shopfront={def.roof} grow={0.5}>
        {/* A giant striped swim ring on the changing-room roof. */}
        <group position={[0.05, h + 0.13, -0.5]}>
          <Cyl m={m} at={[0, 0.02, 0]} r={0.14} h={0.04} c={STEEL} seg={10} />
          <mesh position={[0, 0.27, 0]} rotation-x={-0.25} castShadow>
            <torusGeometry args={[0.24, 0.1, 10, 20]} />
            {m('#ffffff', awningTex('#e53935'))}
          </mesh>
        </group>
      </ShellBuilding>
      {/* Deck round the basin, then the coping and the water. */}
      <Box m={m} at={[0.52, 0.027, -0.94 + (z0 + 0.94) / 2]} s={[2.84, 0.046, z0 + 0.94]} c="#ffffff" t={concreteTex(3, 1)} shadow={false} />
      <Box m={m} at={[0.52, 0.027, (z1 + 1.08) / 2]} s={[2.84, 0.046, 1.08 - z1]} c="#ffffff" t={concreteTex(3, 1)} shadow={false} />
      <Box m={m} at={[(-0.9 + x0) / 2, 0.027, (z0 + z1) / 2]} s={[x0 + 0.9, 0.046, z1 - z0]} c="#ffffff" t={concreteTex(1, 1)} shadow={false} />
      <Box m={m} at={[(x1 + 1.94) / 2, 0.027, (z0 + z1) / 2]} s={[1.94 - x1, 0.046, z1 - z0]} c="#ffffff" t={concreteTex(1, 1)} shadow={false} />
      <Water m={m} x0={x0} x1={x1} z0={z0} z1={z1} y={0.03} />
      <Frame m={m} x0={x0 - 0.05} x1={x1 + 0.05} z0={z0 - 0.05} z1={z1 + 0.05} t={0.07} y0={0.05} h={0.035} c={WHITE} />
      {/* Lane lines on the floor and floating lane ropes. */}
      {ropes.map((z) => <Flat key={`l${z}`} m={m} at={[(x0 + x1) / 2, 0.034, z - lw / 2]} s={[x1 - x0 - 0.3, 0.035]} c="#0277bd" />)}
      <Flat m={m} at={[(x0 + x1) / 2, 0.034, z1 - lw / 2]} s={[x1 - x0 - 0.3, 0.035]} c="#0277bd" />
      {ropes.map((z, i) => (
        <mesh key={z} position={[(x0 + x1) / 2, 0.04, z]} rotation-z={Math.PI / 2} userData={STRETCH}>
          <cylinderGeometry args={[0.014, 0.014, x1 - x0, 6]} />
          {m(i % 2 ? '#fdd835' : '#e53935')}
        </mesh>
      ))}
      {/* Ladders at the shallow end. */}
      {[z0 + 0.12, z1 - 0.12].map((z) => (
        <group key={z} position={[x0 + 0.02, 0.085, z]}>
          {[-0.05, 0.05].map((dz) => (
            <mesh key={dz} position={[0, 0.06, dz]} rotation-z={Math.PI / 2}>
              <torusGeometry args={[0.07, 0.01, 5, 10, Math.PI]} />
              {m('#cfd8dc')}
            </mesh>
          ))}
        </group>
      ))}
      {/* The deep end: a diving board, then a tower at the Olympic Pool. */}
      {st < 3 ? (
        <group position={[1.82, 0.05, -0.1]}>
          <Box m={m} at={[0, 0.07, 0]} s={[0.16, 0.14, 0.16]} c={STEEL} />
          <Box m={m} at={[-0.24, 0.155, 0]} s={[0.6, 0.03, 0.12]} c="#1e88e5" />
          {[-0.08, 0.08].map((z) => <Box key={z} m={m} at={[0.06, 0.24, z]} s={[0.02, 0.18, 0.02]} c="#cfd8dc" />)}
        </group>
      ) : (
        <group position={[1.8, 0.05, -0.05]}>
          <Upright>
            {[[-0.08, -0.14], [0.08, -0.14], [-0.08, 0.14], [0.08, 0.14]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.7, z]} s={[0.05, 1.4, 0.05]} c={WHITE} />)}
            {[0.45, 0.9, 1.35].map((y, i) => <Box key={y} m={m} at={[-0.12 - i * 0.06, y, 0]} s={[0.4 + i * 0.12, 0.04, 0.34]} c="#1e88e5" />)}
            {[0.2, 0.65, 1.1].map((y) => <Box key={y} m={m} at={[0.11, y, 0]} s={[0.012, 0.012, 0.3]} c="#cfd8dc" shadow={false} />)}
          </Upright>
        </group>
      )}
      {st >= 2 && (
        <group position={[-0.76, 0.05, -0.74]}>
          <Upright>
            {[[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.25, z]} s={[0.03, 0.5, 0.03]} c={WHITE} />)}
            <Box m={m} at={[0, 0.5, 0]} s={[0.24, 0.04, 0.24]} c="#ffca28" />
            {[0.12, 0.24, 0.36].map((y) => <Box key={y} m={m} at={[-0.1, y, 0]} s={[0.012, 0.012, 0.18]} c="#cfd8dc" shadow={false} />)}
            <Tube m={m} pts={[[0.04, 0.58, 0.1], [0.22, 0.42, 0.22], [0.14, 0.28, 0.46], [0.3, 0.12, 0.62], [0.36, 0.0, 0.7]]} r={0.06} c="#ff7043" />
          </Upright>
        </group>
      )}
      {st >= 3 && Array.from({ length: lanes }, (_, i) => (
        <Box key={i} m={m} at={[x0 - 0.12, 0.11, z0 + lw * (i + 0.5)]} s={[0.12, 0.12, 0.1]} c={i % 2 ? '#1e88e5' : WHITE} />
      ))}
      {/* Bleachers along the back from the Aquatic Center on. */}
      {st >= 2 && (
        <group position={[0.5, 0.05, -0.76]}>
          {[0, 1, 2].map((r) => <Box key={r} m={m} at={[0, 0.06 + r * 0.06, -r * 0.06]} s={[1.9 - r * 0.08, 0.12 + r * 0.12, 0.08]} c={WHITE} />)}
          {[0, 1, 2].map((r) => <Box key={`s${r}`} m={m} at={[0, 0.135 + r * 0.12, 0.01 - r * 0.06]} s={[1.84 - r * 0.08, 0.03, 0.05]} c={r % 2 ? '#0288d1' : '#29b6f6'} shadow={false} />)}
        </group>
      )}
      {st >= 3 && (
        <group position={[1.62, 0.05, -0.85]}>
          {[-0.2, 0.2].map((x) => <Box key={x} m={m} at={[x, 0.45, 0]} s={[0.04, 0.9, 0.04]} c={DARK} />)}
          <Box m={m} at={[0, 0.82, 0.035]} s={[0.56, 0.26, 0.06]} c="#212121" />
          {[-0.15, 0, 0.15].map((x) => <Neon key={x} at={[x, 0.82, 0.07]} s={[0.1, 0.13, 0.008]} c="#ffca28" />)}
        </group>
      )}
      {!ghost && (
        <group>
          {[[-0.2, '#ffca28'], [0.55, '#4fc3f7'], [1.3, '#ef5350']].map(([x, c]) => <Lounger key={x as number} m={m} at={[x as number, 0.05, 0.86]} c={c as string} rot={Math.PI / 2} />)}
          {[0.17, 0.92].map((x) => <Brolly key={x} m={m} at={[x, 0.05, 0.84]} c={x < 0.5 ? '#0288d1' : '#ff7043'} />)}
          <GuardChair m={m} at={[1.66, 0.05, 0.74]} rot={-Math.PI / 2} />
          {[[0.1, 0.3, '#ff7043'], [0.9, -0.1, '#fdd835'], [1.3, 0.25, '#e91e63']].map(([x, z, c]) => <Ring key={x as number} m={m} at={[x as number, 0.042, z as number]} c={c as string} />)}
          <Planter m={m} at={[-0.25, 0.05, 1.02]} w={0.3} d={0.1} />
          {[0.15, 1.1].map((x) => <Glow key={x} r={0.45} x={x} z={(z0 + z1) / 2} y={0.052} />)}
          <Lamp m={m} bulb={bulb} at={[-0.8, 0.05, 1.0]} ghost={ghost} />
          <Lamp m={m} bulb={bulb} at={[1.9, 0.05, 1.02]} ghost={ghost} />
          {st >= 2 && <Bulbs from={[-0.85, 0.95, 0.56]} to={[1.9, 0.95, 0.56]} n={13} posts={0.9} sag={0.06} />}
        </group>
      )}
    </group>
  )
}

// ---------- Twirl Town Fair ----------

const RIDE_COLORS = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#8e24aa', '#ff7043']

function FerrisWheel({ m, bulb, R, c }: { m: Mat; bulb: ReactNode; R: number; c: string }) {
  const H = R + 0.32
  const N = 8
  const leg = Math.hypot(R * 0.55, H)
  const tilt = Math.atan2(R * 0.55, H)
  return (
    <Upright>
      <Box m={m} at={[0, 0.04, 0]} s={[R * 1.3, 0.08, 0.6]} c="#1565c0" />
      {[-1, 1].map((z) => [-1, 1].map((x) => (
        <Box key={`${x}${z}`} m={m} at={[(x * R * 0.55) / 2, 0.08 + H / 2 - 0.04, z * 0.2]} rot={[0, 0, x * tilt]} s={[0.06, leg, 0.06]} c={WHITE} />
      )))}
      <Cyl m={m} at={[0, H, 0]} r={0.04} h={0.48} c={STEEL} seg={8} rot={[Math.PI / 2, 0, 0]} />
      <Cyl m={m} at={[0, H, 0]} r={0.11} h={0.3} c={GOLD} seg={10} rot={[Math.PI / 2, 0, 0]} />
      <group position={[0, H, 0]}>
        {[-0.12, 0.12].map((z) => (
          <group key={z} position-z={z}>
            <mesh><torusGeometry args={[R, 0.028, 6, 36]} />{m(c)}</mesh>
            <mesh><torusGeometry args={[R * 0.5, 0.02, 6, 24]} />{m(WHITE)}</mesh>
            {[0, 1, 2, 3].map((i) => <Box key={i} m={m} at={[0, 0, 0]} rot={[0, 0, (i / N) * TAU]} s={[0.025, R * 2, 0.025]} c={WHITE} shadow={false} />)}
          </group>
        ))}
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * TAU
          return <mesh key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0.14]}><sphereGeometry args={[0.035, 6, 5]} />{bulb}</mesh>
        })}
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * TAU + Math.PI / N
          return (
            <group key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
              <Cyl m={m} at={[0, 0, 0]} r={0.015} h={0.3} c={STEEL} seg={5} rot={[Math.PI / 2, 0, 0]} />
              <Box m={m} at={[0, -0.07, 0]} s={[0.02, 0.14, 0.02]} c={STEEL} shadow={false} />
              <Box m={m} at={[0, -0.2, 0]} s={[0.2, 0.14, 0.18]} c={RIDE_COLORS[i % RIDE_COLORS.length]} />
              <Box m={m} at={[0, -0.12, 0]} s={[0.24, 0.025, 0.22]} c={WHITE} />
            </group>
          )
        })}
      </group>
    </Upright>
  )
}

function Carousel({ m, bulb, c }: { m: Mat; bulb: ReactNode; c: string }) {
  const N = 8
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.06, 0]} r={0.74} h={0.12} c="#d7ccc8" seg={20} />
      <Cyl m={m} at={[0, 0.13, 0]} r={0.68} h={0.02} c="#8d6e63" seg={20} />
      <Cyl m={m} at={[0, 0.57, 0]} r={0.13} h={0.86} c={GOLD} seg={10} />
      <Cyl m={m} at={[0, 0.97, 0]} r={0.8} h={0.1} c={WHITE} seg={20} />
      <mesh position={[0, 1.2, 0]} castShadow><coneGeometry args={[0.84, 0.36, 16]} />{m('#ffffff', awningTex(c))}</mesh>
      <mesh position={[0, 1.42, 0]}><sphereGeometry args={[0.06, 8, 6]} />{m(GOLD)}</mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * TAU
        return <mesh key={i} position={[Math.cos(a) * 0.8, 0.97, Math.sin(a) * 0.8]}><sphereGeometry args={[0.035, 6, 5]} />{bulb}</mesh>
      })}
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * TAU
        const y = 0.42 + (i % 2) * 0.1
        return (
          <group key={i} position={[Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5]} rotation-y={-a}>
            <Cyl m={m} at={[0, 0.58, 0]} r={0.012} h={0.84} c={GOLD} seg={5} />
            <Box m={m} at={[0, y, 0]} s={[0.06, 0.08, 0.2]} c={i % 3 ? WHITE : '#6d4c41'} />
            <Box m={m} at={[0, y + 0.07, 0.1]} rot={[-0.5, 0, 0]} s={[0.05, 0.1, 0.06]} c={i % 3 ? WHITE : '#6d4c41'} />
            <Box m={m} at={[0, y + 0.045, -0.01]} s={[0.065, 0.015, 0.08]} c={RIDE_COLORS[i % RIDE_COLORS.length]} shadow={false} />
            {[-0.07, 0.07].map((z) => <Box key={z} m={m} at={[0, y - 0.08, z]} s={[0.03, 0.1, 0.025]} c={i % 3 ? WHITE : '#6d4c41'} shadow={false} />)}
          </group>
        )
      })}
    </Upright>
  )
}

// A game stall with a striped awning, prizes on the back wall. Faces +z.
function Stall({ m, bulb, c, prize }: { m: Mat; bulb: ReactNode; c: string; prize: string }) {
  return (
    <group>
      <Box m={m} at={[0, 0.39, -0.2]} s={[0.58, 0.78, 0.04]} c="#fff8e1" />
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.31, 0.4, -0.04]} s={[0.04, 0.8, 0.32]} c={c} />)}
      <Box m={m} at={[0, 0.17, 0.1]} s={[0.66, 0.34, 0.08]} c={c} />
      <Box m={m} at={[0, 0.35, 0.1]} s={[0.7, 0.025, 0.12]} c={WHITE} />
      <Box m={m} at={[0, 0.86, 0.02]} rot={[0.3, 0, 0]} s={[0.74, 0.03, 0.5]} c="#ffffff" t={awningTex(c)} />
      {[[-0.18, '#f48fb1'], [0, '#81d4fa'], [0.18, '#fff176']].map(([x, pc]) => (
        <mesh key={x as number} position={[x as number, 0.58, -0.15]}><sphereGeometry args={[0.06, 8, 6]} />{m(pc as string)}</mesh>
      ))}
      {[-0.12, 0, 0.12].map((x) => <Cyl key={x} m={m} at={[x, 0.39, 0.1]} r={0.025} r2={0.03} h={0.06} c={prize} seg={6} />)}
      <mesh position={[0, 0.75, 0.0]}><boxGeometry args={[0.5, 0.03, 0.03]} />{bulb}</mesh>
    </group>
  )
}

// Swing ride: chairs flung out on chains from a spinning top.
function SwingRide({ m, bulb, c }: { m: Mat; bulb: ReactNode; c: string }) {
  const N = 10
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.05, 0]} r={0.42} h={0.1} c="#d7ccc8" seg={16} />
      <Cyl m={m} at={[0, 0.85, 0]} r={0.07} r2={0.1} h={1.5} c={WHITE} seg={10} />
      <mesh position={[0, 1.66, 0]} rotation-z={0.08} castShadow><coneGeometry args={[0.55, 0.26, 16]} />{m('#ffffff', awningTex(c))}</mesh>
      <mesh position={[0, 1.53, 0]} rotation-z={0.08}><cylinderGeometry args={[0.55, 0.55, 0.06, 16]} />{m(c)}</mesh>
      <mesh position={[0, 1.82, 0]}><sphereGeometry args={[0.05, 8, 6]} />{bulb}</mesh>
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * TAU
        return (
          <group key={i} position={[Math.cos(a) * 0.5, 1.5, Math.sin(a) * 0.5]} rotation-y={-a}>
            <Box m={m} at={[0.12, -0.25, 0]} rot={[0, 0, 0.5]} s={[0.008, 0.56, 0.008]} c={STEEL} shadow={false} />
            <Box m={m} at={[0.25, -0.5, 0]} s={[0.09, 0.03, 0.08]} c={RIDE_COLORS[i % RIDE_COLORS.length]} />
          </group>
        )
      })}
    </Upright>
  )
}

// Drop tower: a tall lattice mast with a ring of seats hauled up near the top.
function DropTower({ m, bulb, c }: { m: Mat; bulb: ReactNode; c: string }) {
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.06, 0]} r={0.34} h={0.12} c="#d7ccc8" seg={12} />
      <Box m={m} at={[0, 1.6, 0]} s={[0.16, 3.0, 0.16]} c={c} />
      {[0.6, 1.2, 1.8, 2.4].map((y) => <Box key={y} m={m} at={[0, y, 0]} s={[0.2, 0.04, 0.2]} c={WHITE} shadow={false} />)}
      <Cyl m={m} at={[0, 2.5, 0]} r={0.3} h={0.14} c="#fdd835" seg={12} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} rotation-y={(i / 6) * TAU}>
          <Box m={m} at={[0, 2.38, 0.28]} s={[0.12, 0.12, 0.06]} c={RIDE_COLORS[i]} />
        </group>
      ))}
      <Cyl m={m} at={[0, 3.14, 0]} r={0.16} h={0.08} c={WHITE} seg={10} />
      <mesh position={[0, 3.24, 0]}><sphereGeometry args={[0.08, 8, 6]} />{bulb}</mesh>
    </Upright>
  )
}

// Teacups: four spinning cups on saucers round a teapot, on a lit turntable.
function Teacups({ m, bulb }: { m: Mat; bulb: ReactNode }) {
  const CUPS = ['#f06292', '#4fc3f7', '#ffd54f', '#81c784']
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.03, 0]} r={0.4} h={0.06} c="#d7ccc8" seg={24} />
      <Cyl m={m} at={[0, 0.07, 0]} r={0.37} h={0.02} c="#ab47bc" seg={24} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * TAU
        return <mesh key={i} position={[Math.cos(a) * 0.385, 0.065, Math.sin(a) * 0.385]}><sphereGeometry args={[0.018, 6, 5]} />{bulb}</mesh>
      })}
      {/* The teapot in the middle, spout and handle. */}
      <Cyl m={m} at={[0, 0.13, 0]} r={0.08} r2={0.09} h={0.1} c={WHITE} seg={14} />
      <mesh position={[0, 0.2, 0]} castShadow><sphereGeometry args={[0.1, 14, 10]} />{m('#ec407a')}</mesh>
      <mesh position={[0, 0.29, 0]}><sphereGeometry args={[0.035, 8, 6]} />{m(GOLD)}</mesh>
      <Cyl m={m} at={[0.12, 0.23, 0]} r={0.016} r2={0.026} h={0.12} c="#ec407a" seg={6} rot={[0, 0, -0.9]} />
      <mesh position={[-0.1, 0.21, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.045, 0.012, 6, 12]} />{m('#ec407a')}</mesh>
      {CUPS.map((c, i) => {
        const a = (i / 4) * TAU + Math.PI / 4
        return (
          <group key={c} position={[Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24]}>
            <Cyl m={m} at={[0, 0.01, 0]} r={0.11} h={0.02} c={WHITE} seg={16} />
            <Cyl m={m} at={[0, 0.085, 0]} r={0.095} r2={0.065} h={0.13} c={c} seg={16} />
            <mesh position={[0, 0.15, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.093, 0.009, 5, 18]} />{m(WHITE)}</mesh>
            <mesh position={[0.1, 0.09, 0]}><torusGeometry args={[0.035, 0.01, 5, 10]} />{m(c)}</mesh>
            <Cyl m={m} at={[0, 0.03, 0]} r={0.02} h={0.02} c={GOLD} seg={8} />
          </group>
        )
      })}
    </Upright>
  )
}

// A cart on two wheels with a striped canopy on poles; `top` is what it sells
// (a glass case of popcorn, a candy floss drum). Faces +z.
function SnackCart({ m, c, stripe, top }: { m: Mat; c: string; stripe: string; top: 'popcorn' | 'floss' }) {
  return (
    <group userData={PEOPLE_SIZED}>
      <Box m={m} at={[0, 0.22, 0]} s={[0.46, 0.26, 0.28]} c={c} />
      <Box m={m} at={[0, 0.36, 0]} s={[0.5, 0.025, 0.32]} c={WHITE} />
      {[-0.16, 0.16].map((x) => <Cyl key={x} m={m} at={[x, 0.07, 0.15]} r={0.07} h={0.03} c={DARK} seg={10} rot={[Math.PI / 2, 0, 0]} />)}
      {[-0.16, 0.16].map((x) => <Cyl key={`h${x}`} m={m} at={[x, 0.07, 0.168]} r={0.025} h={0.01} c={GOLD} seg={8} rot={[Math.PI / 2, 0, 0]} />)}
      <Box m={m} at={[0, 0.1, -0.11]} s={[0.04, 0.12, 0.04]} c={DARK} />
      {[-0.22, 0.22].map((x) => <Box key={x} m={m} at={[x, 0.58, -0.12]} s={[0.02, 0.42, 0.02]} c={WHITE} />)}
      <Box m={m} at={[0, 0.8, -0.04]} rot={[0.15, 0, 0]} s={[0.54, 0.03, 0.38]} c="#ffffff" t={awningTex(stripe)} />
      {top === 'popcorn' ? (
        <group>
          {/* Glass case with popcorn heaped inside and a red striped box on the counter. */}
          <Box m={m} at={[0, 0.39, 0.02]} s={[0.32, 0.03, 0.2]} c="#c62828" />
          <Box m={m} at={[0, 0.46, 0.02]} s={[0.3, 0.1, 0.18]} c="#fff59d" />
          {[[-0.08, 0.04], [0.05, -0.03], [0.1, 0.05], [-0.02, 0.0]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.52, 0.02 + z]}><sphereGeometry args={[0.035, 6, 5]} />{m('#fff9c4')}</mesh>
          ))}
          {[-0.155, 0.155].map((x) => <Box key={x} m={m} at={[x, 0.5, 0.02]} s={[0.012, 0.2, 0.2]} c="#c62828" shadow={false} />)}
          <Box m={m} at={[0, 0.605, 0.02]} s={[0.32, 0.02, 0.21]} c="#c62828" />
          <Cyl m={m} at={[0.19, 0.42, 0.08]} r={0.03} r2={0.022} h={0.08} c="#ffffff" seg={8} />
        </group>
      ) : (
        <group>
          <Cyl m={m} at={[0, 0.43, 0]} r={0.12} h={0.12} c={STEEL} seg={14} />
          <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.1, 10, 8]} />{m('#f8bbd0')}</mesh>
          {[-0.17, 0.17].map((x) => (
            <group key={x} position={[x, 0.38, 0.06]}>
              <Cyl m={m} at={[0, 0.05, 0]} r={0.006} h={0.1} c={WHITE} seg={4} />
              <mesh position={[0, 0.13, 0]}><sphereGeometry args={[0.045, 8, 6]} />{m(x < 0 ? '#ce93d8' : '#81d4fa')}</mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// Balloon stand: a pole on a weighted base, a bunch of balloons tied to its top.
function BalloonStand({ m }: { m: Mat }) {
  const B: [number, number, number, string][] = [[0, 0.98, 0, '#e53935'], [0.1, 0.94, 0.04, '#fdd835'], [-0.09, 0.95, 0.05, '#1e88e5'], [0.04, 1.05, -0.07, '#43a047'], [-0.05, 1.06, -0.05, '#ec407a'], [0.11, 1.04, -0.04, '#8e24aa'], [-0.11, 1.03, 0.0, '#ff7043']]
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.03, 0]} r={0.09} h={0.06} c={DARK} seg={10} />
      <Cyl m={m} at={[0, 0.4, 0]} r={0.012} h={0.74} c={WHITE} seg={5} />
      {B.map(([x, y, z, c]) => {
        const len = Math.hypot(x, y - 0.77 - 0.06, z)
        return (
          <group key={c}>
            <mesh position={[x, y, z]} scale={[1, 1.18, 1]} castShadow><sphereGeometry args={[0.055, 10, 8]} />{m(c)}</mesh>
            <mesh position={[x / 2, (y - 0.06 + 0.77) / 2, z / 2]} rotation={[Math.atan2(z, y - 0.83), 0, -Math.atan2(x, y - 0.83)]}>
              <cylinderGeometry args={[0.003, 0.003, len, 3]} />{m(WHITE)}
            </mesh>
          </group>
        )
      })}
    </Upright>
  )
}

// High striker: hit the pad, ring the bell. Faces +z.
function HighStriker({ m, bulb }: { m: Mat; bulb: ReactNode }) {
  return (
    <Upright>
      <Box m={m} at={[0, 0.04, 0]} s={[0.26, 0.08, 0.26]} c="#6d4c41" />
      <Box m={m} at={[0, 0.1, 0.06]} s={[0.12, 0.04, 0.1]} c="#e53935" />
      <Box m={m} at={[0, 0.52, -0.07]} s={[0.12, 0.88, 0.05]} c={WHITE} />
      {['#43a047', '#9ccc65', '#fdd835', '#ffa000', '#e53935'].map((c, i) => (
        <Box key={c} m={m} at={[0, 0.2 + i * 0.16, -0.042]} s={[0.1, 0.13, 0.006]} c={c} shadow={false} />
      ))}
      <Cyl m={m} at={[0, 0.52, -0.035]} r={0.008} h={0.86} c={STEEL} seg={4} />
      <Box m={m} at={[0, 0.38, -0.028]} s={[0.05, 0.03, 0.01]} c={DARK} shadow={false} />
      <mesh position={[0, 1.0, -0.06]} castShadow><sphereGeometry args={[0.07, 12, 8, 0, TAU, 0, Math.PI / 2]} />{m(GOLD)}</mesh>
      <Box m={m} at={[0, 0.98, -0.07]} s={[0.16, 0.02, 0.06]} c={DARK} />
      <mesh position={[0, 1.09, -0.06]}><sphereGeometry args={[0.03, 6, 5]} />{bulb}</mesh>
      {/* The mallet, leaning on the base. */}
      <Box m={m} at={[0.17, 0.2, 0.06]} rot={[0, 0, -0.25]} s={[0.018, 0.34, 0.018]} c="#a1887f" />
      <Box m={m} at={[0.21, 0.37, 0.06]} rot={[0, 0, -0.25]} s={[0.1, 0.05, 0.05]} c="#5d4037" />
    </Upright>
  )
}

// Hot dog kiosk with a giant hot dog on its roof. Serves out of +z.
function HotDogKiosk({ m, bulb, win }: { m: Mat; bulb: ReactNode; win: ReactNode }) {
  return (
    <Upright>
      <Box m={m} at={[0, 0.27, -0.02]} s={[0.46, 0.54, 0.32]} c="#fff8e1" />
      <Box m={m} at={[0, 0.56, -0.02]} s={[0.52, 0.04, 0.38]} c="#ffb300" />
      <mesh position={[0, 0.36, 0.143]}><planeGeometry args={[0.32, 0.16]} />{win}</mesh>
      <Box m={m} at={[0, 0.27, 0.17]} s={[0.4, 0.025, 0.07]} c={WHITE} />
      <Box m={m} at={[0, 0.13, 0.142]} s={[0.46, 0.18, 0.006]} c="#e53935" shadow={false} />
      <Box m={m} at={[0, 0.48, 0.2]} rot={[0.35, 0, 0]} s={[0.5, 0.025, 0.16]} c="#ffffff" t={awningTex('#e53935')} />
      {/* The hot dog: bun, sausage and a squiggle of mustard. */}
      <group position={[0, 0.61, -0.02]}>
        <Box m={m} at={[0, 0.0, 0]} s={[0.1, 0.06, 0.08]} c={DARK} />
        <mesh position={[0, 0.07, 0]} rotation-z={Math.PI / 2} scale={[1, 1, 1.25]} castShadow><capsuleGeometry args={[0.055, 0.26, 4, 10]} />{m('#f6c27a')}</mesh>
        <mesh position={[0, 0.115, 0]} rotation-z={Math.PI / 2}><capsuleGeometry args={[0.035, 0.34, 4, 10]} />{m('#c0392b')}</mesh>
        {[-0.1, 0, 0.1].map((x) => <Box key={x} m={m} at={[x, 0.148, 0]} rot={[0, x * 4 + 0.6, 0]} s={[0.07, 0.012, 0.014]} c="#fdd835" shadow={false} />)}
      </group>
      {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, 0.6, 0.17]}><sphereGeometry args={[0.025, 6, 5]} />{bulb}</mesh>)}
    </Upright>
  )
}

// One pennant, hanging down from the string (y = 0.05 at its top edge), both faces.
const PENNANT = new Float32Array([-0.04, 0.05, 0, 0.04, 0.05, 0, 0, -0.05, 0, 0.04, 0.05, 0, -0.04, 0.05, 0, 0, -0.05, 0])

// A string of triangle pennants slung between two posts' tops.
function Pennants({ m, from, to, n }: { m: Mat; from: V3; to: V3; n: number }) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2])
  return (
    <group position={from} rotation-y={yaw} userData={STRETCH}>
      <mesh position={[0, 0, len / 2]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.005, 0.005, len, 4, 1, true]} />{m(WHITE)}</mesh>
      {Array.from({ length: n }, (_, i) => {
        const z = ((i + 0.5) / n) * len
        return (
          <mesh key={i} position={[0, -0.05, z]} rotation-y={Math.PI / 2}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[PENNANT, 3]} />
            </bufferGeometry>
            {m(RIDE_COLORS[i % RIDE_COLORS.length])}
          </mesh>
        )
      })}
    </group>
  )
}

// Tethered balloon ride: the basket waits on its pad, the envelope floats
// above on its rigging.
function BalloonRide({ m, bulb }: { m: Mat; bulb: ReactNode }) {
  const top = 1.95
  return (
    <Upright>
      <Cyl m={m} at={[0, 0.03, 0]} r={0.24} h={0.06} c="#d7ccc8" seg={14} />
      <Box m={m} at={[0, 0.17, 0]} s={[0.22, 0.22, 0.22]} c="#8d6e63" />
      <Box m={m} at={[0, 0.29, 0]} s={[0.24, 0.03, 0.24]} c="#5d4037" />
      {[-0.06, 0.06].map((y) => <Box key={y} m={m} at={[0, 0.17 + y, 0]} s={[0.226, 0.012, 0.226]} c="#6d4c41" shadow={false} />)}
      {/* The four corner ropes up to the envelope's skirt. */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
        const dx = sx * 0.06, dz = sz * 0.06
        const h = top - 0.36 - 0.3
        return <Box key={`${sx}${sz}`} m={m} at={[sx * 0.11 + dx / 2, 0.3 + h / 2, sz * 0.11 + dz / 2]} rot={[Math.atan2(dz, h) * -1, 0, Math.atan2(dx, h)]} s={[0.008, h, 0.008]} c={STEEL} shadow={false} />
      })}
      <Cyl m={m} at={[0, top - 0.32, 0]} r={0.17} r2={0.13} h={0.12} c="#fdd835" seg={16} />
      <mesh position={[0, top, 0]} scale={[1, 1.12, 1]} castShadow>
        <sphereGeometry args={[0.32, 16, 12, 0, TAU, 0, Math.PI * 0.82]} />
        {m('#ffffff', awningTex('#e53935'))}
      </mesh>
      <mesh position={[0, top + 0.37, 0]}><sphereGeometry args={[0.03, 6, 5]} />{bulb}</mesh>
    </Upright>
  )
}

// What the fair adds as it levels: every level brings something new to the
// midway, and more visitors.
const FAIR_VISITORS: Visitor[] = [
  { lvl: 1, x: -1.27, z: 0.45, face: -Math.PI / 2 },
  { lvl: 1, x: -1.27, z: 1.3, face: -Math.PI / 2 },
  { lvl: 1, walk: 0.2, speed: 0.045 },
  { lvl: 2, x: -0.4, z: 1.43, face: Math.PI },
  { lvl: 2, walk: 1.1, speed: 0.05 },
  { lvl: 3, x: 0.25, z: 0.18, face: -Math.PI / 2 - 0.4 },
  { lvl: 3, x: 0.2, z: 0.95, face: -Math.PI / 2 },
  { lvl: 4, x: 0.17, z: 0.55, face: -Math.PI / 2 },
  { lvl: 4, x: -0.15, z: 0.12, face: Math.PI },
  { lvl: 5, walk: 0.65, speed: 0.04 },
  { lvl: 5, walk: 1.55, speed: 0.055 },
  { lvl: 6, x: -0.58, z: -0.12, face: -Math.PI / 2 },
  { lvl: 6, walk: 0.9, speed: 0.035 },
  { lvl: 7, x: -1.27, z: -0.38, face: -Math.PI / 2 },
  { lvl: 8, x: 1.17, z: 1.58, face: Math.PI / 2 },
  { lvl: 8, walk: 1.35, speed: 0.06 },
  { lvl: 9, x: 0.08, z: 1.76, face: Math.PI },
  { lvl: 10, walk: 0.05, speed: 0.05 },
  { lvl: 10, walk: 1.8, speed: 0.04 },
]

function Funfair({ k, def, lvl }: { k: K; def: BuildingDef; lvl: number }) {
  const { m, bulb, ghost } = k
  const st = growthStage(lvl)
  const R = 0.85 + (lvl - 1) * 0.03
  const bh = 0.95
  return (
    <group>
      <Box m={m} at={[0, 0.027, 0.02]} s={[3.9, 0.046, 3.92]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
      {/* Ferris wheel at the back, turned to the street. */}
      <group position={[-0.85, 0.05, -1.25]} rotation-y={0.6}><FerrisWheel m={m} bulb={bulb} R={R} c={def.roof} /></group>
      <group position={[1.05, 0.05, 0.62]}><Carousel m={m} bulb={bulb} c={def.roof} /></group>
      {/* Game stalls down the left of the midway. */}
      <group position={[-1.5, 0.05, 0.45]} rotation-y={Math.PI / 2}><Stall m={m} bulb={bulb} c="#1e88e5" prize="#e53935" /></group>
      <group position={[-1.5, 0.05, 1.3]} rotation-y={Math.PI / 2}><Stall m={m} bulb={bulb} c="#43a047" prize="#fdd835" /></group>
      {st >= 3 && <group position={[-1.5, 0.05, -0.38]} rotation-y={Math.PI / 2}><Stall m={m} bulb={bulb} c="#8e24aa" prize="#4fc3f7" /></group>}
      {st >= 2 ? (
        <group position={[1.08, 0.05, -1.1]}><SwingRide m={m} bulb={bulb} c="#00acc1" /></group>
      ) : (
        !ghost && (
          <group>
            {/* Snack corner: a candy floss cart and picnic tables. */}
            <group position={[1.15, 0.05, -1.35]}><SnackCart m={m} c="#f48fb1" stripe="#ec407a" top="floss" /></group>
            {[[0.7, -0.6], [1.5, -0.6]].map(([x, z]) => (
              // Picnic table: the top on slim legs, a bench each side on a crossbar at seat height.
              <group key={x} position={[x, 0.05, z]}>
                <Box m={m} at={[0, 0.29, 0]} s={[0.5, 0.03, 0.26]} c="#8d6e63" />
                {[-0.22, 0.22].map((dz) => <Box key={dz} m={m} at={[0, 0.17, dz]} s={[0.5, 0.025, 0.09]} c="#8d6e63" />)}
                {[-0.19, 0.19].map((dx) => (
                  <group key={dx}>
                    <Box m={m} at={[dx, 0.15, 0]} s={[0.03, 0.025, 0.56]} c="#5d4037" shadow={false} />
                    {[-0.09, 0.09].map((dz) => <Box key={dz} m={m} at={[dx, 0.145, dz]} s={[0.03, 0.29, 0.03]} c="#5d4037" shadow={false} />)}
                  </group>
                ))}
              </group>
            ))}
          </group>
        )
      )}
      {/* Clear of the Ferris wheel beside it and the swing ride's chairs. */}
      {st >= 3 && <group position={[0.25, 0.05, -1.55]}><DropTower m={m} bulb={bulb} c={def.roof} /></group>}
      {/* Entrance: the gateway arch and the ticket booth. */}
      <group position={[-0.4, 0.05, 1.9]}>
        <Upright>
          {[-0.62, 0.62].map((x) => (
            <group key={x}>
              <Box m={m} at={[x, 0.65, 0]} s={[0.14, 1.3, 0.14]} c={def.roof} />
              <mesh position={[x, 1.38, 0]}><sphereGeometry args={[0.1, 10, 8]} />{m(GOLD)}</mesh>
            </group>
          ))}
          <Box m={m} at={[0, 1.12, 0]} s={[1.24, 0.1, 0.12]} c={WHITE} />
          <Box m={m} at={[0, 1.38, -0.01]} s={[1.0, 0.27, 0.06]} c={def.roof} />
          {!ghost && <Sign text={def.sign ?? 'FUNFAIR'} w={0.92} at={[0, 1.38, 0.03]} bg="#fff8e1" fg={def.roof} />}
          {[-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].map((x) => <mesh key={x} position={[x, 1.05, 0.06]}><sphereGeometry args={[0.03, 6, 5]} />{bulb}</mesh>)}
        </Upright>
      </group>
      <group position={[0.64, 0.05, 1.68]}>
        <Box m={m} at={[0, bh / 2, 0]} s={[0.5, bh, 0.42]} c="#fff8e1" />
        <Box m={m} at={[0, bh + 0.03, 0]} s={[0.6, 0.06, 0.52]} c={def.roof} />
        <mesh position={[0, 0.5, 0.212]}><planeGeometry args={[0.32, 0.26]} />{k.win}</mesh>
        <Box m={m} at={[0, 0.35, 0.24]} s={[0.4, 0.03, 0.07]} c={WHITE} />
        <Box m={m} at={[0, 0.8, 0.212]} s={[0.44, 0.1, 0.006]} c={def.roof} shadow={false} />
        <Trims m={m} lvl={lvl} w={0.5} d={0.42} h={bh} z0={0} flag={def.roof} />
      </group>
      {!ghost && (
        <group>
          <Bulbs from={[0.1, 1.05, 1.45]} to={[0.1, 1.05, -0.35]} n={12} posts={1.0} sag={0.08} />
          <Bulbs from={[-0.9, 1.05, 1.45]} to={[-0.9, 1.05, -0.35]} n={12} posts={1.0} sag={0.08} />
          {st >= 2 && <Bulbs from={[-0.9, 1.05, -0.35]} to={[0.1, 1.05, -0.35]} n={7} sag={0.06} />}
          {lvl < 4 && <Bench m={m} at={[-0.4, 0.05, 0.2]} rot={0} />}
          {/* The midway fills up level by level. */}
          {lvl >= 2 && <group position={[-0.4, 0.05, 1.15]}><SnackCart m={m} c="#c62828" stripe="#e53935" top="popcorn" /></group>}
          {lvl >= 3 && <group position={[0.32, 0.05, -0.12]}><BalloonStand m={m} /></group>}
          {lvl >= 4 && <group position={[-0.4, 0.05, 0.55]}><Teacups m={m} bulb={bulb} /></group>}
          {lvl >= 4 && <group position={[-0.15, 0.05, -0.15]}><SnackCart m={m} c="#f48fb1" stripe="#ec407a" top="floss" /></group>}
          {lvl >= 5 && [[0.2, -0.35], [-1.5, 0.875]].map(([x, z]) => (
            <group key={x} position={[x, 0.05, z]} userData={PEOPLE_SIZED}>
              <Cyl m={m} at={[0, 0.11, 0]} r={0.055} r2={0.048} h={0.22} c="#2e7d32" seg={10} />
              <Cyl m={m} at={[0, 0.23, 0]} r={0.06} h={0.025} c={DARK} seg={10} />
            </group>
          ))}
          {st >= 2 && (
            // Picnic table between the big rides, once the swing ride takes the snack corner.
            <group position={[-0.05, 0.05, -0.85]} rotation-y={0.3}>
              <Box m={m} at={[0, 0.29, 0]} s={[0.5, 0.03, 0.26]} c="#8d6e63" />
              {[-0.22, 0.22].map((dz) => <Box key={dz} m={m} at={[0, 0.17, dz]} s={[0.5, 0.025, 0.09]} c="#8d6e63" />)}
              {[-0.19, 0.19].map((dx) => (
                <group key={dx}>
                  <Box m={m} at={[dx, 0.15, 0]} s={[0.03, 0.025, 0.56]} c="#5d4037" shadow={false} />
                  {[-0.09, 0.09].map((dz) => <Box key={dz} m={m} at={[dx, 0.145, dz]} s={[0.03, 0.29, 0.03]} c="#5d4037" shadow={false} />)}
                </group>
              ))}
            </group>
          )}
          {lvl >= 6 && <group position={[-0.8, 0.05, -0.08]} rotation-y={Math.PI / 2}><HighStriker m={m} bulb={bulb} /></group>}
          {lvl >= 8 && <group position={[1.55, 0.05, 1.58]} rotation-y={-Math.PI / 2}><HotDogKiosk m={m} bulb={bulb} win={k.win} /></group>}
          {lvl >= 9 && (
            <group>
              <Pennants m={m} from={[-0.9, 1.06, 1.45]} to={[0.1, 1.06, 1.45]} n={9} />
              <Pennants m={m} from={[-0.9, 1.06, 1.45]} to={[0.1, 1.06, -0.35]} n={14} />
              <Pennants m={m} from={[0.1, 1.06, 1.45]} to={[-0.9, 1.06, -0.35]} n={14} />
            </group>
          )}
          {lvl >= 10 && <group position={[1.68, 0.05, -1.72]}><BalloonRide m={m} bulb={bulb} /></group>}
          <group position-y={0.05}><FairCrowd lvl={lvl} visitors={FAIR_VISITORS} /></group>
          <Lamp m={m} bulb={bulb} at={[-1.75, 0.05, 1.92]} ghost={ghost} />
          <Lamp m={m} bulb={bulb} at={[1.88, 0.05, -0.3]} ghost={ghost} />
          {st < 3 && <Tree m={m} at={[1.62, 0.05, 1.68]} s={0.8} leaves={PAL.leaves} bare={PAL.bare} />}
          {st >= 3 && [[-1.85, -1.85], [1.85, -1.85], [1.85, 1.85]].map(([x, z]) => <group key={`${x}${z}`} position={[x, 0.05, z]}><FlagPole m={m} c={RIDE_COLORS[(x + z + 4) % 6 | 0]} /></group>)}
        </group>
      )}
    </group>
  )
}

function FlagPole({ m, c }: { m: Mat; c: string }) {
  return (
    <group>
      <Cyl m={m} at={[0, 0.6, 0]} r={0.015} h={1.2} c={WHITE} seg={5} />
      <Box m={m} at={[0, 1.1, 0.09]} s={[0.01, 0.12, 0.18]} c={c} shadow={false} />
    </group>
  )
}

// ---------- Big Splash Water Park ----------

const SLIDES = ['#fdd835', '#e53935', '#43a047', '#8e24aa']

// The main slide tower and its slides, in the tower's own frame (it stands at the back right).
function SlideTower({ m, bulb, st, roof }: { m: Mat; bulb: ReactNode; st: number; roof: string }) {
  const levels = st + 1
  const T = 0.55 * levels
  const top = T + 0.04
  // Slides start at the top deck and twist down into the splash pool in front (+z).
  // The yellow one coils three-quarters round beside the tower, eighth by eighth.
  const coil: V3[] = Array.from({ length: 7 }, (_, i) => [-0.62 + 0.34 * Math.cos((i * Math.PI) / 4), top + 0.07 - ((top - 0.33) * i) / 6, 0.1 - 0.34 * Math.sin((i * Math.PI) / 4)])
  const slides: V3[][] = [
    [...coil, [-0.5, 0.15, 0.95], [-0.42, 0.1, 1.15]],
    [[0.2, top + 0.07, 0.24], [0.42, top * 0.8, 0.45], [0.2, top * 0.55, 0.75], [0.45, top * 0.3, 0.95], [0.25, 0.1, 1.15]],
  ]
  if (st >= 2) slides.push([[0.24, T * 0.5 + 0.11, 0], [0.42, T * 0.4, -0.05], [0.45, T * 0.22, 0.45], [0.1, 0.12, 0.9], [-0.15, 0.1, 1.05]])
  if (st >= 3) slides.push([[-0.28, top + 0.07, -0.15], [-0.7, top * 0.92, -0.38], [-1.25, top * 0.6, -0.15], [-1.35, top * 0.3, 0.45], [-1.15, 0.22, 0.95], [-0.9, 0.1, 1.2]])
  return (
    <Upright>
      {[[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, (T + 0.5) / 2, z]} s={[0.06, T + 0.5, 0.06]} c={WHITE} />)}
      {Array.from({ length: levels }, (_, i) => (
        <Box key={i} m={m} at={[0, 0.55 * (i + 1), 0]} s={[0.56, 0.06, 0.56]} c={i === levels - 1 ? '#0288d1' : '#29b6f6'} />
      ))}
      {Array.from({ length: levels }, (_, i) => (
        <Box key={`s${i}`} m={m} at={[0.36, 0.55 * i + 0.3, i % 2 ? 0.1 : -0.1]} rot={[i % 2 ? -0.8 : 0.8, 0, 0]} s={[0.16, 0.03, 0.72]} c="#78909c" />
      ))}
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.27, T + 0.18, 0]} s={[0.015, 0.2, 0.56]} c={roof} shadow={false} />)}
      <mesh position={[0, T + 0.68, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.46, 0.36, 4]} />{m(roof)}</mesh>
      {/* A giant tipping bucket over the top deck from the Slide Park on. */}
      {st >= 2 && (
        <group position={[0, T + 0.86, 0]}>
          <Cyl m={m} at={[0, 0.02, 0]} r={0.07} h={0.04} c={STEEL} seg={8} />
          <mesh position={[0, 0.24, 0]} rotation-z={0.35} castShadow><cylinderGeometry args={[0.24, 0.17, 0.36, 12]} />{m('#fdd835')}</mesh>
          <mesh position={[0.07, 0.42, 0]} rotation-z={0.35}><cylinderGeometry args={[0.2, 0.2, 0.012, 12]} />{m('#4fc3f7')}</mesh>
        </group>
      )}
      <mesh position={[0, T + 0.5, 0]}><boxGeometry args={[0.1, 0.06, 0.1]} />{bulb}</mesh>
      {slides.map((p, i) => <Tube key={i} m={m} pts={p} r={0.07} c={SLIDES[i]} />)}
    </Upright>
  )
}

function Duck({ m }: { m: Mat }) {
  return (
    <group>
      <Cyl m={m} at={[0, 0.02, 0]} r={0.16} h={0.04} c={STEEL} seg={10} />
      <mesh position={[0, 0.24, 0]} scale={[1.3, 0.85, 1]} castShadow><sphereGeometry args={[0.24, 14, 10]} />{m('#ffeb3b')}</mesh>
      <mesh position={[-0.28, 0.36, 0]} rotation-z={0.6} castShadow><coneGeometry args={[0.09, 0.18, 8]} />{m('#ffeb3b')}</mesh>
      <mesh position={[0.2, 0.5, 0]} castShadow><sphereGeometry args={[0.15, 12, 10]} />{m('#ffeb3b')}</mesh>
      <mesh position={[0.36, 0.48, 0]} rotation-z={-Math.PI / 2} castShadow><coneGeometry args={[0.06, 0.12, 8]} />{m('#ff6f00')}</mesh>
      {[-1, 1].map((sd) => <mesh key={sd} position={[0.28, 0.56, sd * 0.1]}><sphereGeometry args={[0.025, 6, 5]} />{m('#212121')}</mesh>)}
    </group>
  )
}

function WaterPark({ k, def, lvl }: { k: K; def: BuildingDef; lvl: number }) {
  const { m, win, bulb, ghost } = k
  const st = growthStage(lvl)
  const h = 1.0 + levelLift(lvl) * 0.5
  const tubeColors = ['#ff7043', '#fdd835', '#4fc3f7', '#e91e63', '#66bb6a']
  return (
    <group>
      <Box m={m} at={[0, 0.027, 0.02]} s={[3.9, 0.046, 3.92]} c="#ffffff" t={concreteTex(4, 4)} shadow={false} />
      <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={1.5} d={0.85} h0={1.0} x0={-1.15} z0={1.15} wall={def.color} tex="siding" roof={def.roof} sign={def.sign} signFg="#0277bd" shopfront={def.roof} grow={0.5}>
        <group position={[0.32, h + 0.13, 0.95]} rotation-y={-0.5}><Duck m={m} /></group>
      </ShellBuilding>
      {/* Lazy river round a palm island (back left). */}
      <Frame m={m} x0={-1.92} x1={-0.12} z0={-1.92} z1={0.58} t={0.07} y0={0.05} h={0.06} c={WHITE} />
      <Water m={m} x0={-1.85} x1={-0.19} z0={-1.85} z1={0.51} y={0.066} />
      <Box m={m} at={[-1.02, 0.08, -0.67]} s={[0.96, 0.06, 1.66]} c="#ffffff" t={grassTex(1, 2)} shadow={false} />
      <Frame m={m} x0={-1.52} x1={-0.52} z0={-1.52} z1={0.18} t={0.04} y0={0.05} h={0.075} c={WHITE} />
      {/* Splash pool under the slides (back right), wave pool with its beach (front right). */}
      <Frame m={m} x0={0.2} x1={1.92} z0={-0.82} z1={0.24} t={0.07} y0={0.05} h={0.06} c={WHITE} />
      <Water m={m} x0={0.27} x1={1.85} z0={-0.75} z1={0.17} y={0.066} />
      <Frame m={m} x0={0.1} x1={1.92} z0={0.46} z1={1.96} t={0.07} y0={0.05} h={0.06} c={WHITE} />
      <Water m={m} x0={0.17} x1={1.85} z0={0.53} z1={1.89} y={0.066} />
      <Box m={m} at={[1.01, 0.075, 1.67]} s={[1.68, 0.05, 0.44]} c="#ffffff" t={sandTex(2, 1)} shadow={false} />
      {[0.72, 0.98, 1.24].map((z) => <Flat key={z} m={m} at={[1.01, 0.07, z]} s={[1.6, 0.04]} c="#e1f5fe" />)}
      <group position={[1.35, 0.05, -1.45]}><SlideTower m={m} bulb={bulb} st={st} roof={def.roof} /></group>
      {/* The Mega Water Park adds a bowl slide on the island. */}
      {st >= 3 && (
        <group position={[-1.02, 0.11, -0.95]}>
          <Upright>
            <Cyl m={m} at={[0, 0.1, 0]} r={0.12} h={0.2} c={WHITE} seg={10} />
            <mesh position={[0, 0.36, 0]} castShadow><cylinderGeometry args={[0.42, 0.1, 0.32, 16]} />{m('#00acc1')}</mesh>
            <mesh position={[0, 0.52, 0]} rotation-x={-Math.PI / 2}><torusGeometry args={[0.42, 0.03, 6, 20]} />{m('#ff6f00')}</mesh>
          </Upright>
        </group>
      )}
      {!ghost && (
        <group>
          {/* Rings drifting round the lazy river. */}
          {[[-1.7, -1.2], [-1.7, 0.1], [-0.9, 0.35], [-0.35, -0.9], [-1.2, -1.7]].map(([x, z], i) => <Ring key={i} m={m} at={[x, 0.08, z]} c={tubeColors[i]} />)}
          {[[0.8, -0.2], [1.5, 0.0]].map(([x, z], i) => <Ring key={`s${i}`} m={m} at={[x, 0.08, z]} c={tubeColors[i + 2]} />)}
          {[[0.5, 1.1], [1.2, 0.8], [1.6, 1.3]].map(([x, z], i) => <Ring key={`w${i}`} m={m} at={[x, 0.08, z]} c={tubeColors[i + 1]} />)}
          {st < 3 && <Palm m={m} at={[-1.05, 0.11, -1.05]} s={1.1} />}
          <Palm m={m} at={[-0.75, 0.11, -0.2]} lean={-0.15} />
          <Palm m={m} at={[-1.3, 0.11, 0.0]} s={0.9} />
          <Lounger m={m} at={[-1.25, 0.11, -0.45]} c="#ff7043" rot={Math.PI / 2} />
          <Lounger m={m} at={[-0.78, 0.11, -0.5]} c="#4fc3f7" rot={Math.PI / 2} />
          {[[0.45, '#ff7043'], [0.95, '#fdd835']].map(([x, c]) => <Lounger key={x as number} m={m} at={[x as number, 0.1, 1.75]} c={c as string} rot={Math.PI / 2} />)}
          <Brolly m={m} at={[0.7, 0.1, 1.72]} c="#ff6f00" />
          <GuardChair m={m} at={[1.65, 0.1, 1.68]} rot={Math.PI} />
          <BlockCar m={m} at={[-0.14, 0.05, 1.45]} c="#ffb300" />
          <Lamp m={m} bulb={bulb} at={[0.0, 0.05, 0.38]} ghost={ghost} />
          <Lamp m={m} bulb={bulb} at={[0.0, 0.05, -1.85]} ghost={ghost} />
          {st >= 2 && <Bulbs from={[-0.02, 1.0, 0.3]} to={[-0.02, 1.0, -1.7]} n={12} posts={0.95} sag={0.08} />}
        </group>
      )}
    </group>
  )
}

// ---------- Basketball Court (1x1 decor) ----------

function Hoop({ m }: { m: Mat }) {
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[0.12, 0.06, 0.12]} c="#78909c" />
      <Cyl m={m} at={[0, 0.42, 0]} r={0.025} h={0.8} c={DARK} seg={8} />
      <Box m={m} at={[0.08, 0.8, 0]} s={[0.16, 0.03, 0.03]} c={DARK} />
      <Box m={m} at={[0.17, 0.82, 0]} s={[0.02, 0.2, 0.32]} c={WHITE} />
      <Box m={m} at={[0.181, 0.79, 0]} s={[0.003, 0.09, 0.12]} c="#e53935" shadow={false} />
      <mesh position={[0.24, 0.74, 0]} rotation-x={-Math.PI / 2}><torusGeometry args={[0.06, 0.008, 5, 14]} />{m('#ff5722')}</mesh>
      <mesh position={[0.24, 0.7, 0]}><cylinderGeometry args={[0.06, 0.04, 0.08, 10, 1, true]} />{m('#eceff1')}</mesh>
    </group>
  )
}

function Court({ k, def }: { k: K; def: BuildingDef }) {
  const { m, bulb, ghost } = k
  const line = WHITE
  const ly = 0.064
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[1.9, 0.052, 1.9]} c={def.roof} shadow={false} />
      <Box m={m} at={[0, 0.0575, 0.05]} s={[1.6, 0.003, 1.1]} c={def.color} shadow={false} />
      {/* Lines: the outline, half-court line and circle, keys and three-point arcs. */}
      <Frame m={m} x0={-0.8} x1={0.8} z0={-0.5} z1={0.6} t={0.025} y0={0.059} h={0.003} c={line} />
      <Flat m={m} at={[0, ly, 0.05]} s={[0.025, 1.05]} c={line} />
      <mesh position={[0, ly, 0.05]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.15, 0.175, 20]} />{m(line)}</mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Flat m={m} at={[sd * 0.65, ly, 0.05]} s={[0.29, 0.3]} c="#1565c0" />
          <mesh position={[sd * 0.505, ly + 0.003, 0.05]} rotation={[-Math.PI / 2, 0, sd > 0 ? Math.PI / 2 : -Math.PI / 2]}><ringGeometry args={[0.13, 0.155, 16, 1, 0, Math.PI]} />{m(line)}</mesh>
          <mesh position={[sd * 0.72, ly + 0.003, 0.05]} rotation={[-Math.PI / 2, 0, sd > 0 ? Math.PI / 2 : -Math.PI / 2]}><ringGeometry args={[0.43, 0.455, 24, 1, 0.12, Math.PI - 0.24]} />{m(line)}</mesh>
        </group>
      ))}
      {/* Hoops at both ends, facing in. */}
      <group position={[-0.9, 0.056, 0.05]}><Hoop m={m} /></group>
      <group position={[0.9, 0.056, 0.05]} rotation-y={Math.PI}><Hoop m={m} /></group>
      {/* Chain-link fence along the back and sides. */}
      {[-0.9, -0.3, 0.3, 0.9].map((x) => <Cyl key={x} m={m} at={[x, 0.33, -0.9]} r={0.015} h={0.6} c={STEEL} seg={5} />)}
      {[-0.3, 0.3].map((z) => [-0.9, 0.9].map((x) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.33, z]} r={0.015} h={0.6} c={STEEL} seg={5} />))}
      {[0.12, 0.62].map((y) => (
        <group key={y}>
          <Box m={m} at={[0, y, -0.9]} s={[1.8, 0.012, 0.012]} c={STEEL} shadow={false} />
          {[-0.9, 0.9].map((x) => <Box key={x} m={m} at={[x, y, -0.6]} s={[0.012, 0.012, 0.6]} c={STEEL} shadow={false} />)}
        </group>
      ))}
      <Box m={m} at={[0, 0.37, -0.925]} s={[1.78, 0.5, 0.004]} c="#b0bec5" shadow={false} />
      {!ghost && (
        <group>
          <Bench m={m} at={[0, 0.056, 0.8]} rot={Math.PI} />
          <mesh position={[0.35, 0.105, 0.3]} castShadow><sphereGeometry args={[0.05, 10, 8]} />{m('#ef6c00')}</mesh>
          <Cyl m={m} at={[-0.4, 0.096, 0.8]} r={0.02} h={0.08} c="#29b6f6" seg={6} />
          <Lamp m={m} bulb={bulb} at={[-0.88, 0.056, -0.82]} h={1.1} ghost={ghost} />
          <Lamp m={m} bulb={bulb} at={[0.88, 0.056, -0.82]} h={1.1} ghost={ghost} />
        </group>
      )}
    </group>
  )
}

// ---------- Tennis Courts (2x2 decor, merges into a bigger club) ----------

// One lot's pair of courts, in true units centred on the lot (4 x 4).
function TennisLot({ m, ghost, c, blue }: { m: Mat; ghost?: boolean; c: number; blue: string }) {
  const ly = 0.066
  return (
    <group>
      {[-1, 1].map((sd) => {
        const x = sd * 1.0
        return (
          <group key={sd} position={[x, 0, 0]}>
            <Box m={m} at={[0, 0.0545, 0]} s={[1.6, 0.017, 3.6]} c={blue} shadow={false} />
            {/* Doubles and singles sidelines, baselines, service boxes. */}
            <Frame m={m} x0={-0.66} x1={0.66} z0={-1.58} z1={1.58} t={0.03} y0={0.063} h={0.002} c={WHITE} />
            {[-0.51, 0.51].map((lx) => <Flat key={lx} m={m} at={[lx, ly, 0]} s={[0.025, 3.1]} c={WHITE} />)}
            {[-0.86, 0.86].map((z) => <Flat key={z} m={m} at={[0, ly, z]} s={[1.0, 0.025]} c={WHITE} />)}
            <Flat m={m} at={[0, ly + 0.003, 0]} s={[0.025, 1.7]} c={WHITE} />
            {/* The net, tape along the top. */}
            {[-0.74, 0.74].map((px) => <Cyl key={px} m={m} at={[px, 0.18, 0]} r={0.018} h={0.25} c={DARK} seg={6} />)}
            <Box m={m} at={[0, 0.16, 0]} s={[1.46, 0.17, 0.008]} c="#37474f" shadow={false} />
            <Box m={m} at={[0, 0.25, 0]} s={[1.46, 0.025, 0.014]} c={WHITE} shadow={false} />
          </group>
        )
      })}
      {!ghost && (
        <group>
          {[-0.6, 0.6].map((z) => <Bench key={z} m={m} at={[0, 0.046, z]} rot={Math.PI / 2} />)}
          {c % 2 === 0 && <group position={[1.85, 0, 0.25]} rotation-y={-Math.PI / 2}><UmpireChair m={m} /></group>}
          <group position={[0, 0.046, 1.25]}>
            <Box m={m} at={[0, 0.13, 0]} s={[0.14, 0.16, 0.14]} c="#b0bec5" />
            {[[-0.03, 0.03], [0.03, -0.02], [0, 0]].map(([x, z], i) => <mesh key={i} position={[x, 0.22, z]}><sphereGeometry args={[0.025, 6, 5]} />{m('#c6ff00')}</mesh>)}
            {[-0.06, 0.06].map((x) => <Box key={x} m={m} at={[x, 0.025, 0]} s={[0.012, 0.05, 0.12]} c={DARK} shadow={false} />)}
          </group>
        </group>
      )}
    </group>
  )
}

function UmpireChair({ m }: { m: Mat }) {
  return (
    <group userData={PEOPLE_SIZED}>
      {[[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.22, z]} s={[0.025, 0.44, 0.025]} c="#2e7d32" />)}
      <Box m={m} at={[0, 0.45, 0]} s={[0.2, 0.03, 0.2]} c="#2e7d32" />
      <Box m={m} at={[0, 0.56, -0.09]} s={[0.2, 0.2, 0.02]} c="#2e7d32" />
      {[0.12, 0.26].map((y) => <Box key={y} m={m} at={[0, y, 0.09]} s={[0.16, 0.02, 0.02]} c={WHITE} shadow={false} />)}
    </group>
  )
}

function Tennis({ k, def }: { k: K; def: BuildingDef }) {
  const [sx, , sz] = useMergeScale()
  return (
    <TrueSize>
      <TennisClub k={k} def={def} nx={Math.max(1, Math.round(sx))} nz={Math.max(1, Math.round(sz))} />
    </TrueSize>
  )
}

function TennisClub({ k, def, nx, nz }: { k: K; def: BuildingDef; nx: number; nz: number }) {
  const { m, bulb, ghost } = k
  const W = 4 * nx, D = 4 * nz
  const fx = W / 2 - 0.08, fz = D / 2 - 0.08
  const posts = (len: number) => Array.from({ length: Math.round(len / 0.95) + 1 }, (_, i) => -len / 2 + (len * i) / Math.round(len / 0.95))
  const lots: [number, number][] = []
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) lots.push([(i - (nx - 1) / 2) * 4, (j - (nz - 1) / 2) * 4])
  return (
    <group>
      <Box m={m} at={[0, 0.025, 0]} s={[W - 0.1, 0.042, D - 0.1]} c={def.color} shadow={false} />
      {/* Fence round the club: windscreens on the back and left, open rails at the front and right. */}
      <group>
        {posts(2 * fx).map((x) => [-fz, fz].map((z) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.33, z]} r={0.018} h={0.58} c={STEEL} seg={5} />))}
        {posts(2 * fz).slice(1, -1).map((z) => [-fx, fx].map((x) => <Cyl key={`${x}${z}`} m={m} at={[x, 0.33, z]} r={0.018} h={0.58} c={STEEL} seg={5} />))}
        {[0.6].map((y) => (
          <group key={y}>
            {[-fz, fz].map((z) => <Box key={z} m={m} at={[0, y, z]} s={[2 * fx, 0.014, 0.014]} c={STEEL} shadow={false} />)}
            {[-fx, fx].map((x) => <Box key={x} m={m} at={[x, y, 0]} s={[0.014, 0.014, 2 * fz]} c={STEEL} shadow={false} />)}
          </group>
        ))}
        <Box m={m} at={[0, 0.3, -fz - 0.012]} s={[2 * fx, 0.44, 0.006]} c="#1b5e20" shadow={false} />
        <Box m={m} at={[-fx - 0.012, 0.3, 0]} s={[0.006, 0.44, 2 * fz]} c="#1b5e20" shadow={false} />
        <Box m={m} at={[0, 0.15, fz]} s={[2 * fx, 0.014, 0.014]} c={STEEL} shadow={false} />
        <Box m={m} at={[fx, 0.15, 0]} s={[0.014, 0.014, 2 * fz]} c={STEEL} shadow={false} />
      </group>
      <group>
        {lots.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <TennisLot m={m} ghost={ghost} c={i} blue={def.roof} />
          </group>
        ))}
      </group>
      {!ghost && (
        <group>
          {[[-fx + 0.12, -fz + 0.12], [fx - 0.12, -fz + 0.12], [-fx + 0.12, fz - 0.12], [fx - 0.12, fz - 0.12]].map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, 0.046, z]}>
              <Cyl m={m} at={[0, 0.7, 0]} r={0.025} h={1.4} c={DARK} seg={6} />
              <mesh position={[0, 1.42, 0]}><boxGeometry args={[0.2, 0.06, 0.12]} />{bulb}</mesh>
              <Glow r={1.0} x={-Math.sign(x) * 0.5} z={-Math.sign(z) * 0.5} y={0.072} />
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

// ---------- entry ----------

export function RecModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const k: K = { m, win, bulb, ghost }
  switch (def.id) {
    case 'minigolf': return <MiniGolf k={k} def={def} lvl={lvl} />
    case 'pool': return <Pool k={k} def={def} lvl={lvl} />
    case 'funfair': return <Funfair k={k} def={def} lvl={lvl} />
    case 'waterpark': return <WaterPark k={k} def={def} lvl={lvl} />
    case 'court': return <Court k={k} def={def} />
    case 'tennis': return <Tennis k={k} def={def} />
  }
  return null
}
