import { useEffect, useMemo, useRef, useState } from 'react'
import { MapControls } from '@react-three/drei'
import { AnchorProjector } from './anchors'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Vector3 } from 'three'
import { create } from 'zustand'
import { useGame, canPlace, buyablePlots, lotSize, movable, type PlacedBuilding } from '../game/store'
import { TILE, PLOT, PLOT_MIN, PLOT_MAX, START_LAND, buildingDef, buildingLevel } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { rotateCurrent, setGhostTurn, turnOf } from '../game/placement'
import { mergeGroups, groupOf, groupTurn, groupScale, type MergeGroup } from '../game/merge'
import { MergeScale } from './mergeScale'
import { sfx } from '../lib/sound'
import { Clouds } from './Clouds'
import { DayNight } from './DayNight'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { townLook } from './look'
import { SeasonFx } from './SeasonFx'
import { glowMats } from './dayNight'
import { LightPool } from './BuildingModel'
import { TownCars } from './TownCars'
import { Townspeople } from './Townspeople'
import { Batch } from './Batch'
import { Manhole } from './BuildingDetail'
import { GrassTufts } from './Tufts'
import { Outskirts } from './Outskirts'
import { RoadWear, StreetProp, PROPS } from './Roadside'
import { toWorld, toTile, DIRS } from './grid'
import { grassTex, paverTex, drainTex, meadowTex } from './textures'
import { roadMat } from './weatherLook'
import { Weather } from './Weather'
import { layoutRoads } from './traffic/layout'
import { LAYER, decal } from './layers'
import { Ear } from './Ear'
import { WorldFx, PopGroup, usePops } from './WorldFx'

// The countryside ground: wide enough to never show its edge, an odd number of
// 16-unit repeats so its meadow texture lines up with the plots'.
const OUTER = 16 * 25
// Everything a town could ever own, centred on the origin like the start lot.
const ALL = (PLOT_MAX - PLOT_MIN + 1) * PLOT * TILE

// World centre of a land plot.
export const plotCenter = (px: number, pz: number) => toWorld(px * PLOT + (PLOT - 1) / 2, pz * PLOT + (PLOT - 1) / 2)

function Land() {
  const land = useGame((s) => (s.visiting ? (s.visiting.land ?? START_LAND) : s.land))
  const mode = useGame((s) => s.mode)
  const forSale = useMemo(() => (mode === 'expand' ? buyablePlots(land) : []), [land, mode])
  return (
    <group>
      {land.map((k) => {
        const [px, pz] = k.split(',').map(Number)
        const [cx, cz] = plotCenter(px, pz)
        return (
          <group key={k} position={[cx, 0, cz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={LAYER.land} receiveShadow>
              <planeGeometry args={[PLOT * TILE, PLOT * TILE]} />
              <meshStandardMaterial map={grassTex(PLOT / 4)} />
            </mesh>
            {mode !== 'play' && mode !== 'expand' && <gridHelper args={[PLOT * TILE, PLOT, '#4f8f2f', '#5f9f3f']} position-y={LAYER.grid} />}
          </group>
        )
      })}
      {forSale.map(([px, pz]) => {
        const [cx, cz] = plotCenter(px, pz)
        return (
          <mesh key={`${px},${pz}`} rotation-x={-Math.PI / 2} position={[cx, LAYER.grid, cz]}>
            <planeGeometry args={[PLOT * TILE - 0.6, PLOT * TILE - 0.6]} />
            <meshBasicMaterial color="#ffd54f" transparent opacity={0.35} depthWrite={false} {...decal()} />
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

// Middle of a merged block.
export const groupCenter = (g: Pick<MergeGroup, 'x' | 'z' | 'w' | 'h'>) => toWorld(g.x + (g.w - 1) / 2, g.z + (g.h - 1) / 2)

// A building being dragged in move mode: where it would land, and which of its
// tiles the pointer is holding.
type Drag = { uid: string; x: number; z: number; gx: number; gz: number }
const useDrag = create<{ drag: Drag | null }>(() => ({ drag: null }))

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()
// Tile under the pointer at ground level, even when the pointer is on a rooftop.
const groundTile = (e: ThreeEvent<PointerEvent>) => {
  const p = e.ray.intersectPlane(GROUND, hit)
  return p ? toTile(p.x, p.z) : toTile(e.point.x, e.point.z)
}

// Pick a building up. Letting go drops it there if it fits, or snaps it back.
// `quick` is a long press from normal play, which goes back to play once dropped.
function startDrag(b: PlacedBuilding, tile: [number, number], pointerId: number, quick = false) {
  useGame.getState().select(b.uid)
  useDrag.setState({ drag: { uid: b.uid, x: b.x, z: b.z, gx: tile[0] - b.x, gz: tile[1] - b.z } })
  const end = (e: PointerEvent) => {
    // A second finger tapping Rotate mustn't drop the building.
    if (e.pointerId !== pointerId) return
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    const d = useDrag.getState().drag
    useDrag.setState({ drag: null })
    if (quick) useGame.getState().setMode('play')
    if (!d || e.type === 'pointercancel' || (d.x === b.x && d.z === b.z)) return
    if (useGame.getState().moveBuilding(d.uid, d.x, d.z)) sfx.click()
    else sfx.error()
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}

// Holding a building in normal play picks it up. Moving the finger first pans the map instead.
const HOLD_MS = 450
const HOLD_SLOP = 10
// Set when a hold lifted a building, so letting go doesn't also count as a tap on it.
let held = false

// The press being watched; a building made of several meshes reports one press per mesh.
let holdPress: PointerEvent | null = null

function holdToMove(b: PlacedBuilding, e: ThreeEvent<PointerEvent>) {
  if (holdPress === e.nativeEvent) return
  holdPress = e.nativeEvent
  const tile = groundTile(e)
  const { pointerId, clientX, clientY } = e.nativeEvent
  const watch = {
    timer: 0,
    stop() {
      clearTimeout(watch.timer)
      window.removeEventListener('pointermove', watch.move)
      window.removeEventListener('pointerrawupdate' as 'pointermove', watch.move)
      window.removeEventListener('pointerup', watch.up)
      window.removeEventListener('pointercancel', watch.up)
    },
    move(m: PointerEvent) {
      if (m.pointerId === pointerId && Math.hypot(m.clientX - clientX, m.clientY - clientY) > HOLD_SLOP) watch.stop()
    },
    up(u: PointerEvent) {
      if (u.pointerId === pointerId) watch.stop()
    },
  }
  watch.timer = window.setTimeout(() => {
    watch.stop()
    const s = useGame.getState()
    if (s.mode !== 'play' || s.panel || s.visiting) return
    held = true
    navigator.vibrate?.(15)
    sfx.click()
    useGame.setState({ mode: 'move', placing: null })
    startDrag(b, tile, pointerId, true)
  }, HOLD_MS)
  // Raw updates aren't held back to the next frame, so a swipe cancels the hold even on a slow phone.
  window.addEventListener('pointermove', watch.move)
  window.addEventListener('pointerrawupdate' as 'pointermove', watch.move)
  window.addEventListener('pointerup', watch.up)
  window.addEventListener('pointercancel', watch.up)
}

const ONE: [number, number, number] = [1, 1, 1]

// `group` is set on the top-left building of a merged block: it stands in,
// scaled up, for the whole block. The others in the block draw nothing.
function Building({ b, roads, group }: { b: PlacedBuilding; roads: Set<string>; group?: MergeGroup }) {
  const d = buildingDef(b.def)
  const [cx, cz] = group ? groupCenter(group) : centerOf(b.def, b.x, b.z, b.rot)
  const turn = group ? groupTurn(group, roads) : turnOf(b, roads)
  const [sx, sy, sz] = group ? groupScale(group, turn) : [1, 1, 1]
  // Hidden while dragged away; the ghost shows where it would land.
  const away = useDrag((g) => g.drag?.uid === b.uid && (g.drag.x !== b.x || g.drag.z !== b.z))
  if (away) return null
  return (
    <group
      position={[cx, 0, cz]}
      rotation-y={(turn * Math.PI) / 2}
      onPointerDown={(e) => {
        const s = useGame.getState()
        if (s.visiting || e.button !== 0) return
        if (s.mode === 'play') {
          held = false
          if (movable(b.def) && !group) holdToMove(b, e)
          return
        }
        if (s.mode !== 'move') return
        e.stopPropagation()
        if (!movable(b.def)) return s.toast(`Tap the ${d.name.toLowerCase()} in play mode to clear it`)
        // A merged block can be picked to turn it, but only moves once split.
        if (group) return s.select(b.uid)
        startDrag(b, groundTile(e), e.pointerId)
      }}
      onClick={(e) => {
        const s = useGame.getState()
        // In move mode the tap already picked it up; don't let it fall through and deselect.
        if (s.mode === 'move' || held) {
          held = false
          return e.stopPropagation()
        }
        if (s.mode !== 'play' || s.visiting || e.delta > 6) return
        e.stopPropagation()
        s.tapBuilding(b.uid)
      }}
      onPointerOver={() => {
        const mode = useGame.getState().mode
        if (mode === 'move' && movable(b.def)) document.body.style.cursor = 'grab'
        else if (mode === 'play' && d.kind !== 'decor') document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {d.kind !== 'decor' && d.kind !== 'obstacle' && (
        <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot} receiveShadow>
          <planeGeometry args={[d.w * TILE * sx - 0.1, d.h * TILE * sz - 0.1]} />
          <meshStandardMaterial map={paverTex(d.w * sx, d.h * sz)} />
        </mesh>
      )}
      <group scale={[sx, sy, sz]}>
        <MergeScale.Provider value={group ? [sx, sy, sz] : ONE}>
          <PopGroup uid={b.uid}>
            <BuildingModel def={d} level={buildingLevel(b)} />
          </PopGroup>
        </MergeScale.Provider>
      </group>
    </group>
  )
}

// Raised sidewalk strip along a road edge with no connecting road.
function Sidewalk({ side, drain }: { side: 'e' | 'w' | 's' | 'n'; drain?: boolean }) {
  const half = TILE / 2
  const w = 0.4
  const along = side === 'e' || side === 'w'
  const pos: [number, number, number] =
    side === 'e' ? [half - w / 2, 0.04, 0] : side === 'w' ? [-half + w / 2, 0.04, 0]
    : side === 's' ? [0, 0.04, half - w / 2] : [0, 0.04, -half + w / 2]
  return (
    <group>
      <mesh position={pos} receiveShadow>
        <boxGeometry args={along ? [w, 0.08, TILE] : [TILE, 0.08, w]} />
        <meshStandardMaterial map={along ? paverTex(0.5, 2) : paverTex(2, 0.5)} />
      </mesh>
      {/* Kerbstones along the road edge, and a drain grate in the gutter. */}
      <mesh position={along ? [pos[0] - Math.sign(pos[0]) * (w / 2 - 0.03), 0.045, 0] : [0, 0.045, pos[2] - Math.sign(pos[2]) * (w / 2 - 0.03)]}>
        <boxGeometry args={along ? [0.06, 0.09, TILE] : [TILE, 0.09, 0.06]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      {drain && (
        <mesh rotation={[-Math.PI / 2, 0, along ? 0 : Math.PI / 2]} position={along ? [pos[0] - Math.sign(pos[0]) * (w / 2 + 0.06), LAYER.paint, 0.5] : [0.5, LAYER.paint, pos[2] - Math.sign(pos[2]) * (w / 2 + 0.06)]}>
          <planeGeometry args={[0.12, 0.3]} />
          <meshStandardMaterial map={drainTex()} {...decal()} />
        </mesh>
      )}
    </group>
  )
}

// Fire hydrant on the sidewalk.
function Hydrant({ side }: { side: 'e' | 'w' | 's' | 'n' }) {
  const at = TILE / 2 - 0.2
  const [x, z] = { e: [at, 0.6], w: [-at, -0.6], s: [-0.6, at], n: [0.6, -at] }[side]
  return (
    <group position={[x, 0.08, z]}>
      <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.24, 8]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.065, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0, 0.14, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.025, 0.025, 0.2, 6]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
    </group>
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
        <mesh key={o} rotation-x={-Math.PI / 2} position={across ? [off, LAYER.paint, o] : [o, LAYER.paint, off]}>
          <planeGeometry args={across ? [0.34, 0.16] : [0.16, 0.34]} />
          <meshBasicMaterial color="#f5f5f5" {...decal()} />
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
      {/* Above the kerb so the glow spills over the sidewalk too. */}
      <LightPool r={0.95} x={0.55} z={half - 0.5} y={0.09} />
    </group>
  )
}

// Lane paint along a tile: dashes down the middle, as on any two-way road and
// between the two lanes of each side of an avenue.
function Dashes({ alongX }: { alongX: boolean }) {
  return (
    <>
      {[-0.5, 0.5].map((o) => (
        <mesh key={o} rotation-x={-Math.PI / 2} position={alongX ? [o, LAYER.paint, 0] : [0, LAYER.paint, o]}>
          <planeGeometry args={alongX ? [0.45, 0.07] : [0.07, 0.45]} />
          <meshBasicMaterial color="#fafafa" {...decal()} />
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
        <mesh key={o} rotation-x={-Math.PI / 2} position={alongX ? [0, LAYER.paint, edge + o] : [edge + o, LAYER.paint, 0]}>
          <planeGeometry args={alongX ? [TILE, 0.06] : [0.06, TILE]} />
          <meshBasicMaterial color="#ffca28" {...decal()} />
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
    <mesh rotation-x={-Math.PI / 2} position={[dx * at + rx * lane, LAYER.paint, dz * at + rz * lane]}>
      <planeGeometry args={dx ? [0.08, 0.8] : [0.8, 0.08]} />
      <meshBasicMaterial color="#fafafa" {...decal()} />
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
  // Shared so rain and snow can change every road at once (weatherLook.ts).
  const asphalt = roadMat()

  return (
    <group>
      {tiles.map(({ key: k, x, z, arms, junction, oneWay, mate, xing }) => {
        const [wx, wz] = toWorld(x, z)
        const [e, w, s, nn] = arms
        const straightX = !junction && (e || w) && !s && !nn
        const straightZ = !junction && (s || nn) && !e && !w
        const avenue = oneWay >= 0
        const plain = (straightX || straightZ) && !xing.some(Boolean)
        // Lamps go on the outside edge of an avenue.
        const outer = avenue ? SIDES[mate ^ 1] : null
        return (
          <group key={k} position={[wx, 0, wz]}>
            <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <primitive object={asphalt} attach="material" dispose={null} />
            </mesh>
            {/* Drains and manholes only on plain straight stretches, clear of crossings. */}
            {SIDES.map((sd, i) => !arms[i] && <Sidewalk key={sd} side={sd} drain={plain && (x * 2 + z + i) % 4 === 0} />)}
            {(straightX || straightZ) && (x * 5 + z * 3) % 7 === 0 && <Hydrant side={straightX ? ((x + z) % 2 ? 'n' : 's') : ((x + z) % 2 ? 'w' : 'e')} />}
            {plain && (x * 3 + z * 7) % 5 === 1 && <Manhole x={straightX ? 0 : 0.45} z={straightX ? 0.45 : 0} />}
            {SIDES.map((sd, i) => xing[i] && <Crosswalk key={sd} side={sd} />)}
            {xing.map((on, i) => on && (oneWay < 0 || oneWay === i) && <StopLine key={i} side={i} />)}
            {/* Street lamps every few tiles along straight roads, alternating sides. */}
            {(straightX || straightZ) && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0 && (
              <StreetLamp side={straightX ? ((x + z) % 2 ? 's' : 'n') : ((x + z) % 2 ? 'e' : 'w')} />
            )}
            {/* A lamp lighting the corner where a side road meets the street. */}
            {junction && arms.filter(Boolean).length === 3 && <StreetLamp side={SIDES[arms.indexOf(false)]} />}
            {avenue && outer && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0 && <StreetLamp side={outer} />}
            <RoadWear kerbs={SIDES.filter((_, i) => !arms[i])} plain={plain} alongX={!!straightX} h={((x * 73 + z * 151) % 97) / 97} />
            {/* Sidewalk furniture on some straight stretches, on the side without a lamp. */}
            {plain && (x * 11 + z * 13) % 4 === 0 && (
              <StreetProp kind={PROPS[(x * 5 + z * 3) % PROPS.length]} side={straightX ? ((x + z) % 2 ? 'n' : 's') : ((x + z) % 2 ? 'w' : 'e')} at={-0.2} />
            )}
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
  const selected = useGame((s) => s.selected)
  const drag = useDrag((g) => g.drag)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const painting = useRef(false)
  // Whether the last press was a finger. Touch has no hover, so a tap previews instead of building.
  const touch = useRef(false)
  const controls = useThree((s) => s.controls) as { target: Vector3 } | null
  const roads = useGame((s) => s.roads)
  const buildings = useGame((s) => s.buildings)
  const land = useGame((s) => s.land)
  const roadSet = useMemo(() => new Set(roads), [roads])
  const pickedBlock = useMemo(() => (mode === 'move' && selected ? groupOf(buildings, selected) : undefined), [mode, selected, buildings])

  // R turns the building being placed or moved on desktop.
  useEffect(() => {
    if (mode !== 'place' && mode !== 'move') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement)) rotateCurrent()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  // Show the ghost mid-screen as soon as placing starts, so Rotate visibly turns it
  // even before the pointer reaches the town (and on phones, which never hover).
  useEffect(() => {
    if (mode !== 'place' || !placing || !controls) return
    setHover(toTile(controls.target.x, controls.target.z))
  }, [mode, placing, controls])

  const tileOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => toTile(e.point.x, e.point.z)

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const t = tileOf(e)
    if (drag) {
      const x = t[0] - drag.gx
      const z = t[1] - drag.gz
      if (x !== drag.x || z !== drag.z) useDrag.setState({ drag: { ...drag, x, z } })
      return
    }
    // A finger dragging across the town is panning; leave the ghost where it was.
    if (mode === 'place' && e.pointerType === 'touch') return
    if (!hover || hover[0] !== t[0] || hover[1] !== t[1]) setHover(t)
    if (painting.current && mode === 'road') useGame.getState().paintRoad(...t)
    if (painting.current && mode === 'bulldoze') useGame.getState().bulldoze(...t)
  }
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    touch.current = e.pointerType === 'touch'
    if (mode === 'move' && selected && e.button === 0) {
      // Grabbing the ground inside the picked building's lot drags it too.
      const b = buildings.find((o) => o.uid === selected)
      const t = tileOf(e)
      const [w, h] = b ? lotSize(b.def, b.rot) : [0, 0]
      if (pickedBlock) return
      if (b && t[0] >= b.x && t[0] < b.x + w && t[1] >= b.z && t[1] < b.z + h) startDrag(b, t, e.pointerId)
      return
    }
    if (mode !== 'road' && mode !== 'bulldoze') return
    if (e.button !== 0) return
    painting.current = true
    const t = tileOf(e)
    if (mode === 'road') useGame.getState().paintRoad(...t)
    else useGame.getState().bulldoze(...t)
  }
  const onUp = () => (painting.current = false)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Tapping open ground lets go of the picked building.
    if (mode === 'move' && e.delta <= 6 && !drag) return useGame.getState().select(null)
    if (mode !== 'place' || !placing || e.delta > 6) return
    let [x, z] = tileOf(e)
    const d = buildingDef(placing)
    const [w, h] = lotSize(placing, placeRot ?? undefined)
    if (touch.current) {
      // Phones: the first tap moves the ghost there; tapping the ghost builds it.
      const gx = hover ? hover[0] - Math.floor((w - 1) / 2) : NaN
      const gz = hover ? hover[1] - Math.floor((h - 1) / 2) : NaN
      if (!(x >= gx && x < gx + w && z >= gz && z < gz + h)) return setHover([x, z])
      ;[x, z] = hover!
    }
    // Hover tile is the footprint's centre; convert to its top-left corner.
    const ox = x - Math.floor((w - 1) / 2)
    const oz = z - Math.floor((h - 1) / 2)
    if (useGame.getState().placeBuilding(placing, ox, oz, placeRot ?? undefined)) {
      // Keep the new building picked so Rotate (and dragging) can still adjust it.
      const s = useGame.getState()
      const built = s.buildings[s.buildings.length - 1]
      useGame.setState({ mode: 'move', placing: null, selected: built.uid, again: s.coins >= d.price && !d.unique ? placing : null })
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
  } else if (pickedBlock) {
    // A picked merged block: highlight its whole footprint.
    const [cx, cz] = groupCenter(pickedBlock)
    ghost = (
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.05, cz]}>
        <planeGeometry args={[pickedBlock.w * TILE, pickedBlock.h * TILE]} />
        <meshBasicMaterial color="#ffd54f" transparent opacity={0.45} />
      </mesh>
    )
  } else if (mode === 'move' && selected) {
    const b = buildings.find((o) => o.uid === selected)
    if (b) {
      const d = buildingDef(b.def)
      const [w, h] = lotSize(b.def, b.rot)
      const x = drag?.uid === b.uid ? drag.x : b.x
      const z = drag?.uid === b.uid ? drag.z : b.z
      const moved = x !== b.x || z !== b.z
      const valid = !moved || canPlace({ roads, buildings, land }, b.def, x, z, b.rot, b.uid)
      const [cx, cz] = centerOf(b.def, x, z, b.rot)
      // Buildings that face the nearest road keep doing so at the new spot.
      const turn = turnOf({ def: b.def, x, z, rot: b.rot }, roadSet)
      ghost = (
        <group position={[cx, 0.02, cz]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
            <planeGeometry args={[w * TILE, h * TILE]} />
            <meshBasicMaterial color={!moved ? '#ffd54f' : valid ? '#66bb6a' : '#ef5350'} transparent opacity={0.45} />
          </mesh>
          {moved && (
            <group rotation-y={(turn * Math.PI) / 2}>
              <BuildingModel def={d} ghost valid={valid} level={buildingLevel(b)} />
            </group>
          )}
        </group>
      )
    }
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
        position-y={LAYER.base}
        receiveShadow
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => {
          painting.current = false
          // Keep the ghost while the mouse visits the Rotate button.
          if (mode !== 'place') setHover(null)
        }}
        onClick={onClick}
      >
        <planeGeometry args={[ALL, ALL]} />
        <meshStandardMaterial map={meadowTex(ALL / 16)} />
      </mesh>
      {ghost}
      <MapControls
        makeDefault
        enabled={!(mode === 'road' || mode === 'bulldoze' || drag)}
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
  const land = useGame((s) => (s.visiting ? (s.visiting.land ?? START_LAND) : s.land))
  const mode = useGame((s) => s.mode)
  const popping = usePops((s) => Object.keys(s.pops).join())
  // Rebuild the merged town only when something's footprint changes, not on every job timer.
  const layout = useMemo(
    () => [buildings.map((b) => `${b.uid}:${b.def}:${b.x}:${b.z}:${b.rot}:${b.level ?? 1}:${b.merge ?? ''}`).join(), roadsList.join(), land.join(), popping].join('/'),
    [buildings, roadsList, land, popping],
  )
  const merges = useMemo(() => mergeGroups(buildings), [layout]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <DayNight small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      {/* Countryside beyond the buildable lot. Its meadow lines up with the one under
          unbought plots (both repeat every 16 units from a half-repeat offset). */}
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.outer}>
        <planeGeometry args={[OUTER, OUTER]} />
        <meshStandardMaterial map={meadowTex(OUTER / 16)} />
      </mesh>
      <Outskirts land={land} roads={roadsList} small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      <ResponsiveZoom />
      <ExpandZoom />
      <Interaction />
      {/* Pieces move while building or dragging, so merging waits for plain play. */}
      <Batch version={layout} off={mode !== 'play'}>
        <Land />
        <GrassTufts land={land} roads={roadsList} buildings={buildings} />
        <Roads />
        {buildings.map((b) =>
          merges.owner.has(b.uid) && !merges.groups.has(b.uid) ? null : <Building key={b.uid} b={b} roads={roads} group={merges.groups.get(b.uid)} />,
        )}
      </Batch>
      <AnchorProjector />
      <Ear />
      <TownCars />
      <Townspeople />
      <WorldFx small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      <Clouds />
      <SeasonFx small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      <Weather small={Math.min(window.innerWidth, window.innerHeight) < 700} />
      <SkyEnv />
      <PostFx look={townLook} town tiltShift />
    </>
  )
}
