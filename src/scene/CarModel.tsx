import { useMemo } from 'react'
import { Color, DoubleSide, ExtrudeGeometry, Shape as ThreeShape, type Group } from 'three'
import { RoundedBox } from '@react-three/drei'
import { rimTex } from './textures'
import { glowMats } from './dayNight'
import type { Body } from '../game/data'

type Shape = {
  len: number; wid: number
  body: number // lower body height
  lift: number // ground clearance
  cabinLen: number; cabinH: number; cabinZ: number
  taper: number // how much the cabin roof narrows (0 = box)
  hood: number // hood bulge height
  wheel: number
  spoiler?: boolean; bed?: boolean; scoop?: boolean
  round?: boolean // domed cabin and soft body, like a bubble car
  open?: boolean // no roof: windshield and seats only
  rollbar?: boolean
  fins?: boolean // fifties tail fins
  wood?: boolean // wood side panels
  wing?: boolean // tall rally wing
  drop: number // how far the hood sits below the rear deck
  nose: number // how far the nose falls away from the hood
}

const SHAPES: Record<Body, Shape> = {
  compact: { len: 0.95, wid: 0.64, body: 0.27, lift: 0.1, cabinLen: 0.58, cabinH: 0.28, cabinZ: -0.06, taper: 0.72, hood: 0, wheel: 0.15, drop: 0.06, nose: 0.05 },
  sedan: { len: 1.22, wid: 0.66, body: 0.24, lift: 0.1, cabinLen: 0.62, cabinH: 0.25, cabinZ: -0.06, taper: 0.74, hood: 0, wheel: 0.15, drop: 0.05, nose: 0.05 },
  sports: { len: 1.22, wid: 0.7, body: 0.19, lift: 0.08, cabinLen: 0.52, cabinH: 0.18, cabinZ: -0.12, taper: 0.64, hood: 0.03, wheel: 0.15, drop: 0.04, nose: 0.06, spoiler: true },
  muscle: { len: 1.32, wid: 0.7, body: 0.25, lift: 0.1, cabinLen: 0.52, cabinH: 0.21, cabinZ: -0.16, taper: 0.76, hood: 0.05, wheel: 0.16, drop: 0.02, nose: 0.05, scoop: true },
  truck: { len: 1.38, wid: 0.74, body: 0.32, lift: 0.18, cabinLen: 0.5, cabinH: 0.31, cabinZ: 0.2, taper: 0.88, hood: 0, wheel: 0.2, drop: 0.03, nose: 0.06, bed: true },
  super: { len: 1.28, wid: 0.76, body: 0.16, lift: 0.07, cabinLen: 0.5, cabinH: 0.16, cabinZ: -0.04, taper: 0.56, hood: 0.02, wheel: 0.15, drop: 0.03, nose: 0.07, spoiler: true, scoop: true },
  bubble: { len: 0.98, wid: 0.66, body: 0.28, lift: 0.11, cabinLen: 0.6, cabinH: 0.22, cabinZ: -0.04, taper: 0.6, hood: 0, wheel: 0.15, drop: 0.08, nose: 0.06, round: true },
  wagon: { len: 1.36, wid: 0.68, body: 0.25, lift: 0.1, cabinLen: 0.9, cabinH: 0.25, cabinZ: -0.16, taper: 0.9, hood: 0, wheel: 0.15, drop: 0.05, nose: 0.05, wood: true },
  wedge: { len: 1.3, wid: 0.78, body: 0.14, lift: 0.07, cabinLen: 0.56, cabinH: 0.15, cabinZ: 0.02, taper: 0.42, hood: 0, wheel: 0.15, drop: 0.02, nose: 0.08, spoiler: true },
  roadster: { len: 1.08, wid: 0.66, body: 0.2, lift: 0.08, cabinLen: 0.42, cabinH: 0.16, cabinZ: -0.12, taper: 0.7, hood: 0.02, wheel: 0.14, drop: 0.02, nose: 0.06, open: true },
  rally: { len: 1.2, wid: 0.68, body: 0.24, lift: 0.11, cabinLen: 0.6, cabinH: 0.24, cabinZ: -0.06, taper: 0.74, hood: 0.02, wheel: 0.16, drop: 0.05, nose: 0.05, scoop: true, wing: true },
  classic: { len: 1.48, wid: 0.72, body: 0.25, lift: 0.1, cabinLen: 0.56, cabinH: 0.22, cabinZ: -0.08, taper: 0.8, hood: 0, wheel: 0.15, drop: 0.02, nose: 0.04, fins: true },
  offroad: { len: 0.96, wid: 0.7, body: 0.16, lift: 0.2, cabinLen: 0.4, cabinH: 0.2, cabinZ: -0.1, taper: 1, hood: 0, wheel: 0.21, drop: 0.0, nose: 0.03, open: true, rollbar: true },
  coupe: { len: 1.26, wid: 0.72, body: 0.21, lift: 0.08, cabinLen: 0.5, cabinH: 0.2, cabinZ: -0.16, taper: 0.62, hood: 0.03, wheel: 0.16, drop: 0.03, nose: 0.06 },
}

// Side profile of the lower body: a high rear deck, a hood that drops toward
// the nose, and rounded corners. u runs along the car (+ is the front).
function bodyProfile(s: Shape, b: number) {
  const L = s.len / 2 - b
  const bot = s.lift + 0.03
  const deck = s.lift + s.body - b
  const hood = deck - s.drop
  const nose = Math.max(bot + 0.07, hood - s.nose)
  const r = Math.min(0.06, s.body * 0.3)
  const sh = new ThreeShape()
  sh.moveTo(-L + r, bot)
  sh.lineTo(L - r * 0.6, bot)
  sh.quadraticCurveTo(L, bot, L, bot + r)
  sh.lineTo(L, nose)
  sh.quadraticCurveTo(L, hood, L - s.len * 0.12, hood)
  // Hood runs back to the base of the windshield, then steps up to the deck.
  const cowl = Math.min(s.cabinZ + s.cabinLen / 2, L - s.len * 0.12 - 0.06)
  sh.lineTo(cowl + 0.04, hood)
  sh.quadraticCurveTo(cowl, hood, cowl - 0.04, deck)
  sh.lineTo(-L + r, deck)
  sh.quadraticCurveTo(-L, deck, -L, deck - r)
  sh.lineTo(-L, bot + r)
  sh.quadraticCurveTo(-L, bot, -L + r, bot)
  return { sh, hood: hood + b, deck: deck + b }
}

// Greenhouse profile: raked windshield, roof and rear window with soft corners.
function cabinProfile(s: Shape, base: number, b: number) {
  const front = s.cabinZ + s.cabinLen / 2 - b
  const rear = s.cabinZ - s.cabinLen / 2 + b
  const slack = s.cabinLen * (1 - s.taper)
  const roofF = front - slack * 0.72
  const roofR = rear + slack * 0.28
  const roof = base + s.cabinH - b
  const r = Math.min(0.05, s.cabinH * 0.35)
  const sh = new ThreeShape()
  sh.moveTo(rear, base - 0.02)
  sh.lineTo(front, base - 0.02)
  sh.lineTo(roofF + r * 0.5, roof - r * 0.4)
  sh.quadraticCurveTo(roofF, roof, roofF - r, roof)
  sh.lineTo(roofR + r, roof)
  sh.quadraticCurveTo(roofR, roof, roofR - r * 0.3, roof - r * 0.6)
  sh.lineTo(rear, base - 0.02)
  return { sh, roofF, roofR, roof: roof + b }
}

// Extrudes a side profile across the car's width with bevelled (rounded) edges.
function extrude(sh: ThreeShape, width: number, b: number) {
  const g = new ExtrudeGeometry(sh, { depth: Math.max(0.01, width - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 })
  // Profile x is along the car; turn it so it faces +z and centre it across the width.
  g.translate(0, 0, -(width - 2 * b) / 2)
  g.rotateY(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Footprint of a body (before any scaling), for keeping town cars apart.
export const carSize = (body: Body) => ({ len: SHAPES[body].len, wid: SHAPES[body].wid })

// Wheel radius and the distance between front and rear axles, for steering and rolling.
export const wheelRig = (body: Body): WheelRig => ({ steer: [], spin: [], radius: SHAPES[body].wheel, base: SHAPES[body].len * 0.66 })

const geoCache = new Map<Body, { body: ExtrudeGeometry; glass: ExtrudeGeometry | null; roof: ExtrudeGeometry | null; hood: number; deck: number; roofY: number; roofLen: number; roofZ: number }>()

function carGeo(body: Body) {
  const hit = geoCache.get(body)
  if (hit) return hit
  const s = SHAPES[body]
  const b = s.round ? Math.min(0.1, s.body * 0.4) : 0.035
  const lower = bodyProfile(s, b)
  let glass: ExtrudeGeometry | null = null
  let roof: ExtrudeGeometry | null = null
  let roofY = lower.deck
  let roofLen = 0
  let roofZ = s.cabinZ
  if (!s.open && !s.round) {
    const cb = 0.025
    const c = cabinProfile(s, lower.deck - 0.01, cb)
    glass = extrude(c.sh, s.wid * 0.8, cb)
    // Painted roof panel sitting on the glass, slightly wider so it reads as a roof line.
    const rs = new ThreeShape()
    const t = 0.03
    rs.moveTo(c.roofR, c.roof - t)
    rs.lineTo(c.roofF, c.roof - t)
    rs.lineTo(c.roofF - 0.01, c.roof)
    rs.lineTo(c.roofR + 0.01, c.roof)
    rs.lineTo(c.roofR, c.roof - t)
    roof = extrude(rs, s.wid * 0.84, 0.015)
    roofY = c.roof
    roofLen = c.roofF - c.roofR
    roofZ = (c.roofF + c.roofR) / 2
  }
  const out = { body: extrude(lower.sh, s.wid, b), glass, roof, hood: lower.hood, deck: lower.deck, roofY, roofLen, roofZ }
  geoCache.set(body, out)
  return out
}

// Toy-style car: bevelled extruded body and cabin so no edge is a hard box corner. Faces +z.
// Handles on a car's wheels so a driving car can steer the front pair and roll all four.
export type WheelRig = { steer: (Group | null)[]; spin: (Group | null)[]; radius: number; base: number }

export function CarModel({ body, color, highlight, stripe, beams, rusty, rig }: { body: Body; color: string; highlight?: boolean; stripe?: string | null; beams?: boolean; rusty?: boolean; rig?: WheelRig }) {
  const s = SHAPES[body]
  const g = carGeo(body)
  // Rusty finds keep a hint of their paint under brown, matte rust.
  const tint = useMemo(() => (rusty ? '#' + new Color(color).lerp(new Color('#8a5a3c'), 0.72).getHexString() : color), [color, rusty])
  const dark = useMemo(() => '#' + new Color(tint).multiplyScalar(0.6).getHexString(), [tint])
  const top = g.deck
  const wz = s.len * 0.33
  const wx = s.wid / 2 - 0.02
  const cowl = s.cabinZ + s.cabinLen / 2
  const hoodFront = s.len / 2 - s.len * 0.1
  const lightY = s.lift + (Math.max(s.lift + 0.1, g.hood - s.nose) - s.lift) * 0.7
  const paint = <meshStandardMaterial color={tint} metalness={rusty ? 0.1 : 0.4} roughness={rusty ? 0.95 : 0.3} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
  const glassMat = <meshStandardMaterial color="#4f86b0" metalness={0.55} roughness={0.06} />
  return (
    <group>
      <mesh geometry={g.body} castShadow>{paint}</mesh>
      {/* Dark rocker panel along the bottom. */}
      <RoundedBox args={[s.wid * 1.01, 0.06, s.len * 0.8]} radius={0.025} smoothness={2} position={[0, s.lift + 0.04, 0]}>
        <meshStandardMaterial color={dark} />
      </RoundedBox>
      {/* Wheel arches: dark wells behind each tyre so the wheels sit in the body. */}
      {[wz, -wz].map((z) => [-1, 1].map((sd) => (
        <mesh key={`a${z}${sd}`} position={[sd * (s.wid / 2 + 0.003), s.wheel, z]} rotation-y={sd * Math.PI / 2}>
          <circleGeometry args={[s.wheel * 1.18, 18, 0, Math.PI]} />
          <meshStandardMaterial color="#141414" side={DoubleSide} />
        </mesh>
      )))}
      {s.round ? (
        <group position={[0, top - 0.02, s.cabinZ]} scale={[s.wid * 0.46, s.cabinH * 1.25, s.cabinLen * 0.58]}>
          {/* Domed cabin: glass all round under a painted roof cap. */}
          <mesh castShadow>
            <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {glassMat}
          </mesh>
          <mesh scale={1.02}>
            <sphereGeometry args={[1, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.36]} />
            {paint}
          </mesh>
        </group>
      ) : s.open ? (
        <group position={[0, top, s.cabinZ]}>
          {/* Open top: raked windshield, two seats and an optional roll bar. */}
          <mesh position={[0, s.cabinH * 0.45, s.cabinLen * 0.5]} rotation-x={-0.5}>
            <boxGeometry args={[s.wid * 0.86, s.cabinH * 0.9, 0.02]} />
            <meshStandardMaterial color="#9fd3f2" transparent opacity={0.6} metalness={0.4} roughness={0.05} />
          </mesh>
          {[-1, 1].map((sd) => (
            <RoundedBox key={sd} args={[s.wid * 0.28, 0.16, 0.16]} radius={0.04} smoothness={2} position={[sd * s.wid * 0.2, 0.06, 0]}>
              <meshStandardMaterial color="#3e2723" />
            </RoundedBox>
          ))}
          {s.rollbar && (
            <mesh position={[0, 0.1, -0.12]}>
              <torusGeometry args={[s.wid * 0.3, 0.025, 6, 16, Math.PI]} />
              <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
            </mesh>
          )}
        </group>
      ) : (
        <>
          <mesh geometry={g.glass!} castShadow>{glassMat}</mesh>
          <mesh geometry={g.roof!} castShadow>{paint}</mesh>
          {/* Door pillars between the side windows. */}
          {[-1, 1].map((sd) => (
            <mesh key={`p${sd}`} position={[sd * s.wid * 0.405, (top + g.roofY) / 2, g.roofZ - g.roofLen * 0.05]}>
              <boxGeometry args={[0.012, g.roofY - top, 0.035]} />
              {paint}
            </mesh>
          ))}
        </>
      )}
      {s.wood && [-1, 1].map((sd) => (
        <mesh key={`w${sd}`} position={[sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.55, -0.05]} rotation-y={sd * Math.PI / 2}>
          <planeGeometry args={[s.len * 0.8, s.body * 0.55]} />
          <meshStandardMaterial color="#8d5a3b" roughness={0.8} />
        </mesh>
      ))}
      {s.fins && [-1, 1].map((sd) => (
        <mesh key={`f${sd}`} position={[sd * s.wid * 0.42, top + 0.04, -s.len * 0.38]} rotation-x={-0.25} castShadow>
          <boxGeometry args={[0.05, 0.1, s.len * 0.26]} />
          {paint}
        </mesh>
      ))}
      {s.wing && (
        <group position={[0, top, -s.len / 2 + 0.08]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * s.wid * 0.3, 0.1, 0]}>
              <boxGeometry args={[0.03, 0.2, 0.04]} />
              <meshStandardMaterial color="#212121" />
            </mesh>
          ))}
          <mesh position={[0, 0.21, 0]}>
            <boxGeometry args={[s.wid * 0.9, 0.03, 0.15]} />
            {paint}
          </mesh>
        </group>
      )}
      {s.hood > 0 && (
        <RoundedBox args={[s.wid * 0.5, s.hood * 2, s.len * 0.26]} radius={s.hood * 0.9} smoothness={2} position={[0, g.hood, s.len * 0.3]}>
          {paint}
        </RoundedBox>
      )}
      {s.scoop && (
        <RoundedBox args={[0.16, 0.07, 0.16]} radius={0.025} smoothness={2} position={[0, g.hood + s.hood + 0.02, s.len * 0.27]}>
          <meshStandardMaterial color="#212121" />
        </RoundedBox>
      )}
      {s.bed && (
        <mesh position={[0, top + 0.01, -s.len * 0.27]}>
          <boxGeometry args={[s.wid * 0.84, 0.03, s.len * 0.4]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
      )}
      {s.spoiler && (
        <group position={[0, top, -s.len / 2 + 0.07]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * s.wid * 0.32, 0.06, 0]}>
              <boxGeometry args={[0.03, 0.12, 0.04]} />
              <meshStandardMaterial color="#212121" />
            </mesh>
          ))}
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[s.wid * 0.95, 0.03, 0.14]} />
            <meshStandardMaterial color={body === 'super' ? '#212121' : tint} />
          </mesh>
        </group>
      )}
      {stripe && (
        <>
          {[-0.07, 0.07].map((x) => (
            <group key={x}>
              {/* Along the hood, the rear deck and the roof. */}
              <mesh position={[x, g.hood + 0.003, (hoodFront + cowl) / 2]}>
                <boxGeometry args={[0.07, 0.006, hoodFront - cowl]} />
                <meshStandardMaterial color={stripe} />
              </mesh>
              <mesh position={[x, top + 0.003, (cowl - s.len / 2) / 2]}>
                <boxGeometry args={[0.07, 0.006, cowl + s.len / 2 - 0.05]} />
                <meshStandardMaterial color={stripe} />
              </mesh>
              {g.roofLen > 0 && (
                <mesh position={[x, g.roofY + 0.003, g.roofZ]}>
                  <boxGeometry args={[0.07, 0.006, g.roofLen * 0.95]} />
                  <meshStandardMaterial color={stripe} />
                </mesh>
              )}
            </group>
          ))}
        </>
      )}
      {/* Bumpers. */}
      {[1, -1].map((sd) => (
        <RoundedBox key={sd} args={[s.wid * 0.96, 0.07, 0.06]} radius={0.028} smoothness={2} position={[0, s.lift + 0.07, sd * (s.len / 2 - 0.005)]}>
          <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
        </RoundedBox>
      ))}
      {/* Front: headlights either side of a grille (or a low intake on sleek cars), and a number plate. */}
      {(() => {
        const z = s.len / 2 + 0.004
        const roundLamps = s.round || body === 'classic' || body === 'offroad' || body === 'compact' || body === 'truck'
        const bigGrille = body === 'muscle' || body === 'truck' || body === 'classic' || body === 'wagon'
        const sleek = body === 'super' || body === 'wedge' || body === 'bubble'
        return (
          <group>
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * s.wid * 0.3, lightY, z]}>
                {roundLamps ? (
                  <mesh><circleGeometry args={[0.045, 16]} /><meshBasicMaterial color="#fffde7" /></mesh>
                ) : (
                  <mesh rotation-z={sd * 0.12}><planeGeometry args={[0.14, 0.04]} /><meshBasicMaterial color="#fffde7" /></mesh>
                )}
              </group>
            ))}
            {!sleek && (
              <RoundedBox args={[s.wid * (bigGrille ? 0.42 : 0.3), bigGrille ? 0.07 : 0.045, 0.01]} radius={0.004} smoothness={1} position={[0, lightY - 0.005, z]}>
                <meshStandardMaterial color={bigGrille ? '#b0bec5' : '#1c1c1c'} metalness={bigGrille ? 0.7 : 0.2} roughness={0.4} />
              </RoundedBox>
            )}
            {sleek && body !== 'bubble' && (
              <mesh position={[0, s.lift + 0.12, z]}><planeGeometry args={[s.wid * 0.6, 0.035]} /><meshBasicMaterial color="#141414" /></mesh>
            )}
            <mesh position={[0, s.lift + 0.12, s.len / 2 + 0.035]}><planeGeometry args={[0.11, 0.04]} /><meshBasicMaterial color="#fafafa" /></mesh>
          </group>
        )
      })()}
      {/* Rear: wide tail lights and a number plate. */}
      {[-1, 1].map((sd) => (
        <mesh key={`t${sd}`} position={[sd * s.wid * 0.3, s.lift + (top - s.lift) * 0.68, -s.len / 2 - 0.004]} rotation-y={Math.PI}>
          <planeGeometry args={[0.15, 0.045]} />
          <meshBasicMaterial color="#ff1744" />
        </mesh>
      ))}
      <mesh position={[0, s.lift + 0.13, -s.len / 2 - 0.035]} rotation-y={Math.PI}><planeGeometry args={[0.11, 0.045]} /><meshBasicMaterial color="#fafafa" /></mesh>
      {/* Door seams, handles and mirrors on closed cars. */}
      {!s.open && !s.round && [-1, 1].map((sd) => (
        <group key={`d${sd}`}>
          <mesh position={[sd * (s.wid / 2 + 0.003), (s.lift + 0.07 + top) / 2, s.cabinZ + s.cabinLen * 0.08]} rotation-y={sd * Math.PI / 2}>
            <planeGeometry args={[0.008, top - s.lift - 0.11]} />
            <meshBasicMaterial color={dark} />
          </mesh>
          <mesh position={[sd * (s.wid / 2 + 0.004), top - 0.05, s.cabinZ + s.cabinLen * 0.08 - 0.06]} rotation-y={sd * Math.PI / 2}>
            <planeGeometry args={[0.05, 0.012]} />
            <meshBasicMaterial color="#cfd8dc" />
          </mesh>
          <RoundedBox args={[0.06, 0.04, 0.03]} radius={0.012} smoothness={1} position={[sd * (s.wid * 0.4 + 0.03), top + 0.05, cowl - 0.04]}>
            {paint}
          </RoundedBox>
        </group>
      ))}
      {/* Headlight beams on the road, visible after dark. */}
      {beams && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, s.len / 2 + 0.55]} renderOrder={2}>
          <planeGeometry args={[s.wid * 1.5, 1.3]} />
          <primitive object={glowMats.beam} attach="material" dispose={null} />
        </mesh>
      )}
      {/* Chunky toy wheels with spoked rims. */}
      {[[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].map(([x, z], i) => (
        <group key={i} position={[x, s.wheel, z]} ref={rig && i < 2 ? (g) => void (rig.steer[i] = g) : undefined}>
          <group ref={rig ? (g) => void (rig.spin[i] = g) : undefined}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[s.wheel, s.wheel, 0.14, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh position={[x > 0 ? 0.071 : -0.071, 0, 0]} rotation-y={x > 0 ? Math.PI / 2 : -Math.PI / 2}>
            <circleGeometry args={[s.wheel * 0.92, 16]} />
            <meshStandardMaterial map={rimTex()} metalness={0.5} roughness={0.3} side={DoubleSide} />
          </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}
