import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import { BuildingModel } from './BuildingModel'
import { CarModel, carFrame } from './CarModel'
import { Batch } from './Batch'
import { Box, Cone, Cyl } from './RaceVenues'
import { Crowd, type Person } from './ArcadeScenery'
import { signTexture } from './signTexture'
import { local, nearZone, useFansFar, useFanZones, useSpots, ZONE_R, type FanZone } from './kartSpots'
import { CARS, buildingDef, type Body } from '../game/data'
import type { Track } from '../game/kart'

// A kart crowd: only the fans in view and near enough to see are drawn.
export function Fans({ people }: { people: Person[] }) {
  return <Crowd people={people} far={useFansFar()} />
}

// The second scenery pass round the kart circuits: more going on in every direction you
// look. Common to all three: a pit lane, flag lines, TV camera towers, a blimp and hot-air
// balloons. Then per theme: a suburb, park and funfair (town); a cargo ship, oil rigs, buoys,
// gulls, quay traffic and spectator boats (harbour); pumpjacks, a rock arch, a ghost town,
// wind turbines, tumbleweeds and vultures (canyon). Town and canyon get fan zones.

const B = ({ def, x, z, ry = 0, s = 1 }: { def: string; x: number; z: number; ry?: number; s?: number }) => (
  <group position={[x, 0, z]} rotation-y={ry} scale={s}><BuildingModel def={buildingDef(def)} /></group>
)
const face = (x: number, z: number) => Math.atan2(-x, -z) // turned to look at the middle

// ---------- common ----------

const TEAMS = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#ef6c00']
const TEAM_NAMES = ['ROCKET', 'BOLT', 'VIPER', 'COMET', 'TITAN', 'FLASH']

export function CommonExtras({ t }: { t: Track }) {
  const { along, clearOf } = useSpots(t)
  // Pit garages along the start straight, opposite the main grandstand.
  const pits = useMemo(() => {
    const out: { x: number; z: number; ry: number; k: number }[] = []
    for (let k = 0; k < 6; k++) {
      const i = (t.n - 6 - k * 5) % t.n
      const o = -(t.wall + 4.2)
      const x = t.x[i] + t.nx[i] * o, z = t.z[i] + t.nz[i] * o
      // Back to the paddock, doors (local -z) open onto the track.
      if (clearOf(x, z, t.wall + 3.2)) out.push({ x, z, ry: Math.atan2(-t.nx[i], -t.nz[i]), k })
    }
    return out
  }, [t, clearOf])
  const crew = useMemo(() => pits.flatMap((p, i): Person[] => [0, 1].map((n) => ({
    x: p.x - Math.sin(p.ry) * 1.9 + Math.cos(p.ry) * (n - 0.5) * 1.4, z: p.z - Math.cos(p.ry) * 1.9 - Math.sin(p.ry) * (n - 0.5) * 1.4,
    h: p.ry + Math.PI, cheer: (i + n) % 3 === 0, shirt: TEAMS[p.k],
  }))), [pits])
  // Flag poles every so often on both sides, in team colours.
  const flags = useMemo(() => along(16, 0.5, 1, 0.3, 211).concat(along(19, 0.5, -1, 0.3, 213)), [along])
  // TV camera scaffolds on the outside of a few bends.
  const zones = useFanZones(t)
  const cams = useMemo(() => along(90, 3.2, 1, 2.6, 223).concat(along(110, 3.2, -1, 2.6, 227)).filter((c) => !nearZone(zones, c.x, c.z)), [along, zones])
  const flagsClear = useMemo(() => flags.filter((f) => !nearZone(zones, f.x, f.z, 7)), [flags, zones])
  return (
    <group>
      <Batch version={t.n + 11} cell={24} freeze>
        {pits.map((p) => (
          <group key={p.k} position={[p.x, 0, p.z]} rotation-y={p.ry}>
            <Box p={[0, 1.6, 0.8]} s={[4.6, 3.2, 4.4]} c="#eceff1" />
            <Box p={[0, 3.3, 0.8]} s={[4.8, 0.25, 4.6]} c={TEAMS[p.k]} />
            <Box p={[0, 1.3, -1.43]} s={[3.8, 2.6, 0.04]} c="#263238" />
            <mesh position={[0, 2.85, -1.46]} rotation-y={Math.PI}><planeGeometry args={[3.6, 0.5]} /><meshBasicMaterial map={signTexture(TEAM_NAMES[p.k], TEAMS[p.k], '#ffffff', 6)} toneMapped={false} /></mesh>
            <Box p={[-1.4, 0.45, -2.3]} s={[0.6, 0.9, 0.5]} c={TEAMS[p.k]} />
            <Box p={[1.5, 0.35, -2.4]} s={[0.5, 0.7, 0.5]} c="#455a64" />
          </group>
        ))}
        {flagsClear.map((f, i) => (
          <group key={i} position={[f.x, 0, f.z]} rotation-y={f.ry}>
            <Cyl p={[0, 2.2, 0]} r={0.04} h={4.4} c="#cfd8dc" />
            <Box p={[0.45, 4.05, 0]} s={[0.9, 0.55, 0.02]} c={TEAMS[i % TEAMS.length]} />
          </group>
        ))}
        {cams.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation-y={c.ry}>
            {[-0.7, 0.7].map((dx) => [-0.7, 0.7].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 2, dz]} s={[0.08, 4, 0.08]} c="#90a4ae" />))}
            {[1, 2, 3].map((y) => <Box key={y} p={[0, y * 1.3, 0]} s={[1.5, 0.06, 1.5]} c="#90a4ae" />)}
            <Box p={[0, 4.05, 0]} s={[1.7, 0.12, 1.7]} c="#546e7a" />
            <Box p={[0.1, 4.45, 0.3]} s={[0.35, 0.35, 0.7]} c="#212121" />
            <Cyl p={[0.1, 4.45, 0.75]} r={0.12} h={0.25} c="#37474f" rot={[Math.PI / 2, 0, 0]} />
            <Box p={[-0.35, 4.55, -0.2]} s={[0.3, 0.8, 0.3]} c="#1565c0" />
            <Box p={[-0.35, 5.08, -0.2]} s={[0.24, 0.24, 0.24]} c="#ffcc80" />
          </group>
        ))}
      </Batch>
      <Fans people={crew} />
      <Blimp />
      <Balloons count={t.def.theme === 'docks' ? 2 : 4} seed={t.n} />
    </group>
  )
}

// A CARTOPIA blimp on a slow lap high over the circuit.
const blimpTex = () => signTexture('CARTOPIA', '#1565c0', '#ffffff', 8)
function Blimp() {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const a = clock.elapsedTime * 0.025
    g.position.set(Math.cos(a) * 70, 34, Math.sin(a) * 60)
    g.rotation.y = -a
  })
  return (
    <group ref={ref}>
      <mesh scale={[3.2, 3.2, 10]}><sphereGeometry args={[1, 24, 14]} /><meshStandardMaterial color="#eceff1" /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 3.22, 0.3, 0]} rotation-y={sd * Math.PI / 2}><planeGeometry args={[10, 1.6]} /><meshBasicMaterial map={blimpTex()} toneMapped={false} /></mesh>
      ))}
      <Box p={[0, -3.3, 1]} s={[1.4, 0.9, 3.2]} c="#37474f" />
      {[0, Math.PI / 2].map((r) => <Box key={r} p={[0, 0, -9.2]} s={r ? [0.15, 4.4, 2.4] : [4.4, 0.15, 2.4]} c="#c62828" />)}
    </group>
  )
}

// Hot-air balloons drifting about at the edge of the scene.
const BALLOON = [['#e53935', '#fdd835'], ['#1e88e5', '#ffffff'], ['#43a047', '#ff7043'], ['#8e24aa', '#ffca28']]
function Balloons({ count, seed }: { count: number; seed: number }) {
  const refs = useRef<(Group | null)[]>([])
  const list = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: i * 2.1 + seed * 0.01, d: 85 + i * 9, h: 22 + (i % 3) * 7, c: BALLOON[i % BALLOON.length] })), [count, seed])
  useFrame(({ clock }) => list.forEach((b, i) => {
    const g = refs.current[i]
    if (!g) return
    const a = b.a + clock.elapsedTime * 0.008
    g.position.set(Math.cos(a) * b.d, b.h + Math.sin(clock.elapsedTime * 0.3 + i) * 1.2, Math.sin(a) * b.d * 0.85)
  }))
  return (
    <>
      {list.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }}>
          <BalloonModel c={b.c} />
        </group>
      ))}
    </>
  )
}

// One balloon: a striped envelope (radius 3.2 round its middle), its skirt and the
// basket hanging about 6 below. Also flies over the town (SkyExtras.tsx).
export function BalloonModel({ c }: { c: readonly string[] }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={k} rotation-y={(k / 8) * Math.PI * 2}>
          <sphereGeometry args={[3.2, 6, 12, 0, Math.PI / 4]} />
          <meshStandardMaterial color={c[k % 2]} side={DoubleSide} />
        </mesh>
      ))}
      <Cone p={[0, -3.6, 0]} r={1.6} h={2.4} c={c[0]} />
      <Box p={[0, -5.4, 0]} s={[1.1, 0.9, 1.1]} c="#8d6e63" />
    </>
  )
}

// Birds wheeling overhead: gulls at the harbour, vultures over the canyon.
function Birds({ count, color, size, y, r }: { count: number; color: string; size: number; y: number; r: number }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(({ clock }) => {
    for (let i = 0; i < count; i++) {
      const g = refs.current[i]
      if (!g) continue
      const t = clock.elapsedTime * (0.25 + (i % 3) * 0.05) + i * 2.4
      const cx = Math.cos(i * 1.7) * r, cz = Math.sin(i * 1.7) * r
      g.position.set(cx + Math.cos(t) * 9, y + (i % 4) * 2 + Math.sin(t * 2) * 0.5, cz + Math.sin(t) * 9)
      g.rotation.y = -t
      const flap = Math.sin(clock.elapsedTime * 7 + i) * 0.4
      g.children[1].rotation.z = flap
      g.children[2].rotation.z = -flap
    }
  })
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} scale={size}>
          <mesh scale={[0.25, 0.22, 0.9]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={color} /></mesh>
          <group><mesh position={[0.9, 0, 0]} scale={[1.6, 0.05, 0.5]}><boxGeometry /><meshStandardMaterial color={color} /></mesh></group>
          <group><mesh position={[-0.9, 0, 0]} scale={[1.6, 0.05, 0.5]}><boxGeometry /><meshStandardMaterial color={color} /></mesh></group>
        </group>
      ))}
    </>
  )
}

// ---------- town ----------

const PARKED = ['miata', 'stallion', 'rally', 'vette', 'charger', 'bug', 'woodie', 'camper', 'zippy', 'baron']
export function TownExtras({ t }: { t: Track }) {
  const { open } = useSpots(t)
  const zones = useFanZones(t)
  const fans = useMemo(() => zonePeople(zones), [zones])
  const zoneTaken = useMemo(() => zones.map((z) => ({ ...z, r: ZONE_R })), [zones])
  // Big things first so the small ones fill round them.
  const wheel = useMemo(() => open({ need: 16, count: 1, seed: 301, reach: 75, taken: zoneTaken })[0], [open, zoneTaken])
  const lots = useMemo(() => open({ need: 9, count: 3, seed: 307, gap: 20, reach: 80, taken: [...zoneTaken, ...(wheel ? [{ ...wheel, r: 14 }] : [])] }), [open, wheel, zoneTaken])
  const taken = useMemo(() => [...zoneTaken, ...(wheel ? [{ ...wheel, r: 14 }] : []), ...lots.map((l) => ({ ...l, r: 9 }))], [wheel, lots, zoneTaken])
  const park = useMemo(() => open({ need: 6, count: 26, seed: 311, gap: 7, reach: 70, taken }), [open, taken])
  const houses = useMemo(() => open({ need: 7, count: 34, seed: 313, gap: 7.5, reach: 100, where: 'out', taken: [...taken, ...park.map((p) => ({ ...p, r: 3 }))] }), [open, taken, park])
  const PARK = ['fountain', 'playground', 'gazebo', 'picnic', 'pond', 'statue', 'flowers', 'hedge', 'bench', 'billboard', 'clocktower', 'flowers', 'picnic', 'hedge']
  return (
    <group>
      <Batch version={t.n + 21} cell={24} freeze>
        {houses.map((h, i) => <B key={i} def="house" x={h.x} z={h.z} ry={face(h.x, h.z) + (h.r() - 0.5) * 0.3} />)}
        {park.map((p, i) => <B key={i} def={PARK[i % PARK.length]} x={p.x} z={p.z} ry={face(p.x, p.z)} />)}
        {lots.map((l, li) => (
          <group key={li} position={[l.x, 0, l.z]} rotation-y={face(l.x, l.z)}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.015}><planeGeometry args={[13, 9]} /><meshStandardMaterial color="#5f6368" /></mesh>
            {[-1, 1].map((row) => [-2, -1, 0, 1, 2].map((k) => (
              <mesh key={`${row}${k}`} rotation-x={-Math.PI / 2} position={[k * 2.4 + 1.2, 0.02, row * 2.2]}><planeGeometry args={[0.08, 3.2]} /><meshBasicMaterial color="#eceff1" /></mesh>
            )))}
            {[-1, 1].map((row) => [-2, -1, 0, 1].map((k) => {
              const n = (li * 8 + (row + 1) * 2 + k + 2) % PARKED.length
              if ((li + k + row) % 4 === 0) return null
              const d = CARS.find((c) => c.id === PARKED[n])
              if (!d) return null
              return (
                <group key={`${row}${k}`} position={[k * 2.4 + 2.4, 0, row * 2.2]} rotation-y={row > 0 ? Math.PI : 0} scale={0.42}>
                  <CarModel body={d.body as Body} model={d.id} color={d.colors[(n + li) % d.colors.length]} />
                </group>
              )
            }))}
          </group>
        ))}
      </Batch>
      {wheel && <FerrisWheel x={wheel.x} z={wheel.z} ry={face(wheel.x, wheel.z) + Math.PI / 2} />}
      <FanZones zones={zones} theme="town" />
      <Fans people={fans} />
    </group>
  )
}

// A funfair Ferris wheel, turning slowly, with a few stalls at its foot.
function FerrisWheel({ x, z, ry }: { x: number; z: number; ry: number }) {
  const wheel = useRef<Group>(null)
  const cars = useRef<(Group | null)[]>([])
  const N = 12, R = 7
  useFrame((_, dt) => {
    const w = wheel.current
    if (!w) return
    w.rotation.z += dt * 0.12
    // Gondolas hang level.
    for (const c of cars.current) if (c) c.rotation.z = -w.rotation.z
  })
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[0, 0, sd * 1.2]}>
          <Box p={[-2.6, 4.2, 0]} s={[0.3, 8.8, 0.3]} c="#eceff1" ry={0} />
          <Box p={[2.6, 4.2, 0]} s={[0.3, 8.8, 0.3]} c="#eceff1" />
        </group>
      ))}
      <group ref={wheel} position={[0, 8.6, 0]}>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position-z={sd * 0.9}><torusGeometry args={[R, 0.12, 6, 40]} /><meshStandardMaterial color="#e53935" /></mesh>
        ))}
        {Array.from({ length: N }, (_, i) => (
          <mesh key={i} rotation-z={(i / N) * Math.PI * 2}><boxGeometry args={[0.1, R * 2, 0.1]} /><meshStandardMaterial color="#fafafa" /></mesh>
        ))}
        <Cyl p={[0, 0, 0]} r={0.5} h={2.6} c="#fdd835" rot={[Math.PI / 2, 0, 0]} />
        {Array.from({ length: N }, (_, i) => {
          const a = (i / N) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * R, Math.sin(a) * R, 0]}>
              <group ref={(g) => { cars.current[i] = g }}>
                <Box p={[0, -0.7, 0]} s={[1.1, 0.9, 1.3]} c={TEAMS[i % TEAMS.length]} />
                <Box p={[0, -0.15, 0]} s={[1.2, 0.12, 1.4]} c="#fafafa" />
              </group>
            </group>
          )
        })}
      </group>
      <B def="hotdog" x={-5} z={4} ry={0} />
      <B def="icecream" x={5} z={4} ry={0} s={0.8} />
    </group>
  )
}

// ---------- harbour ----------

export function DocksExtras({ t }: { t: Track }) {
  const { open, along } = useSpots(t)
  const ship = useMemo(() => open({ need: 26, count: 1, seed: 401, where: 'out', reach: 120 })[0] ?? open({ need: 18, count: 1, seed: 401, where: 'in', reach: 60 })[0], [open])
  const buoys = useMemo(() => open({ need: 6, count: 10, seed: 409, gap: 9, where: 'in', reach: 60 }), [open])
  const quay = useMemo(() => along(26, 1.6, 1, 1.2, 419).concat(along(31, 1.6, -1, 1.2, 421)), [along])
  // Oil rigs out in the bay, their crews cheering from the rail.
  const rigs = useMemo(() => open({ need: 26, count: 3, seed: 431, gap: 55, where: 'out', reach: 135, taken: ship ? [{ ...ship, r: 22 }] : [] })
    .map((p) => ({ x: p.x, z: p.z, ry: face(p.x, p.z) })), [open, ship])
  const crews = useMemo(() => rigPeople(rigs), [rigs])
  return (
    <group>
      <Batch version={t.n + 31} cell={24} freeze>
        {quay.map((q, i) => (
          // Forklifts and container trucks working the quay.
          <group key={i} position={[q.x, 0, q.z]} rotation-y={q.ry + Math.PI / 2}>
            {i % 2 ? (
              <>
                <Box p={[0, 0.45, 0]} s={[0.9, 0.6, 1.3]} c="#fbc02d" />
                <Box p={[0, 1.05, -0.2]} s={[0.8, 0.6, 0.7]} c="#37474f" />
                <Box p={[0, 0.9, 0.85]} s={[0.7, 1.6, 0.08]} c="#455a64" />
                <Box p={[0, 0.15, 1.15]} s={[0.6, 0.06, 0.6]} c="#455a64" />
              </>
            ) : (
              <>
                <Box p={[0, 0.8, 1.8]} s={[1.3, 1.2, 1.2]} c="#1565c0" />
                <Box p={[0, 0.45, -0.6]} s={[1.3, 0.3, 3.8]} c="#455a64" />
                <Box p={[0, 1.25, -0.6]} s={[1.2, 1.3, 3.6]} c={['#c62828', '#2e7d32', '#ef6c00'][i % 3]} />
              </>
            )}
          </group>
        ))}
      </Batch>
      {ship && <Ship x={ship.x} z={ship.z} ry={face(ship.x, ship.z) + Math.PI / 2} />}
      <OilRigs rigs={rigs} />
      <Fans people={crews} />
      <Buoys spots={buoys} />
      <Birds count={9} color="#fafafa" size={0.55} y={9} r={30} />
    </group>
  )
}

// A cargo ship riding at anchor, stacked with containers.
function Ship({ x, z, ry }: { x: number; z: number; ry: number }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.012
  })
  const cols = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#00838f', '#6d4c41']
  return (
    <group position={[x, -0.3, z]} rotation-y={ry}>
      <group ref={ref}>
        <Box p={[0, 1.2, 0]} s={[7, 3, 34]} c="#263238" />
        <Box p={[0, 0.2, 0]} s={[7.05, 1, 34.05]} c="#b71c1c" />
        <Cone p={[0, 1.2, 18.4]} r={3.5} h={3} c="#263238" ry={Math.PI / 4} />
        <Box p={[0, 4.6, -13]} s={[6, 4, 5]} c="#eceff1" />
        <Box p={[0, 6.9, -13]} s={[6.6, 0.6, 5.4]} c="#cfd8dc" />
        <Box p={[0, 5.4, -10.45]} s={[5, 0.7, 0.04]} c="#263238" />
        <Cyl p={[1.6, 8.4, -14.5]} r={0.6} h={2.6} c="#c62828" />
        {Array.from({ length: 3 }, (_, row) => Array.from({ length: 7 }, (_, k) => Array.from({ length: 1 + ((row + k) % 3) }, (_, lev) => (
          <Box key={`${row}${k}${lev}`} p={[(row - 1) * 2.1, 3.3 + lev * 1.2, -6 + k * 3.4]} s={[2, 1.15, 3.2]} c={cols[(row * 7 + k + lev) % cols.length]} />
        ))))}
      </group>
    </group>
  )
}

function Buoys({ spots }: { spots: { x: number; z: number }[] }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(({ clock }) => spots.forEach((_, i) => {
    const g = refs.current[i]
    if (!g) return
    g.position.y = -0.3 + Math.sin(clock.elapsedTime * 1.6 + i) * 0.08
    g.rotation.x = Math.sin(clock.elapsedTime * 1.2 + i * 2) * 0.12
  }))
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, -0.3, s.z]} ref={(g) => { refs.current[i] = g }}>
          <Cyl p={[0, 0.3, 0]} r={0.45} h={0.6} c={i % 2 ? '#c62828' : '#2e7d32'} />
          <Cone p={[0, 0.95, 0]} r={0.3} h={0.7} c={i % 2 ? '#c62828' : '#2e7d32'} />
          <Box p={[0, 1.38, 0]} s={[0.14, 0.14, 0.14]} c="#fff59d" />
        </group>
      ))}
    </>
  )
}

// ---------- canyon ----------

const WEST = [['SALOON', '#8d6e63'], ['GENERAL STORE', '#a1887f'], ['SHERIFF', '#6d4c41'], ['ASSAY OFFICE', '#8d6e63'], ['HOTEL', '#795548']] as const
export function DesertExtras({ t }: { t: Track }) {
  const { open } = useSpots(t)
  const zones = useFanZones(t)
  const fans = useMemo(() => zonePeople(zones), [zones])
  const zoneTaken = useMemo(() => zones.map((z) => ({ ...z, r: ZONE_R })), [zones])
  const arch = useMemo(() => open({ need: 14, count: 1, seed: 501, where: 'out', reach: 95, taken: zoneTaken })[0], [open, zoneTaken])
  const town = useMemo(() => open({ need: 11, count: 1, seed: 503, reach: 85, taken: [...zoneTaken, ...(arch ? [{ ...arch, r: 12 }] : [])] })[0], [open, arch, zoneTaken])
  const taken = useMemo(() => [...zoneTaken, ...[arch, town].filter(Boolean).map((p) => ({ ...p!, r: 12 }))], [arch, town, zoneTaken])
  const pumps = useMemo(() => open({ need: 6, count: 5, seed: 509, gap: 7, reach: 90, taken }), [open, taken])
  const turbines = useMemo(() => open({ need: 12, count: 5, seed: 521, gap: 14, reach: 120, where: 'out', taken: [...taken, ...pumps.map((p) => ({ ...p, r: 4 }))] }), [open, taken, pumps])
  const weeds = useMemo(() => open({ need: 3, count: 7, seed: 531, gap: 10, reach: 70 }), [open])
  return (
    <group>
      <Batch version={t.n + 41} cell={24} freeze>
        {arch && (
          <group position={[arch.x, 0, arch.z]} rotation-y={face(arch.x, arch.z) + Math.PI / 2}>
            <Box p={[-5, 3.5, 0]} s={[3, 7, 3.4]} c="#b5532f" />
            <Box p={[5, 3.5, 0]} s={[3, 7, 3.4]} c="#a84a2a" />
            <Box p={[0, 8, 0]} s={[13.5, 2.4, 3.6]} c="#c8693a" />
            <Box p={[0, 9.4, 0]} s={[12, 0.5, 3.2]} c="#d4844e" />
            <Box p={[-3.6, 6.4, 0]} s={[1.6, 1.2, 3.3]} c="#b5532f" />
            <Box p={[3.6, 6.4, 0]} s={[1.6, 1.2, 3.3]} c="#a84a2a" />
          </group>
        )}
        {town && (
          <group position={[town.x, 0, town.z]} rotation-y={face(town.x, town.z)}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.012}><planeGeometry args={[22, 7]} /><meshStandardMaterial color="#c9a074" /></mesh>
            {WEST.map(([name, c], i) => {
              const w = 3.6 + (i % 2) * 0.8, h = 3 + (i % 3) * 0.7
              return (
                <group key={name} position={[(i - 2) * 4.4, 0, -2]}>
                  <Box p={[0, h / 2, -1.2]} s={[w, h, 3]} c={c} />
                  <Box p={[0, h + 0.5, 0.25]} s={[w, 1.2, 0.15]} c={c} />
                  <Box p={[0, 1.6, 0.9]} s={[w + 0.2, 0.1, 1.4]} c="#5d4037" />
                  {[-1, 1].map((sd) => <Box key={sd} p={[sd * (w / 2), 0.8, 1.5]} s={[0.12, 1.6, 0.12]} c="#5d4037" />)}
                  <Box p={[0, 0.9, 0.31]} s={[0.9, 1.8, 0.04]} c="#3e2723" />
                  <mesh position={[0, h + 0.5, 0.34]}><planeGeometry args={[w - 0.4, 0.7]} /><meshStandardMaterial map={signTexture(name, '#f5e6c8', '#4e342e', 8)} /></mesh>
                </group>
              )
            })}
            <B def="trailer" x={9} z={1} ry={-0.6} s={0.8} />
          </group>
        )}
        {turbines.map((w, i) => (
          <group key={i} position={[w.x, 0, w.z]}>
            <Cyl p={[0, 7, 0]} r={0.3} h={14} c="#fafafa" seg={10} />
            <Box p={[0, 14.1, -0.4]} s={[0.8, 0.8, 1.8]} c="#eceff1" />
          </group>
        ))}
      </Batch>
      {turbines.map((w, i) => <Rotor key={i} x={w.x} z={w.z} ry={face(w.x, w.z)} k={i} />)}
      {pumps.map((p, i) => <Pumpjack key={i} x={p.x} z={p.z} ry={face(p.x, p.z) + Math.PI / 2} k={i} />)}
      <Tumbleweeds spots={weeds} />
      <FanZones zones={zones} theme="desert" />
      <Fans people={fans} />
      <Birds count={5} color="#3e2723" size={0.9} y={16} r={25} />
    </group>
  )
}

function Rotor({ x, z, ry, k }: { x: number; z: number; ry: number; k: number }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * (0.8 + (k % 3) * 0.15) })
  return (
    <group position={[x, 14.1, z]} rotation-y={ry}>
      <group ref={ref} position-z={0.6}>
        {[0, 1, 2].map((b) => (
          <group key={b} rotation-z={(b / 3) * Math.PI * 2}>
            <mesh position-y={3}><boxGeometry args={[0.4, 6, 0.08]} /><meshStandardMaterial color="#fafafa" /></mesh>
          </group>
        ))}
        <Cone p={[0, 0, 0.3]} r={0.35} h={0.6} c="#eceff1" />
      </group>
    </group>
  )
}

// An oil pumpjack nodding away.
function Pumpjack({ x, z, ry, k }: { x: number; z: number; ry: number; k: number }) {
  const beam = useRef<Group>(null)
  useFrame(({ clock }) => { if (beam.current) beam.current.rotation.z = Math.sin(clock.elapsedTime * 1.4 + k) * 0.32 })
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      <Box p={[0, 0.15, 0]} s={[4.6, 0.3, 1.4]} c="#757575" />
      <Box p={[0, 1.4, 0.35]} s={[0.18, 2.6, 0.18]} c="#424242" />
      <Box p={[0, 1.4, -0.35]} s={[0.18, 2.6, 0.18]} c="#424242" />
      <group ref={beam} position={[0, 2.7, 0]}>
        <Box p={[0, 0, 0]} s={[4.4, 0.3, 0.3]} c="#f9a825" />
        <Box p={[2.3, -0.3, 0]} s={[0.5, 0.9, 0.5]} c="#f9a825" />
        <Box p={[-2.1, -0.5, 0]} s={[0.8, 0.8, 0.5]} c="#424242" />
      </group>
      <Box p={[2.3, 0.9, 0]} s={[0.06, 1.6, 0.06]} c="#212121" />
      <Box p={[-1.6, 0.6, 0]} s={[1, 0.9, 1]} c="#c62828" />
    </group>
  )
}

// Tumbleweeds rolling across the sand, now and then over the track.
function Tumbleweeds({ spots }: { spots: { x: number; z: number }[] }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(({ clock }) => spots.forEach((s, i) => {
    const g = refs.current[i]
    if (!g) return
    const time = clock.elapsedTime * (1.6 + (i % 3) * 0.4) + i * 13
    const d = (time % 40) - 20
    g.position.set(s.x + d, 0.45 + Math.abs(Math.sin(time * 2.2)) * 0.5, s.z + Math.sin(time * 0.3) * 2)
    g.rotation.z = -time * 2
  }))
  return (
    <>
      {spots.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }}>
          <mesh><icosahedronGeometry args={[0.45, 1]} /><meshStandardMaterial color="#b0915a" wireframe /></mesh>
          <mesh scale={0.7}><icosahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#9c7e48" wireframe /></mesh>
        </group>
      ))}
    </>
  )
}

// ---------- fans ----------

// Fan zones (town and canyon): stepped terraces behind a rail, a banner over the back row,
// bunting on the rail and a snack cart or a camper at the side, packed with cheering locals.
const STEP = [0.2, 0.5, 0.8]
const ZONE_W = 11
export function zonePeople(zones: FanZone[]): Person[] {
  const out: Person[] = []
  zones.forEach((zn, zi) => {
    const rows: [number, number][] = [[1.0, 0], ...STEP.map((y, r): [number, number] => [0.6 - r, y])]
    rows.forEach(([lz, y], r) => {
      for (let k = 0; k < 16; k++) {
        if ((k * 7 + r * 5 + zi * 3) % 6 === 0) continue
        const p = local(zn, -ZONE_W / 2 + 0.45 + k * 0.67 + (r % 2) * 0.2, lz)
        out.push({ x: p.x, z: p.z, h: zn.ry + ((k * 13 + r) % 5 - 2) * 0.08, y, cheer: (k + r + zi) % 4 !== 0 })
      }
    })
  })
  return out
}

const CHEERS = { town: ['GO GO GO!', 'MAIN ST FANS', 'FULL THROTTLE', 'VROOM VROOM'], desert: ['CANYON CREW', 'DUST EM!', 'GO GO GO!', 'RED ROCK RACERS'] }
const BUNTING = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00']
export function FanZones({ zones, theme }: { zones: FanZone[]; theme: 'town' | 'desert' }) {
  const desert = theme === 'desert'
  const step = desert ? ['#c8693a', '#d4844e', '#b5532f'] : ['#cfd8dc', '#b0bec5', '#cfd8dc']
  return (
    <Batch version={zones.length * 7 + (desert ? 1 : 0)} freeze>
      {zones.map((zn, zi) => (
        <group key={zi} position={[zn.x, 0, zn.z]} rotation-y={zn.ry}>
          {STEP.map((h, r) => <Box key={r} p={[0, h / 2, 0.6 - r]} s={[ZONE_W, h, 1]} c={step[r]} />)}
          {/* The rail along the front, with bunting. */}
          <Box p={[0, 1.0, 1.55]} s={[ZONE_W + 0.4, 0.08, 0.08]} c="#eceff1" />
          <Box p={[0, 0.55, 1.55]} s={[ZONE_W + 0.4, 0.06, 0.06]} c="#eceff1" />
          {Array.from({ length: 7 }, (_, k) => <Box key={k} p={[-ZONE_W / 2 - 0.1 + k * ((ZONE_W + 0.2) / 6), 0.52, 1.55]} s={[0.09, 1.04, 0.09]} c="#b0bec5" />)}
          {Array.from({ length: 18 }, (_, k) => <Box key={k} p={[-ZONE_W / 2 + 0.3 + k * 0.62, 0.86, 1.6]} s={[0.3, 0.22, 0.02]} c={BUNTING[k % BUNTING.length]} />)}
          {/* A banner over the back row. */}
          {[-1, 1].map((sd) => <Cyl key={sd} p={[sd * 4.8, 2.3, -2.2]} r={0.07} h={4.6} c="#90a4ae" />)}
          <mesh position={[0, 3.9, -2.18]}><planeGeometry args={[9.2, 1.2]} /><meshBasicMaterial map={signTexture(CHEERS[theme][zi % 4], desert ? '#4e342e' : '#1565c0', '#ffffff', 7.6)} toneMapped={false} side={DoubleSide} /></mesh>
          {desert ? (
            <>
              {/* A shade canopy and a camper parked up beside the terraces. */}
              {[-1, 1].map((a) => [-1, 1].map((b) => <Box key={`${a}${b}`} p={[-7.6 + a * 1.3, 1.1, -0.4 + b * 1.3]} s={[0.08, 2.2, 0.08]} c="#9e9e9e" />))}
              <Cone p={[-7.6, 2.55, -0.4]} r={2.1} h={0.8} c={zi % 2 ? '#e53935' : '#1e88e5'} seg={4} ry={Math.PI / 4} />
              {(() => {
                const d = CARS.find((c) => c.id === 'camper')
                return d && <group position={[7.8, 0, -0.8]} rotation-y={0.25} scale={4.4 / carFrame(d.body as Body).len}><CarModel body={d.body as Body} model={d.id} color={d.colors[zi % d.colors.length]} /></group>
              })()}
            </>
          ) : (
            <>
              <B def="hotdog" x={-7.6} z={-0.2} ry={0} s={0.8} />
              <B def="icecream" x={7.6} z={-0.2} ry={0} s={0.7} />
            </>
          )}
        </group>
      ))}
    </Batch>
  )
}

// ---------- harbour fans ----------

// Spectator boats moored off the quay, decks full of fans: a motor yacht, a party barge
// and a sightseeing ferry. Length along local x, the track off local +z.
export type BoatSpot = { x: number; z: number; ry: number; k: number }
export function boatPeople(boats: BoatSpot[]): Person[] {
  const out: Person[] = []
  const add = (b: BoatSpot, lx: number, lz: number, y: number, n: number) => {
    const p = local(b, lx, lz)
    out.push({ x: p.x, z: p.z, h: b.ry + ((n * 7) % 5 - 2) * 0.12, y, cheer: n % 4 !== 1 })
  }
  boats.forEach((b, bi) => {
    const v = b.k % 3
    let n = bi * 5
    if (v === 0) {
      for (let k = 0; k < 7; k++) add(b, 0.4 + k * 0.62, 1.1 - (k % 2) * 0.9, 1.04, n++)
      for (let k = 0; k < 4; k++) add(b, -3.4 + k * 0.7, 0.9, 2.35, n++)
      for (let k = 0; k < 3; k++) add(b, -4.6, -1 + k * 0.8, 1.04, n++)
    } else if (v === 1) {
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) if ((k + row + bi) % 5) add(b, -3.6 + k * 1.2 + (row % 2) * 0.5, 1.3 - row * 1.1, 0.66, n++)
    } else {
      for (let k = 0; k < 10; k++) add(b, -3.6 + k * 0.8, 1.55, 2.62, n++)
      for (let k = 0; k < 6; k++) add(b, -2.8 + k * 0.9, 0.4, 2.62, n++)
      for (let k = 0; k < 4; k++) add(b, 3.9 + (k % 2) * 0.6, -0.8 + k * 0.5, 1.22, n++)
    }
  })
  return out
}

const HULLS = ['#fafafa', '#eceff1', '#fafafa']
export function SpectatorBoats({ boats }: { boats: BoatSpot[] }) {
  return (
    <Batch version={boats.length * 3 + 1} freeze>
      {boats.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.ry}>
          {b.k % 3 === 0 ? (
            <>
              {/* Motor yacht. */}
              <Box p={[0, 0.3, 0]} s={[10, 1.4, 3.6]} c={HULLS[i % 3]} />
              <Box p={[0, -0.12, 0]} s={[10.04, 0.36, 3.64]} c={['#0d47a1', '#b71c1c', '#004d40'][i % 3]} />
              <Bow x={5} w={3.6} y={0.3} h={1.4} c={HULLS[i % 3]} />
              <Box p={[0.3, 1.03, 0]} s={[9.2, 0.06, 3.3]} c="#c8a27a" />
              <Box p={[-2.2, 1.65, -0.2]} s={[4, 1.2, 2.6]} c="#fafafa" />
              <Box p={[-2.2, 1.75, -0.2]} s={[4.04, 0.4, 2.64]} c="#263238" />
              <Box p={[-2.2, 2.3, -0.2]} s={[4.4, 0.1, 3]} c="#eceff1" />
              <Box p={[0.5, 1.5, 1.72]} s={[9, 0.05, 0.05]} c="#cfd8dc" />
              <Cyl p={[-2.2, 3.3, -0.6]} r={0.05} h={2} c="#b0bec5" />
              {Array.from({ length: 7 }, (_, k) => <Box key={k} p={[-1.4 + k * 0.95, 4 - k * 0.42, -0.6]} s={[0.25, 0.25, 0.02]} c={BUNTING[k % BUNTING.length]} />)}
            </>
          ) : b.k % 3 === 1 ? (
            <>
              {/* Party barge: twin pontoons, a striped canopy and a banner. */}
              {[-1.4, 1.4].map((z) => <Cyl key={z} p={[0, 0.05, z]} r={0.5} h={9.4} c="#b0bec5" rot={[0, 0, Math.PI / 2]} />)}
              <Box p={[0, 0.55, 0]} s={[9.6, 0.22, 4]} c="#78909c" />
              {[-1, 1].map((a) => [-1, 1].map((c) => <Box key={`${a}${c}`} p={[a * 4.5, 1.7, c * 1.8]} s={[0.08, 2.1, 0.08]} c="#eceff1" />))}
              {Array.from({ length: 6 }, (_, k) => <Box key={k} p={[-4 + k * 1.6, 2.8, 0]} s={[1.6, 0.12, 4.1]} c={k % 2 ? '#fafafa' : ['#e53935', '#1e88e5', '#fb8c00'][i % 3]} />)}
              <mesh position={[0, 2.45, 2.07]}><planeGeometry args={[6, 0.55]} /><meshBasicMaterial map={signTexture('GO GO GO!', '#fdd835', '#c62828', 10.9)} toneMapped={false} /></mesh>
              <Box p={[4.4, 0.95, -1.3]} s={[0.7, 0.6, 0.9]} c="#37474f" />
            </>
          ) : (
            <>
              {/* Sightseeing ferry with an open top deck. */}
              <Box p={[0, 0.35, 0]} s={[11, 1.5, 4.2]} c="#fafafa" />
              <Box p={[0, -0.15, 0]} s={[11.04, 0.4, 4.24]} c="#c62828" />
              <Bow x={5.5} w={4.2} y={0.35} h={1.5} c="#fafafa" />
              <Box p={[-1, 1.9, 0]} s={[8, 1.4, 3.8]} c="#eceff1" />
              <Box p={[-1, 2.0, 0]} s={[8.04, 0.6, 3.84]} c="#1a237e" />
              <Box p={[-1, 2.6, 0]} s={[8.4, 0.04, 4]} c="#90a4ae" />
              <Box p={[-1, 3.1, 1.95]} s={[8.4, 0.05, 0.05]} c="#eceff1" />
              <Cyl p={[-4.2, 3.4, 0]} r={0.35} h={1.6} c="#fdd835" />
            </>
          )}
        </group>
      ))}
    </Batch>
  )
}

// A pointed bow on the +x end of a hull w wide: a three-sided prism with one flat face on the hull.
function Bow({ x, w, y, h, c }: { x: number; w: number; y: number; h: number; c: string }) {
  const r = w / Math.sqrt(3)
  return <mesh position={[x + r / 2, y, 0]} rotation-y={Math.PI / 2}><cylinderGeometry args={[r, r, h, 3]} /><meshStandardMaterial color={c} flatShading /></mesh>
}

// Oil rigs standing in the bay, crews in hi-vis cheering from the deck rail and the helipad.
export type RigSpot = { x: number; z: number; ry: number }
export function rigPeople(rigs: RigSpot[]): Person[] {
  const out: Person[] = []
  rigs.forEach((r, ri) => {
    for (let k = 0; k < 10; k++) {
      const p = local(r, -5.6 + k * 1.25, 6.3)
      out.push({ x: p.x, z: p.z, h: r.ry, y: 11, cheer: (k + ri) % 3 !== 0, shirt: k % 2 ? '#ff9800' : '#fdd835' })
    }
    for (let k = 0; k < 3; k++) {
      const p = local(r, -3.5 + k * 1, -0.5)
      out.push({ x: p.x, z: p.z, h: r.ry, y: 14.2, cheer: true, shirt: '#ff9800' })
    }
  })
  return out
}

const TILT = Math.atan(1.3 / 13)
export function OilRigs({ rigs }: { rigs: RigSpot[] }) {
  return (
    <Batch version={rigs.length * 5 + 2} freeze>
      {rigs.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]} rotation-y={r.ry}>
          {[-5, 5].map((x) => [-5, 5].map((z) => <Cyl key={`${x}${z}`} p={[x, 4.4, z]} r={0.8} h={11.2} c="#fbc02d" seg={10} />))}
          {[3, 7].map((y) => [-5, 5].map((s) => (
            <group key={`${y}${s}`}>
              <Box p={[0, y, s]} s={[10, 0.3, 0.3]} c="#f9a825" />
              <Box p={[s, y, 0]} s={[0.3, 0.3, 10]} c="#f9a825" />
            </group>
          )))}
          <Box p={[0, 10.5, 0]} s={[14, 1, 14]} c="#78909c" />
          <mesh position={[0, 10.5, 7.02]}><planeGeometry args={[10, 0.8]} /><meshBasicMaterial map={signTexture(['RIG 7', 'DEEP BLUE 2', 'NORTH STAR'][i % 3], '#263238', '#fdd835', 12.5)} toneMapped={false} /></mesh>
          <Box p={[0, 11.9, 6.9]} s={[14, 0.06, 0.06]} c="#fdd835" />
          <Box p={[0, 11.45, 6.9]} s={[14, 0.05, 0.05]} c="#fdd835" />
          {/* Living quarters with a helipad on the roof. */}
          <Box p={[-3, 12.6, -2.5]} s={[7, 3.2, 7]} c="#eceff1" />
          <Box p={[-3, 12.8, -2.5]} s={[7.04, 0.6, 7.04]} c="#37474f" />
          <Cyl p={[-3, 14.3, -2.5]} r={3.6} h={0.2} c="#37474f" seg={16} />
          <mesh position={[-3, 14.42, -2.5]} rotation-x={-Math.PI / 2}><torusGeometry args={[2.6, 0.12, 6, 28]} /><meshStandardMaterial color="#fdd835" /></mesh>
          {/* The derrick. */}
          {[-1, 1].map((sx) => [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[3.5 + sx * 0.95, 17.5, -2 + sz * 0.95]} rotation={[-sz * TILT, 0, sx * TILT]}>
              <boxGeometry args={[0.22, 13.1, 0.22]} />
              <meshStandardMaterial color="#e53935" flatShading />
            </mesh>
          )))}
          {[14, 18, 22].map((y, k) => <Box key={y} p={[3.5, y, -2]} s={[2.9 - k * 0.8, 0.14, 2.9 - k * 0.8]} c="#e53935" />)}
          <Box p={[3.5, 24.2, -2]} s={[0.9, 0.5, 0.9]} c="#fafafa" />
          {/* A deck crane and the flare boom. */}
          <Cyl p={[5.2, 12, 3.5]} r={0.6} h={2} c="#fbc02d" />
          <mesh position={[5.2, 14.2, 0.6]} rotation-x={0.45}><boxGeometry args={[0.5, 0.5, 7]} /><meshStandardMaterial color="#fbc02d" flatShading /></mesh>
          <Box p={[9.5, 11.6, -5]} s={[6, 0.3, 0.3]} c="#9e9e9e" />
          <mesh position={[12.6, 12.4, -5]}><coneGeometry args={[0.45, 1.6, 8]} /><meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={1.4} toneMapped={false} /></mesh>
        </group>
      ))}
    </Batch>
  )
}
