import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type Group, type InstancedMesh } from 'three'
import { towerTex, towerGlowTex } from './textures'

// Taller buildings behind the street: a second row along both sides and a
// far-off downtown that travels with the camera, so the horizon is never
// empty. Two instanced meshes keep it to a couple of draw calls.

// Look knobs, kept together so the race lighting is easy to retune.
export const SKYLINE = {
  day: ['#b0bec5', '#cfd8dc', '#90a4ae', '#d7ccc8', '#bcaaa4', '#9fa8da', '#a5d6a7'],
  night: '#2a3350',
  glow: 0.9, // window glow at full night
}

type Tower = { x: number; z: number; w: number; d: number; h: number; c: number }

// Deterministic so the street looks the same every race.
function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

function useTowers(make: (r: () => number) => Tower[], seed: number) {
  return useMemo(() => make(rand(seed)), [make, seed])
}

function Towers({ towers, night }: { towers: Tower[]; night: number }) {
  const ref = useRef<InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    const dark = new Color(SKYLINE.night)
    towers.forEach((t, i) => {
      o.position.set(t.x, t.h / 2, t.z)
      o.scale.set(t.w, t.h, t.d)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(SKYLINE.day[t.c % SKYLINE.day.length]).lerp(dark, night * 0.7))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [towers, night])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, towers.length]} raycast={() => null}>
      <boxGeometry />
      <meshStandardMaterial map={towerTex()} emissiveMap={towerGlowTex()} emissive="#ffffff" emissiveIntensity={night * SKYLINE.glow} roughness={0.8} />
    </instancedMesh>
  )
}

export function Skyline({ len, edge, night }: { len: number; edge: number; night: number }) {
  // Second row: mid-rise blocks just behind the shops on both sides.
  const row = useTowers(
    useMemo(
      () => (r: () => number) => {
        const out: Tower[] = []
        for (const side of [-1, 1]) {
          for (let z = -14; z < len + 60; ) {
            const w = 2.2 + r() * 2.2
            out.push({ x: side * (edge + 2 + r() * 3 + w / 2), z: z + w / 2, w, d: 2.5 + r() * 2, h: 3 + r() * 4.5, c: Math.floor(r() * 99) })
            z += w + 0.3 + r() * 1.2
          }
        }
        return out
      },
      [len, edge],
    ),
    11,
  )
  // Downtown: tall towers spread across the far end of the view.
  const far = useTowers(
    useMemo(
      () => (r: () => number) =>
        Array.from({ length: 34 }, (_, i) => {
          const x = (i / 33 - 0.5) * 110 + (r() - 0.5) * 3
          const mid = 1 - Math.min(1, Math.abs(x) / 35)
          const w = 4 + r() * 5
          return { x, z: 66 + r() * 12, w, d: w * (0.8 + r() * 0.4), h: 10 + r() * 9 + mid * 16, c: Math.floor(r() * 99) }
        }),
      [],
    ),
    23,
  )
  const downtown = useRef<Group>(null)
  // Far towers ride along with the camera: too far away to show parallax.
  useFrame(({ camera }) => downtown.current?.position.set(0, 0, camera.position.z))
  return (
    <>
      <Towers towers={row} night={night} />
      <group ref={downtown}>
        <Towers towers={far} night={night} />
      </group>
    </>
  )
}
