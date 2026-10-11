import { useEffect, useMemo, useRef, useState } from 'react'
import { MapControls } from '@react-three/drei'
import { AnchorProjector } from './anchors'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useGame, canPlace, buyablePlots, lotSize, type PlacedBuilding } from '../game/store'
import { GRID, TILE, PLOT, PLOT_MIN, PLOT_MAX, START_LAND, buildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { rotatePlacement, setGhostTurn, turnOf } from '../game/placement'
import { Clouds } from './Clouds'
import { DayNight } from './DayNight'
import { PAL } from './season'
import { SeasonFx } from './SeasonFx'
import { glowMats } from './dayNight'
import { LightPool } from './BuildingModel'
import { TownCars } from './TownCars'
import { toWorld, toTile, DIRS } from './grid'
import { grassTex, paverTex, asphaltTex } from './textures'
import { layoutRoads } from './traffic/layout'

const SIZE = GRID * TILE
// Everything a town could ever own, centred on the origin like the start lot.
const ALL = (PLOT_MAX - PLOT_MIN + 1) * PLOT * TILE

// World centre of a land plot.
export const plotCenter = (px: number, pz: number) => toWorld(px * PLOT + (PLOT - 1) / 2, pz * PLOT + (PLOT - 1) / 2)

function Land() {
  const land = useGame((s) => (s.visiting ? START_LAND : s.land))
  const mode = useGame((s) => s.mode)
  const forSale = useMemo(() => (mode === 'expand' ? buyablePlots(land) : []), [land, mode])
  return (
    <group>
      {land.map((k) => {
        const [px, pz] = k.split(',').map(Number)
        const [cx, cz] = plotCenter(px, pz)
        return (
          <group key={k} position={[cx, 0, cz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
              <planeGeometry args={[PLOT * TILE, PLOT * TILE]} />
              <meshStandardMaterial map={grassTex(PLOT / 2)} />
            </mesh>
            {mode !== 'play' && mode !== 'expand' && <gridHelper args={[PLOT * TILE, PLOT, '#4f8f2f', '#5f9f3f']} position-y={0.005} />}
          </group>
        )
      })}
      {forSale.map(([px, pz]) => {
        const [cx, cz] = plotCenter(px, pz)
        return (
          <mesh key={`${px},${pz}`} rotation-x={-Math.PI / 2} position={[cx, 0.004, cz]}>
            <planeGeometry args={[PLOT * TILE - 0.6, PLOT * TILE - 0.6]} />
            <meshBasicMaterial color="#ffd54f" transparent opacity={0.35} />
          </mesh>
        )
      })}
    </group>
  )
}

export function centerOf(def: string, x: number, z: number, rot?: number): [number, number] {
  const [w, h] = lotSize(def, rot)
  return toWorld(x + (w - 1) / 2, z + (h - 1) / 2)
}



function Building({ b, roads }: { b: PlacedBuilding; roads: Set<string> }) {
  const d = buildingDef(b.def)
  const [cx, cz] = centerOf(b.def, b.x, b.z, b.rot)
  return (
    <group
      position={[cx, 0, cz]}
      rotation-y={(turnOf(b, roads) * Math.PI) / 2}
      onClick={(e) => {
        const s = useGame.getState()
        if (s.mode !== 'play' || s.visiting || e.delta > 6) return
        e.stopPropagation()
        s.tapBuilding(b.uid)
      }}
      onPointerOver={() => {
        if (useGame.getState().mode === 'play' && d.kind !== 'decor' && d.kind !== 'house') document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {d.kind !== 'decor' && d.kind !== 'obstacle' && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
          <planeGeometry args={[d.w * TILE - 0.1, d.h * TILE - 0.1]} />
          <meshStandardMaterial map={paverTex(d.w, d.h)} />
        </mesh>
      )}
      <BuildingModel def={d} />
    </group>
  )
}

// Raised sidewalk strip along a road edge with no connecting road.
function Sidewalk({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const half = TILE / 2
  const w = 0.4
  const along = side === 'e' || side === 'w'
  const pos: [number, number, number] =
    side === 'e' ? [half - w / 2, 0.04, 0] : side === 'w' ? [-half + w / 2, 0.04, 0]
    : side === 's' ? [0, 0.04, half - w / 2] : [0, 0.04, -half + w / 2]
  return (
    <mesh position={pos} receiveShadow>
      <boxGeometry args={along ? [w, 0.08, TILE] : [TILE, 0.08, w]} />
      <meshStandardMaterial map={along ? paverTex(0.5, 2) : paverTex(2, 0.5)} />
    </mesh>
  )
}

// Zebra crossing painted across the road near one edge of the tile.
function Crosswalk({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const half = TILE / 2
  const across = side === 'e' || side === 'w'
  const at = half - 0.32
  const off = side === 'e' || side === 's' ? at : -at
  return (
    <group>
      {[-0.45, -0.15, 0.15, 0.45].map((o) => (
        <mesh key={o} rotation-x={-Math.PI / 2} position={across ? [off, 0.021, o] : [o, 0.021, off]}>
          <planeGeometry args={across ? [0.34, 0.16] : [0.16, 0.34]} />
          <meshBasicMaterial color="#f5f5f5" />
        </mesh>
      ))}
    </group>
  )
}

// Street lamp on the sidewalk, arm reaching over the road. Lit at night.
function StreetLamp({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const half = TILE / 2 - 0.18
  const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[side]
  return (
    <group rotation-y={rot}>
      <group position={[0.55, 0, half]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 1.7, 6]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position={[0, 1.68, -0.22]}>
          <boxGeometry args={[0.05, 0.04, 0.48]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position={[0, 1.63, -0.44]}>
          <boxGeometry args={[0.14, 0.06, 0.2]} />
          <primitive object={glowMats.bulb} attach="material" dispose={null} />
        </mesh>
      </group>
      <LightPool r={0.95} x={0.55} z={half - 0.5} />
    </group>
  )
}

// Lane paint along a tile: dashes down the middle, as on any two-way road and
// between the two lanes of each side of an avenue.
function Dashes({ alongX }: { alongX: boolean }) {
  return (
    <>
      {[-0.5, 0.5].map((o) => (
        <mesh key={o} rotation-x={-Math.PI / 2} position={alongX ? [o, 0.02, 0] : [0, 0.02, o]}>
          <planeGeometry args={alongX ? [0.45, 0.07] : [0.07, 0.45]} />
          <meshBasicMaterial color="#fafafa" />
        </mesh>
      ))}
    </>
  )
}

// Double yellow line down the middle of an avenue, on the edge facing `side`.
function Median({ side }: { side: number }) {
  const alongX = side >= 2
  const edge = (side === 0 || side === 2 ? 1 : -1) * (TILE / 2)
  return (
    <>
      {[-0.07, 0.07].map((o) => (
        <mesh key={o} rotation-x={-Math.PI / 2} position={alongX ? [0, 0.02, edge + o] : [edge + o, 0.02, 0]}>
          <planeGeometry args={alongX ? [TILE, 0.06] : [0.06, TILE]} />
          <meshBasicMaterial color="#ffca28" />
        </mesh>
      ))}
    </>
  )
}

// Stop line across the lane heading into an intersection on side `side`.
function StopLine({ side }: { side: number }) {
  const [dx, dz] = DIRS[side]
  // The lane on the right of traffic heading that way.
  const [rx, rz] = [-dz, dx]
  const at = TILE / 2 - 0.58
  const lane = 0.45
  return (
    <mesh rotation-x={-Math.PI / 2} position={[dx * at + rx * lane, 0.02, dz * at + rz * lane]}>
      <planeGeometry args={dx ? [0.08, 0.8] : [0.8, 0.08]} />
      <meshBasicMaterial color="#fafafa" />
    </mesh>
  )
}

const SIDES = ['e', 'w', 's', 'n'] as const

function Roads() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const tiles = useMemo(() => {
    const { tiles: all } = layoutRoads(roadsList)
    return [...all.values()].map((t) => {
      const near = DIRS.map(([dx, dz]) => all.get(`${t.x + dx},${t.z + dz}`))
      // Zebra crossings where a road meets an intersection.
      const xing = near.map((n) => !t.junction && !!n?.junction)
      return { ...t, xing }
    })
  }, [roadsList])
  const asphalt = asphaltTex()

  return (
    <group>
      {tiles.map(({ key: k, x, z, arms, junction, oneWay, mate, xing }) => {
        const [wx, wz] = toWorld(x, z)
        const [e, w, s, nn] = arms
        const straightX = !junction && (e || w) && !s && !nn
        const straightZ = !junction && (s || nn) && !e && !w
        const avenue = oneWay >= 0
        // Lamps go on the outside edge of an avenue.
        const outer = avenue ? SIDES[mate ^ 1] : null
        return (
          <group key={k} position={[wx, 0, wz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial map={asphalt} />
            </mesh>
            {SIDES.map((sd, i) => !arms[i] && <Sidewalk key={sd} side={sd} />)}
            {SIDES.map((sd, i) => xing[i] && <Crosswalk key={sd} side={sd} />)}
            {xing.map((on, i) => on && (oneWay < 0 || oneWay === i) && <StopLine key={i} side={i} />)}
            {/* Street lamps every few tiles along straight roads, alternating sides. */}
            {(straightX || straightZ) && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0 && (
              <StreetLamp side={straightX ? ((x + z) % 2 ? 's' : 'n') : ((x + z) % 2 ? 'e' : 'w')} />
            )}
            {avenue && outer && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0 && <StreetLamp side={outer} />}
            {(straightX || straightZ) && <Dashes alongX={straightX} />}
            {avenue && <Dashes alongX={oneWay < 2} />}
            {avenue && (mate === 0 || mate === 2) && <Median side={mate} />}
          </group>
        )
      })}
    </group>
  )
}

function Interaction() {
  const mode = useGame((s) => s.mode)
  const placing = useGame((s) => s.placing)
  const placeRot = useGame((s) => s.placeRot)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const painting = useRef(false)
  const roads = useGame((s) => s.roads)
  const buildings = useGame((s) => s.buildings)
  const land = useGame((s) => s.land)
  const roadSet = useMemo(() => new Set(roads), [roads])

  // R turns the building being placed on desktop.
  useEffect(() => {
    if (mode !== 'place') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement)) rotatePlacement()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  const tileOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => toTile(e.point.x, e.point.z)

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const t = tileOf(e)
    if (!hover || hover[0] !== t[0] || hover[1] !== t[1]) setHover(t)
    if (painting.current && mode === 'road') useGame.getState().paintRoad(...t)
    if (painting.current && mode === 'bulldoze') useGame.getState().bulldoze(...t)
  }
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'road' && mode !== 'bulldoze') return
    if (e.button !== 0) return
    painting.current = true
    const t = tileOf(e)
    if (mode === 'road') useGame.getState().paintRoad(...t)
    else useGame.getState().bulldoze(...t)
  }
  const onUp = () => (painting.current = false)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (mode !== 'place' || !placing || e.delta > 6) return
    const [x, z] = tileOf(e)
    const d = buildingDef(placing)
    const [w, h] = lotSize(placing, placeRot ?? undefined)
    // Hover tile is the footprint's centre; convert to its top-left corner.
    const ox = x - Math.floor((w - 1) / 2)
    const oz = z - Math.floor((h - 1) / 2)
    if (useGame.getState().placeBuilding(placing, ox, oz, placeRot ?? undefined)) {
      const s = useGame.getState()
      if (s.coins < d.price) s.setMode('play')
    }
  }

  let ghost = null
  if (hover && mode === 'place' && placing) {
    const d = buildingDef(placing)
    const rot = placeRot ?? undefined
    const [w, h] = lotSize(placing, rot)
    const ox = hover[0] - Math.floor((w - 1) / 2)
    const oz = hover[1] - Math.floor((h - 1) / 2)
    const valid = canPlace({ roads, buildings, land }, placing, ox, oz, rot)
    const [cx, cz] = centerOf(placing, ox, oz, rot)
    const turn = turnOf({ def: placing, x: ox, z: oz, rot }, roadSet)
    setGhostTurn(turn)
    ghost = (
      <group position={[cx, 0.02, cz]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <planeGeometry args={[w * TILE, h * TILE]} />
          <meshBasicMaterial color={valid ? '#66bb6a' : '#ef5350'} transparent opacity={0.4} />
        </mesh>
        <group rotation-y={(turn * Math.PI) / 2}>
          <BuildingModel def={d} ghost valid={valid} />
        </group>
      </group>
    )
  } else if (hover && (mode === 'road' || mode === 'bulldoze')) {
    const [wx, wz] = toWorld(...hover)
    ghost = (
      <mesh rotation-x={-Math.PI / 2} position={[wx, 0.06, wz]}>
        <planeGeometry args={[TILE, TILE]} />
        <meshBasicMaterial color={mode === 'road' ? '#90caf9' : '#ef5350'} transparent opacity={0.5} />
      </mesh>
    )
  }

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => {
          painting.current = false
          setHover(null)
        }}
        onClick={onClick}
      >
        <planeGeometry args={[ALL, ALL]} />
        <meshStandardMaterial color={PAL.ground} />
      </mesh>
      {ghost}
      <MapControls
        makeDefault
        enabled={!(mode === 'road' || mode === 'bulldoze')}
        enableRotate={false}
        minZoom={12}
        maxZoom={90}
        screenSpacePanning={false}
      />
    </>
  )
}

// Pick a zoom that frames a similar slice of town on any screen size.
function ResponsiveZoom() {
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  useEffect(() => {
    camera.zoom = Math.min(38, Math.max(18, Math.sqrt(width * height) / 24))
    camera.updateProjectionMatrix()
  }, [camera, width, height])
  return null
}

// Pull the camera back while buying land so the For Sale signs are in view.
function ExpandZoom() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null
  const mode = useGame((s) => s.mode)
  const saved = useRef<number | null>(null)
  useEffect(() => {
    if (mode === 'expand' && saved.current === null) {
      saved.current = camera.zoom
      camera.zoom = Math.max(12, camera.zoom * 0.5)
      camera.updateProjectionMatrix()
    } else if (mode !== 'expand' && saved.current !== null) {
      camera.zoom = saved.current
      saved.current = null
      camera.updateProjectionMatrix()
    }
    controls?.update()
  }, [mode, camera, controls])
  return null
}

export function World() {
  const buildings = useGame((s) => (s.visiting ?? s).buildings)
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const roads = useMemo(() => new Set(roadsList), [roadsList])
  return (
    <>
      <DayNight small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      {/* Grass beyond the buildable lot. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[SIZE * 8, SIZE * 8]} />
        <meshStandardMaterial color={PAL.ground} />
      </mesh>
      <ResponsiveZoom />
      <ExpandZoom />
      <Interaction />
      <Land />
      <Roads />
      {buildings.map((b) => (
        <Building key={b.uid} b={b} roads={roads} />
      ))}
      <AnchorProjector />
      <TownCars />
      <Clouds />
      <SeasonFx small={Math.min(window.innerWidth, window.innerHeight) < 700} />
    </>
  )
}
