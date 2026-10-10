import { useEffect, useMemo, useRef, useState } from 'react'
import { Html, MapControls } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useGame, canPlace, type PlacedBuilding } from '../game/store'
import { GRID, TILE, buildingDef } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { TownCars } from './TownCars'
import { toWorld, toTile, DIRS } from './grid'
import { useNow } from './useNow'

const SIZE = GRID * TILE

function centerOf(def: string, x: number, z: number): [number, number] {
  const d = buildingDef(def)
  return toWorld(x + (d.w - 1) / 2, z + (d.h - 1) / 2)
}

function fmt(sec: number) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
  return `${sec}s`
}

function JobBadge({ b, now }: { b: PlacedBuilding; now: number }) {
  const d = buildingDef(b.def)
  const tap = useGame((s) => s.tapBuilding)
  const mode = useGame((s) => s.mode)
  if (!d.jobSeconds) return null
  const [cx, cz] = centerOf(b.def, b.x, b.z)
  const ready = b.jobEndsAt !== null && now >= b.jobEndsAt
  const working = b.jobEndsAt !== null && !ready
  const left = working ? Math.ceil((b.jobEndsAt! - now) / 1000) : 0
  const pct = working ? 1 - left / d.jobSeconds : 0
  return (
    <Html position={[cx, d.w > 1 ? 2.6 : 2.2, cz]} center zIndexRange={[10, 0]} style={{ display: mode === 'play' ? 'block' : 'none' }}>
      <button
        className={`badge ${ready ? 'badge-ready' : working ? 'badge-working' : 'badge-idle'}`}
        onClick={(e) => {
          e.stopPropagation()
          tap(b.uid)
        }}
        title={d.name}
      >
        {ready ? (
          <span className="coin">$</span>
        ) : working ? (
          <>
            <span className="clock">⏱</span>
            <span className="bar"><span style={{ width: `${pct * 100}%` }} /></span>
            <span className="time">{fmt(left)}</span>
          </>
        ) : (
          <span className="start">⛽ {d.fuelCost}</span>
        )}
      </button>
    </Html>
  )
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
  const rot = d.kind === 'decor' ? 0 : facing(b, roads)
  return (
    <group
      position={[cx, 0, cz]}
      rotation-y={rot}
      onClick={(e) => {
        const s = useGame.getState()
        if (s.mode !== 'play' || e.delta > 6) return
        e.stopPropagation()
        s.tapBuilding(b.uid)
      }}
      onPointerOver={() => {
        if (useGame.getState().mode === 'play' && d.kind !== 'decor' && d.kind !== 'house') document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {d.kind !== 'decor' && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
          <planeGeometry args={[d.w * TILE - 0.1, d.h * TILE - 0.1]} />
          <meshStandardMaterial color="#e8dcc3" />
        </mesh>
      )}
      <BuildingModel def={d} />
    </group>
  )
}

function Roads() {
  const roadsList = useGame((s) => s.roads)
  const tiles = useMemo(() => {
    const set = new Set(roadsList)
    return roadsList.map((k) => {
      const [x, z] = k.split(',').map(Number)
      const n = DIRS.map(([dx, dz]) => set.has(`${x + dx},${z + dz}`))
      return { k, x, z, n }
    })
  }, [roadsList])

  return (
    <group>
      {tiles.map(({ k, x, z, n }) => {
        const [wx, wz] = toWorld(x, z)
        const [e, w, s, nn] = n
        const count = n.filter(Boolean).length
        const straightX = (e || w) && !s && !nn
        const straightZ = (s || nn) && !e && !w
        const half = TILE / 2
        return (
          <group key={k} position={[wx, 0, wz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.01} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial color="#5f646b" />
            </mesh>
            {/* Curbs on sides with no connecting road. */}
            {!e && <mesh position={[half - 0.12, 0.04, 0]}><boxGeometry args={[0.24, 0.08, TILE]} /><meshStandardMaterial color="#e8dcc3" /></mesh>}
            {!w && <mesh position={[-half + 0.12, 0.04, 0]}><boxGeometry args={[0.24, 0.08, TILE]} /><meshStandardMaterial color="#e8dcc3" /></mesh>}
            {!s && <mesh position={[0, 0.04, half - 0.12]}><boxGeometry args={[TILE, 0.08, 0.24]} /><meshStandardMaterial color="#e8dcc3" /></mesh>}
            {!nn && <mesh position={[0, 0.04, -half + 0.12]}><boxGeometry args={[TILE, 0.08, 0.24]} /><meshStandardMaterial color="#e8dcc3" /></mesh>}
            {straightX && [-0.5, 0.5].map((o) => (
              <mesh key={o} rotation-x={-Math.PI / 2} position={[o, 0.02, 0]}><planeGeometry args={[0.45, 0.07]} /><meshBasicMaterial color="#fafafa" /></mesh>
            ))}
            {straightZ && [-0.5, 0.5].map((o) => (
              <mesh key={o} rotation-x={-Math.PI / 2} position={[0, 0.02, o]}><planeGeometry args={[0.07, 0.45]} /><meshBasicMaterial color="#fafafa" /></mesh>
            ))}
            {count >= 3 && (
              <mesh rotation-x={-Math.PI / 2} position-y={0.015}><circleGeometry args={[0.18, 12]} /><meshBasicMaterial color="#ffd54f" /></mesh>
            )}
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
    const valid = canPlace({ roads, buildings }, placing, ox, oz)
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
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial color="#7ec850" />
      </mesh>
      {mode !== 'play' && <gridHelper args={[SIZE, GRID, '#4f8f2f', '#5f9f3f']} position-y={0.005} />}
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

export function World() {
  const buildings = useGame((s) => s.buildings)
  const roadsList = useGame((s) => s.roads)
  const roads = useMemo(() => new Set(roadsList), [roadsList])
  const now = useNow()
  return (
    <>
      <color attach="background" args={['#5aa83a']} />
      <hemisphereLight args={['#ffffff', '#6b8e4e', 0.7]} />
      <directionalLight
        castShadow
        position={[25, 40, 15]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      {/* Grass beyond the buildable lot. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[SIZE * 4, SIZE * 4]} />
        <meshStandardMaterial color="#5aa83a" />
      </mesh>
      <ResponsiveZoom />
      <Interaction />
      <Roads />
      {buildings.map((b) => (
        <Building key={b.uid} b={b} roads={roads} />
      ))}
      {buildings.map((b) => (
        <JobBadge key={b.uid} b={b} now={now} />
      ))}
      <TownCars />
    </>
  )
}
