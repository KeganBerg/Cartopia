import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Color, type Group, type Material, type Mesh, type MeshStandardMaterial } from 'three'
import { useGame } from '../game/store'
import { lightTone, type ColorTheme } from '../game/cityLook'
import { glowMats, setLampTone } from './dayNight'

// Building colour themes (game/cityLook.ts): every plain material under a building is swapped
// for a tinted copy, made once per material and theme and shared, so Batch still merges them.
// Lit, see-through and lettered materials and greenery keep their own colours.
const live = new Set<Material>(Object.values(glowMats))
const tinted = new Map<string, Material>()
const hsl = { h: 0, s: 0, l: 0 }

function keeps(m: Material) {
  const c = (m as MeshStandardMaterial).color
  if (!c || live.has(m) || m.userData.live || m.transparent || (m as MeshStandardMaterial).map?.userData.text) return true
  c.getHSL(hsl)
  return hsl.h > 0.19 && hsl.h < 0.45 && hsl.s > 0.25 && hsl.l > 0.12
}

function tint(base: Material, t: ColorTheme) {
  const k = `${base.uuid}|${t.id}`
  let m = tinted.get(k)
  if (!m) {
    m = base.clone()
    ;(m as MeshStandardMaterial).color.lerp(new Color(t.c), t.amount)
    tinted.set(k, m)
  }
  return m
}

export function Tint({ theme, children }: { theme: ColorTheme | null; children: ReactNode }) {
  const ref = useRef<Group>(null)
  // Every commit: a level change can bring new meshes. Runs before the town's Batch merges.
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material)) return
      const u = mesh.userData
      // React may have given the mesh a new material since it was tinted.
      if (u.tinted && mesh.material !== u.tinted) u.base = undefined
      const base: Material = u.base ?? mesh.material
      if (!theme || keeps(base)) {
        if (u.base) mesh.material = base
        u.base = u.tinted = undefined
        return
      }
      u.base = base
      mesh.material = u.tinted = tint(base, theme)
    })
  })
  return <group ref={ref}>{children}</group>
}

// Keeps the street light colour in step with the save.
export function LampTone() {
  const c = useGame((s) => lightTone(s.lights).c)
  useEffect(() => setLampTone(c), [c])
  return null
}
