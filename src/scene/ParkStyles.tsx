import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import { SEASON, PAL } from './season'
import { Upright } from './mergeScale'
import { brickTex, concreteTex, gravelTex, grassTex, paverTex, soilTex } from './textures'
import { Ball, Bench, Box, Cyl, Lamp, Patch, Sign, Tree, type EdgeProps, type Mat, type V3 } from './edgeKit'
import { Figure } from './Figure'

// Park styles (2x2 decorations, front +z): a dog park, a skate park, a koi
// garden and a botanical garden. Static pieces bake into Batch; the few
// moving things (dogs, a skater, koi) sit in small noBatch groups.

export const PARK_STYLES = new Set(['dogpark', 'skatepark', 'koi', 'garden'])

const SNOW = SEASON === 'winter'
const LIVE = { noBatch: true }

function Lawn({ m }: { m: Mat }) {
  return <Box m={m} at={[0, 0.02, 0]} s={[3.9, 0.04, 3.9]} c="#ffffff" t={grassTex(2, 2)} shadow={false} />
}

// ---- Dog park ----

function Dog({ m, c, ear = c, s = 1 }: { m: Mat; c: string; ear?: string; s?: number }) {
  return (
    <group scale={s}>
      <mesh position={[0, 0.13, 0]} scale={[0.7, 0.65, 1.3]} castShadow><sphereGeometry args={[0.08, 8, 6]} />{m(c)}</mesh>
      <Ball m={m} at={[0, 0.2, 0.11]} r={0.055} c={c} />
      <Box m={m} at={[0, 0.185, 0.17]} s={[0.04, 0.035, 0.05]} c={c} />
      <Box m={m} at={[0, 0.195, 0.197]} s={[0.022, 0.02, 0.01]} c="#212121" shadow={false} />
      {[-0.04, 0.04].map((x) => <Box key={x} m={m} at={[x, 0.24, 0.1]} s={[0.025, 0.05, 0.02]} c={ear} rot={[0, 0, x * 6]} shadow={false} />)}
      {[[-0.035, 0.06], [0.035, 0.06], [-0.035, -0.06], [0.035, -0.06]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.05, z]} s={[0.025, 0.1, 0.025]} c={c} />)}
      <Box m={m} at={[0, 0.18, -0.11]} s={[0.015, 0.015, 0.08]} c={c} rot={[0.7, 0, 0]} shadow={false} />
    </group>
  )
}

// Two dogs chase round a loop after a bouncing ball.
function Zoomies({ m }: { m: Mat }) {
  const a = useRef<Group>(null)
  const b = useRef<Group>(null)
  const ball = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.7
    const at = (k: number) => [Math.sin(k) * 0.75, Math.sin(2 * k) * 0.4] as const
    const place = (g: Group | null, k: number, hop: number) => {
      if (!g) return
      const [x, z] = at(k)
      const [nx, nz] = at(k + 0.05)
      g.position.set(x, Math.abs(Math.sin(clock.elapsedTime * hop)) * 0.03, z)
      g.rotation.y = Math.atan2(nx - x, nz - z)
    }
    place(ball.current, t + 0.5, 6)
    place(a.current, t, 11)
    place(b.current, t - 0.45, 10)
    if (ball.current) ball.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.18
  })
  return (
    <group position={[0.35, 0.04, 0.1]}>
      <group ref={a} userData={LIVE}><Dog m={m} c="#f5deb3" ear="#c8a165" /></group>
      <group ref={b} userData={LIVE}><Dog m={m} c="#424242" ear="#212121" s={0.85} /></group>
      <group ref={ball} userData={LIVE}><Ball m={m} at={[0, 0.03, 0]} r={0.03} c="#c6ff00" /></group>
    </group>
  )
}

function DogPark({ m, bulb, ghost }: EdgeProps) {
  const posts: V3[] = []
  for (let i = 0; i <= 6; i++) {
    const v = -1.85 + (3.7 * i) / 6
    posts.push([v, 0, -1.85], [-1.85, 0, v], [1.85, 0, v])
    if (Math.abs(v) > 0.4) posts.push([v, 0, 1.85])
  }
  return (
    <group>
      <Lawn m={m} />
      {/* Worn dirt where the dogs run the loop, and a gravel entry pad. */}
      {!ghost && [[0.35, 0.1, 0.32, 2.3], [-0.05, 1.3, 0.22, 1.6], [-1.05, -0.95, 0.25, 1.2]].map(([x, z, r, sx], i) => (
        <Patch key={i} at={[x, 0.045, z]} r={r} c="#8d6e4a" sx={sx} opacity={0.35} />
      ))}
      <Box m={m} at={[0, 0.045, 1.55]} s={[0.9, 0.02, 0.6]} c="#ffffff" t={gravelTex(1, 1)} shadow={false} />
      {/* Chain-link fence with a double gate at the front. */}
      {posts.map((p, i) => <Cyl key={i} m={m} at={[p[0], 0.3, p[2]]} r={0.02} h={0.6} c="#607d8b" seg={5} />)}
      {[0.12, 0.3, 0.58].map((y) => (
        <group key={y}>
          <Box m={m} at={[0, y, -1.85]} s={[3.7, 0.012, 0.012]} c="#78909c" shadow={false} />
          {[-1.85, 1.85].map((x) => <Box key={x} m={m} at={[x, y, 0]} s={[0.012, 0.012, 3.7]} c="#78909c" shadow={false} />)}
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 1.125, y, 1.85]} s={[1.45, 0.012, 0.012]} c="#78909c" shadow={false} />)}
        </group>
      ))}
      {[-0.4, 0.4].map((x) => (
        <group key={x} position={[x, 0, 1.85]} rotation-y={x < 0 ? 0.5 : -0.5}>
          <Box m={m} at={[-Math.sign(x) * -0.2, 0.3, 0]} s={[0.38, 0.5, 0.02]} c="#90a4ae" />
        </group>
      ))}
      <group position={[-1.1, 0, 1.92]}>
        {[-0.25, 0.25].map((x) => <Box key={x} m={m} at={[x, 0.25, 0]} s={[0.04, 0.5, 0.04]} c="#5d4037" />)}
        <Box m={m} at={[0, 0.5, -0.01]} s={[0.62, 0.17, 0.03]} c="#2e7d32" />
        {!ghost && <Sign text="DOG PARK" w={0.56} at={[0, 0.5, 0.008]} bg="#fff8e1" fg="#2e7d32" />}
      </group>
      {/* Agility course: A-frame, tunnel, hurdles and weave poles. */}
      <group position={[-1.05, 0, -1.0]} rotation-y={0.3}>
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[0, 0.2, sd * 0.2]} s={[0.36, 0.03, 0.46]} c={sd < 0 ? '#ffb300' : '#1e88e5'} rot={[sd * 0.95, 0, 0]} />)}
      </group>
      <group position={[1.1, 0.14, -1.15]} rotation-y={0.4}>
        <mesh rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[0.14, 0.14, 0.7, 12, 1, true]} />{m('#e53935')}</mesh>
        {[-0.35, 0.35].map((x) => <mesh key={x} position={[x, 0, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.14, 0.02, 6, 12]} />{m('#fdd835')}</mesh>)}
      </group>
      {[[-0.2, -1.4], [0.45, -1.45]].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          {[-0.18, 0.18].map((sx) => <Cyl key={sx} m={m} at={[sx, 0.14, 0]} r={0.015} h={0.28} c="#fafafa" seg={5} />)}
          <Cyl m={m} at={[0, 0.2, 0]} r={0.012} h={0.38} c="#e53935" seg={5} rot={[0, 0, Math.PI / 2]} />
        </group>
      ))}
      <group position={[-1.35, 0, 0.2]}>
        <Box m={m} at={[0, 0.015, 0]} s={[0.05, 0.03, 0.75]} c="#fafafa" />
        {[-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((z, i) => <Cyl key={z} m={m} at={[0, 0.16, z]} r={0.01} h={0.3} c={i % 2 ? '#1e88e5' : '#fafafa'} seg={5} />)}
      </group>
      {/* Hydrant, a drinking fountain, the bag station, benches and a shade tree. */}
      <group position={[1.15, 0, 1.2]}>
        <Cyl m={m} at={[0, 0.1, 0]} r={0.05} h={0.2} c="#e53935" seg={10} />
        <Ball m={m} at={[0, 0.21, 0]} r={0.05} c="#e53935" />
        <Cyl m={m} at={[0, 0.13, 0]} r={0.02} h={0.15} c="#c62828" seg={6} rot={[0, 0, Math.PI / 2]} />
      </group>
      <group position={[-1.5, 0, 1.25]}>
        <Cyl m={m} at={[0, 0.17, 0]} r={0.05} h={0.34} c="#78909c" seg={8} />
        <Cyl m={m} at={[0, 0.36, 0]} r={0.11} r2={0.08} h={0.05} c="#90a4ae" seg={12} />
        <Cyl m={m} at={[0.12, 0.03, 0.12]} r={0.08} h={0.04} c="#90a4ae" seg={12} />
      </group>
      <group position={[1.65, 0, 0.6]}>
        <Box m={m} at={[0, 0.25, 0]} s={[0.04, 0.5, 0.04]} c="#37474f" />
        <Box m={m} at={[0, 0.45, 0.04]} s={[0.12, 0.16, 0.06]} c="#2e7d32" />
        <Cyl m={m} at={[0, 0.12, 0.08]} r={0.07} h={0.22} c="#37474f" seg={8} />
      </group>
      <Bench m={m} at={[-0.4, 0, -1.55]} />
      <Bench m={m} at={[1.55, 0, -0.2]} rot={-Math.PI / 2} />
      <Bench m={m} at={[-1.55, 0, -0.35]} rot={Math.PI / 2} />
      <Tree m={m} at={[1.4, 0, -0.85]} s={1.25} leaves={PAL.leaves} bare={PAL.bare} />
      <Tree m={m} at={[-1.45, 0, -1.45]} s={1.05} leaves={PAL.leaves} bare={PAL.bare} />
      <Lamp m={m} at={[0.75, 0, 1.6]} bulb={bulb} ghost={ghost} />
      {!ghost && (
        <group>
          {/* A third dog sits by the bench with a frisbee nearby. */}
          <group position={[-0.25, 0.04, -1.25]} rotation-y={0.4}><Dog m={m} c="#d84315" ear="#bf360c" s={0.9} /></group>
          <Cyl m={m} at={[0.1, 0.05, -0.9]} r={0.06} h={0.012} c="#1e88e5" seg={12} />
          <Zoomies m={m} />
        </group>
      )}
    </group>
  )
}

// ---- Skate park ----

// The half-pipe's cross-section, in its own frame: across (u) and up (v).
const HP = { r: 0.55, flat: 0.5, deck: 0.28, w: 1.7 }
// The pipe stands a clear step above the park's slab (top at 0.06), so its
// flat bottom never lies flush with the slab and flickers; its base reaches
// down into the slab so it doesn't float (see coplanar.test.tsx).
const PIPE_Y = 0.072
const PIPE_BASE = -0.03
const hpHalf = HP.flat / 2 + HP.r + HP.deck
// Graffiti tags on the half-pipe's sides: [along, up, radius].
const TAGS: [number, number, number][] = [[-0.98, 0.14, 0.1], [-0.83, 0.36, 0.13], [0.84, 0.17, 0.16], [0.97, 0.41, 0.1]]

function halfPipeGeometry() {
  const { r, flat, w } = HP
  const s = new Shape()
  s.moveTo(-hpHalf, PIPE_BASE)
  s.lineTo(-hpHalf, r)
  s.lineTo(-flat / 2 - r, r)
  // Down the left wall (a quarter circle, hollow side up), across the flat, up the right.
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2)
    s.lineTo(-flat / 2 - r * Math.cos(a), r - r * Math.sin(a))
  }
  s.lineTo(flat / 2, 0)
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2)
    s.lineTo(flat / 2 + r * Math.sin(a), r - r * Math.cos(a))
  }
  s.lineTo(hpHalf, r)
  s.lineTo(hpHalf, PIPE_BASE)
  s.lineTo(-hpHalf, PIPE_BASE)
  const g = new ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -w / 2)
  return g
}

// Height and slope of the ramp surface at `u` across it.
function hpSurface(u: number): [number, number] {
  const { r, flat } = HP
  const d = Math.abs(u) - flat / 2
  if (d <= 0) return [0, 0]
  const c = Math.min(d, r)
  const y = r - Math.sqrt(Math.max(0, r * r - c * c))
  const slope = c / Math.sqrt(Math.max(1e-4, r * r - c * c))
  return [y, Math.sign(u) * Math.atan(slope)]
}

// A skateboard: deck, trucks and four wheels, about a third of a person long.
function Board({ m }: { m: Mat }) {
  return (
    <group>
      <Box m={m} at={[0, 0.052, 0]} s={[0.1, 0.014, 0.36]} c="#212121" />
      {[-0.12, 0.12].map((z) => (
        <group key={z}>
          <Box m={m} at={[0, 0.037, z]} s={[0.07, 0.016, 0.03]} c="#9e9e9e" shadow={false} />
          {[-1, 1].map((sd) => <Cyl key={sd} m={m} at={[sd * 0.04, 0.016, z]} r={0.016} h={0.02} c="#fafafa" seg={8} rot={[0, 0, Math.PI / 2]} />)}
        </group>
      ))}
    </group>
  )
}

// A skater riding sideways on a board, as big as the townspeople.
function Skater({ m, shirt }: { m: Mat; shirt: string }) {
  return (
    <group>
      <Board m={m} />
      <group position-y={0.059} rotation-y={Math.PI / 2}>
        <Figure shirt={shirt} pants="#1565c0" skin="#ffcc80" hat="#e53935" />
      </group>
    </group>
  )
}

// A skater pumping back and forth across the half-pipe.
function Rider({ m }: { m: Mat }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const u = Math.sin(clock.elapsedTime * 1.6) * (HP.flat / 2 + HP.r * 0.92)
    const [y, tilt] = hpSurface(u)
    g.current.position.set(0.3, y, u)
    g.current.rotation.x = -tilt
  })
  return <group ref={g} userData={LIVE}><Skater m={m} shirt="#ff7043" /></group>
}

function SkatePark({ m, bulb, ghost }: EdgeProps) {
  const pipe = useMemo(() => halfPipeGeometry(), [])
  const tags = ['#e91e63', '#00bcd4', '#ffeb3b', '#7c4dff', '#76ff03']
  return (
    <group>
      <Box m={m} at={[0, 0.03, 0]} s={[3.9, 0.06, 3.9]} c="#ffffff" t={concreteTex(4, 4)} shadow={false} />
      {/* Half-pipe across the back, running front to back, with coping and decks. */}
      <group position={[-0.55, PIPE_Y, -0.8]}>
        <mesh geometry={pipe} rotation-y={Math.PI / 2} castShadow receiveShadow>
          {m('#cfd8dc', concreteTex(1, 1))}
        </mesh>
        {[-1, 1].map((sd) => (
          <group key={sd}>
            {/* Square coping, posts and rails: merged, they run the pipe's whole width.
                The coping stops just short of the side walls so its ends don't lie flush with them. */}
            <Box m={m} at={[0, HP.r + 0.012, sd * (hpHalf - HP.deck)]} s={[HP.w - 0.01, 0.034, 0.034]} c="#b0bec5" />
            {[-0.8, 0, 0.8].map((x) => <Box key={x} m={m} at={[x, HP.r + 0.18, sd * (hpHalf - 0.03)]} s={[0.022, 0.36, 0.022]} c="#78909c" shadow={false} />)}
            <Box m={m} at={[0, HP.r + 0.34, sd * (hpHalf - 0.03)]} s={[HP.w, 0.02, 0.02]} c="#78909c" />
          </group>
        ))}
        {/* Graffiti on the side walls. */}
        {/* Only on the ramps' full-height ends: over the dip there's no wall to paint. */}
        {!ghost && [-1, 1].map((sd) => TAGS.map(([u, y, r], i) => (
          <mesh key={`${sd}${i}`} position={[sd * (HP.w / 2 + 0.004), y, u]} rotation-y={(sd * Math.PI) / 2}>
            <circleGeometry args={[r, 8]} />
            {m(tags[i])}
          </mesh>
        )))}
        {!ghost && <Rider m={m} />}
      </group>
      {/* Bowl corner: a quarter pipe, a funbox with a ledge and rail, a stair set. */}
      <group position={[1.25, 0.06, -1.0]}>
        <Box m={m} at={[0, 0.2, -0.3]} s={[0.9, 0.4, 0.6]} c="#b0bec5" t={concreteTex(1, 1)} />
        <Box m={m} at={[0, 0.12, 0.17]} s={[0.9, 0.04, 0.6]} c="#b0bec5" rot={[0.62, 0, 0]} />
        <Box m={m} at={[0, 0.41, 0.0]} s={[0.9, 0.028, 0.028]} c="#b0bec5" />
      </group>
      <group position={[0.3, 0.06, 0.9]}>
        <Box m={m} at={[0, 0.12, 0]} s={[0.8, 0.24, 0.5]} c="#90a4ae" t={concreteTex(1, 1)} />
        {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.6, 0.06, 0]} s={[0.42, 0.04, 0.5]} c="#90a4ae" rot={[0, 0, sd * -0.55]} />)}
        <Box m={m} at={[0, 0.25, 0.24]} s={[0.79, 0.025, 0.03]} c="#ffb300" />
        <Box m={m} at={[0, 0.38, -0.12]} s={[1.0, 0.028, 0.028]} c="#cfd8dc" />
        {[-0.4, 0.4].map((x) => <Box key={x} m={m} at={[x, 0.3, -0.12]} s={[0.022, 0.16, 0.022]} c="#cfd8dc" shadow={false} />)}
      </group>
      <group position={[1.4, 0.06, 0.8]} rotation-y={-Math.PI / 2}>
        {/* Steps overlap the next one, so their widths differ a hair: no shared side planes. */}
        {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.05 + i * 0.07, -0.25 + i * 0.12]} s={[0.6 - (i % 2) * 0.008, 0.1 + i * 0.14, 0.14]} c="#9e9e9e" t={concreteTex(1, 1)} />)}
        <Box m={m} at={[0, 0.36, 0.25]} s={[0.584, 0.2, 0.3]} c="#9e9e9e" t={concreteTex(1, 1)} />
        <Cyl m={m} at={[0, 0.42, 0.02]} r={0.012} h={0.62} c="#ffb300" seg={6} rot={[-0.55, 0, 0]} />
      </group>
      {/* Grind rail and a kicker in the middle. */}
      <group position={[-1.3, 0.06, 1.1]} rotation-y={0.4}>
        <Cyl m={m} at={[0, 0.16, 0]} r={0.015} h={0.9} c="#e53935" seg={6} rot={[Math.PI / 2, 0, 0]} />
        {[-0.38, 0.38].map((z) => <Box key={z} m={m} at={[0, 0.08, z]} s={[0.02, 0.16, 0.02]} c="#37474f" />)}
      </group>
      <Box m={m} at={[0.6, 0.12, -0.05]} s={[0.4, 0.03, 0.42]} c="#795548" rot={[0, 0.3, 0.3]} />
      {/* Bleacher, a spare board, a second skater sitting on the deck, lights. */}
      <group position={[-1.75, 0.06, 0.05]} rotation-y={Math.PI / 2}>
        {[0, 1].map((i) => <Box key={i} m={m} at={[0, 0.1 + i * 0.12, -i * 0.15]} s={[0.9, 0.03, 0.14]} c="#90a4ae" />)}
        {[-0.4, 0.4].map((x) => <Box key={x} m={m} at={[x, 0.12, -0.08]} s={[0.03, 0.24, 0.296]} c="#607d8b" />)}
      </group>
      {!ghost && (
        <group>
          {/* A second skater waiting on the deck, board at their feet. */}
          <group position={[-0.1, PIPE_Y + HP.r, -0.8 - hpHalf + 0.14]} rotation-y={0.5}>
            <Figure shirt="#43a047" pants="#37474f" skin="#8d5524" hat="#212121" />
            <group position={[0.2, 0, 0.02]} rotation-y={1.2}><Board m={m} /></group>
          </group>
          {[[1.7, 1.7], [-1.7, -1.7]].map(([x, z]) => <Lamp key={x} m={m} at={[x, 0.06, z]} h={1.4} bulb={bulb} />)}
          <Cyl m={m} at={[1.75, 0.2, -0.15]} r={0.08} h={0.28} c="#455a64" seg={8} />
        </group>
      )}
      <group position={[0, 0.06, 1.88]}>
        {[-0.45, 0.45].map((x) => <Box key={x} m={m} at={[x, 0.25, 0]} s={[0.05, 0.5, 0.05]} c="#212121" />)}
        <Box m={m} at={[0, 0.48, -0.01]} s={[1.0, 0.24, 0.026]} c="#ff7043" />
        {!ghost && <Sign text="SKATE PARK" w={0.92} at={[0, 0.48, 0.008]} bg="#212121" fg="#ff7043" />}
      </group>
    </group>
  )
}

// ---- Koi garden ----

function Koi() {
  const g = useRef<Group>(null)
  const fish = [
    { r: 0.55, sp: 0.35, ph: 0, c: '#ff6d00', y: 0.08 },
    { r: 0.4, sp: -0.45, ph: 2, c: '#fafafa', y: 0.075 },
    { r: 0.65, sp: 0.28, ph: 4, c: '#ffab00', y: 0.07 },
    { r: 0.3, sp: 0.55, ph: 1, c: '#e53935', y: 0.08 },
  ]
  useFrame(({ clock }) => {
    if (!g.current) return
    g.current.children.forEach((o, i) => {
      const f = fish[i]
      const a = clock.elapsedTime * f.sp + f.ph
      o.position.set(Math.sin(a) * f.r * 1.2, f.y, Math.cos(a) * f.r * 0.8)
      o.rotation.y = a + (f.sp > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(clock.elapsedTime * 4 + i) * 0.2
    })
  })
  return (
    <group ref={g} userData={LIVE}>
      {fish.map((f, i) => (
        <group key={i}>
          {/* Fish stay fish-sized in a merged garden's bigger pond. */}
          <Upright size={1}>
            <mesh scale={[0.4, 0.35, 1]}><sphereGeometry args={[0.07, 8, 5]} /><meshStandardMaterial color={f.c} /></mesh>
            <mesh position={[0, 0, -0.08]} rotation-x={Math.PI / 2} scale={[1, 0.3, 1]}><coneGeometry args={[0.035, 0.05, 5]} /><meshStandardMaterial color={f.c} /></mesh>
          </Upright>
        </group>
      ))}
    </group>
  )
}

function KoiGarden({ m, bulb, ghost }: EdgeProps) {
  const water = SNOW ? '#cfe6ef' : '#2f8f9d'
  const maple = PAL.bare ? null : SEASON === 'fall' ? ['#d84315', '#ff8f00', '#c62828'] : ['#c62828', '#e53935', '#ad1457']
  return (
    <group>
      <Lawn m={m} />
      {/* Raked gravel bed with three rocks, back left. */}
      <Box m={m} at={[-1.15, 0.045, -1.15]} s={[1.4, 0.02, 1.2]} c="#ffffff" t={gravelTex(2, 2)} shadow={false} />
      {!ghost && [-1.45, -1.3, -1.15, -1.0, -0.85].map((z) => <Box key={z} m={m} at={[-1.15, 0.058, z]} s={[1.3, 0.006, 0.02]} c="#cfd3d6" shadow={false} />)}
      {[[-1.4, -1.25, 0.16], [-0.95, -0.95, 0.11], [-1.05, -1.4, 0.08]].map(([x, z, r], i) => <Ball key={i} m={m} at={[x, 0.06 + r * 0.5, z]} r={r} c="#78909c" flat />)}
      {/* The pond: two overlapping pools ringed with stones, lily pads on top. */}
      <group position={[0.25, 0, 0.1]}>
        <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} scale={[1.2, 0.8, 1]}><circleGeometry args={[0.85, 28]} /><meshStandardMaterial color={water} roughness={SNOW ? 0.5 : 0.12} metalness={0.1} /></mesh>
        <mesh position={[0.75, 0.051, 0.45]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.5, 20]} /><meshStandardMaterial color={water} roughness={SNOW ? 0.5 : 0.12} metalness={0.1} /></mesh>
        {Array.from({ length: 26 }, (_, i) => {
          const a = (i / 26) * Math.PI * 2
          return <Ball key={i} m={m} at={[Math.sin(a) * 1.05, 0.06, Math.cos(a) * 0.72]} r={0.07 + (i % 3) * 0.025} c={['#9e9e9e', '#8d8d8d', '#a1a1a1'][i % 3]} flat />
        })}
        {!ghost && !SNOW && (
          <group>
            {[[-0.5, 0.25, 0.09], [-0.35, 0.38, 0.07], [0.45, -0.3, 0.08], [0.85, 0.55, 0.07]].map(([x, z, r], i) => <Patch key={i} at={[x, 0.058, z]} r={r} c="#43a047" />)}
            <Ball m={m} at={[-0.5, 0.075, 0.25]} r={0.03} c="#f48fb1" />
            <Koi />
          </group>
        )}
      </group>
      {/* Red arched bridge across the narrow part. */}
      {/* One piece when merged, so the planks stay a bridge; its end planks rest on the banks. */}
      <group position={[0.95, 0, -0.15]} rotation-y={0.5} userData={{ whole: true }}>
        {Array.from({ length: 9 }, (_, i) => {
          const t = i / 8 - 0.5
          return <Box key={i} m={m} at={[0, 0.06 + Math.cos(t * Math.PI) * 0.24, t * 0.9]} s={[0.36, 0.03, 0.11]} c="#8d6e63" rot={[-Math.sin(t * Math.PI) * 0.55, 0, 0]} />
        })}
        {[-0.19, 0.19].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.15, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.5, 0.018, 6, 16, Math.PI]} />{m('#c62828')}</mesh>
            {[-0.35, 0, 0.35].map((z) => <Cyl key={z} m={m} at={[x, 0.25 + Math.cos(z * 2.2) * 0.12, z]} r={0.018} h={0.2} c="#c62828" seg={6} />)}
          </group>
        ))}
      </group>
      {/* Stone lantern lit at night, and a little tea pavilion. */}
      <group position={[-0.5, 0, 0.95]}>
        <Cyl m={m} at={[0, 0.0425, 0]} r={0.12} h={0.085} c="#9e9e9e" seg={6} />
        <Cyl m={m} at={[0, 0.22, 0]} r={0.04} h={0.3} c="#9e9e9e" seg={6} />
        <Cyl m={m} at={[0, 0.39, 0]} r={0.1} h={0.04} c="#9e9e9e" seg={6} />
        <mesh position={[0, 0.47, 0]}><boxGeometry args={[0.12, 0.12, 0.12]} />{bulb}</mesh>
        <mesh position={[0, 0.58, 0]} castShadow><coneGeometry args={[0.16, 0.12, 6]} />{m(SNOW ? '#f4f8fb' : '#8d8d8d')}</mesh>
        <Ball m={m} at={[0, 0.66, 0]} r={0.025} c="#8d8d8d" />
      </group>
      <group position={[1.15, 0, -1.25]}>
        <Box m={m} at={[0, 0.06, 0]} s={[0.95, 0.08, 0.8]} c="#a1887f" t={paverTex(2, 2)} />
        {[[-0.4, -0.33], [0.4, -0.33], [-0.4, 0.33], [0.4, 0.33]].map(([x, z]) => <Box key={`${x}${z}`} m={m} at={[x, 0.38, z]} s={[0.06, 0.6, 0.06]} c="#5d4037" />)}
        <mesh position={[0, 0.82, 0]} rotation-y={Math.PI / 4} scale={[1, 0.55, 1]} castShadow><coneGeometry args={[0.8, 0.6, 4]} />{m(SNOW ? '#f4f8fb' : '#37474f')}</mesh>
        <Box m={m} at={[0, 0.69, 0]} s={[0.98, 0.04, 0.84]} c="#4e342e" />
        <Box m={m} at={[0, 0.2, 0]} s={[0.36, 0.04, 0.26]} c="#4e342e" />
        <Box m={m} at={[0, 0.14, 0]} s={[0.08, 0.1, 0.08]} c="#4e342e" />
        <mesh position={[0, 0.66, 0.34]}><boxGeometry args={[0.06, 0.08, 0.06]} />{bulb}</mesh>
      </group>
      {/* Maples, bamboo and stepping stones from the front gate. */}
      {[[1.55, 0.9, 1], [-1.55, 0.25, 0.85], [0.1, -1.55, 0.95]].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <Cyl m={m} at={[0, 0.3, 0]} r={0.035} r2={0.05} h={0.6} c="#4e342e" seg={6} rot={[0, 0, 0.12]} />
          {maple
            ? [[0, 0.75, 0, 0.26], [0.18, 0.66, 0.06, 0.2], [-0.16, 0.68, -0.05, 0.21], [0.02, 0.62, -0.18, 0.18]].map(([lx, ly, lz, r], k) => (
                <mesh key={k} position={[lx, ly, lz]} scale={[1, 0.6, 1]} castShadow><icosahedronGeometry args={[r, 0]} />{m(maple[k % maple.length])}</mesh>
              ))
            : [-0.6, 0.6].map((r) => <Cyl key={r} m={m} at={[r * 0.12, 0.7, 0]} r={0.012} r2={0.025} h={0.32} c="#4e342e" seg={5} rot={[0, 0, r]} />)}
        </group>
      ))}
      <group position={[-1.6, 0, 1.3]}>
        {[[0, 0, 0.9], [0.1, 0.08, 0.75], [-0.08, 0.1, 1.0], [0.06, -0.1, 0.7], [-0.12, -0.05, 0.85]].map(([x, z, h], i) => (
          <group key={i}>
            <Cyl m={m} at={[x, h / 2, z]} r={0.018} h={h} c="#7cb342" seg={6} />
            {!PAL.bare && <Box m={m} at={[x + 0.04, h - 0.05, z]} s={[0.1, 0.01, 0.03]} c="#558b2f" rot={[0, i, -0.4]} shadow={false} />}
          </group>
        ))}
      </group>
      {[[0.15, 1.7], [0.0, 1.45], [-0.15, 1.2], [-0.05, 0.95]].map(([x, z], i) => <Cyl key={i} m={m} at={[x, 0.05, z]} r={0.1 + (i % 2) * 0.02} h={0.03} c="#bdbdbd" seg={9} />)}
      {/* A small red gate at the entrance. */}
      <group position={[0.35, 0, 1.75]}>
        {[-0.38, 0.38].map((x) => <Cyl key={x} m={m} at={[x, 0.42, 0]} r={0.035} h={0.84} c="#c62828" seg={8} />)}
        <Box m={m} at={[0, 0.88, 0]} s={[1.0, 0.06, 0.08]} c="#212121" rot={[0, 0, 0]} />
        <Box m={m} at={[0, 0.74, 0]} s={[0.86, 0.04, 0.05]} c="#c62828" />
      </group>
      <Bench m={m} at={[1.55, 0, 0.0]} rot={-Math.PI / 2} />
    </group>
  )
}

// ---- Botanical garden ----

function Glasshouse({ m, bulb, ghost }: { m: Mat; bulb: ReactNode; ghost?: boolean }) {
  const w = 2.6, d = 1.0, h = 0.62, r = d / 2
  const glass = <meshStandardMaterial color="#cdeefa" transparent opacity={ghost ? 0.3 : 0.38} roughness={0.08} metalness={0.2} depthWrite={false} />
  return (
    <group position={[0, 0, -1.25]}>
      <Box m={m} at={[0, 0.08, 0]} s={[w + 0.06, 0.16, d + 0.06]} c="#b0796b" t={brickTex(4, 1)} />
      {/* Plants inside, seen through the glass. */}
      {!ghost && (
        <group>
          {[-0.9, -0.3, 0.35, 0.95].map((x, i) => (
            <group key={x} position={[x, 0.16, (i % 2) * 0.2 - 0.1]}>
              <Cyl m={m} at={[0, 0.25, 0]} r={0.025} h={0.5} c="#8d6e63" seg={5} />
              {[0, 1.3, 2.6, 3.9, 5.2].map((a) => <Box key={a} m={m} at={[Math.sin(a) * 0.12, 0.5, Math.cos(a) * 0.12]} s={[0.05, 0.015, 0.26]} c="#43a047" rot={[0.5, a, 0]} shadow={false} />)}
            </group>
          ))}
          {[-0.6, 0.05, 0.65].map((x) => <Ball key={x} m={m} at={[x, 0.26, 0.15]} r={0.12} c="#66bb6a" flat />)}
        </group>
      )}
      <mesh position={[0, 0.16 + h / 2, 0]}><boxGeometry args={[w, h, d]} />{glass}</mesh>
      <mesh position={[0, 0.16 + h, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[r, r, w, 16, 1, true, 0, Math.PI]} />{glass}</mesh>
      {/* White ironwork: posts, rails, roof ribs, the dome and its lantern. */}
      {Array.from({ length: 9 }, (_, i) => -w / 2 + (w * i) / 8).map((x, i) => (
        <group key={x}>
          {/* Just outside the glass, so a merged glasshouse's posts never sit flush with it. */}
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[x + (i === 0 ? -0.003 : i === 8 ? 0.003 : 0), 0.16 + (h - 0.004) / 2, sd * (d / 2 + 0.003)]} s={[0.025, h - 0.004, 0.025]} c="#fafafa" shadow={false} />)}
          <mesh position={[x, 0.16 + h, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[r + 0.01, r + 0.01, 0.025, 16, 1, true, 0, Math.PI]} />{m('#fafafa')}</mesh>
        </group>
      ))}
      {[0.16 + h, 0.16 + h * 0.5].map((y) => [-1, 1].map((sd) => <Box key={`${y}${sd}`} m={m} at={[0, y, sd * (d / 2 + 0.004)]} s={[w + 0.012, 0.025, 0.025]} c="#fafafa" shadow={false} />))}
      {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * (w / 2 + 0.004), 0.16 + (h - 0.004) / 2, 0]} s={[0.03, h - 0.004, d - 0.004]} c="#fafafa" shadow={false} />)}
      <group position={[0, 0.16 + h + r - 0.05, 0]}>
        <mesh><sphereGeometry args={[0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{glass}</mesh>
        {[0, 1, 2, 3].map((k) => <mesh key={k} rotation-y={(k * Math.PI) / 4}><torusGeometry args={[0.36, 0.012, 4, 16, Math.PI]} />{m('#fafafa')}</mesh>)}
        <Cyl m={m} at={[0, 0.4, 0]} r={0.06} h={0.1} c="#fafafa" seg={8} />
        <mesh position={[0, 0.47, 0]}><sphereGeometry args={[0.04, 8, 6]} />{bulb}</mesh>
      </group>
      {/* Doors in the middle of the front. */}
      <mesh position={[0, 0.4, d / 2 + 0.01]}><planeGeometry args={[0.3, 0.48]} />{m('#2e7d32')}</mesh>
      <Box m={m} at={[0, 0.66, d / 2 + 0.02]} s={[0.36, 0.04, 0.03]} c="#fafafa" />
    </group>
  )
}

function Garden({ m, bulb, ghost }: EdgeProps) {
  const blooms = PAL.bare ? ['#2e7d32', '#1b5e20'] : SEASON === 'fall' ? ['#e65100', '#fbc02d', '#c62828', '#8e24aa'] : SEASON === 'spring' ? ['#f8bbd0', '#fff59d', '#ce93d8', '#ffffff'] : ['#e91e63', '#ffeb3b', '#7e57c2', '#ff7043']
  // Four flower beds edged with box hedges, one in each corner of the cross paths.
  const beds: [number, number][] = [[-1.05, 0.35], [1.05, 0.35], [-1.05, 1.35], [1.05, 1.35]]
  return (
    <group>
      <Lawn m={m} />
      <Box m={m} at={[0, 0.045, 0.598]} s={[0.5, 0.02, 2.696]} c="#ffffff" t={paverTex(1, 4)} shadow={false} />
      <Box m={m} at={[0, 0.048, 0.85]} s={[3.6, 0.02, 0.4]} c="#ffffff" t={paverTex(5, 1)} shadow={false} />
      <Box m={m} at={[0, 0.048, -0.55]} s={[3.2, 0.02, 0.35]} c="#ffffff" t={paverTex(5, 1)} shadow={false} />
      <Glasshouse m={m} bulb={bulb} ghost={ghost} />
      {beds.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box m={m} at={[0, 0.05, 0]} s={[1.3, 0.04, 0.62]} c="#ffffff" t={soilTex(1, 1)} shadow={false} />
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[0, 0.09, sd * 0.31]} s={[1.32, 0.1, 0.07]} c="#33691e" />)}
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[sd * 0.65, 0.09, 0]} s={[0.07, 0.1, 0.616]} c="#33691e" />)}
          {!ghost && Array.from({ length: 12 }, (_, k) => (
            <Ball key={k} m={m} at={[-0.48 + (k % 6) * 0.19, 0.11, (k < 6 ? -0.11 : 0.11)]} r={0.06} c={blooms[(k + i) % blooms.length]} />
          ))}
          {SNOW && <Box m={m} at={[0, 0.15, 0]} s={[1.2, 0.02, 0.5]} c="#f4f8fb" shadow={false} />}
        </group>
      ))}
      {/* Tiered fountain where the paths cross. */}
      <group position={[0, 0.05, 0.85]}>
        <Cyl m={m} at={[0, 0.07, 0]} r={0.36} h={0.14} c="#e0e0e0" seg={20} />
        <mesh position={[0, 0.145, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.32, 20]} /><meshStandardMaterial color={SNOW ? '#cfe6ef' : '#4fc3f7'} roughness={0.1} /></mesh>
        <Cyl m={m} at={[0, 0.3, 0]} r={0.04} h={0.3} c="#e0e0e0" seg={8} />
        <Cyl m={m} at={[0, 0.46, 0]} r={0.15} r2={0.06} h={0.06} c="#e0e0e0" seg={14} />
        <Ball m={m} at={[0, 0.53, 0]} r={0.04} c="#e0e0e0" />
      </group>
      {/* Topiary in pots along the walks, lamps and benches. */}
      {[[-0.4, 0.2], [0.4, 0.2], [-0.4, 1.5], [0.4, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0.05, z]}>
          <Cyl m={m} at={[0, 0.07, 0]} r={0.07} r2={0.055} h={0.14} c="#bf6b4a" seg={8} />
          {i % 2
            ? <mesh position={[0, 0.32, 0]} castShadow><coneGeometry args={[0.1, 0.36, 8]} />{m('#2e7d32')}</mesh>
            : <Ball m={m} at={[0, 0.25, 0]} r={0.11} c="#2e7d32" flat />}
        </group>
      ))}
      <Lamp m={m} at={[-0.4, 0.05, 0.85]} bulb={bulb} ghost={ghost} />
      <Lamp m={m} at={[0.4, 0.05, -0.55]} bulb={bulb} ghost={ghost} />
      <Bench m={m} at={[-1.05, 0.05, -0.2]} rot={0} />
      <Bench m={m} at={[1.05, 0.05, -0.2]} rot={0} />
      {/* Rose arch at the entrance with the garden's name on a stone plinth. */}
      <group position={[0, 0.05, 1.82]}>
        {/* One piece, so a merged garden doesn't pull the posts out from under the hoop. */}
        <Upright>
          <mesh position={[0, 0.48, 0]}><torusGeometry args={[0.3, 0.025, 6, 14, Math.PI]} />{m('#fafafa')}</mesh>
          {[-0.3, 0.3].map((x) => <Cyl key={x} m={m} at={[x, 0.24, 0]} r={0.025} h={0.48} c="#fafafa" seg={6} />)}
          {!PAL.bare && Array.from({ length: 9 }, (_, k) => {
            const a = (k / 8) * Math.PI
            return <Ball key={k} m={m} at={[Math.cos(a) * 0.3, 0.48 + Math.sin(a) * 0.3, 0.02]} r={0.04} c={k % 2 ? '#e91e63' : '#43a047'} />
          })}
        </Upright>
        <group position={[-1.1, 0, 0]}>
          <Box m={m} at={[0, 0.12, 0]} s={[0.9, 0.24, 0.12]} c="#bdbdbd" t={brickTex(2, 1)} />
          {!ghost && <Sign text="BOTANICAL GARDEN" w={0.84} at={[0, 0.13, 0.065]} bg="#1b5e20" fg="#fff8e1" />}
        </group>
      </group>
      <Tree m={m} at={[1.6, 0, 1.7]} s={0.9} leaves={PAL.leaves} bare={PAL.bare} />
      <Tree m={m} at={[1.65, 0, -0.45]} s={0.8} leaves={PAL.leaves} bare={PAL.bare} />
      <Tree m={m} at={[-1.62, 0, -0.45]} s={0.85} leaves={PAL.leaves} bare={PAL.bare} />
    </group>
  )
}

export function ParkStyleModel(p: EdgeProps & { id: string }) {
  switch (p.id) {
    case 'dogpark': return <DogPark {...p} />
    case 'skatepark': return <SkatePark {...p} />
    case 'koi': return <KoiGarden {...p} />
    default: return <Garden {...p} />
  }
}
