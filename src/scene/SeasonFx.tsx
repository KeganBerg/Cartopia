import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Object3D, Shape, ShapeGeometry, type InstancedMesh } from 'three'
import { SEASON } from './season'
import { dayPhase, nightAmount } from './dayNight'
import { weatherNow } from '../game/weather'

type Fx = { colors: readonly string[]; fall: number; sway: number; size: number; shape: 'leaf' | 'petal' | 'flake' }
const FX: Record<'fall' | 'winter' | 'spring', Fx> = {
  fall: { colors: ['#ff7a1a', '#ffa726', '#e53935', '#ffd54f', '#d2691e'], fall: 1.1, sway: 1.2, size: 0.6, shape: 'leaf' },
  winter: { colors: ['#ffffff', '#f1f5ff'], fall: 1.6, sway: 0.5, size: 4, shape: 'flake' },
  spring: { colors: ['#f8bbd0', '#ffffff', '#f48fb1'], fall: 0.8, sway: 1.4, size: 0.4, shape: 'petal' },
}

const SPAN = 56
const TOP = 22
const PARKED = -100 // below the ground, out of sight
// Nothing new takes off at night, or while rain knocks leaves and petals down.
const isNight = () => nightAmount(dayPhase()) > 0.5 || weatherNow().rain > 0.15
// In the morning a parked flake rejoins after about this many seconds on average,
// so the sky fills from the top gradually rather than all at once.
const REJOIN_S = 6

// A shared breeze: a steady drift plus slow gusts, so everything leans the same way.
// Windy weather and blizzards blow it much harder.
const wind = (t: number) => (0.6 + Math.sin(t * 0.23) * 0.5 + Math.max(0, Math.sin(t * 0.61)) * 0.9) * (1 + weatherNow().wind * 3)

type Flier = { x: Float32Array; y: Float32Array; z: Float32Array; seed: Float32Array }

function makeFliers(count: number): Flier {
  const night = isNight()
  const f = { x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count), seed: new Float32Array(count) }
  for (let i = 0; i < count; i++) {
    f.x[i] = (Math.random() - 0.5) * SPAN
    f.y[i] = night ? PARKED : Math.random() * TOP
    f.z[i] = (Math.random() - 0.5) * SPAN
    f.seed[i] = Math.random() * 100
  }
  return f
}

// Drift every flier one step. Only during the day: at dusk nothing new spawns
// and the last ones land, and in the morning they start again from the top.
function drift(f: Flier, fx: Fx, t: number, step: number) {
  const night = isNight()
  const w = wind(t)
  for (let i = 0; i < f.y.length; i++) {
    const s = f.seed[i]
    if (f.y[i] === PARKED) {
      if (night || Math.random() > step / REJOIN_S) continue
      f.x[i] = (Math.random() - 0.5) * SPAN
      f.y[i] = TOP
      f.z[i] = (Math.random() - 0.5) * SPAN
    }
    f.x[i] += (Math.sin(t * 0.8 + s) * fx.sway + w * fx.sway) * step
    f.y[i] -= fx.fall * (0.7 + (s % 1) * 0.6) * (1 + Math.sin(t * 2.3 + s) * 0.35) * step
    f.z[i] += (Math.cos(t * 0.6 + s) * fx.sway * 0.5 + w * fx.sway * 0.4) * step
    // Blown off one side: come back in on the other.
    if (f.x[i] > SPAN / 2) f.x[i] -= SPAN
    if (f.z[i] > SPAN / 2) f.z[i] -= SPAN
    if (f.y[i] < 0) f.y[i] = night ? PARKED : f.y[i] + TOP
  }
}

function leafShape(kind: 'leaf' | 'petal') {
  const s = new Shape()
  if (kind === 'petal') {
    s.moveTo(0, -0.5)
    s.quadraticCurveTo(0.5, -0.1, 0.18, 0.45)
    s.quadraticCurveTo(0, 0.3, -0.18, 0.45)
    s.quadraticCurveTo(-0.5, -0.1, 0, -0.5)
  } else {
    // Pointed leaf with a little stem.
    s.moveTo(0, -0.62)
    s.lineTo(0.03, -0.42)
    s.quadraticCurveTo(0.42, -0.3, 0.32, 0.05)
    s.quadraticCurveTo(0.22, 0.32, 0, 0.55)
    s.quadraticCurveTo(-0.22, 0.32, -0.32, 0.05)
    s.quadraticCurveTo(-0.42, -0.3, -0.03, -0.42)
    s.lineTo(0, -0.62)
  }
  return new ShapeGeometry(s, 3)
}

// Leaves and petals: small flat shapes that tumble and flutter as they blow
// across town. One instanced mesh, so a single draw call.
function Leaves({ fx, count }: { fx: Fx; count: number }) {
  const ref = useRef<InstancedMesh>(null)
  const fliers = useMemo(() => makeFliers(count), [count])
  const geo = useMemo(() => leafShape(fx.shape === 'petal' ? 'petal' : 'leaf'), [fx])
  const o = useMemo(() => new Object3D(), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const c = new Color()
    for (let i = 0; i < count; i++) m.setColorAt(i, c.set(fx.colors[i % fx.colors.length]).offsetHSL(0, 0, (fliers.seed[i] % 1) * 0.1 - 0.05))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count, fx, fliers])
  useFrame(({ clock }, dt) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    drift(fliers, fx, t, Math.min(dt, 0.1))
    for (let i = 0; i < count; i++) {
      const s = fliers.seed[i]
      o.position.set(fliers.x[i], fliers.y[i], fliers.z[i])
      // Each leaf spins at its own pace and rocks side to side as it falls.
      o.rotation.set(t * (1.1 + (s % 1.7)) + s, t * 0.7 + s * 2, Math.sin(t * 2.6 + s) * 0.9)
      o.scale.setScalar(fx.size * (0.75 + (s % 0.5)))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} raycast={() => null} frustumCulled={false}>
      <meshLambertMaterial side={DoubleSide} />
    </instancedMesh>
  )
}

// Snow: soft round dots, one Points object.
function Snow({ fx, count }: { fx: Fx; count: number }) {
  const fliers = useMemo(() => makeFliers(count), [count])
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    return g
  }, [count])
  useFrame(({ clock }, dt) => {
    drift(fliers, fx, clock.elapsedTime, Math.min(dt, 0.1))
    const p = geo.attributes.position as BufferAttribute
    const a = p.array as Float32Array
    for (let i = 0; i < count; i++) { a[i * 3] = fliers.x[i]; a[i * 3 + 1] = fliers.y[i]; a[i * 3 + 2] = fliers.z[i] }
    p.needsUpdate = true
  })
  return (
    <points geometry={geo} raycast={() => null} frustumCulled={false}>
      <pointsMaterial color={fx.colors[0]} size={fx.size} sizeAttenuation={false} transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

// Falling leaves in fall, snow in winter and blossom petals in spring.
export function SeasonFx({ small }: { small: boolean }) {
  if (SEASON === 'summer') return null
  const fx = FX[SEASON]
  if (fx.shape === 'flake') return <Snow fx={fx} count={small ? 160 : 320} />
  // Fall leaves are bigger and bolder than petals, so far fewer of them keep the
  // roads, cars and people readable.
  if (SEASON === 'fall') return <Leaves fx={fx} count={small ? 35 : 60} />
  return <Leaves fx={fx} count={small ? 150 : 280} />
}
