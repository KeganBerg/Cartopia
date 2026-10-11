import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three'
import { CarModel, carFrame } from './CarModel'
import { holdTown } from './renderGate'
import { Batch } from './Batch'
import { LAYER, decal } from './layers'
import { concreteTex, glowTex, grassTex, sandTex } from './textures'
import { signTexture } from './signTexture'
import { glowMats } from './dayNight'
import { ArcadeSky, CarShadow, Grandstand, useArcadeLook } from './ArcadeScenery'
import { GRAVITY, STUNT_JUMPS, flips, jumpScore, landed, launchSpeed } from '../game/arcadeMore'
import { CARS, isBike } from '../game/data'
import type { ChaseCar } from './ChaseScene'
import { crashSound, dingSound, landSound, revSound } from '../lib/arcadeSound'

// The screen writes whether the screen is pressed: a press stops the power needle,
// and holding in the air flips the car.
export type StuntInput = { down: boolean }
export type StuntPhase = 'aim' | 'run' | 'air' | 'roll' | 'crash'
export type StuntHud = { jump: number; score: number; power: number; phase: StuntPhase; last: { pts: number; flips: number; ok: boolean } | null }
export type StuntEnd = { score: number }

const LEN = 1.8
const ANGLE = 0.5 // ramp angle
const RAMP = 2.6 // ramp deck length
const H = RAMP * Math.sin(ANGLE) // take-off height
const RUN = RAMP * Math.cos(ANGLE)
const LAND_X = 6 // where the landing deck starts; short of this is the bus row
const DECK_END = 18
const START_X = -14
const SPIN = 8 // flip speed, radians a second

// Everything that never moves: the dirt arena, ramps, landing deck, barriers,
// flood light towers, flags and the big screen.
function ArenaScenery() {
  const sand = useMemo(() => sandTex(40, 22), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.outer, 0]}>
        <planeGeometry args={[140, 80]} />
        <meshStandardMaterial map={grassTex(28, 16)} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[2, LAYER.land, 9]}>
        <planeGeometry args={[60, 32]} />
        <meshStandardMaterial map={sand} />
      </mesh>
      {/* Tyre tracks down the run-up. */}
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[-9, LAYER.paint, z]}>
          <planeGeometry args={[14, 0.22]} />
          <meshBasicMaterial color="#4e342e" transparent opacity={0.45} {...decal()} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[START_X + 0.9, LAYER.paint, 0]}>
        <planeGeometry args={[0.25, 2.4]} />
        <meshBasicMaterial color="#fafafa" {...decal()} />
      </mesh>
      {/* Take-off ramp: a yellow steel deck with chevrons on a scaffold. */}
      <group position={[-RUN / 2, H / 2, 0]} rotation-z={ANGLE}>
        <mesh><boxGeometry args={[RAMP, 0.1, 2.4]} /><meshStandardMaterial color="#fbc02d" metalness={0.4} roughness={0.5} /></mesh>
        {[-0.8, 0, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.052, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.3, 2.3]} /><meshBasicMaterial color="#212121" /></mesh>
        ))}
      </group>
      {[-RUN + 0.5, -RUN / 2, -0.1].map((x, i) => [-1.1, 1.1].map((z) => {
        const h = Math.max(0.05, (x + RUN) * Math.tan(ANGLE))
        return <mesh key={`${i}${z}`} position={[x, h / 2, z]}><boxGeometry args={[0.08, h, 0.08]} /><meshStandardMaterial color="#455a64" /></mesh>
      }))}
      <mesh position={[-0.1, H / 2, 0]}><boxGeometry args={[0.1, H, 2.3]} /><meshStandardMaterial color="#37474f" /></mesh>
      {/* Landing deck: a long packed-dirt mound with distance boards, then a slope down. */}
      <mesh position={[(LAND_X + DECK_END) / 2, H / 2, 0]}>
        <boxGeometry args={[DECK_END - LAND_X, H, 3]} />
        <meshStandardMaterial map={sandTex(6, 1)} color="#c8a27a" />
      </mesh>
      <mesh position={[DECK_END + 2, H / 2 - 0.25, 0]} rotation-z={-Math.atan(H / 4)}>
        <boxGeometry args={[Math.hypot(4, H), 0.3, 3]} />
        <meshStandardMaterial map={sandTex(2, 1)} color="#c8a27a" />
      </mesh>
      <mesh position={[LAND_X + 0.05, H / 2, 0]}><boxGeometry args={[0.12, H + 0.02, 3.02]} /><meshStandardMaterial color="#e53935" /></mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const x = LAND_X + 2 + i * 2
        return (
          <group key={i}>
            <mesh rotation-x={-Math.PI / 2} position={[x, H + 0.005, 0]}><planeGeometry args={[0.08, 3]} /><meshBasicMaterial color="#fafafa" /></mesh>
            <mesh position={[x, H + 0.45, -1.55]}><boxGeometry args={[0.6, 0.45, 0.05]} /><meshStandardMaterial color="#212121" /></mesh>
            <mesh position={[x, H + 0.45, -1.52]}><planeGeometry args={[0.55, 0.4]} /><meshBasicMaterial map={signTexture(`${x}m`, '#212121', '#ffd54f')} /></mesh>
            <mesh position={[x, H + 0.11, -1.55]}><boxGeometry args={[0.04, 0.22, 0.04]} /><meshStandardMaterial color="#455a64" /></mesh>
          </group>
        )
      })}
      {/* Hay bales down the run-up. */}
      {Array.from({ length: 7 }, (_, i) => [-1.6].map((z) => (
        <mesh key={`${i}${z}`} position={[START_X + 1 + i * 1.6, 0.25, z]}>
          <boxGeometry args={[1.1, 0.5, 0.55]} />
          <meshStandardMaterial color={i % 2 ? '#e0c068' : '#d4b45a'} roughness={1} />
        </mesh>
      )))}
      {/* Barriers in sponsor colours round the back of the arena. */}
      {Array.from({ length: 24 }, (_, i) => (
        <group key={i} position={[-26 + i * 2.4, 0, -5.5]}>
          <mesh position-y={0.4}><boxGeometry args={[2.3, 0.8, 0.45]} /><meshStandardMaterial map={concreteTex(2, 1)} color="#eceff1" /></mesh>
          <mesh position={[0, 0.45, 0.23]}><planeGeometry args={[2.1, 0.5]} /><meshBasicMaterial map={signTexture(['STUNT SHOW', 'NITRO', 'CARTOPIA', 'BIG AIR'][i % 4], ['#e53935', '#1e88e5', '#fb8c00', '#6a1b9a'][i % 4], '#ffffff')} /></mesh>
        </group>
      ))}
      {/* The big screen over the stands. */}
      <group position={[3, 0, -14]}>
        {[-3, 3].map((x) => <mesh key={x} position={[x, 4, 0]}><boxGeometry args={[0.3, 8, 0.3]} /><meshStandardMaterial color="#37474f" /></mesh>)}
        <mesh position={[0, 7.5, 0]}><boxGeometry args={[7, 2.6, 0.3]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position={[0, 7.5, 0.16]}><planeGeometry args={[6.6, 2.2]} /><meshBasicMaterial map={signTexture('BIG AIR', '#0d47a1', '#ffd54f')} toneMapped={false} /></mesh>
      </group>
      {/* Flood light towers. */}
      {[-18, 8, 26].map((x) => (
        <group key={x} position={[x, 0, -7]}>
          <mesh position-y={5}><cylinderGeometry args={[0.12, 0.18, 10, 8]} /><meshStandardMaterial color="#78909c" /></mesh>
          <mesh position={[0, 10, 0.2]}><boxGeometry args={[2, 1, 0.2]} /><meshStandardMaterial color="#455a64" /></mesh>
          {[-0.6, 0, 0.6].map((dx) => [-0.25, 0.25].map((dy) => (
            <mesh key={`${dx}${dy}`} position={[dx, 10 + dy, 0.31]}>
              <planeGeometry args={[0.45, 0.4]} />
              <primitive object={glowMats.bulb} attach="material" dispose={null} />
            </mesh>
          )))}
        </group>
      ))}
      {/* Flags along the deck. */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[LAND_X + 1 + i * 3, H, 1.6]}>
          <mesh position-y={0.8}><cylinderGeometry args={[0.025, 0.025, 1.6, 5]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
          <mesh position={[0.25, 1.4, 0]}><planeGeometry args={[0.5, 0.32]} /><meshStandardMaterial color={['#e53935', '#fdd835', '#1e88e5'][i % 3]} side={2} /></mesh>
        </group>
      ))}
    </group>
  )
}

const DUST = 40

export function StuntScene({ me, input, running, onHud, onEnd }: {
  me: ChaseCar; input: StuntInput; running: boolean
  onHud: (h: StuntHud) => void; onEnd: (e: StuntEnd) => void
}) {
  useEffect(() => holdTown(), [])
  const view = useArcadeLook()
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const f = carFrame(me.body)
  const sc = LEN / f.len
  const buses = useMemo(() => {
    const bus = CARS.find((c) => c.body === 'bus')
    const pool = CARS.filter((c) => !c.parked && !isBike(c.body))
    return Array.from({ length: 5 }, (_, i) => {
      const c = bus && i % 2 === 0 ? bus : pool[(i * 7) % pool.length]
      return { x: 1 + i * 1.05, body: c.body, model: c.id, color: c.colors[i % c.colors.length] }
    })
  }, [])

  const car = useRef<Group>(null)
  const flames = useRef<(Mesh | null)[]>([])
  const dust = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => new Object3D(), [])
  const puffs = useMemo(() => Array.from({ length: DUST }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, life: 0 })), [])
  const st = useRef({
    jump: 0, score: 0, phase: 'aim' as StuntPhase, power: 0, needle: 0, wasDown: false,
    x: START_X, y: 0, vx: 0, vy: 0, spin: 0, pitch: 0, t: 0, wait: 0, fire: 0, done: false, hudAt: 0,
    last: null as StuntHud['last'],
  })
  const eye = useMemo(() => new Vector3(), [])
  const at = useMemo(() => new Vector3(), [])

  const puff = (x: number, y: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const p = puffs.find((q) => q.life <= 0)
      if (!p) return
      Object.assign(p, { x: x + (Math.random() - 0.5) * 0.8, y, z: (Math.random() - 0.5) * 1.2, vx: (Math.random() - 0.5) * 2, vy: 0.6 + Math.random() * 1.2, life: 1 })
    }
  }

  useFrame((state, rawDt) => {
    const s = st.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = state.clock.elapsedTime
    const down = running && input.down
    const press = down && !s.wasDown
    s.wasDown = down
    s.wait = Math.max(0, s.wait - dt)

    if (s.phase === 'aim') {
      // The needle sweeps up and down; a press locks it.
      if (running) s.needle += dt * 1.6
      s.power = 1 - Math.abs(1 - (s.needle % 2))
      if (press && s.wait <= 0 && !s.done) {
        s.phase = 'run'
        revSound(1.2)
      }
    } else if (s.phase === 'run') {
      // Accelerate to take-off speed by the foot of the ramp, then ride up it.
      const v = launchSpeed(s.power)
      if (s.x < -RUN) {
        s.vx = Math.min(v, s.vx + v * 0.9 * dt)
        s.x += s.vx * dt
        s.pitch = 0
        if (Math.random() < 0.4) puff(s.x - 0.8, 0.05, 1)
      } else {
        s.vx = v
        s.x += v * Math.cos(ANGLE) * dt
        s.y = (s.x + RUN) * Math.tan(ANGLE)
        s.pitch = ANGLE
        if (s.x >= 0) {
          s.phase = 'air'
          s.x = 0
          s.y = H
          s.vx = v * Math.cos(ANGLE)
          s.vy = v * Math.sin(ANGLE)
          s.spin = 0
          s.t = 0
        }
      }
    } else if (s.phase === 'air') {
      s.t += dt
      s.x += s.vx * dt
      s.vy -= GRAVITY * dt
      s.y += s.vy * dt
      if (down) s.spin += SPIN * dt
      s.pitch = s.spin + Math.atan2(s.vy, s.vx) * 0.4
      // Down at deck height (or onto the buses if short).
      const floor = s.x >= LAND_X ? H : 0.9
      if (s.vy < 0 && s.y <= floor) {
        const ok = s.x >= LAND_X && s.x <= DECK_END && landed(s.spin)
        const pts = ok ? jumpScore(s.x, s.spin) : 0
        s.score += pts
        s.last = { pts, flips: ok ? flips(s.spin) : 0, ok }
        s.jump++
        s.y = floor
        puff(s.x, floor, 14)
        if (ok) {
          s.phase = 'roll'
          s.pitch = 0
          s.fire = 1.2
          landSound()
          dingSound(1 + flips(s.spin) * 0.2)
        } else {
          s.phase = 'crash'
          s.vy = 3
          crashSound()
        }
        s.wait = 1.8
      }
    } else if (s.phase === 'roll') {
      s.vx = Math.max(0, s.vx - 7 * dt)
      s.x += s.vx * dt
      s.pitch *= 0.8
    } else if (s.phase === 'crash') {
      // Tumble and settle.
      s.vy -= GRAVITY * dt
      s.y = Math.max(s.x >= LAND_X ? H : 0.9, s.y + s.vy * dt)
      s.x += s.vx * 0.3 * dt
      s.pitch += dt * 6 * Math.max(0, s.wait - 0.8)
      if (Math.random() < 0.3) puff(s.x, s.y, 1)
    }
    if ((s.phase === 'roll' || s.phase === 'crash') && s.wait <= 0) {
      if (s.jump >= STUNT_JUMPS) {
        if (!s.done) {
          s.done = true
          onEnd({ score: s.score })
        }
      } else {
        Object.assign(s, { phase: 'aim', x: START_X, y: 0, vx: 0, vy: 0, spin: 0, pitch: 0, needle: 0, wait: 0.4 })
      }
    }

    if (car.current) {
      car.current.position.set(s.x, s.y, 0)
      car.current.rotation.set(0, Math.PI / 2, 0)
      car.current.rotateX(-s.pitch)
    }
    s.fire = Math.max(0, s.fire - dt)
    flames.current.forEach((m, i) => {
      if (!m) return
      m.visible = s.fire > 0
      m.scale.set(1, 0.6 + Math.sin(t * 30 + i) * 0.3 + s.fire, 1)
      ;(m.material as MeshBasicMaterial).opacity = Math.min(1, s.fire)
    })
    if (dust.current) {
      puffs.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt * 0.8
          p.x += p.vx * dt
          p.y += p.vy * dt
        }
        tmp.position.set(p.x, p.life > 0 ? p.y : -9, p.z)
        tmp.scale.setScalar(0.15 + (1 - Math.max(0, p.life)) * 0.45)
        tmp.updateMatrix()
        dust.current!.setMatrixAt(i, tmp.matrix)
      })
      dust.current.instanceMatrix.needsUpdate = true
    }
    // Side-on camera that pans with the car; further out on a narrow screen.
    const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const wide = size.width > size.height
    const dist = Math.max(4.6 / tan, (wide ? 8.5 : 4.4) / (tan * (size.width / size.height)))
    const cx = wide ? Math.max(-6, Math.min(12, s.x + 4)) : Math.max(-11, Math.min(15, s.x + 1.5))
    at.set(cx, wide ? 1.4 : 2.4, 0)
    eye.set(cx - dist * 0.12, 1.4 + dist * 0.28, dist)
    camera.position.lerp(eye, Math.min(1, dt * 3))
    camera.lookAt(at)
    if (t - s.hudAt > 0.05) {
      s.hudAt = t
      onHud({ jump: Math.min(STUNT_JUMPS, s.jump + (s.phase === 'aim' || s.phase === 'run' || s.phase === 'air' ? 1 : 0)), score: s.score, power: s.power, phase: s.phase, last: s.last })
    }
  })

  return (
    <>
      <ArcadeSky view={view} near={30} far={120} />
      <Batch version={0}>
        <ArenaScenery />
      </Batch>
      <Grandstand x={0} z={-8} h={0} width={30} rows={5} roof="#1e88e5" />
      <Grandstand x={24} z={-8} h={0} width={14} rows={4} roof="#e53935" />
      {buses.map((b, i) => (
        <group key={i} position={[b.x, 0, 0]}>
          <CarShadow len={LEN * 1.6} wid={LEN * 0.6} />
          <group scale={(LEN * 1.6) / carFrame(b.body).len}>
            <CarModel body={b.body} model={b.model} color={b.color} />
          </group>
        </group>
      ))}
      {[LAND_X + 0.5, DECK_END - 0.5].map((x) => [-1.3, 1.3].map((z, k) => (
        <group key={`${x}${z}`} position={[x, H, z]}>
          <mesh position-y={0.1}><cylinderGeometry args={[0.14, 0.18, 0.2, 8]} /><meshStandardMaterial color="#37474f" /></mesh>
          <mesh ref={(m) => { flames.current[(x > 10 ? 2 : 0) + k] = m }} position-y={0.9} visible={false}>
            <coneGeometry args={[0.22, 1.4, 10, 1, true]} />
            <meshBasicMaterial map={glowTex()} color="#ff9100" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      )))}
      <instancedMesh ref={dust} args={[undefined, undefined, DUST]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#c8a27a" transparent opacity={0.55} roughness={1} />
      </instancedMesh>
      <group ref={car} position={[START_X, 0, 0]}>
        <CarShadow len={LEN} wid={f.wid * sc} />
        <group scale={sc}>
          <CarModel body={me.body} model={me.model} color={me.color} finish={me.finish} mods={me.mods} beams={view.beams} flames />
        </group>
      </group>
    </>
  )
}
