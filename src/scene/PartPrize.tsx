import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, BoxGeometry, BufferGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { modDef, modFits, CARS, type Body } from '../game/data'
import { KIND_MAT, RIM_LOOK, RIM_STYLE, SOLID_KINDS, carbon, chrome, modGeo } from './CarMods'
import { wheelGeo } from './carWheels'

// A crate's part prize, shown on its own and turning on the lift: the same bolt-on pieces
// a car wears (CarMods), lifted off the car, centred and scaled up so they read on their own;
// rims as a full wheel in their finish; tyres as a wheel with their own tread.

// How big the shown part is: its longest side, in metres.
const SIZE = 2
export const PART_SIZE = SIZE
// How high its middle sits, and a wheel prize's radius as drawn (R scaled up 1.5).
export const PART_LIFT = 1.15

const rubber = new MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.9 })
const steelRim = new MeshStandardMaterial({ color: '#b0bec5', metalness: 0.75, roughness: 0.3 })

// What each tyre's tread adds on top of a plain tyre: a coloured sidewall band and its grip.
const TREAD: Record<string, { band: string; studs?: boolean; paddles?: boolean; blocks?: boolean }> = {
  raintires: { band: '#29b6f6', blocks: true },
  sandtires: { band: '#ffb74d', paddles: true },
  snowstuds: { band: '#e3f2fd', studs: true },
  allweather: { band: '#ffd54f', blocks: true },
}

// The body to build a part for: the car it's for, else the first body it fits.
function bodyFor(id: string, body?: Body): Body {
  const m = modDef(id)
  if (m && body && modFits(m, body)) return body
  return CARS.find((c) => m && modFits(m, c.body))?.body ?? 'sedan'
}

// The part's geometry, moved so it sits centred on the origin, and the scale that makes it SIZE.
function centred(geos: (BufferGeometry | undefined)[]) {
  const box = new Box3()
  for (const g of geos) {
    if (!g) continue
    g.computeBoundingBox()
    box.union(g.boundingBox!)
  }
  const size = box.getSize(new Vector3())
  const mid = box.getCenter(new Vector3())
  return { mid, scale: SIZE / Math.max(0.05, size.x, size.y, size.z) }
}

export function BoltOn({ id, body, tint }: { id: string; body: Body; tint: string }) {
  const g = modGeo(bodyFor(id, body), [id])
  const { mid, scale } = useMemo(() => centred(SOLID_KINDS.map((k) => g[k])), [g])
  const paint = useMemo(() => new MeshStandardMaterial({ color: tint, metalness: 0.4, roughness: 0.3 }), [tint])
  useEffect(() => () => paint.dispose(), [paint])
  return (
    <group scale={scale}>
      <group position={[-mid.x, -mid.y, -mid.z]}>
        {SOLID_KINDS.map((k) => g[k] && <mesh key={k} geometry={g[k]} material={k === 'paint' ? paint : KIND_MAT[k]} castShadow={k !== 'glass'} renderOrder={k === 'glass' ? 2 : 0} />)}
        {/* Flame pipes show their nozzles, not the flames. */}
      </group>
    </group>
  )
}

// A full wheel standing up, axle across: a rims prize in its finish, or a tyre prize with its tread.
const R = 0.5
const W = 0.3
export const PART_WHEEL = R * 1.5
function WheelPrize({ id }: { id: string }) {
  const rim = RIM_LOOK[id]
  const tread = TREAD[id]
  const geo = wheelGeo(RIM_STYLE[id] ?? 'five', R, W)
  const rimMat = useMemo(() => (rim ? new MeshStandardMaterial({ color: rim[0], metalness: Math.max(0.6, rim[1] + 0.4), roughness: rim[2] }) : steelRim), [rim])
  const extra = useMemo(() => {
    if (!tread) return null
    const band: BufferGeometry[] = []
    const grip: BufferGeometry[] = []
    for (const sd of [-1, 1]) {
      const t = new TorusGeometry(R * 0.86, 0.018, 6, 40)
      t.rotateY(Math.PI / 2)
      t.translate(sd * W * 0.5, 0, 0)
      band.push(t)
    }
    const n = tread.studs ? 22 : tread.paddles ? 14 : 20
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (tread.paddles) {
        const b = new BoxGeometry(W * 0.92, 0.07, 0.035)
        b.translate(0, R + 0.02, 0)
        b.rotateX(a)
        grip.push(b)
      } else if (tread.studs) {
        for (const x of [-0.3, 0, 0.3]) {
          const s = new SphereGeometry(0.016, 6, 4)
          s.translate(x * W, R + 0.002, 0)
          s.rotateX(a + (x ? 0.09 : 0))
          grip.push(s)
        }
      } else {
        // Chunky tread blocks in a chevron, two per row.
        for (const sd of [-1, 1]) {
          const b = new BoxGeometry(W * 0.36, 0.03, 0.07)
          b.rotateY(sd * 0.5)
          b.translate(sd * W * 0.2, R + 0.006, 0)
          b.rotateX(a)
          grip.push(b)
        }
      }
    }
    const merge = (l: BufferGeometry[]) => {
      const m = mergeGeometries(l.map((x) => (x.index ? x.toNonIndexed() : x)))!
      l.forEach((x) => x.dispose())
      return m
    }
    return {
      band: merge(band),
      bandMat: new MeshStandardMaterial({ color: tread.band, roughness: 0.5, emissive: tread.band, emissiveIntensity: 0.15 }),
      grip: merge(grip),
      gripMat: tread.studs ? chrome : rubber,
    }
  }, [tread])
  useEffect(() => () => {
    if (rim) rimMat.dispose()
    extra?.band.dispose()
    extra?.grip.dispose()
    extra?.bandMat.dispose()
  }, [rim, rimMat, extra])
  // Turned so the rim faces the camera as the wheel turns about its upright axis.
  return (
    <group rotation-y={Math.PI / 2}>
      <mesh geometry={geo.tire} material={rubber} castShadow />
      <mesh geometry={geo.rims[0]} material={rimMat} />
      <mesh geometry={geo.rims[1]} material={rimMat} />
      {extra && <mesh geometry={extra.band} material={extra.bandMat} />}
      {extra && <mesh geometry={extra.grip} material={extra.gripMat} castShadow />}
    </group>
  )
}

// A stance prize: the coil-over (or air bag) it fits, standing up. Long for a lift kit,
// short and red for lowering springs, a black air bag for air ride.
const springRed = new MeshStandardMaterial({ color: '#e53935', metalness: 0.4, roughness: 0.35 })
function StancePrize({ id }: { id: string }) {
  const geo = useMemo(() => {
    const air = id === 'slammed'
    const tall = id === 'lifted' ? 1.5 : air ? 0.8 : 1
    const coils: BufferGeometry[] = []
    const n = air ? 3 : Math.round(7 * tall)
    for (let i = 0; i < n; i++) {
      const t = air ? new TorusGeometry(0.2, 0.09, 10, 24) : new TorusGeometry(0.17, 0.035, 8, 24)
      t.rotateX(Math.PI / 2)
      t.translate(0, -0.45 * tall + 0.15 + i * (air ? 0.17 : 0.13), 0)
      coils.push(t.toNonIndexed())
    }
    const rod = new CylinderGeometry(0.07, 0.07, 1.1 * tall, 14)
    const caps = [-1, 1].map((sd) => new CylinderGeometry(0.24, 0.24, 0.06, 18).translate(0, sd * 0.55 * tall, 0).toNonIndexed())
    const merged = mergeGeometries(coils)!
    coils.forEach((g) => g.dispose())
    return { coil: merged, rod, caps: mergeGeometries(caps)!, air }
  }, [id])
  useEffect(() => () => {
    geo.coil.dispose()
    geo.rod.dispose()
    geo.caps.dispose()
  }, [geo])
  return (
    <group scale={1.2}>
      <mesh geometry={geo.rod} material={chrome} />
      <mesh geometry={geo.caps} material={carbon} castShadow />
      <mesh geometry={geo.coil} material={geo.air ? rubber : id === 'lowered' ? springRed : KIND_MAT.ti} castShadow />
    </group>
  )
}

// The part, floating a little above the lift and turning slowly.
// lit={false}: the scene lights it instead (the crate keeps its light count fixed; see CrateScene).
export function PartPrize({ id, body, tint, lit = true }: { id: string; body?: Body; tint: string; lit?: boolean }) {
  const turn = useRef<Group>(null)
  useFrame((_, dt) => {
    if (turn.current) turn.current.rotation.y += Math.min(dt, 0.05) * 1.1
  })
  const slot = modDef(id)?.slot
  const wheel = slot === 'rims' || slot === 'tires'
  return (
    <group position-y={PART_LIFT}>
      {/* A soft key light so thin parts (pipes, flares) still catch the eye. */}
      {lit && <pointLight position={[0.6, 1.4, 1.6]} intensity={5} distance={5} color="#fff8e1" />}
      {/* Tipped toward the camera so parts that lie flat on a car read from above. */}
      <group rotation-x={wheel ? 0 : 0.3}>
        <group ref={turn} scale={wheel ? 1.5 : 1}>{wheel ? <WheelPrize id={id} /> : slot === 'stance' ? <StancePrize id={id} /> : <BoltOn id={id} body={body ?? 'sedan'} tint={tint} />}</group>
      </group>
    </group>
  )
}
