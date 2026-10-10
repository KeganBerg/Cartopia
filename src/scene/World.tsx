import { useEffect, useMemo, useRef, useState } from 'react'
import { MapControls } from '@react-three/drei'
import { AnchorProjector } from './anchors'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useGame, canPlace, buyablePlots, type PlacedBuilding } from '../game/store'
import { GRID, TILE, PLOT, PLOT_MIN, PLOT_MAX, START_LAND, buildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { Clouds } from './Clouds'
import { TownCars } from './TownCars'
import { toWorld, toTile, DIRS } from './grid'
import { grassTex, paverTex, asphaltTex } from './textures'

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

export function centerOf(def: string, x: number, z: number): [number, number] {
  const d = buildingDef(def)
  return toWorld(x + (d.w - 1) / 2, z + (d.h - 1) / 2)
}



// Turn a building's front toward an adjacent road. Non-square lots can only flip.
function facing(b: PlacedBuilding, roads: Set<string>) {
  const d = buildingDef(b.def)
  const edge = (dir: 'S' | 'E' | 'N' | 'W') => {
    for (let i = 0; i < Math.max(d.w, d.h); i++) {
      const t =
        dir === 'S' ? [b.x + i, b.z + d.h] : dir === 'N' ? [b.x + i, b.z - 1]
        : dir === 'E' ? [b.x + d.w, b.z + i] : [b.x - 1, b.z + i]
      const inRange = dir === 'S' || dir === 'N' ? i < d.w : i < d.h
      if (inRange && roads.has(`${t[0]},${t[1]}`)) return true
    }
    return false
  }
  const square = d.w === d.h
  if (edge('S')) return 0
  if (square && edge('E')) return Math.PI / 2
  if (edge('N')) return Math.PI
  if (square && edge('W')) return -Math.PI / 2
  return 0
}

function Building({ b, roads }: { b: PlacedBuilding; roads: Set<string> }) {
  const d = buildingDef(b.def)
  const [cx, cz] = centerOf(b.def, b.x, b.z)
  const rot = d.kind === 'decor' || d.kind === 'obstacle' ? 0 : facing(b, roads)
  return (
    <group
      position={[cx, 0, cz]}
      rotation-y={rot}
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

function Roads() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const tiles = useMemo(() => {
    const set = new Set(roadsList)
    const degree = (x: number, z: number) => DIRS.filter(([dx, dz]) => set.has(`${x + dx},${z + dz}`)).length
    return roadsList.map((k) => {
      const [x, z] = k.split(',').map(Number)
      const n = DIRS.map(([dx, dz]) => set.has(`${x + dx},${z + dz}`))
      // Which neighbours are intersections, for crosswalks.
      const xing = DIRS.map(([dx, dz], i) => n[i] && degree(x + dx, z + dz) >= 3)
      return { k, x, z, n, xing }
    })
  }, [roadsList])
  const asphalt = asphaltTex()

  return (
    <group>
      {tiles.map(({ k, x, z, n, xing }) => {
        const [wx, wz] = toWorld(x, z)
        const [e, w, s, nn] = n
        const count = n.filter(Boolean).length
        const straightX = (e || w) && !s && !nn
        const straightZ = (s || nn) && !e && !w
        return (
          <group key={k} position={[wx, 0, wz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial map={asphalt} />
            </mesh>
            {!e && <Sidewalk side="e" />}
            {!w && <Sidewalk side="w" />}
            {!s && <Sidewalk side="s" />}
            {!nn && <Sidewalk side="n" />}
            {count < 3 && xing[0] && <Crosswalk side="e" />}
            {count < 3 && xing[1] && <Crosswalk side="w" />}
            {count < 3 && xing[2] && <Crosswalk side="s" />}
            {count < 3 && xing[3] && <Crosswalk side="n" />}
            {straightX && [-0.5, 0.5].map((o) => (
              <mesh key={o} rotation-x={-Math.PI / 2} position={[o, 0.02, 0]}><planeGeometry args={[0.45, 0.07]} /><meshBasicMaterial color="#fafafa" /></mesh>
            ))}
            {straightZ && [-0.5, 0.5].map((o) => (
              <mesh key={o} rotation-x={-Math.PI / 2} position={[0, 0.02, o]}><planeGeometry args={[0.07, 0.45]} /><meshBasicMaterial color="#fafafa" /></mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Interaction() {
  const mode = useGame((s) => s.mode)
  const placing = useGame((s) => s.placing)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const painting = useRef(false)
  const roads = useGame((s) => s.roads)
  const buildings = useGame((s) => s.buildings)
  const land = useGame((s) => s.land)

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
    // Hover tile is the footprint's centre; convert to its top-left corner.
    const ox = x - Math.floor((d.w - 1) / 2)
    const oz = z - Math.floor((d.h - 1) / 2)
    if (useGame.getState().placeBuilding(placing, ox, oz)) {
      const s = useGame.getState()
      if (s.coins < d.price) s.setMode('play')
    }
  }

  let ghost = null
  if (hover && mode === 'place' && placing) {
    const d = buildingDef(placing)
    const ox = hover[0] - Math.floor((d.w - 1) / 2)
    const oz = hover[1] - Math.floor((d.h - 1) / 2)
    const valid = canPlace({ roads, buildings, land }, placing, ox, oz)
    const [cx, cz] = centerOf(placing, ox, oz)
    ghost = (
      <group position={[cx, 0.02, cz]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <planeGeometry args={[d.w * TILE, d.h * TILE]} />
          <meshBasicMaterial color={valid ? '#66bb6a' : '#ef5350'} transparent opacity={0.4} />
        </mesh>
        <BuildingModel def={d} ghost valid={valid} />
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
        <meshStandardMaterial color="#5aa83a" />
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
      <color attach="background" args={['#5aa83a']} />
      <hemisphereLight args={['#ffffff', '#6b8e4e', 0.7]} />
      <directionalLight
        castShadow
        position={[25, 40, 15]}
        intensity={1.6}
        shadow-mapSize={Math.min(window.innerWidth, window.innerHeight) < 700 ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      {/* Grass beyond the buildable lot. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[SIZE * 8, SIZE * 8]} />
        <meshStandardMaterial color="#5aa83a" />
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
    </>
  )
}
