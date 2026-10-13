import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, BoxGeometry, BufferGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { modDef, modFits, CARS, type Body } from '../game/data'
import { RIM_LOOK, carbon, chrome, glass, modGeo } from './CarMods'
import { wheelGeo, type RimStyle } from './carWheels'

// A crate's part prize, shown on its own and turning on the lift: the same bolt-on pieces
// a car wears (CarMods), lifted off the car, centred and scaled up so they read on their own;
// rims as a full wheel in their finish; tyres as a wheel with their own tread.

// How big the shown part is: its longest side, in metres.
const SIZE = 2
// Rims mods and their rim style (as CarModel draws them).
const RIM_STYLE: Record<string, RimStyle> = { chrome: 'deep', goldmesh: 'mesh', forged: 'split' }

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
  const { mid, scale } = useMemo(() => centred([g.paint, g.carbon, g.chrome, g.glass]), [g])
  const paint = useMemo(() => new MeshStandardMaterial({ color: tint, metalness: 0.4, roughness: 0.3 }), [tint])
  useEffect(() => () => paint.dispose(), [paint])
  return (
    <group scale={scale}>
      <group position={[-mid.x, -mid.y, -mid.z]}>
        {g.paint && <mesh geometry={g.paint} material={paint} castShadow />}
        {g.carbon && <mesh geometry={g.carbon} material={carbon} castShadow />}
        {g.chrome && <mesh geometry={g.chrome} material={chrome} castShadow />}
        {g.glass && <mesh geometry={g.glass} material={glass} renderOrder={2} />}
        {/* Flame pipes show their nozzles, not the flames. */}
      </group>
    </group>
  )
}

// A full wheel standing up, axle across: a rims prize in its finish, or a tyre prize with its tread.
const R = 0.5
const W = 0.3
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

// The part, floating a little above the lift and turning slowly.
export function PartPrize({ id, body, tint }: { id: string; body?: Body; tint: string }) {
  const turn = useRef<Group>(null)
  useFrame((_, dt) => {
    if (turn.current) turn.current.rotation.y += Math.min(dt, 0.05) * 1.1
  })
  const slot = modDef(id)?.slot
  const wheel = slot === 'rims' || slot === 'tires'
  return (
    <group position-y={1.15}>
      {/* A soft key light so thin parts (pipes, flares) still catch the eye. */}
      <pointLight position={[0.6, 1.4, 1.6]} intensity={5} distance={5} color="#fff8e1" />
      {/* Tipped toward the camera so parts that lie flat on a car read from above. */}
      <group rotation-x={wheel ? 0 : 0.3}>
        <group ref={turn} scale={wheel ? 1.5 : 1}>{wheel ? <WheelPrize id={id} /> : <BoltOn id={id} body={body ?? 'sedan'} tint={tint} />}</group>
      </group>
    </group>
  )
}
