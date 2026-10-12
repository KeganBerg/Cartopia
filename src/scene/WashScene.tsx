import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, InstancedMesh, Mesh, Object3D, Vector3 } from 'three'
import { CarModel, carFrame } from './CarModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { concreteTex, corrugatedTex, drainTex, glowTex, paverTex } from './textures'
import { signTexture } from './signTexture'
import { ArcadeSky, CarShadow, Lamp, useArcadeLook, useFitCamera } from './ArcadeScenery'
import { SCRUB_PX, WASH_SPOTS, WASH_TIME } from '../game/arcadeMore'
import type { ChaseCar } from './ChaseScene'
import { dingSound, scrubSound, splashSound } from '../lib/arcadeSound'

// The screen writes the pointer here (canvas pixels) and adds up how far it has moved
// while pressed; the scene spends that travel scrubbing whichever mud is under it.
export type WashInput = { x: number; y: number; down: boolean; moved: number }
export type WashHud = { left: number; time: number }
export type WashEnd = { cleaned: number; timeLeft: number }

const LEN = 2.6

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

// A tall spinning wash brush: a core wrapped in coloured bristle bands.
function Brush({ x, z, spin, flat }: { x: number; z: number; spin: number; flat?: boolean }) {
  const g = useRef<Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += Math.min(dt, 0.05) * spin })
  const bands = ['#1e88e5', '#e53935', '#fdd835', '#43a047', '#1e88e5', '#e53935', '#fdd835']
  return (
    <group position={[x, flat ? 2.15 : 0, z]} rotation-z={flat ? Math.PI / 2 : 0}>
      <group ref={g} position-y={flat ? 0 : 1.1}>
        <mesh><cylinderGeometry args={[0.05, 0.05, 2.4, 6]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} roughness={0.3} /></mesh>
        {bands.map((c, i) => (
          <mesh key={i} position-y={-0.95 + i * 0.32} rotation-y={i * 0.6}>
            <cylinderGeometry args={[0.42, 0.42, 0.28, 10, 1, true]} />
            <meshStandardMaterial color={c} roughness={1} side={2} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// The wash bay: concrete floor and drains, tiled walls, the tunnel arches, spray bars,
// curtain strips, the sign, and the street outside each end.
function WashScenery() {
  const strips = useMemo(() => Array.from({ length: 16 }, (_, i) => i), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 0]}>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial map={paverTex(40, 26)} color="#cfd2d6" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.land, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial map={concreteTex(6, 3)} color="#b8c4cc" />
      </mesh>
      {/* Guide rails for the wheels and the drain run down the middle. */}
      {[-0.75, 0.75].map((z) => <mesh key={z} position={[0, 0.05, z]}><boxGeometry args={[11, 0.1, 0.08]} /><meshStandardMaterial color="#ffd54f" /></mesh>)}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-4.9 + i * 1.4, LAYER.paint, 0]}>
          <planeGeometry args={[0.5, 0.9]} />
          <meshStandardMaterial map={drainTex()} {...decal()} />
        </mesh>
      ))}
      {/* Puddles. */}
      {[[-2.5, 1.4, 1.2], [2.8, -1.2, 0.9], [0.5, 1.9, 0.7], [-4, -1.6, 0.8]].map(([x, z, r], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, LAYER.paint + 0.001, z]}>
          <circleGeometry args={[r, 20]} />
          <meshStandardMaterial color="#5d7a8a" metalness={0.6} roughness={0.08} transparent opacity={0.55} {...decal(2)} />
        </mesh>
      ))}
      {/* Back wall in tiles, with the sign and a price board. */}
      <mesh position={[0, 1.6, -3]}>
        <boxGeometry args={[12, 3.2, 0.2]} />
        <meshStandardMaterial map={corrugatedTex(6, 2)} color="#b3e5fc" />
      </mesh>
      <mesh position={[0, 0.45, -2.88]}>
        <boxGeometry args={[12, 0.9, 0.05]} />
        <meshStandardMaterial color="#0277bd" />
      </mesh>
      <mesh position={[0, 2.55, -2.88]}>
        <planeGeometry args={[4.4, 1.1]} />
        <meshBasicMaterial map={signTexture('SUDS & SHINE', '#01579b', '#ffffff')} toneMapped={false} />
      </mesh>
      {[[-3.8, '#e53935', 'WASH'], [3.8, '#43a047', 'WAX']].map(([x, c, t]) => (
        <group key={t as string} position={[x as number, 1.9, -2.88]}>
          <mesh><planeGeometry args={[1.6, 0.5]} /><meshBasicMaterial map={signTexture(t as string, c as string, '#ffffff')} /></mesh>
          {[0, 1, 2].map((k) => <mesh key={k} position={[0, -0.45 - k * 0.22, 0]}><planeGeometry args={[1.4, 0.12]} /><meshBasicMaterial color="#e1f5fe" /></mesh>)}
        </group>
      ))}
      {/* Hoses coiled on the back wall. */}
      {[-2.2, 2.2].map((x) => (
        <group key={x} position={[x, 1.4, -2.85]}>
          <mesh><torusGeometry args={[0.28, 0.035, 6, 20]} /><meshStandardMaterial color="#fdd835" /></mesh>
          <mesh position={[0, 0, 0.02]}><torusGeometry args={[0.22, 0.035, 6, 20]} /><meshStandardMaterial color="#fdd835" /></mesh>
          <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.1, 0.1, 0.12]} /><meshStandardMaterial color="#455a64" /></mesh>
        </group>
      ))}
      {/* Tunnel arches at each end, with spray bars and curtain strips. */}
      {[-4.6, 4.6].map((x) => (
        <group key={x} position-x={x}>
          {[-2.6, 2.6].map((z) => (
            <mesh key={z} position={[0, 1.6, z]}><boxGeometry args={[0.35, 3.2, 0.35]} /><meshStandardMaterial color="#0288d1" /></mesh>
          ))}
          <mesh position={[0, 3.25, 0]}><boxGeometry args={[0.45, 0.5, 5.6]} /><meshStandardMaterial color="#0277bd" /></mesh>
          <mesh position={[0.24, 3.25, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[3, 0.38]} /><meshBasicMaterial map={signTexture(x < 0 ? 'EXIT' : 'ENTER', '#0277bd', '#ffffff')} /></mesh>
          {/* Spray bar across the top with nozzles. */}
          <mesh position={[0.3, 2.7, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.04, 0.04, 5, 6]} /><meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.3} /></mesh>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[0.3, 2.62, -2 + i * 0.5]}><coneGeometry args={[0.04, 0.1, 6]} /><meshStandardMaterial color="#455a64" /></mesh>
          ))}
          {x < 0 && strips.map((i) => (
            <mesh key={i} position={[0.1, 2.05, -2.25 + i * 0.3]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[0.22, 1.9]} />
              <meshStandardMaterial color={i % 2 ? '#4fc3f7' : '#0288d1'} side={2} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Roof beams and strip lights. */}
      {[-3, -1, 1, 3].map((x) => (
        <group key={x}>
          <mesh position={[x, 3.4, 0]}><boxGeometry args={[0.2, 0.2, 6]} /><meshStandardMaterial color="#90a4ae" /></mesh>
          <mesh position={[x, 3.28, 0]}><boxGeometry args={[0.12, 0.04, 4.4]} /><meshBasicMaterial color="#f5fbff" toneMapped={false} /></mesh>
        </group>
      ))}
      {/* Side vacuum stands outside the entrance. */}
      {[6.5, 8].map((x) => (
        <group key={x} position={[x, 0, -1.8]}>
          <mesh position-y={0.55}><boxGeometry args={[0.45, 1.1, 0.45]} /><meshStandardMaterial color="#ffd54f" /></mesh>
          <mesh position={[0, 0.85, 0.23]}><planeGeometry args={[0.35, 0.2]} /><meshBasicMaterial map={signTexture('VAC', '#ffd54f', '#1a1a1a')} /></mesh>
          <mesh position={[0, 1.3, 0]}><torusGeometry args={[0.2, 0.03, 6, 14, Math.PI]} /><meshStandardMaterial color="#212121" /></mesh>
        </group>
      ))}
      <Lamp x={7.2} z={2.2} ry={Math.PI} />
      <Lamp x={-7.2} z={2.2} ry={Math.PI} />
    </group>
  )
}

export function WashScene({ me, input, running, onHud, onEnd }: {
  me: ChaseCar; input: WashInput; running: boolean
  onHud: (h: WashHud) => void; onEnd: (e: WashEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const wide = size.width > size.height
  useFitCamera([0, 0.55, 1], [0, 0.5, 0.2], wide ? 3.4 : 1.75, 2)
  const f = carFrame(me.body)
  const sc = LEN / f.len

  // Mud splats on the near side and the top of the car, in world space (the car faces +x).
  const spots = useMemo(() => {
    const r = rng(97)
    const out: { p: Vector3; up: boolean; size: number }[] = []
    const side = (f.side + 0.01) * sc
    // Two rows down the side (the lower row heavier, like road spray) and a few on top.
    const low = (f.lift + f.wheel * 0.55) * sc, belt = Math.max(low + 0.12, f.deck * sc * 0.92)
    for (let i = 0; i < WASH_SPOTS; i++) {
      if (i >= 8) {
        const x = [-0.32, -0.12, 0.18, 0.36][i - 8] * f.len * sc
        out.push({ p: new Vector3(x, (x > 0 ? f.hoodTop : f.deck) * sc + 0.012, (r() - 0.5) * side * 0.9), up: true, size: 0.17 + r() * 0.06 })
      } else {
        const x = (-0.4 + ((i % 4) + 0.5) * 0.2 + (r() - 0.5) * 0.06) * f.len * sc
        const y = i < 4 ? low + (belt - low) * (0.15 + r() * 0.2) : low + (belt - low) * (0.6 + r() * 0.3)
        out.push({ p: new Vector3(x, y, side), up: false, size: 0.16 + r() * 0.06 })
      }
    }
    return out
  }, [f, sc])
  const mud = useRef<(Group | null)[]>([])
  const foam = useRef<InstancedMesh>(null)
  const sparkle = useRef<Mesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  const bubbles = useMemo(() => Array.from({ length: 48 }, () => ({ x: 0, y: -10, z: 0, vy: 0, life: 0, s: 0 })), [])
  const st = useRef({ t: 0, scrub: spots.map(() => 0), left: WASH_SPOTS, done: false, endAt: 0, hudAt: 0, squish: 0, nextBubble: 0, shine: 0 })
  const v = useMemo(() => new Vector3(), [])

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    const live = running && !s.done
    if (live) s.t += dt
    const moved = input.moved
    input.moved = 0
    if (live && input.down && moved > 0) {
      const reach = Math.max(42, size.height * 0.08)
      let hit = false
      spots.forEach((sp, i) => {
        if (s.scrub[i] >= SCRUB_PX) return
        v.copy(sp.p).project(camera)
        const px = ((v.x + 1) / 2) * size.width, py = ((1 - v.y) / 2) * size.height
        if (Math.hypot(px - input.x, py - input.y) > reach) return
        hit = true
        s.scrub[i] = Math.min(SCRUB_PX, s.scrub[i] + moved)
        if (s.nextBubble <= 0) {
          const b = bubbles.find((q) => q.life <= 0)
          if (b) Object.assign(b, { x: sp.p.x + (Math.random() - 0.5) * 0.3, y: sp.p.y, z: sp.p.z + 0.05, vy: 0.3 + Math.random() * 0.4, life: 1, s: 0.04 + Math.random() * 0.05 })
        }
        if (s.scrub[i] >= SCRUB_PX) {
          s.left--
          dingSound(1 + (WASH_SPOTS - s.left) * 0.03)
        }
      })
      s.nextBubble = s.nextBubble <= 0 ? 0.03 : s.nextBubble - dt
      if (hit) {
        s.squish -= dt
        if (s.squish <= 0) { scrubSound(); s.squish = 0.11 }
      }
    }
    const timeLeft = Math.max(0, WASH_TIME - s.t)
    if (live && (s.left <= 0 || timeLeft <= 0)) {
      s.done = true
      s.endAt = t + (s.left <= 0 ? 1.4 : 0.6)
      if (s.left <= 0) splashSound()
    }
    if (s.done && s.endAt && t > s.endAt) {
      s.endAt = 0
      onEnd({ cleaned: WASH_SPOTS - s.left, timeLeft })
    }
    mud.current.forEach((g, i) => {
      if (!g) return
      const k = 1 - s.scrub[i] / SCRUB_PX
      g.visible = k > 0.02
      g.scale.setScalar(0.35 + k * 0.65)
    })
    // Foam drifts up and pops.
    if (foam.current) {
      bubbles.forEach((b, i) => {
        if (b.life > 0) {
          b.life -= dt * 0.9
          b.y += b.vy * dt
          b.x += Math.sin(t * 3 + i) * dt * 0.1
        }
        tmp.position.set(b.x, b.life > 0 ? b.y : -10, b.z)
        tmp.scale.setScalar(b.s * (0.6 + (1 - Math.max(0, b.life)) * 0.8))
        tmp.updateMatrix()
        foam.current!.setMatrixAt(i, tmp.matrix)
      })
      foam.current.instanceMatrix.needsUpdate = true
    }
    // A glint that sweeps along the clean car.
    if (sparkle.current) {
      if (s.left <= 0) s.shine += dt
      sparkle.current.visible = s.shine > 0 && s.shine < 1.4
      sparkle.current.position.set(-LEN / 2 + (s.shine / 1.2) * LEN, f.deck * sc * 0.9, f.side * sc + 0.08)
      sparkle.current.rotation.z = t * 4
    }
    if (t - s.hudAt > 0.1) {
      s.hudAt = t
      onHud({ left: s.left, time: timeLeft })
    }
  })

  const mudColors = ['#6d4c2f', '#5d4037', '#7b5a3a']
  return (
    <>
      <ArcadeSky view={view} near={14} far={60} dome={false} />
      <Batch version={0}>
        <WashScenery />
      </Batch>
      <Brush x={-3.6} z={-1.7} spin={7} />
      <Brush x={-3.6} z={1.95} spin={-7} />
      <Brush x={-4} z={0} spin={6} flat />
      <group rotation-y={Math.PI / 2}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group scale={sc}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} skin={me.skin} modSkin={me.modSkin} panels={me.panels} hat={me.hat} mods={me.mods} beams={view.beams} />
        </group>
      </group>
      {spots.map((sp, i) => (
        <group key={i} ref={(g) => { mud.current[i] = g }} position={sp.p} rotation={sp.up ? [0, 0, 0] : [Math.PI / 2, 0, 0]}>
          <group rotation-y={i * 1.3}>
          {[[0, 0, 1], [0.7, 0.25, 0.55], [-0.6, -0.3, 0.65], [0.2, -0.65, 0.4], [-0.3, 0.6, 0.35]].map(([dx, dz, k], j) => (
            <mesh key={j} position={[dx * sp.size, 0, dz * sp.size]} scale={[sp.size * k, sp.size * 0.12, sp.size * k * 0.85]}>
              <sphereGeometry args={[1, 10, 6]} />
              <meshStandardMaterial color={mudColors[(i + j) % 3]} roughness={0.55} />
            </mesh>
          ))}
          </group>
          {/* Drips running down the panel. */}
          {!sp.up && [-0.3, 0.25].map((dx, j) => (
            <mesh key={`d${j}`} position={[dx * sp.size, 0, (1 + j * 0.4) * sp.size]} scale={[sp.size * 0.14, sp.size * 0.08, sp.size * (0.55 + j * 0.3)]}>
              <sphereGeometry args={[1, 8, 5]} />
              <meshStandardMaterial color={mudColors[(i + 1) % 3]} roughness={0.55} />
            </mesh>
          ))}
        </group>
      ))}
      <instancedMesh ref={foam} args={[undefined, undefined, bubbles.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} transparent opacity={0.85} />
      </instancedMesh>
      <mesh ref={sparkle} visible={false}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial map={glowTex()} color="#ffffff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}
