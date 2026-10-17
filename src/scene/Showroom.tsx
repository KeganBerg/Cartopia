import { useMemo } from 'react'
import { Batch } from './Batch'
import { BackSide, CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { decal } from './layers'
import { brickTex, checkerTex, corrugatedTex, glowTex, shutterTex } from './textures'
import { signTexture } from './signTexture'
import { ToolChest, Tyre, TyreStack } from './ArcadeScenery'
import { CarModel } from './CarModel'

// The Showroom: where every car preview stands (the garage turntable, the full-screen look and
// photo mode). A sibling of the Crate Depot: the same night-time workshop feel, but a place to
// show a car off rather than a loading bay. A flush turntable in a polished tile floor under a
// ring of track lights, a tyre wall and the neon sign at the back, a shop window onto the town
// at night, a lift with a covered car, the roller door, and a lounge corner.
//
// Built in metres and shrunk to the turntable's units (a fitted car is about two units long).
// Everything but the turntable is static and drawn through one Batch, so the whole room costs a
// handful of draws on a phone.

// Metres to scene units.
const S = 0.45
// The turntable disc and the fixed steel rim round it (scene units).
export const TT_R = 1.6
const RIM_R = 1.78
// How deep the dyno pit under the disc is.
const PIT = 1.4
// Room half-width and ceiling height, in metres.
const HALF = 18
const ROOF = 8.5
// Where the orbiting camera may go (scene units): inside this radius and under this height, so
// it never passes through a prop, a wall or the ceiling. showroom.test.tsx keeps props out.
export const CAM_REACH = 5.4
export const CAM_TOP = 3.0
// The camera starts looking from +x+z, so the room is turned to put its back wall behind the car.
const TURN = Math.PI / 4
// The open half of the roller door (BAY 1, under the half-up shutter) in scene units, and the way
// into the room from it: the Cars page's camera walks out through it to the Crate Depot and back.
export const DOOR_AT = new Vector3(Math.cos(TURN), 0, -Math.sin(TURN)).multiplyScalar((HALF - 0.17) * S).setY(1.1 * S)
export const DOOR_IN = new Vector3(-Math.cos(TURN), 0, Math.sin(TURN))

export const SHOWROOM_BG = '#0f141d'

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

const cache = new Map<string, CanvasTexture>()
function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(...repeat)
  }
  cache.set(key, t)
  return t
}

// Big polished floor tiles with thin grout, a little variation tile to tile.
const tileTex = (rx: number) =>
  tex(`sr-tile-${rx}`, 256, 256, (g) => {
    const r = rng(17)
    g.fillStyle = '#8f969e'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 0.93 + r() * 0.08
      g.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(218 * v)},${Math.round(224 * v)})`
      g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61)
      // A faint sweep of polish across each tile.
      const grd = g.createLinearGradient(i * 64, j * 64, i * 64 + 64, j * 64 + 64)
      grd.addColorStop(0, 'rgba(255,255,255,0.05)')
      grd.addColorStop(1, 'rgba(0,0,0,0.05)')
      g.fillStyle = grd
      g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61)
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
      g.fillRect(r() * 256, r() * 256, 1.5, 1.5)
    }
  }, [rx, rx])

// The turntable's top: brushed steel in rings, plate seams, and a ring of studs near the edge.
export const discTex = () =>
  tex('sr-disc', 512, 512, (g) => {
    const c = 256
    g.fillStyle = '#c7ced6'
    g.fillRect(0, 0, 512, 512)
    for (let rad = 4; rad < 256; rad += 3) {
      g.strokeStyle = rad % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(c, c, rad, 0, Math.PI * 2)
      g.stroke()
    }
    // Plate seams.
    g.strokeStyle = 'rgba(30,36,44,0.55)'
    g.lineWidth = 2.5
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath()
      g.moveTo(c + Math.cos(a) * 70, c + Math.sin(a) * 70)
      g.lineTo(c + Math.cos(a) * 252, c + Math.sin(a) * 252)
      g.stroke()
    }
    for (const rad of [70, 200]) {
      g.beginPath()
      g.arc(c, c, rad, 0, Math.PI * 2)
      g.stroke()
    }
    // The hub plate.
    g.fillStyle = '#8b949e'
    g.beginPath()
    g.arc(c, c, 66, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.25)'
    g.beginPath()
    g.arc(c, c, 58, 0, Math.PI * 2)
    g.stroke()
    // Studs.
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      g.fillStyle = '#5c6670'
      g.beginPath()
      g.arc(c + Math.cos(a) * 228, c + Math.sin(a) * 228, 4, 0, Math.PI * 2)
      g.fill()
    }
    // A darker band at the edge.
    const grd = g.createRadialGradient(c, c, 236, c, c, 256)
    grd.addColorStop(0, 'rgba(0,0,0,0)')
    grd.addColorStop(1, 'rgba(0,0,0,0.35)')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 512)
  })

// A soft dark pool under the car, so it sits on the disc instead of floating over it.
export const contactTex = () =>
  tex('sr-contact', 128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(0,0,0,0.6)')
    grd.addColorStop(0.55, 'rgba(0,0,0,0.38)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
  })

// The town at night through the shop window: a skyline with lit windows under a deep blue sky.
const cityTex = () =>
  tex('sr-city', 512, 256, (g) => {
    const r = rng(41)
    const sky = g.createLinearGradient(0, 0, 0, 256)
    sky.addColorStop(0, '#0b1230')
    sky.addColorStop(0.7, '#27306a')
    sky.addColorStop(1, '#4a3d74')
    g.fillStyle = sky
    g.fillRect(0, 0, 512, 256)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`
      g.fillRect(r() * 512, r() * 110, 1.5, 1.5)
    }
    // Two rows of buildings, the far one dimmer.
    for (const [base, dim, minH, maxH] of [[200, 0.45, 60, 150], [256, 1, 40, 120]] as const) {
      let x = -10
      while (x < 512) {
        const w = 28 + r() * 46
        const h = minH + r() * (maxH - minH)
        g.fillStyle = dim < 1 ? '#151a3a' : '#0b0f22'
        g.fillRect(x, base - h, w, h)
        for (let wy = base - h + 8; wy < base - 8; wy += 11) {
          for (let wx = x + 5; wx < x + w - 6; wx += 9) {
            if (r() > 0.55) continue
            g.fillStyle = r() > 0.3 ? `rgba(255,214,140,${0.55 * dim + 0.2})` : `rgba(150,200,255,${0.5 * dim + 0.2})`
            g.fillRect(wx, wy, 5, 6)
          }
        }
        x += w + 2 + r() * 8
      }
    }
    // Street level: a road with car lights streaking past.
    g.fillStyle = '#121626'
    g.fillRect(0, 236, 512, 20)
    for (let i = 0; i < 9; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,90,70,0.8)' : 'rgba(255,240,200,0.85)'
      g.fillRect(r() * 512, 242 + r() * 8, 14 + r() * 26, 2)
    }
  })

// Pegboard with tools hung on it: spanners, a hammer and screwdrivers drawn as silhouettes.
const pegTex = () =>
  tex('sr-peg', 256, 128, (g) => {
    g.fillStyle = '#c9a77a'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = 'rgba(60,40,20,0.45)'
    for (let y = 6; y < 128; y += 10) for (let x = 6; x < 256; x += 10) g.fillRect(x, y, 2.5, 2.5)
    g.fillStyle = '#37474f'
    // Spanners, largest to smallest.
    for (let i = 0; i < 6; i++) {
      const x = 16 + i * 14, h = 70 - i * 7
      g.fillRect(x, 20, 5, h)
      g.beginPath()
      g.arc(x + 2.5, 20, 6 - i * 0.4, 0, Math.PI * 2)
      g.fill()
    }
    // Hammer.
    g.fillStyle = '#6d4c41'
    g.fillRect(120, 30, 6, 70)
    g.fillStyle = '#455a64'
    g.fillRect(108, 22, 30, 12)
    // Screwdrivers with coloured handles.
    ;['#e53935', '#fdd835', '#1e88e5', '#43a047'].forEach((col, i) => {
      g.fillStyle = col
      g.fillRect(160 + i * 12, 20, 7, 24)
      g.fillStyle = '#90a4ae'
      g.fillRect(162 + i * 12, 44, 3, 34)
    })
    // A coil of hose.
    g.strokeStyle = '#ff7043'
    g.lineWidth = 5
    for (let k = 0; k < 3; k++) {
      g.beginPath()
      g.arc(228, 60, 14 + k * 5, 0, Math.PI * 2)
      g.stroke()
    }
  })

// The drinks machine's front: rows of cans behind glass, and the coin slot panel.
const vendTex = () =>
  tex('sr-vend', 128, 256, (g) => {
    g.fillStyle = '#10161f'
    g.fillRect(0, 0, 128, 256)
    const cols = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff7043']
    for (let row = 0; row < 6; row++) {
      g.fillStyle = '#2a3442'
      g.fillRect(8, 22 + row * 34, 84, 3)
      for (let k = 0; k < 5; k++) {
        g.fillStyle = cols[(row + k) % cols.length]
        g.fillRect(12 + k * 16, 4 + row * 34, 11, 18)
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.fillRect(13 + k * 16, 6 + row * 34, 2, 14)
      }
    }
    g.fillStyle = '#263238'
    g.fillRect(98, 8, 24, 200)
    g.fillStyle = '#80cbc4'
    g.fillRect(102, 20, 16, 10)
    g.fillStyle = '#90a4ae'
    for (let i = 0; i < 9; i++) g.fillRect(102 + (i % 3) * 6, 40 + Math.floor(i / 3) * 7, 4, 4)
    g.fillStyle = '#000000'
    g.fillRect(8, 218, 84, 28)
  })

// A race poster: a big number over a chequered band.
const posterTex = (num: string, bg: string, fg: string) =>
  tex(`sr-poster-${num}`, 128, 180, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 128, 180)
    g.fillStyle = fg
    g.font = '900 96px "Arial Black", Impact, system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(num, 64, 74)
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff'
      g.fillRect(x * 16, 140 + y * 16, 16, 16)
    }
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 6
    g.strokeRect(3, 3, 122, 174)
  })

// ---------------------------------------------------------------------------------------------
// Props (metres)

const steel = { color: '#3b4650', metalness: 0.55, roughness: 0.4 }

// Wall rack of tyres standing on their treads, three shelves high.
function TyreWall({ x, z, w }: { x: number; z: number; w: number }) {
  const n = Math.floor(w / 0.6)
  const bands = ['#e53935', '#fdd835', '#ffffff', '#43a047']
  return (
    <group position={[x, 0, z]}>
      {[-w / 2, 0, w / 2].map((dx) => (
        <mesh key={dx} position={[dx, 1.9, 0]}><boxGeometry args={[0.1, 3.8, 0.7]} /><meshStandardMaterial color="#ff6d00" roughness={0.6} /></mesh>
      ))}
      {[0.2, 1.45, 2.7].map((y, row) => (
        <group key={y}>
          <mesh position={[0, y - 0.05, 0]}><boxGeometry args={[w, 0.1, 0.7]} /><meshStandardMaterial color="#1565c0" roughness={0.5} /></mesh>
          {Array.from({ length: n }, (_, i) => (
            <Tyre key={i} x={-w / 2 + 0.35 + i * ((w - 0.7) / Math.max(1, n - 1))} z={0} y={y} r={0.33} w={0.24} band={bands[(i + row) % bands.length]} ry={Math.PI / 2} />
          ))}
        </group>
      ))}
    </group>
  )
}

// A workbench under a pegboard, with a vice and a parts tray.
function Workbench({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.92, 0]}><boxGeometry args={[2.6, 0.08, 0.8]} /><meshStandardMaterial color="#8d6e63" roughness={0.8} /></mesh>
      {[-1.2, 1.2].map((dx) => [-0.32, 0.32].map((dz) => (
        <mesh key={`${dx}${dz}`} position={[dx, 0.44, dz]}><boxGeometry args={[0.07, 0.88, 0.07]} /><meshStandardMaterial {...steel} /></mesh>
      )))}
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[2.4, 0.04, 0.7]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[0, 1.85, -0.4]}><boxGeometry args={[2.6, 1.5, 0.04]} /><meshStandardMaterial map={pegTex()} roughness={0.85} /></mesh>
      {/* Vice. */}
      <mesh position={[-0.9, 1.05, 0.2]}><boxGeometry args={[0.24, 0.18, 0.3]} /><meshStandardMaterial color="#1e88e5" roughness={0.5} /></mesh>
      <mesh position={[-0.9, 1.05, 0.42]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.02, 0.02, 0.3, 6]} /><meshStandardMaterial color="#cfd8dc" metalness={0.8} /></mesh>
      {/* Parts tray and an oil can. */}
      <mesh position={[0.5, 0.99, 0.1]}><boxGeometry args={[0.5, 0.06, 0.32]} /><meshStandardMaterial color="#c62828" /></mesh>
      <mesh position={[1.0, 1.07, -0.05]}><cylinderGeometry args={[0.08, 0.08, 0.22, 12]} /><meshStandardMaterial color="#fdd835" /></mesh>
      {/* Work lamp over the bench. */}
      <mesh position={[0, 2.5, -0.2]}><boxGeometry args={[2.2, 0.06, 0.36]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[0, 2.46, -0.15]}><boxGeometry args={[2.0, 0.02, 0.12]} /><meshBasicMaterial color="#fff4dc" toneMapped={false} /></mesh>
    </group>
  )
}

// A two-post lift with a car up on it, by the right wall (metres, before the room turns).
export const LIFT_AT: [number, number] = [12.5, -9]
const LIFT_ARMS = 1.67 // top of the arms, metres
const LIFT_K = 4.3 / 1.48
function Lift({ x, z, ry }: { x: number; z: number; ry: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      {[-1.6, 1.6].map((dx) => (
        <group key={dx} position={[dx, 0, 0]}>
          <mesh position-y={1.9}><boxGeometry args={[0.32, 3.8, 0.32]} /><meshStandardMaterial color="#ffb300" roughness={0.45} /></mesh>
          <mesh position-y={0.04}><boxGeometry args={[0.6, 0.08, 0.6]} /><meshStandardMaterial {...steel} /></mesh>
          {/* The carriage that rides up the post, and the arms reaching under the car. */}
          <mesh position={[-Math.sign(dx) * 0.22, 1.62, 0]}><boxGeometry args={[0.16, 0.3, 1.6]} /><meshStandardMaterial {...steel} /></mesh>
          {[-0.7, 0.7].map((dz) => (
            <mesh key={dz} position={[-Math.sign(dx) * 0.55, 1.62, dz]}><boxGeometry args={[1.0, 0.1, 0.12]} /><meshStandardMaterial {...steel} /></mesh>
          ))}
        </group>
      ))}
      <mesh position-y={3.86}><boxGeometry args={[3.6, 0.14, 0.24]} /><meshStandardMaterial color="#ffb300" roughness={0.45} /></mesh>
      {/* A real car up on the arms, wheels hanging clear: the camera's free to look at it up close.
          CarModel is in its own units (the classic is 1.48 long with its sills 0.1 up); LIFT_K makes it 4.3 m. */}
      <group position-y={LIFT_ARMS - LIFT_K * 0.1} rotation-y={Math.PI}>
        <group scale={LIFT_K}>
          <CarModel body="classic" color="#8e1b2b" finish="gloss" stripe="#eceff1" />
        </group>
      </group>
    </group>
  )
}

// The lounge corner: a sofa, a low table, a rug, a plant and the drinks machine.
function Lounge({ x, z, ry }: { x: number; z: number; ry: number }) {
  const sofa = '#37474f'
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      <mesh position={[0, 0.006, 1.2]} rotation-x={-Math.PI / 2}><planeGeometry args={[4.2, 2.8]} /><meshStandardMaterial color="#8c2f39" roughness={1} {...decal()} /></mesh>
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[3, 0.42, 0.95]} /><meshStandardMaterial color={sofa} roughness={0.9} /></mesh>
      <mesh position={[0, 0.72, -0.38]}><boxGeometry args={[3, 0.62, 0.22]} /><meshStandardMaterial color={sofa} roughness={0.9} /></mesh>
      {[-1.5, 1.5].map((dx) => <mesh key={dx} position={[dx, 0.42, 0]}><boxGeometry args={[0.22, 0.6, 0.95]} /><meshStandardMaterial color={sofa} roughness={0.9} /></mesh>)}
      {[-0.68, 0.68].map((dx) => <mesh key={dx} position={[dx, 0.5, 0.06]}><boxGeometry args={[1.3, 0.14, 0.8]} /><meshStandardMaterial color="#455a64" roughness={0.9} /></mesh>)}
      <mesh position={[-0.9, 0.78, -0.16]} rotation-x={-0.25}><boxGeometry args={[0.5, 0.4, 0.14]} /><meshStandardMaterial color="#ffb300" roughness={0.9} /></mesh>
      {/* Table with a magazine and a mug. */}
      <mesh position={[0, 0.4, 1.4]}><boxGeometry args={[1.6, 0.06, 0.8]} /><meshStandardMaterial color="#5d4037" roughness={0.6} /></mesh>
      {[-0.7, 0.7].map((dx) => [-0.3, 0.3].map((dz) => <mesh key={`${dx}${dz}`} position={[dx, 0.19, 1.4 + dz]}><boxGeometry args={[0.06, 0.38, 0.06]} /><meshStandardMaterial color="#212121" /></mesh>))}
      <mesh position={[-0.3, 0.44, 1.38]} rotation-y={0.3}><boxGeometry args={[0.42, 0.02, 0.3]} /><meshStandardMaterial color="#e3f2fd" /></mesh>
      <mesh position={[0.35, 0.48, 1.5]}><cylinderGeometry args={[0.05, 0.045, 0.1, 10]} /><meshStandardMaterial color="#fafafa" /></mesh>
      {/* Potted plant. */}
      <group position={[2.1, 0, -0.1]}>
        <mesh position-y={0.3}><cylinderGeometry args={[0.28, 0.22, 0.6, 14]} /><meshStandardMaterial color="#cfd8dc" roughness={0.7} /></mesh>
        {[[0, 1.0, 0, 0.42], [0.18, 1.3, 0.1, 0.32], [-0.15, 1.25, -0.08, 0.34], [0.05, 1.55, -0.05, 0.25]].map(([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]}><icosahedronGeometry args={[r, 0]} /><meshStandardMaterial color={i % 2 ? '#2e7d32' : '#388e3c'} roughness={0.9} flatShading /></mesh>
        ))}
        <mesh position-y={0.7}><cylinderGeometry args={[0.03, 0.04, 0.5, 5]} /><meshStandardMaterial color="#5d4037" /></mesh>
      </group>
      {/* Drinks machine. */}
      <group position={[-2.6, 0, -0.1]}>
        <mesh position-y={1.0}><boxGeometry args={[1.0, 2.0, 0.8]} /><meshStandardMaterial color="#b71c1c" roughness={0.5} /></mesh>
        <mesh position={[0, 1.05, 0.41]}><planeGeometry args={[0.86, 1.72]} /><meshBasicMaterial map={vendTex()} toneMapped={false} /></mesh>
      </group>
    </group>
  )
}

// A wall shelf of trophies.
function Trophies({ x, z, ry }: { x: number; z: number; ry: number }) {
  const gold = { color: '#e0a526', metalness: 0.75, roughness: 0.3 }
  return (
    <group position={[x, 0, z]} rotation-y={ry}>
      {[1.5, 2.3].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0]}><boxGeometry args={[2.4, 0.06, 0.4]} /><meshStandardMaterial color="#4e342e" roughness={0.6} /></mesh>
          {[-0.85, -0.3, 0.3, 0.85].map((dx, i) => {
            const k = 0.8 + ((i + y) % 3) * 0.15
            return (
              <group key={dx} position={[dx, y + 0.03, 0]} scale={k}>
                <mesh position-y={0.05}><boxGeometry args={[0.18, 0.1, 0.18]} /><meshStandardMaterial color="#263238" /></mesh>
                <mesh position-y={0.17}><cylinderGeometry args={[0.025, 0.04, 0.14, 8]} /><meshStandardMaterial {...gold} /></mesh>
                <mesh position-y={0.33}><cylinderGeometry args={[0.12, 0.05, 0.2, 12]} /><meshStandardMaterial {...gold} /></mesh>
              </group>
            )
          })}
        </group>
      ))}
    </group>
  )
}

// A ceiling can light aimed at the turntable.
function TrackLight({ a }: { a: number }) {
  const r = 6.5
  const x = Math.cos(a) * r, z = Math.sin(a) * r
  // Tilt towards the centre.
  return (
    <group position={[x, ROOF - 0.9, z]} rotation-y={-a + Math.PI / 2}>
      <mesh position-y={0.45}><cylinderGeometry args={[0.03, 0.03, 0.9, 5]} /><meshStandardMaterial color="#212121" /></mesh>
      <group rotation-x={0.75}>
        <mesh><cylinderGeometry args={[0.2, 0.26, 0.6, 14]} /><meshStandardMaterial color="#1c232b" metalness={0.5} roughness={0.45} /></mesh>
        <mesh position-y={-0.31} rotation-x={Math.PI / 2}><circleGeometry args={[0.2, 14]} /><meshBasicMaterial color="#fff2d6" toneMapped={false} side={DoubleSide} /></mesh>
      </group>
    </group>
  )
}

// The room on its own, in metres (exported for its tests).
export function Room() {
  const neon = useMemo(() => signTexture('CARTOPIA MOTORS', '#0c1730', '#ffcf6b'), [])
  const bay = useMemo(() => signTexture('BAY 1', '#1b2430', '#4fe3ff', 3), [])
  const wall = brickTex(10, 3)
  const tube = '#ff7a3d'
  return (
    <group>
      {/* The pit wall and floor below the disc, seen when it drops for a dyno run. */}
      <mesh position-y={-PIT / 2 / S}>
        <cylinderGeometry args={[TT_R / S, TT_R / S, PIT / S, 40, 1, true]} />
        <meshStandardMaterial color="#2a3038" roughness={0.8} side={BackSide} />
      </mesh>
      <mesh position-y={-PIT / S} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[TT_R / S, 32]} />
        <meshStandardMaterial color="#1b2026" />
      </mesh>
      {/* The fixed steel rim, and a lit strip just inside it. */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[TT_R / S, RIM_R / S, 64]} />
        <meshStandardMaterial color="#9aa4ae" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[(RIM_R - 0.07) / S, (RIM_R - 0.035) / S, 64]} />
        <meshBasicMaterial color="#cfe9ff" toneMapped={false} {...decal()} />
      </mesh>
      {/* Polished tile floor with a hole for the turntable. */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[RIM_R / S, HALF * 1.5, 72, 1]} />
        <meshStandardMaterial map={tileTex(14)} color="#262c35" roughness={0.45} metalness={0.1} envMapIntensity={0.35} />
      </mesh>
      {/* A dark apron round the turntable, and a painted walkway to the roller door. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[RIM_R / S, RIM_R / S + 1.6, 64]} />
        <meshStandardMaterial color="#2c333c" roughness={0.6} {...decal()} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[RIM_R / S + 1.6, RIM_R / S + 1.75, 64]} />
        <meshStandardMaterial color="#ffd600" roughness={0.7} {...decal(2)} />
      </mesh>
      {[-1.6, 1.6].map((dz) => (
        <mesh key={dz} rotation-x={-Math.PI / 2} position={[(RIM_R / S + 1.75 + HALF) / 2, 0.01, dz]}>
          <planeGeometry args={[HALF - RIM_R / S - 1.75, 0.14]} />
          <meshStandardMaterial color="#ffd600" roughness={0.7} {...decal()} />
        </mesh>
      ))}

      {/* Back wall: brick, a dark skirting, the neon sign, tyre wall and workbench. */}
      <mesh position={[0, ROOF / 2, -HALF]}><boxGeometry args={[HALF * 2, ROOF, 0.3]} /><meshStandardMaterial map={wall} color="#7b5a52" roughness={0.85} /></mesh>
      <mesh position={[0, 0.6, -HALF + 0.2]}><boxGeometry args={[HALF * 2, 1.2, 0.1]} /><meshStandardMaterial color="#2b333d" roughness={0.6} /></mesh>
      <group position={[0, 3.3, -HALF + 0.18]}>
        <mesh><boxGeometry args={[8.2, 2.1, 0.15]} /><meshStandardMaterial color="#0a1226" /></mesh>
        <mesh position-z={0.085}><planeGeometry args={[7.8, 1.95]} /><meshBasicMaterial map={neon} toneMapped={false} /></mesh>
        {[[0, 1.03, 8.1, 0.08], [0, -1.03, 8.1, 0.08], [-4.05, 0, 0.08, 2.1], [4.05, 0, 0.08, 2.1]].map(([px, py, w, h], i) => (
          <mesh key={i} position={[px, py, 0.13]}><boxGeometry args={[w, h, 0.08]} /><meshBasicMaterial color={tube} toneMapped={false} /></mesh>
        ))}
      </group>
      <TyreWall x={-10} z={-HALF + 0.55} w={7} />
      <Workbench x={9.5} z={-HALF + 0.6} />
      <ToolChest x={13} z={-HALF + 0.5} />
      <ToolChest x={6.2} z={-HALF + 0.5} color="#1565c0" />
      {/* Race posters. */}
      {[[-5.1, '7', '#c62828', '#ffffff'], [5.1, '1', '#0d47a1', '#ffd54f']].map(([px, num, bg, fg]) => (
        <group key={num as string} position={[px as number, 2.25, -HALF + 0.17]}>
          <mesh><boxGeometry args={[1.5, 2.1, 0.05]} /><meshStandardMaterial color="#111111" /></mesh>
          <mesh position-z={0.035}><planeGeometry args={[1.38, 1.96]} /><meshStandardMaterial map={posterTex(num as string, bg as string, fg as string)} roughness={0.6} /></mesh>
        </group>
      ))}

      {/* Left wall: the shop window onto the town at night. */}
      <mesh position={[-HALF, ROOF / 2, 0]}><boxGeometry args={[0.3, ROOF, HALF * 2]} /><meshStandardMaterial map={corrugatedTex(9, 3)} color="#4d5a66" metalness={0.3} roughness={0.7} /></mesh>
      <group position={[-HALF + 0.17, 0, 1]}>
        <mesh position={[0, 3.2, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[20, 5.2]} /><meshBasicMaterial map={cityTex()} toneMapped={false} /></mesh>
        {/* Mullions and the frame. */}
        {[-10, -6, -2, 2, 6, 10].map((dz) => <mesh key={dz} position={[0.06, 3.2, dz]}><boxGeometry args={[0.12, 5.4, 0.16]} /><meshStandardMaterial color="#1a1f26" metalness={0.5} roughness={0.4} /></mesh>)}
        {[0.55, 5.85].map((y) => <mesh key={y} position={[0.06, y, 0]}><boxGeometry args={[0.14, 0.16, 20.2]} /><meshStandardMaterial color="#1a1f26" metalness={0.5} roughness={0.4} /></mesh>)}
        <mesh position={[0.3, 0.25, 0]}><boxGeometry args={[0.5, 0.5, 20.2]} /><meshStandardMaterial color="#263038" roughness={0.6} /></mesh>
      </group>
      {/* Light from the street spilling in through the window. */}
      <mesh position={[-HALF + 3.2, 0.03, 1]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[6, 20]} />
        <meshBasicMaterial map={glowTex()} color="#3d5bb0" transparent opacity={0.35} depthWrite={false} toneMapped={false} {...decal()} />
      </mesh>

      {/* Right wall: the roller door half up onto the street, and the lift. */}
      <mesh position={[HALF, ROOF / 2, 0]}><boxGeometry args={[0.3, ROOF, HALF * 2]} /><meshStandardMaterial map={corrugatedTex(9, 3)} color="#55626d" metalness={0.3} roughness={0.7} /></mesh>
      <group position={[HALF - 0.17, 0, 0]}>
        <mesh position={[-0.01, 2.2, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[5.6, 4.4]} /><meshBasicMaterial color="#121a33" /></mesh>
        <mesh position={[-0.03, 1.0, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[5.2, 1.6]} /><meshBasicMaterial map={glowTex()} color="#ffc87a" transparent opacity={0.4} depthWrite={false} toneMapped={false} /></mesh>
        <mesh position={[-0.1, 3.4, 0]}><boxGeometry args={[0.1, 2.4, 5.6]} /><meshStandardMaterial map={shutterTex()} color="#b0bec5" metalness={0.4} roughness={0.5} /></mesh>
        {[-2.95, 2.95].map((dz) => <mesh key={dz} position={[-0.15, 2.3, dz]}><boxGeometry args={[0.2, 4.6, 0.25]} /><meshStandardMaterial map={checkerTex(1)} color="#ffd54f" /></mesh>)}
        <mesh position={[-0.01, 6.2, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[2.4, 0.8]} /><meshBasicMaterial map={bay} toneMapped={false} /></mesh>
      </group>
      <Lift x={LIFT_AT[0]} z={LIFT_AT[1]} ry={Math.PI / 2} />
      <TyreStack x={15.5} z={5} n={5} band="#ffc400" />
      <TyreStack x={16.2} z={6.2} n={3} band="#e53935" />
      {/* Traffic cones by the door. */}
      {[[15, 3.6], [15.6, -3.8]].map(([cx, cz]) => (
        <group key={cx} position={[cx, 0, cz]}>
          <mesh position-y={0.36}><coneGeometry args={[0.22, 0.7, 14]} /><meshStandardMaterial color="#ff6d00" /></mesh>
          <mesh position-y={0.4}><cylinderGeometry args={[0.13, 0.16, 0.12, 14]} /><meshStandardMaterial color="#fafafa" /></mesh>
          <mesh position-y={0.025}><boxGeometry args={[0.5, 0.05, 0.5]} /><meshStandardMaterial color="#212121" /></mesh>
        </group>
      ))}

      {/* Front wall: brick, the lounge, trophies and a clock. */}
      <mesh position={[0, ROOF / 2, HALF]}><boxGeometry args={[HALF * 2, ROOF, 0.3]} /><meshStandardMaterial map={wall} color="#6e5049" roughness={0.85} /></mesh>
      <mesh position={[0, 0.6, HALF - 0.2]}><boxGeometry args={[HALF * 2, 1.2, 0.1]} /><meshStandardMaterial color="#2b333d" roughness={0.6} /></mesh>
      <Lounge x={-7} z={HALF - 1.6} ry={Math.PI} />
      <Trophies x={6} z={HALF - 0.36} ry={Math.PI} />
      <group position={[0, 4.6, HALF - 0.2]} rotation-y={Math.PI}>
        <mesh rotation-x={Math.PI / 2}><cylinderGeometry args={[0.7, 0.7, 0.1, 32]} /><meshStandardMaterial color="#fafafa" roughness={0.5} /></mesh>
        <mesh position-z={0.06} rotation-z={0.6}><boxGeometry args={[0.06, 0.5, 0.02]} /><meshStandardMaterial color="#212121" /></mesh>
        <mesh position-z={0.07} rotation-z={-1.9}><boxGeometry args={[0.05, 0.36, 0.02]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>
      {/* A fire extinguisher on its bracket. */}
      <group position={[13, 0, HALF - 0.3]}>
        <mesh position-y={1.0}><cylinderGeometry args={[0.13, 0.13, 0.6, 12]} /><meshStandardMaterial color="#d32f2f" roughness={0.4} /></mesh>
        <mesh position-y={1.36}><cylinderGeometry args={[0.04, 0.06, 0.12, 8]} /><meshStandardMaterial color="#212121" /></mesh>
      </group>

      {/* Square columns with hazard-taped feet. */}
      {[[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([px, pz]) => (
        <group key={`${px}${pz}`} position={[px, 0, pz]}>
          <mesh position-y={ROOF / 2}><boxGeometry args={[0.7, ROOF, 0.7]} /><meshStandardMaterial color="#8a9198" roughness={0.8} /></mesh>
          {[0.15, 0.45].map((y) => <mesh key={y} position-y={y}><boxGeometry args={[0.72, 0.18, 0.72]} /><meshStandardMaterial map={checkerTex(2)} color="#ffd54f" /></mesh>)}
        </group>
      ))}

      {/* Ceiling: dark deck, steel beams, rows of light panels and the track lights. */}
      <mesh position-y={ROOF} rotation-x={Math.PI / 2}><planeGeometry args={[HALF * 2, HALF * 2]} /><meshStandardMaterial color="#141a22" /></mesh>
      {[-12, -6, 0, 6, 12].map((bz) => <mesh key={bz} position={[0, ROOF - 0.25, bz]}><boxGeometry args={[HALF * 2, 0.5, 0.25]} /><meshStandardMaterial color="#2a323b" metalness={0.4} /></mesh>)}
      {[-9, -3, 3, 9].map((pz) => [-12, -4, 4, 12].map((px) => (
        <mesh key={`${px}${pz}`} position={[px, ROOF - 0.04, pz]} rotation-x={Math.PI / 2}><planeGeometry args={[3, 0.5]} /><meshBasicMaterial color="#e8f1ff" toneMapped={false} side={DoubleSide} /></mesh>
      )))}
      <mesh position={[0, ROOF - 0.5, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[6.5, 0.07, 6, 48]} /><meshStandardMaterial color="#1c232b" metalness={0.5} /></mesh>
      {Array.from({ length: 8 }, (_, i) => <TrackLight key={i} a={(i / 8) * Math.PI * 2 + Math.PI / 8} />)}
      {/* Chequered banners hanging from the beams. */}
      {[[-6, -6], [6, 6], [-6, 6], [6, -6]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px * 1.6, ROOF - 1.1, pz]}><boxGeometry args={[0.04, 1.2, 2.4]} /><meshStandardMaterial map={checkerTex(3)} roughness={0.9} /></mesh>
      ))}
    </group>
  )
}

// The room's lights: a clean key and a cool rim for the car, and a warm pool from the track
// lights on the turntable. Four lights and no shadows, so the preview canvas stays cheap; the
// sign, window and door glow by themselves.
export function ShowroomLights() {
  return (
    <>
      <color attach="background" args={[SHOWROOM_BG]} />
      <fog attach="fog" args={[SHOWROOM_BG, 11, 26]} />
      <hemisphereLight args={['#dfe8ff', '#262c36', 0.85]} />
      <directionalLight position={[3, 5, 2]} intensity={1.45} />
      <directionalLight position={[-3, 2.5, -4]} intensity={0.55} color="#a9c8ff" />
      <spotLight position={[0, 3.8, 0]} angle={0.75} penumbra={0.7} intensity={18} distance={7} decay={1.5} color="#fff1dc" />
    </>
  )
}

// The room itself, merged into a few draws.
export function Showroom() {
  return (
    <group rotation-y={TURN} scale={S} userData={{ noFit: true }}>
      <Batch version={0}>
        <Room />
      </Batch>
    </group>
  )
}
