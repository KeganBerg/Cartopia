import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, type Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Body, ModSlot } from '../game/data'
import { carFrame } from './CarModel'

// Bolt-on mod parts for a car. Every part of one material is merged into a
// single mesh, so a fully modded car adds at most four draw calls (paint,
// carbon, chrome and, in races, exhaust flames) however many parts it wears.

type Frame = ReturnType<typeof carFrame>
type Kind = 'paint' | 'carbon' | 'chrome' | 'flame'
type Parts = Record<Kind, BufferGeometry[]>

const carbon = new MeshStandardMaterial({ color: '#1d1f22', metalness: 0.35, roughness: 0.45 })
// Kept off full metal so it still reads as bright chrome in previews that have no reflections.
const chrome = new MeshStandardMaterial({ color: '#f5f7f8', metalness: 0.6, roughness: 0.2 })
const flame = new MeshBasicMaterial({ color: '#ff8f00', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false })

function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) {
  const g = new BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

// A pipe running along the car (z axis).
function pipe(r: number, len: number, x: number, y: number, z: number, r2 = r) {
  const g = new CylinderGeometry(r2, r, len, 10, 1, false)
  g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

const BUILD: Record<string, (f: Frame, p: Parts) => void> = {
  // Spoilers sit on the rear deck.
  ducktail: (f, p) => {
    p.paint.push(box(f.wid * 0.86, 0.035, 0.13, 0, f.deck + 0.02, -f.len / 2 + 0.08, 0.35))
  },
  gtwing: (f, p) => {
    const z = -f.len / 2 + 0.08
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.03, 0.17, 0.05, sd * f.wid * 0.3, f.deck + 0.085, z))
      p.carbon.push(box(0.015, 0.07, 0.18, sd * f.wid * 0.49, f.deck + 0.18, z))
    }
    p.paint.push(box(f.wid * 0.98, 0.025, 0.17, 0, f.deck + 0.18, z, 0.12))
  },
  attackwing: (f, p) => {
    const z = -f.len / 2 + 0.05
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.025, 0.28, 0.05, sd * f.wid * 0.22, f.deck + 0.14, z))
      p.paint.push(box(0.016, 0.12, 0.24, sd * f.wid * 0.56, f.deck + 0.27, z))
    }
    p.carbon.push(box(f.wid * 1.12, 0.024, 0.2, 0, f.deck + 0.28, z, 0.18))
    p.carbon.push(box(f.wid * 1.12, 0.018, 0.1, 0, f.deck + 0.33, z - 0.07, 0.45))
  },

  // Exhausts.
  twintips: (f, p) => {
    for (const sd of [-1, 1]) p.chrome.push(pipe(0.028, 0.09, sd * f.wid * 0.26, f.lift + 0.06, -f.len / 2 - 0.02))
  },
  sidepipes: (f, p) => {
    for (const sd of [-1, 1]) {
      const x = sd * (f.wid / 2 + 0.035)
      p.chrome.push(pipe(0.028, f.len * 0.42, x, f.lift + 0.045, -f.len * 0.04))
      p.carbon.push(box(0.02, 0.05, f.len * 0.3, x + sd * 0.02, f.lift + 0.05, -f.len * 0.04))
      p.chrome.push(pipe(0.022, 0.06, x, f.lift + 0.045, f.len * 0.19, 0.034))
    }
  },
  flamepipes: (f, p) => {
    for (const x of [-0.22, -0.12, 0.12, 0.22]) {
      const px = x * f.wid * 1.6
      p.chrome.push(pipe(0.03, 0.12, px, f.lift + 0.065, -f.len / 2 - 0.03, 0.036))
      p.carbon.push(pipe(0.022, 0.125, px, f.lift + 0.065, -f.len / 2 - 0.03))
      const c = new ConeGeometry(0.035, 0.22, 8)
      c.rotateX(-Math.PI / 2)
      // Relative to the pipe exits (see FLAME_Z), so the flicker scales out from the pipes.
      c.translate(px, f.lift + 0.065, -0.11)
      p.flame.push(c)
    }
  },

  // Body kits.
  streetkit: (f, p) => {
    p.carbon.push(box(f.wid * 0.98, 0.025, 0.08, 0, f.lift + 0.025, f.len / 2 + 0.015))
    p.carbon.push(box(f.wid * 0.7, 0.03, 0.07, 0, f.lift + 0.03, -f.len / 2 - 0.01))
    for (const sd of [-1, 1]) p.paint.push(box(0.03, 0.05, f.len * 0.42, sd * (f.wid / 2 + 0.012), f.lift + 0.055, 0))
  },
  widebody: (f, p) => {
    for (const sd of [-1, 1]) {
      for (const z of [f.wz, -f.wz]) {
        // Bolt-on arch over each tyre: a flattened half ring on the side of the car.
        const g = new TorusGeometry(f.wheel * 1.2, 0.035, 6, 14, Math.PI)
        g.scale(1, 1, 1.7)
        g.rotateY(Math.PI / 2)
        g.translate(sd * (f.wid / 2 + 0.035), f.wheel, z)
        p.paint.push(g)
      }
      p.paint.push(box(0.05, 0.06, f.wz * 2 - f.wheel * 2.6, sd * (f.wid / 2 + 0.02), f.lift + 0.055, 0))
    }
    p.carbon.push(box(f.wid * 1.05, 0.025, 0.1, 0, f.lift + 0.025, f.len / 2 + 0.02))
  },
  carbonkit: (f, p) => {
    p.carbon.push(box(f.wid * 1.08, 0.022, 0.14, 0, f.lift + 0.022, f.len / 2 + 0.03))
    for (const sd of [-1, 1]) {
      p.carbon.push(box(0.04, 0.05, f.len * 0.46, sd * (f.wid / 2 + 0.018), f.lift + 0.05, 0))
      // Canards on the front corners.
      p.carbon.push(box(0.1, 0.012, 0.06, sd * (f.wid / 2 - 0.02), f.lift + 0.13, f.len / 2 - 0.02, 0, sd * 0.4))
    }
    p.carbon.push(box(f.wid * 0.8, 0.025, 0.1, 0, f.lift + 0.03, -f.len / 2 - 0.03))
    for (const x of [-0.2, 0, 0.2]) p.carbon.push(box(0.012, 0.06, 0.1, x * f.wid, f.lift + 0.06, -f.len / 2 - 0.03))
  },

  // Hoods.
  vented: (f, p) => {
    for (const sd of [-1, 1]) for (const k of [0, 1, 2]) p.carbon.push(box(0.09, 0.012, 0.022, sd * 0.1, f.hoodTop + 0.006, f.hoodZ - 0.05 + k * 0.045))
  },
  ramscoop: (f, p) => {
    p.paint.push(box(0.22, 0.06, 0.2, 0, f.hoodTop + 0.02, f.hoodZ, -0.12))
    p.carbon.push(box(0.17, 0.04, 0.01, 0, f.hoodTop + 0.035, f.hoodZ + 0.1))
  },
  blower: (f, p) => {
    p.chrome.push(box(0.15, 0.09, 0.14, 0, f.hoodTop + 0.045, f.hoodZ - 0.01))
    for (const x of [-0.045, 0, 0.045]) p.chrome.push(box(0.012, 0.1, 0.15, x, f.hoodTop + 0.05, f.hoodZ - 0.01))
    p.carbon.push(box(0.18, 0.06, 0.1, 0, f.hoodTop + 0.12, f.hoodZ + 0.01, -0.15))
  },
}

// How far behind the bumper the flame pipes end.
const FLAME_Z = 0.09

const cache = new Map<string, Partial<Record<Kind, BufferGeometry>>>()

function modGeo(body: Body, ids: string[]) {
  const key = `${body}|${ids.join(',')}`
  const hit = cache.get(key)
  if (hit) return hit
  const f = carFrame(body)
  const parts: Parts = { paint: [], carbon: [], chrome: [], flame: [] }
  for (const id of ids) BUILD[id]?.(f, parts)
  const out: Partial<Record<Kind, BufferGeometry>> = {}
  for (const k of Object.keys(parts) as Kind[]) {
    const list = parts[k]
    if (!list.length) continue
    out[k] = mergeGeometries(list.map((g) => g.toNonIndexed()))
    list.forEach((g) => g.dispose())
  }
  cache.set(key, out)
  return out
}

function Flames({ geometry }: { geometry: BufferGeometry }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime * 30
    m.scale.set(1, 1, 0.7 + 0.3 * Math.abs(Math.sin(t) * Math.cos(t * 0.37)))
  })
  return <mesh ref={ref} geometry={geometry} material={flame} renderOrder={3} />
}

export function CarMods({ body, fit, tint, metal, flames }: { body: Body; fit: Partial<Record<ModSlot, string>>; tint: string; metal: number; flames?: boolean }) {
  const ids = (['spoiler', 'exhaust', 'kit', 'hood'] as ModSlot[]).map((s) => fit[s]).filter((id): id is string => !!id)
  if (!ids.length) return null
  const g = modGeo(body, ids)
  return (
    <group>
      {g.paint && <mesh geometry={g.paint} castShadow><meshStandardMaterial color={tint} metalness={metal} roughness={0.3} /></mesh>}
      {g.carbon && <mesh geometry={g.carbon} material={carbon} castShadow />}
      {g.chrome && <mesh geometry={g.chrome} material={chrome} />}
      {g.flame && flames && (
        <group position-z={-carFrame(body).len / 2 - FLAME_Z}><Flames geometry={g.flame} /></group>
      )}
    </group>
  )
}

// Rim finish for a Rims mod: [colour, metalness, roughness].
export const RIM_LOOK: Record<string, [string, number, number]> = {
  chrome: ['#ffffff', 0.2, 0.1],
  goldmesh: ['#ffc23d', 0.5, 0.25],
  forged: ['#3a3a3a', 0.3, 0.4],
}
