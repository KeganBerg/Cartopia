import { useMemo } from 'react'
import type { Texture } from 'three'
import { CarModel } from './CarModel'
import type { Body } from '../game/data'
import { Lamp } from './ArcadeScenery'
import { LightPool } from './BuildingModel'
import { glowMats } from './dayNight'
import { signTexture } from './signTexture'
import { LAYER } from './layers'
import { corrugatedTex, dirtTex, gravelTex, sidingTex } from './textures'
import { lotBounds, type LotLayout } from './RescueLots'
import { rand } from './RaceVenues'

// Rusty's own kit inside every search lot: a dirt yard behind a patchwork
// sheet-metal fence, a gate arch with his sign, lamps, his site office and
// the junk he keeps in the middle of the loop, and clutter round each search
// spot. All plain static meshes, so the scene's <Batch> bakes them into a few
// draws. Rusty himself (animated) is placed by the scene.

type V3 = [number, number, number]

export type YardLook = { dirt: string; pad: string; fence: string[]; flavour?: 'hay' | 'desert' | 'track' }

function Box({ p, s, c, t, rot }: { p: V3; s: V3; c: string; t?: Texture; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} map={t} />
    </mesh>
  )
}

function Cyl({ p, r, r2 = r, h, c, seg = 10, rot }: { p: V3; r: number; r2?: number; h: number; c: string; seg?: number; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot}>
      <cylinderGeometry args={[r, r2, h, seg]} />
      <meshStandardMaterial color={c} />
    </mesh>
  )
}

function Tyre({ p, flat = true, ry = 0 }: { p: V3; flat?: boolean; ry?: number }) {
  return (
    <mesh position={p} rotation={flat ? [-Math.PI / 2, 0, ry] : [0, ry, 0]}>
      <torusGeometry args={[0.14, 0.065, 6, 14]} />
      <meshStandardMaterial color="#26292c" roughness={0.95} />
    </mesh>
  )
}

function Drum({ p, c, tipped }: { p: V3; c: string; tipped?: number }) {
  return (
    <group position={p} rotation={tipped !== undefined ? [0, tipped, Math.PI / 2] : undefined}>
      <Cyl p={[0, tipped !== undefined ? 0 : 0.17, 0]} r={0.11} h={0.34} c={c} />
      {[-0.08, 0.08].map((y) => <Cyl key={y} p={[0, (tipped !== undefined ? 0 : 0.17) + y, 0]} r={0.113} h={0.025} c="#3d4247" />)}
    </group>
  )
}

function Pallet({ p, ry = 0 }: { p: V3; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      {[-0.17, 0, 0.17].map((x) => <Box key={x} p={[x, 0.04, 0]} s={[0.07, 0.07, 0.5]} c="#a1887f" />)}
      {[-0.2, -0.07, 0.07, 0.2].map((z) => <Box key={z} p={[0, 0.09, z]} s={[0.5, 0.025, 0.09]} c="#bcaaa4" />)}
    </group>
  )
}

// A car squashed flat by the crusher: a slab of faded paint with a window strip.
function Crushed({ p, c, ry = 0 }: { p: V3; c: string; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      <Box p={[0, 0, 0]} s={[1.05, 0.2, 0.5]} c={c} />
      <Box p={[0.04, 0.01, 0.252]} s={[0.56, 0.07, 0.01]} c="#37474f" />
      <Box p={[-0.36, -0.02, 0.252]} s={[0.16, 0.1, 0.01]} c="#8d4a24" />
      <Box p={[0.04, 0.01, -0.252]} s={[0.56, 0.07, 0.01]} c="#37474f" />
    </group>
  )
}

const WRECK = ['#7b8f6a', '#a35d3a', '#6a7f99', '#b39b5a', '#8a6f8f', '#9b5145']

function CrushedStack({ p, ry = 0, n = 4, seed = 0 }: { p: V3; ry?: number; n?: number; seed?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      {Array.from({ length: n }, (_, i) => (
        <Crushed key={i} p={[((i * 37 + seed) % 5) * 0.025 - 0.05, 0.1 + i * 0.2, ((i + seed) % 2) * 0.05]} c={WRECK[(i + seed) % WRECK.length]} ry={((i + seed) % 3) * 0.1 - 0.1} />
      ))}
    </group>
  )
}

// A heap of old tyres, a pyramid of flat ones with a couple leaning on it.
function TyreHeap({ p }: { p: V3 }) {
  const ring: V3[] = [[-0.3, 0.07, 0], [0, 0.07, 0.02], [0.3, 0.07, -0.02], [-0.15, 0.07, 0.27], [0.16, 0.07, 0.26], [-0.15, 0.2, 0.08], [0.15, 0.2, 0.08], [0, 0.33, 0.06]]
  return (
    <group position={p}>
      {ring.map((q, i) => <Tyre key={i} p={q} ry={i} />)}
      <Tyre p={[0.5, 0.18, 0.1]} flat={false} ry={Math.PI / 2 + 0.3} />
      <Tyre p={[-0.48, 0.18, 0.22]} flat={false} ry={Math.PI / 2 - 0.4} />
    </group>
  )
}

// Rusty's site office: a portable cabin on blocks with a door, windows, steps,
// an air-con box and his sign on the front.
function Office({ p, ry = 0 }: { p: V3; ry?: number }) {
  const sign = signTexture('OFFICE', '#fffde7', '#c62828')
  return (
    <group position={p} rotation-y={ry}>
      {[-0.6, 0, 0.6].map((x) => [-0.28, 0.28].map((z) => <Box key={`${x}${z}`} p={[x, 0.05, z]} s={[0.16, 0.1, 0.16]} c="#9e9e9e" />))}
      <Box p={[0, 0.48, 0]} s={[1.6, 0.74, 0.78]} c="#f2e7c9" t={sidingTex(4, 2)} />
      <Box p={[0, 0.88, 0]} s={[1.72, 0.07, 0.9]} c="#b9572c" t={corrugatedTex(4, 1)} />
      <Box p={[0, 0.13, 0]} s={[1.62, 0.06, 0.8]} c="#455a64" />
      {/* Door, steps and a little rail. */}
      <Box p={[0.42, 0.42, 0.392]} s={[0.28, 0.5, 0.02]} c="#c62828" />
      <Box p={[0.5, 0.42, 0.405]} s={[0.03, 0.03, 0.02]} c="#ffd54f" />
      <Box p={[0.42, 0.12, 0.52]} s={[0.36, 0.06, 0.22]} c="#78909c" />
      <Box p={[0.42, 0.05, 0.64]} s={[0.36, 0.06, 0.16]} c="#78909c" />
      <Box p={[0.62, 0.3, 0.55]} s={[0.025, 0.36, 0.025]} c="#eceff1" />
      {/* Windows (lit at night) with white frames. */}
      {[-0.5, -0.06].map((x) => (
        <group key={x} position={[x, 0.52, 0.392]}>
          <Box p={[0, 0, 0]} s={[0.34, 0.26, 0.015]} c="#fafafa" />
          <mesh position-z={0.009}>
            <planeGeometry args={[0.28, 0.2]} />
            <primitive object={glowMats.window} attach="material" dispose={null} />
          </mesh>
        </group>
      ))}
      <Box p={[-0.78, 0.4, -0.12]} s={[0.12, 0.26, 0.3]} c="#cfd8dc" />
      <Cyl p={[-0.845, 0.4, -0.12]} r={0.09} h={0.01} c="#78909c" rot={[0, 0, Math.PI / 2]} seg={12} />
      <mesh position={[-0.2, 0.75, 0.395]}>
        <planeGeometry args={[0.6, 0.15]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* A bench and a drinks crate out front. */}
      <Box p={[-0.35, 0.15, 0.62]} s={[0.6, 0.04, 0.16]} c="#8d6e63" />
      {[-0.6, -0.1].map((x) => <Box key={x} p={[x, 0.07, 0.62]} s={[0.04, 0.14, 0.14]} c="#5d4037" />)}
      <Box p={[0.05, 0.08, 0.66]} s={[0.18, 0.16, 0.14]} c="#1565c0" />
      <LightPool r={0.7} z={0.6} y={0.06} />
    </group>
  )
}

// A rusted shell up on blocks, waiting for parts.
function Shell({ p, ry = 0, body = 'sedan', color = '#8d6e63' }: { p: V3; ry?: number; body?: Body; color?: string }) {
  return (
    <group position={p} rotation-y={ry}>
      {[-0.3, 0.3].map((x) => [-0.4, 0.4].map((z) => <Box key={`${x}${z}`} p={[x, 0.07, z]} s={[0.14, 0.14, 0.2]} c="#9e9e9e" />))}
      <group position-y={0.06}>
        <CarModel body={body} color={color} rusty />
      </group>
    </group>
  )
}

function Engine({ p, ry = 0 }: { p: V3; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      <Pallet p={[0, 0, 0]} />
      <Box p={[0, 0.25, 0]} s={[0.3, 0.24, 0.36]} c="#607d8b" />
      <Box p={[0, 0.42, 0]} s={[0.24, 0.1, 0.32]} c="#455a64" />
      <Cyl p={[0, 0.26, 0.2]} r={0.07} h={0.04} c="#263238" rot={[Math.PI / 2, 0, 0]} />
      <Box p={[0.17, 0.3, -0.05]} s={[0.05, 0.08, 0.22]} c="#b71c1c" />
    </group>
  )
}

function HayBales({ p }: { p: V3 }) {
  return (
    <group position={p}>
      {[-0.3, 0.3].map((x) => <Cyl key={x} p={[x, 0.24, 0]} r={0.24} h={0.5} c="#d9b44a" rot={[Math.PI / 2, 0, 0]} seg={12} />)}
      <Cyl p={[0, 0.62, 0]} r={0.24} h={0.5} c="#e0bf5a" rot={[Math.PI / 2, 0, 0]} seg={12} />
    </group>
  )
}

// A floodlight mast: two lamps on a tall pole, pools of light at night.
function Mast({ p, ry = 0 }: { p: V3; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      <Box p={[0, 0.05, 0]} s={[0.3, 0.1, 0.3]} c="#9e9e9e" />
      <Cyl p={[0, 1.35, 0]} r={0.04} r2={0.06} h={2.6} c="#546e7a" seg={6} />
      <Box p={[0, 2.62, 0]} s={[0.8, 0.05, 0.05]} c="#546e7a" />
      {[-0.32, 0.32].map((x) => (
        <group key={x} position={[x, 2.56, 0.04]} rotation-x={0.5}>
          <Box p={[0, 0, 0]} s={[0.22, 0.16, 0.08]} c="#37474f" />
          <mesh position-z={0.045}>
            <planeGeometry args={[0.18, 0.12]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
        </group>
      ))}
      <LightPool r={2.2} z={1.3} y={0.07} />
    </group>
  )
}

// ---- The fence and gate ----

// Sheet-metal panels of odd colours and heights round the lot, with a gap at
// the front for the road in from town.
function JunkFence({ X, Z, colors }: { X: number; Z: number; colors: string[] }) {
  const panels = useMemo(() => {
    const out: { p: V3; w: number; h: number; ry: number; c: string }[] = []
    let k = 0
    const run = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 0.95))
      const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n
        const h = 0.5 + ((k * 7) % 4) * 0.04
        out.push({ p: [x0 + (x1 - x0) * f, h / 2, z0 + (z1 - z0) * f], w: len / n + 0.02, h, ry: ry + (((k * 13) % 5) - 2) * 0.012, c: colors[(k * 5) % colors.length] })
        k++
      }
    }
    run(-X, -Z, X, -Z)
    run(-X, -Z, -X, Z)
    run(X, -Z, X, Z)
    run(-X, Z, -1.15, Z)
    run(1.15, Z, X, Z)
    return out
  }, [X, Z, colors])
  const posts = useMemo(() => {
    const out: [number, number][] = [[-X, -Z], [X, -Z], [-X, Z], [X, Z], [-1.15, Z], [1.15, Z]]
    for (let x = -X + 2; x < X - 1; x += 2) out.push([x, -Z], ...(Math.abs(x) > 1.6 ? [[x, Z] as [number, number]] : []))
    for (let z = -Z + 2; z < Z - 1; z += 2) out.push([-X, z], [X, z])
    return out
  }, [X, Z])
  return (
    <group>
      {panels.map((q, i) => (
        <mesh key={i} position={q.p} rotation-y={q.ry}>
          <boxGeometry args={[q.w, q.h, 0.035]} />
          <meshStandardMaterial color={q.c} map={corrugatedTex(Math.max(1, Math.round(q.w * 2)), 1)} />
        </mesh>
      ))}
      {posts.map(([x, z], i) => <Box key={i} p={[x, 0.33, z]} s={[0.07, 0.66, 0.07]} c="#4e5a61" />)}
    </group>
  )
}

// The way in: an arch of pipe over the gate with RUSTY'S RESCUE on it, a
// tyre hung off one side and a pair of open gates swung back.
function Gate({ Z }: { Z: number }) {
  const sign = signTexture("RUSTY'S RESCUE", '#ffca28', '#3e2723')
  return (
    <group position={[0, 0, Z]} scale={1.2}>
      {[-1.15, 1.15].map((x) => (
        <group key={x}>
          <Box p={[x, 0.85, 0]} s={[0.13, 1.7, 0.13]} c="#c62828" />
          <Box p={[x, 0.04, 0]} s={[0.26, 0.08, 0.26]} c="#9e9e9e" />
        </group>
      ))}
      <Box p={[0, 1.68, 0]} s={[2.5, 0.1, 0.1]} c="#c62828" />
      {/* The sign leans back a little, so it reads from above. */}
      <group position={[0, 1.4, 0.06]} rotation-x={-0.45}>
        <Box p={[0, 0, 0]} s={[2, 0.5, 0.05]} c="#3e2723" />
        <mesh position-z={0.028}>
          <planeGeometry args={[1.9, 0.42]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>
      {[-0.6, 0.6].map((x) => <Box key={x} p={[x, 1.6, 0.06]} s={[0.02, 0.18, 0.02]} c="#263238" />)}
      <Tyre p={[1.15, 1.1, 0.14]} flat={false} />
      {/* The gates, swung open against the fence. */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 1.15, 0, -0.02]} rotation-y={sd * -1.35}>
          <Box p={[-sd * 0.5, 0.3, 0]} s={[1, 0.04, 0.03]} c="#78909c" />
          <Box p={[-sd * 0.5, 0.58, 0]} s={[1, 0.04, 0.03]} c="#78909c" />
          <Box p={[-sd * 0.5, 0.44, 0]} s={[1, 0.3, 0.012]} c="#b0bec5" t={corrugatedTex(2, 1)} />
          <Box p={[-sd, 0.3, 0]} s={[0.04, 0.6, 0.04]} c="#78909c" />
        </group>
      ))}
    </group>
  )
}

// ---- The middle of the loop ----

type Item = 'office' | 'stack' | 'tyres' | 'shell' | 'drums' | 'engine' | 'mast' | 'hay' | 'stack2' | 'van' | 'cones' | 'scrap'
const ORDER: Item[] = ['office', 'stack', 'shell', 'tyres', 'mast', 'drums', 'van', 'engine', 'stack2', 'scrap', 'cones', 'tyres', 'drums', 'scrap']

// Where things fit in the middle of the loop: a grid of points kept clear of
// the road and every search spot, nearest the middle first.
export function yardSlots(L: LotLayout) {
  const tall = L.rz > L.rx
  const out: { x: number; z: number; ry: number }[] = []
  for (let i = -6; i <= 6; i++)
    for (let j = -3; j <= 3; j++) {
      const x = tall ? j * 1.5 : i * 1.5
      const z = tall ? i * 1.5 : j * 1.5
      const clear = L.spots.every((p) => Math.hypot(p.x - x, p.z - z) > 2.1) && L.pts.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.45)
      if (clear) out.push({ x, z, ry: tall ? Math.PI / 2 : 0 })
    }
  return out.sort((a, b) => Math.hypot(a.x, a.z * 1.3) - Math.hypot(b.x, b.z * 1.3)).slice(0, ORDER.length)
}

// Where Rusty stands: by the office door.
export function rustySpot(L: LotLayout) {
  const s = yardSlots(L)[0]
  if (!s) return null
  const c = Math.cos(s.ry)
  const sn = Math.sin(s.ry)
  // Office-local (0.1, 0.62) turned by its yaw.
  return { x: s.x + 0.1 * c + 0.62 * sn, z: s.z - 0.1 * sn + 0.62 * c }
}

function Cones({ p, ry = 0 }: { p: V3; ry?: number }) {
  return (
    <group position={p} rotation-y={ry}>
      {[[-0.4, 0], [0, 0.1], [0.4, 0]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box p={[0, 0.015, 0]} s={[0.2, 0.03, 0.2]} c="#e65100" />
          <mesh position-y={0.15}><coneGeometry args={[0.08, 0.26, 8]} /><meshStandardMaterial color="#ff6d00" /></mesh>
          <Cyl p={[0, 0.15, 0]} r={0.056} h={0.05} c="#fafafa" />
        </group>
      ))}
      <Box p={[0, 0.22, 0.05]} s={[0.85, 0.04, 0.04]} c="#fdd835" />
    </group>
  )
}

// Loose car parts: a door, a bonnet, a bumper and a couple of hubcaps.
function Scrap({ p, ry = 0, k = 0 }: { p: V3; ry?: number; k?: number }) {
  const c = WRECK[k % WRECK.length]
  return (
    <group position={p} rotation-y={ry}>
      <Box p={[-0.2, 0.03, 0]} s={[0.42, 0.04, 0.5]} c={c} rot={[0, 0.3, 0.05]} />
      <Box p={[0.25, 0.04, 0.15]} s={[0.36, 0.05, 0.3]} c={WRECK[(k + 2) % WRECK.length]} rot={[0.08, -0.4, 0]} />
      <Box p={[0.1, 0.05, -0.3]} s={[0.6, 0.08, 0.08]} c="#b0bec5" rot={[0, 0.2, 0]} />
      {[[0.35, -0.12], [-0.4, 0.32]].map(([x, z], i) => <Cyl key={i} p={[x, 0.015, z]} r={0.09} h={0.02} c="#cfd8dc" seg={12} />)}
    </group>
  )
}

function Centre({ L, look }: { L: LotLayout; look: YardLook }) {
  const slots = useMemo(() => yardSlots(L), [L])
  return (
    <group>
      {slots.map((s, i) => {
        let it = ORDER[i % ORDER.length]
        if (look.flavour === 'hay' && (it === 'stack2' || it === 'engine' || it === 'cones')) it = 'hay'
        const p: V3 = [s.x, 0, s.z]
        switch (it) {
          case 'office': return <Office key={i} p={p} ry={s.ry} />
          case 'stack': return <CrushedStack key={i} p={p} ry={s.ry + 0.2} n={4} />
          case 'stack2': return <CrushedStack key={i} p={p} ry={s.ry - 0.3} n={3} seed={3} />
          case 'tyres': return <TyreHeap key={i} p={p} />
          case 'shell': return <Shell key={i} p={p} ry={s.ry + Math.PI / 2 + 0.4} color="#8d6e63" />
          case 'van': return <Shell key={i} p={p} ry={s.ry + Math.PI / 2 - 0.3} body="van" color="#6a7f99" />
          case 'drums': return (
            <group key={i}>
              <Drum p={[s.x - 0.2, 0, s.z - 0.1]} c="#1e88e5" />
              <Drum p={[s.x + 0.08, 0, s.z - 0.18]} c="#e53935" />
              <Drum p={[s.x - 0.05, 0, s.z + 0.16]} c="#43a047" />
              <Drum p={[s.x + 0.38, 0.11, s.z + 0.1]} c="#fbc02d" tipped={0.6} />
              <Pallet p={[s.x - 0.45, 0, s.z + 0.3]} ry={0.4} />
            </group>
          )
          case 'engine': return <Engine key={i} p={p} ry={s.ry + 0.5} />
          case 'mast': return <Mast key={i} p={p} />
          case 'hay': return <HayBales key={i} p={p} />
          case 'cones': return <Cones key={i} p={p} ry={s.ry + 0.3} />
          case 'scrap': return <Scrap key={i} p={p} ry={i} k={i} />
        }
        return null
      })}
    </group>
  )
}

// Odds and ends scattered over the open dirt: single tyres, hubcaps, weeds,
// a patch of grass fighting back, an oily puddle. Kept off the road, the
// spots, the middle's junk and the way in.
function Litter({ L, X, Z, look }: { L: LotLayout; X: number; Z: number; look: YardLook }) {
  const items = useMemo(() => {
    const r = rand(53)
    const taken = yardSlots(L)
    const out: { x: number; z: number; k: number; a: number }[] = []
    for (let n = 0; n < 260 && out.length < 38; n++) {
      const x = (r() * 2 - 1) * (X - 0.5)
      const z = (r() * 2 - 1) * (Z - 0.5)
      const ok = L.pts.every(([px, pz]) => Math.hypot(px - x, pz - z) > 0.95) && L.spots.every((p) => Math.hypot(p.x - x, p.z - z) > 1.75) && taken.every((t) => Math.hypot(t.x - x, t.z - z) > 0.95) && !(Math.abs(x) < 1.3 && z > L.rz - 1) && out.every((o) => Math.hypot(o.x - x, o.z - z) > 0.7)
      if (ok) out.push({ x, z, k: Math.floor(r() * 8), a: r() * 6.28 })
    }
    return out
  }, [L, X, Z])
  const grass = look.flavour === 'desert' ? '#c5a35a' : '#8fbf5a'
  return (
    <group>
      {items.map(({ x, z, k, a }, i) => {
        switch (k) {
          case 0: return <Tyre key={i} p={[x, 0.07, z]} ry={a} />
          case 1: return <Cyl key={i} p={[x, 0.012, z]} r={0.09} h={0.02} c="#cfd8dc" seg={12} />
          case 2: return (
            <mesh key={i} rotation-x={-Math.PI / 2} position={[x, LAYER.base + 0.006, z]} scale={[1, 0.7, 1]} rotation-z={a}>
              <circleGeometry args={[0.45, 14]} />
              <meshStandardMaterial color={grass} />
            </mesh>
          )
          case 3: return (
            <mesh key={i} rotation-x={-Math.PI / 2} position={[x, LAYER.base + 0.008, z]} scale={[1, 0.6, 1]} rotation-z={a}>
              <circleGeometry args={[0.3, 14]} />
              <meshStandardMaterial color="#8a8079" roughness={0.25} />
            </mesh>
          )
          case 4: return <Box key={i} p={[x, 0.02, z]} s={[0.4, 0.03, 0.26]} c={WRECK[i % WRECK.length]} rot={[0, a, 0.04]} />
          default: return (
            <group key={i} position={[x, 0, z]} rotation-y={a}>
              {[[0, 0], [0.12, 0.06], [-0.08, 0.1]].map(([dx, dz], j) => (
                <mesh key={j} position={[dx, 0.08, dz]}>
                  <coneGeometry args={[0.08, 0.2, 5]} />
                  <meshStandardMaterial color={j % 2 ? '#7cb342' : '#558b2f'} />
                </mesh>
              ))}
            </group>
          )
        }
      })}
    </group>
  )
}

// Clutter round one search spot, off to the sides so the tarp has room to fly.
function SpotClutter({ x, z, yaw, k }: { x: number; z: number; yaw: number; k: number }) {
  // `a` is measured from the direction of the road.
  const at = (a: number, r: number, y = 0): V3 => [x + Math.sin(yaw + a) * r, y, z + Math.cos(yaw + a) * r]
  const kind = k % 4
  return (
    <group>
      {kind === 0 && [0, 1, 2].map((j) => <Tyre key={j} p={at(1.75, 1.15, 0.07 + j * 0.13)} ry={j} />)}
      {kind === 1 && <Drum p={at(-1.7, 1.15)} c={['#e53935', '#1e88e5', '#43a047'][k % 3]} />}
      {kind === 2 && <Pallet p={at(1.6, 1.15)} ry={yaw} />}
      {kind === 3 && <Drum p={at(-1.6, 1.15, 0.11)} c="#fbc02d" tipped={yaw} />}
      <Tyre p={at(-1.95, 1.2, 0.07)} ry={k} />
      {/* Weeds poking up round the pad. */}
      {[0.6, 2.4, -2.2].map((a, j) => (
        <mesh key={j} position={at(a + k, 1.3, 0.08)}>
          <coneGeometry args={[0.1, 0.18, 5]} />
          <meshStandardMaterial color={j % 2 ? '#7cb342' : '#558b2f'} />
        </mesh>
      ))}
    </group>
  )
}

// ---- Everything together ----

export function RescueYard({ L, spots, look }: { L: LotLayout; spots: { x: number; z: number; yaw: number }[]; look: YardLook }) {
  const { X, Z } = lotBounds(L)
  const lamps = useMemo<[number, number, number][]>(() => {
    const out: [number, number, number][] = [[-X + 0.4, -Z + 0.4, Math.PI * 0.25], [X - 0.4, -Z + 0.4, -Math.PI * 0.25], [-X + 0.4, Z - 0.4, Math.PI * 0.75], [X - 0.4, Z - 0.4, -Math.PI * 0.75]]
    if (X > Z) out.push([0, -Z + 0.4, 0], [-2.2, Z - 0.4, Math.PI], [2.2, Z - 0.4, Math.PI])
    else out.push([-X + 0.4, 0, Math.PI / 2], [X - 0.4, 0, -Math.PI / 2])
    return out
  }, [X, Z])
  return (
    <group>
      {/* The yard's dirt, and a gravel apron inside the gate. */}
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.base}>
        <planeGeometry args={[X * 2 + 0.3, Z * 2 + 0.3]} />
        <meshStandardMaterial color={look.dirt} map={dirtTex((X * 2) / 5, (Z * 2) / 5)} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.base + 0.01, Z - 0.9]}>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial color="#b9b4ac" map={gravelTex(3, 1.5)} />
      </mesh>
      <JunkFence X={X} Z={Z} colors={look.fence} />
      <Gate Z={Z} />
      {lamps.map(([x, z, ry], i) => (i < 4 ? <Mast key={i} p={[x, 0, z]} ry={ry} /> : <Lamp key={i} x={x} z={z} ry={ry} />))}
      <Centre L={L} look={look} />
      <Litter L={L} X={X} Z={Z} look={look} />
      {spots.map((p, i) => <SpotClutter key={i} x={p.x} z={p.z} yaw={p.yaw} k={i} />)}
    </group>
  )
}
