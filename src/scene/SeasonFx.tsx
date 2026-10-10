import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, type Points } from 'three'
import { SEASON } from './season'

const FX = {
  fall: { colors: ['#e65100', '#ff8f00', '#c62828', '#fbc02d'], fall: 1.2, sway: 1.2, size: 6 },
  winter: { colors: ['#ffffff', '#f1f5ff'], fall: 1.6, sway: 0.5, size: 4 },
  spring: { colors: ['#f8bbd0', '#ffffff', '#f48fb1'], fall: 0.9, sway: 1.4, size: 4 },
} as const

const SPAN = 56
const TOP = 22

// Falling leaves in fall, snow in winter and blossom petals in spring.
// One Points object, so it costs a single draw call.
export function SeasonFx({ small }: { small: boolean }) {
  const fx = SEASON === 'summer' ? null : FX[SEASON]
  const count = small ? 160 : 320
  const ref = useRef<Points>(null)
  const { geo, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const c = { r: 0, g: 0, b: 0 }
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPAN
      pos[i * 3 + 1] = Math.random() * TOP
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPAN
      seeds[i] = Math.random() * 100
      const hex = fx ? fx.colors[i % fx.colors.length] : '#ffffff'
      c.r = parseInt(hex.slice(1, 3), 16) / 255
      c.g = parseInt(hex.slice(3, 5), 16) / 255
      c.b = parseInt(hex.slice(5, 7), 16) / 255
      col.set([c.r, c.g, c.b], i * 3)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    return { geo, seeds }
  }, [count, fx])
  useFrame(({ clock }, dt) => {
    if (!fx || !ref.current) return
    const step = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const p = geo.attributes.position as BufferAttribute
    const a = p.array as Float32Array
    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      a[i * 3] += Math.sin(t * 0.8 + s) * fx.sway * step
      a[i * 3 + 1] -= fx.fall * (0.7 + (s % 1) * 0.6) * step
      a[i * 3 + 2] += Math.cos(t * 0.6 + s) * fx.sway * 0.5 * step
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += TOP
    }
    p.needsUpdate = true
  })
  if (!fx) return null
  return (
    <points ref={ref} geometry={geo} raycast={() => null} frustumCulled={false}>
      <pointsMaterial vertexColors size={fx.size} sizeAttenuation={false} transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}
