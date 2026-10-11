import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry, type Group } from 'three'
import { create } from 'zustand'
import { onFx, reducedMotion } from '../game/fx'
import { useGame, lotSize } from '../game/store'
import { buildingDef, TILE } from '../game/data'
import { weatherNow } from '../game/weather'
import { toWorld } from './grid'

// One-shot town effects (a building dropping in, an upgrade sparkling, a
// boulder going poof) and the chimney smoke over busy businesses. Two
// instanced meshes draw every particle, so the whole lot costs two draws.

const POP_MS = 900

// Buildings mid-pop. World skips them when merging the town (they need to move),
// and re-merges once they settle.
export const usePops = create<{ pops: Record<string, { kind: 'built' | 'upgraded'; at: number }> }>(() => ({ pops: {} }))

function addPop(uids: string[], kind: 'built' | 'upgraded') {
  const at = performance.now()
  usePops.setState((s) => {
    const pops = { ...s.pops }
    for (const u of uids) pops[u] = { kind, at }
    return { pops }
  })
  setTimeout(() => {
    usePops.setState((s) => {
      const pops = { ...s.pops }
      for (const u of uids) if (pops[u]?.at === at) delete pops[u]
      return { pops }
    })
  }, POP_MS + 50)
}

// Squash-and-stretch on a building that just landed or levelled up.
export function PopGroup({ uid, children }: { uid: string; children: React.ReactNode }) {
  const g = useRef<Group>(null)
  const pop = usePops((s) => s.pops[uid])
  useFrame(() => {
    const o = g.current
    if (!o) return
    if (!pop) {
      o.scale.set(1, 1, 1)
      o.position.y = 0
      return
    }
    const t = Math.min(1, (performance.now() - pop.at) / POP_MS)
    if (pop.kind === 'built') {
      // Drops from above, lands squashed, springs back.
      const fall = Math.min(1, t / 0.32)
      o.position.y = (1 - fall * fall) * 4
      const after = Math.max(0, (t - 0.32) / 0.68)
      const wob = fall < 1 ? 0 : Math.sin(after * Math.PI * 3) * Math.exp(-after * 4) * 0.28
      o.scale.set(1 + wob * 0.6, Math.max(0.05, 1 - wob), 1 + wob * 0.6)
    } else {
      // A quick stretch up, then a bouncy settle.
      const wob = Math.sin(t * Math.PI * 3) * Math.exp(-t * 3.5) * 0.22
      o.position.y = 0
      o.scale.set(1 - wob * 0.5, 1 + wob, 1 - wob * 0.5)
    }
  })
  return (
    <group ref={g} userData={{ noBatch: !!pop }}>
      {children}
    </group>
  )
}

type Kind = 0 | 1 // 0 = puff (smoke, dust), 1 = sparkle
type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number; grow: number; spin: number; drag: number; lift: number; color: Color }

const MAX = { 0: 220, 1: 120 }
const tmp = new Object3D()

const DUST = [new Color('#d7ccc8'), new Color('#efebe9'), new Color('#bcaaa4')]
const SMOKE = [new Color('#cfd8dc'), new Color('#eceff1'), new Color('#b0bec5')]
const SUDS = [new Color('#e1f5fe'), new Color('#ffffff'), new Color('#b3e5fc')]
const GOLD = [new Color('#ffd54f'), new Color('#fff59d'), new Color('#ffffff')]
const LEAF = [new Color('#7cb342'), new Color('#558b2f'), new Color('#9ccc65')]
const STONE = [new Color('#9e9e9e'), new Color('#bdbdbd'), new Color('#757575')]
const pick = (c: Color[]) => c[(Math.random() * c.length) | 0]

function footprint(def: string, x: number, z: number, rot?: number) {
  const [w, h] = lotSize(def, rot)
  const [cx, cz] = toWorld(x + (w - 1) / 2, z + (h - 1) / 2)
  return { cx, cz, w: w * TILE, h: h * TILE }
}

export function WorldFx({ small }: { small: boolean }) {
  const parts = useRef<P[][]>([[], []])
  const puffs = useRef<InstancedMesh>(null)
  const sparks = useRef<InstancedMesh>(null)
  const smokeClock = useRef(0)
  const geo = useMemo(() => [new IcosahedronGeometry(0.5, 1), new OctahedronGeometry(0.5, 0)] as const, [])
  const mats = useMemo(
    () => [new MeshStandardMaterial({ roughness: 1, flatShading: true, emissive: '#3a3a3a' }), new MeshBasicMaterial({ toneMapped: false })] as const,
    [],
  )

  const add = (k: Kind, p: Omit<P, 'age'>) => {
    const list = parts.current[k]
    if (list.length >= MAX[k]) list.shift()
    list.push({ ...p, age: 0 })
  }

  useEffect(
    () =>
      onFx((e) => {
        if (reducedMotion()) return
        const s = useGame.getState()
        const town = (s.visiting ?? s).buildings
        if (e.kind === 'built') {
          addPop([e.uid], 'built')
          // The building lands a beat after it's placed; kick up dust then.
          setTimeout(() => {
            const b = useGame.getState().buildings.find((o) => o.uid === e.uid)
            if (!b) return
            const f = footprint(b.def, b.x, b.z, b.rot)
            const n = small ? 14 : 22
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + Math.random() * 0.3
              const r = 0.5 * Math.max(f.w, f.h) * 0.85
              const sp = 1.6 + Math.random() * 1.4
              add(0, { x: f.cx + Math.cos(a) * r, y: 0.15, z: f.cz + Math.sin(a) * r, vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.8, vz: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.4, size: 0.35 + Math.random() * 0.3, grow: 1.2, spin: 0, drag: 3, lift: 0, color: pick(DUST) })
            }
          }, POP_MS * 0.3)
        } else if (e.kind === 'upgraded') {
          addPop(e.uids, 'upgraded')
          const b = town.find((o) => e.uids.includes(o.uid))
          if (!b) return
          let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
          for (const o of town.filter((t) => e.uids.includes(t.uid))) {
            const f = footprint(o.def, o.x, o.z, o.rot)
            minX = Math.min(minX, f.cx - f.w / 2); maxX = Math.max(maxX, f.cx + f.w / 2)
            minZ = Math.min(minZ, f.cz - f.h / 2); maxZ = Math.max(maxZ, f.cz + f.h / 2)
          }
          const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, r = Math.max(maxX - minX, maxZ - minZ) * 0.5
          const n = small ? 22 : 36
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            add(1, { x: cx + Math.cos(a) * r, y: 0.2 + Math.random() * 0.6, z: cz + Math.sin(a) * r, vx: -Math.sin(a) * 1.2, vy: 2.2 + Math.random() * 2.2, vz: Math.cos(a) * 1.2, life: 0.9 + Math.random() * 0.5, size: 0.22 + Math.random() * 0.16, grow: -0.6, spin: 6, drag: 0.8, lift: -1.5, color: pick(GOLD) })
          }
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2
            add(0, { x: cx + Math.cos(a) * r, y: 0.1, z: cz + Math.sin(a) * r, vx: Math.cos(a) * 1.5, vy: 0.3, vz: Math.sin(a) * 1.5, life: 0.6, size: 0.3, grow: 1, spin: 0, drag: 3, lift: 0, color: pick(DUST) })
          }
        } else if (e.kind === 'cleared') {
          const b = town.find((o) => o.uid === e.uid)
          if (!b) return
          const f = footprint(b.def, b.x, b.z, b.rot)
          const bits = b.def === 'rock' ? STONE : LEAF
          for (let i = 0; i < (small ? 16 : 24); i++) {
            const a = Math.random() * Math.PI * 2
            const sp = 0.6 + Math.random() * 1.6
            add(0, { x: f.cx + Math.cos(a) * 0.3, y: 0.3 + Math.random() * 0.8, z: f.cz + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 1.6, vz: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.5, size: 0.45 + Math.random() * 0.35, grow: 1.4, spin: 0, drag: 2.5, lift: 0.2, color: pick(DUST) })
          }
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2
            add(1, { x: f.cx, y: 0.6, z: f.cz, vx: Math.cos(a) * 2.5, vy: 3 + Math.random() * 2, vz: Math.sin(a) * 2.5, life: 0.9, size: 0.2, grow: -0.3, spin: 9, drag: 0.5, lift: -9, color: pick(bits) })
          }
        }
      }),
    [small],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt)
    // Busy businesses puff smoke from the roof (bubbles at the car wash).
    smokeClock.current += dt
    if (smokeClock.current > (small ? 0.5 : 0.3)) {
      smokeClock.current = 0
      const s = useGame.getState()
      const now = Date.now()
      const busy = (s.visiting ?? s).buildings.filter((b) => b.jobEndsAt !== null && now < b.jobEndsAt && buildingDef(b.def).kind !== 'obstacle')
      if (busy.length && !reducedMotion()) {
        const b = busy[(Math.random() * busy.length) | 0]
        const d = buildingDef(b.def)
        const f = footprint(b.def, b.x, b.z, b.rot)
        const wash = b.def === 'carwash'
        const wind = weatherNow(now).wind
        const top = (d.w > 1 ? 2.1 : 1.7) + (b.level ?? 1) * 0.04
        add(0, {
          x: f.cx + f.w * (wash ? 0 : 0.28) + (Math.random() - 0.5) * 0.2,
          y: wash ? 0.8 : top,
          z: f.cz - f.h * (wash ? 0 : 0.2) + (Math.random() - 0.5) * 0.2,
          vx: 0.15 + wind * 1.2 + (wash ? (Math.random() - 0.5) * 1.2 : 0),
          vy: wash ? 0.9 : 0.6,
          vz: wash ? (Math.random() - 0.5) * 1.2 : 0,
          life: wash ? 1.4 : 2.2,
          size: wash ? 0.18 + Math.random() * 0.12 : 0.22,
          grow: wash ? 0.2 : 0.7,
          spin: 0, drag: 0.4, lift: 0.1,
          color: pick(wash ? SUDS : SMOKE),
        })
      }
    }

    for (const k of [0, 1] as Kind[]) {
      const mesh = (k ? sparks : puffs).current
      if (!mesh) continue
      const list = parts.current[k]
      let n = 0
      for (let i = 0; i < list.length; i++) {
        const p = list[i]
        p.age += dt
        if (p.age >= p.life) continue
        const damp = Math.exp(-p.drag * dt)
        p.vx *= damp; p.vz *= damp
        p.vy = p.vy * damp + p.lift * dt
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
        if (p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy) * 0.3 }
        const t = p.age / p.life
        // Puffs swell then shrink away; sparkles twinkle out.
        const sz = Math.max(0.001, p.size * (1 + p.grow * t) * (k ? 1 - t * t : Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6))
        tmp.position.set(p.x, p.y, p.z)
        tmp.rotation.set(p.age * p.spin, p.age * p.spin * 0.7, 0)
        tmp.scale.setScalar(sz)
        tmp.updateMatrix()
        mesh.setMatrixAt(n, tmp.matrix)
        mesh.setColorAt(n, p.color)
        list[n] = p
        n++
      }
      list.length = n
      mesh.count = n
      mesh.visible = n > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={puffs} args={[geo[0], mats[0], MAX[0]]} frustumCulled={false} visible={false} userData={{ noBatch: true }} />
      <instancedMesh ref={sparks} args={[geo[1], mats[1], MAX[1]]} frustumCulled={false} visible={false} userData={{ noBatch: true }} />
    </>
  )
}
