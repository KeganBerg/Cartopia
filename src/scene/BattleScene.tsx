import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, DoubleSide, PlaneGeometry, SRGBColorSpace, type Group, type Mesh, type PerspectiveCamera } from 'three'
import type { Body, Finish, Panels, SkinnedSlot } from '../game/data'
import type { HatFit } from '../game/hats'
import { RaceScene, startLights, type RacerView } from './RaceScene'
import { ROAD } from './RaceVenues'
import { carSize } from './CarModel'
import { glowTex } from './textures'
import { LAYER, decal } from './layers'
import type { Venue } from './venues'

// The crew battle's showdown: the week's venue under the floodlights, with the player's car and the
// rival crew's car lined up at the start, each crew's flag flying behind its lane, searchlights in
// the crews' colours sweeping the sky, and a slow low camera drifting behind the line.
// The street, crowd, lamps and weather are the race's own (RaceScene); this adds the crews.

type Look = { body: Body; model?: string; color: string; finish?: Finish; skin?: string; modSkin?: Partial<Record<SkinnedSlot, string>>; panels?: Panels; mods?: string[]; hat?: HatFit | null }
export type Crew = { tag: string; color: string }
type Props = { venue: Venue; mine: Look; theirs: Look; us: Crew; them: Crew; lead: number }

const LANE = 0.75 // RaceScene's lanes: the player on the right, the rival on the left
const TRACK = 402

// A flag: the crew colour with a chequered strip at the pole and the tag across it. flip prints the
// tag mirrored, for a flag whose cloth is mirrored to stream the other way, so it still reads.
const flagCache = new Map<string, CanvasTexture>()
function flagTex(tag: string, color: string, flip: boolean) {
  const k = `${tag}|${color}|${flip}`
  const hit = flagCache.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.fillRect(0, 0, 256, 160)
  // A darker band top and bottom, and the chequers by the pole.
  g.fillStyle = 'rgba(0,0,0,.28)'
  g.fillRect(0, 0, 256, 18)
  g.fillRect(0, 142, 256, 18)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#111' : '#fafafa'
    g.fillRect(x * 20, y * 20, 20, 20)
  }
  g.fillStyle = '#ffffff'
  g.strokeStyle = 'rgba(0,0,0,.45)'
  g.lineWidth = 8
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 76px "Arial Black", Impact, system-ui, sans-serif'
  g.translate(146, 84)
  if (flip) g.scale(-1, 1)
  g.strokeText(tag, 0, 0)
  g.fillText(tag, 0, 0)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  flagCache.set(k, t)
  return t
}

// A tall pole with the flag rippling off it in the breeze.
function CrewFlag({ x, crew, phase }: { x: number; crew: Crew; phase: number }) {
  // The cloth runs from the pole (x = 0) to its tip (x = 1.5).
  const geo = useMemo(() => new PlaneGeometry(1.5, 0.94, 14, 4).translate(0.75, 0, 0), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(({ clock }) => {
    const p = geo.attributes.position
    const t = clock.elapsedTime * 3.2 + phase
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3]
      const by = base[i * 3 + 1]
      const k = bx / 1.5
      p.setZ(i, Math.sin(t - bx * 3.1) * 0.14 * k + Math.sin(t * 1.7 - bx * 5 + by * 2) * 0.03 * k)
      p.setY(i, by - k * k * 0.08)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  })
  // The flag streams away from the street on each side, its printed face toward the camera behind the line.
  const out = x > 0
  return (
    <group position={[x, 0, 3.2]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 12]} />
        <meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 3.5, 10]} />
        <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 3.55, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh geometry={geo} position={[0, 3.0, 0]} rotation-y={Math.PI} scale-x={out ? -1 : 1}>
        <meshStandardMaterial map={flagTex(crew.tag, crew.color, out)} side={DoubleSide} roughness={0.8} />
      </mesh>
    </group>
  )
}

// A searchlight on the ground far down the street, its beam sweeping the night sky.
function Searchlight({ x, z, color, phase }: { x: number; z: number; color: string; phase: number }) {
  const beam = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.45 + phase
    beam.current?.rotation.set(-0.25 + Math.sin(t * 0.7) * 0.12, 0, Math.sin(t) * 0.5)
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.7, 14]} />
        <meshStandardMaterial color="#263238" metalness={0.5} roughness={0.4} />
      </mesh>
      <group ref={beam} position={[0, 0.8, 0]}>
        <mesh position={[0, 14, 0]}>
          <cylinderGeometry args={[2.4, 0.35, 28, 20, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.13} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} fog={false} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <circleGeometry args={[0.42, 18]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// Coloured light pooled under each car, pulsing a little brighter for whoever leads.
function Underglow({ x, z, color, strong }: { x: number; z: number; color: string; strong: boolean }) {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const pulse = 0.5 + Math.sin(clock.elapsedTime * (strong ? 3 : 1.6)) * 0.5
    ;(m.material as { opacity: number }).opacity = (strong ? 0.55 : 0.38) + pulse * 0.15
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[x, LAYER.paint + 0.002, z]}>
      <planeGeometry args={[1.9, 2.8]} />
      <meshBasicMaterial map={glowTex()} color={color} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} {...decal(4)} />
    </mesh>
  )
}

// A low camera drifting from one lane to the other behind the line. Runs after the race camera.
function ShowdownCam() {
  const { camera, size } = useThree()
  useFrame(({ clock }) => {
    const cam = camera as PerspectiveCamera
    const tall = size.height > size.width
    const t = clock.elapsedTime
    const sway = Math.sin(t * 0.22)
    cam.position.set(sway * (tall ? 1.1 : 2.3), (tall ? 1.7 : 1.05) + Math.sin(t * 0.31) * 0.08, tall ? -6.6 : -5.1)
    cam.lookAt(sway * 0.35, tall ? 0.45 : 0.62, tall ? 2.6 : 1.8)
  })
  return null
}

export function BattleScene({ venue, mine, theirs, us, them, lead }: Props) {
  // Both cars sit on the line: the race scene draws them where these say.
  const me = useRef<RacerView>({ dist: 0 })
  const rival = useRef<RacerView>({ dist: 0 })
  // Keep the start lights dark, whatever a race left them on.
  useEffect(() => void (startLights.n = 99), [])
  const nose = (b: Body) => carSize(b).len * 0.7
  return (
    <>
      <RaceScene track={TRACK} me={me} them={rival} mine={mine} theirs={theirs} venue={venue} night weatherSeed={`battle:${us.tag}:${them.tag}`} />
      <CrewFlag x={ROAD + 0.35} crew={us} phase={0} />
      <CrewFlag x={-(ROAD + 0.35)} crew={them} phase={1.7} />
      <Underglow x={LANE} z={-nose(mine.body) - 0.7} color={us.color} strong={lead > 0} />
      <Underglow x={-LANE} z={-nose(theirs.body) - 0.7} color={them.color} strong={lead < 0} />
      <Searchlight x={7} z={22} color={us.color} phase={0} />
      <Searchlight x={-7} z={26} color={them.color} phase={2.2} />
      <ShowdownCam />
    </>
  )
}
