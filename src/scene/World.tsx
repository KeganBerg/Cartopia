import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Atmosphere } from './Atmosphere'
import { MapControls } from '@react-three/drei'
import { AnchorProjector, anchorEls } from './anchors'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { MeshStandardMaterial, Plane, Vector3, type TOUCH } from 'three'
import { create } from 'zustand'
import { useGame, buildPrice, canPlace, buyablePlots, lotSize, movable, type PlacedBuilding } from '../game/store'
import { TILE, PLOT, PLOT_MIN, PLOT_MAX, START_LAND, buildingDef, buildingLevel } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { rotateCurrent, setGhostTurn, turnOf } from '../game/placement'
import { mergeGroups, groupOf, groupTurn, groupScale, isLandmark, type MergeGroup } from '../game/merge'
import { VanguardTower, launchTower } from './Landmark'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'
import { sfx } from '../lib/sound'
import { Clouds } from './Clouds'
import { DayNight } from './DayNight'
import { TechnoLights } from './TechnoLights'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { townLook } from './look'
import { SeasonFx } from './SeasonFx'
import { TownCars } from './TownCars'
import { Townspeople } from './Townspeople'
import { Batch } from './Batch'
import { LampTone, Tint } from './CityTint'
import { lampPost, themeFor } from '../game/cityLook'
import { Manhole } from './BuildingDetail'
import { GrassTufts } from './Tufts'
import { Outskirts } from './Outskirts'
import { RoadWear, StreetProp, PROPS, Hydrant, StreetLamp, Sidewalk, CornerCurb, CornerFillet, ENDS, type End } from './Roadside'
import { toWorld, toTile, DIRS } from './grid'
import { grassTex, paverTex, meadowTex } from './textures'
import { cloudyGround, roadMat } from './weatherLook'
import { Weather } from './Weather'
import { SkyExtras } from './SkyExtras'
import { layoutRoads } from './traffic/layout'
import { LAYER, decal } from './layers'
import { Ear } from './Ear'
import { WorldFx, PopGroup, usePops } from './WorldFx'
import { helpable } from '../game/help'
import { helpBuilding } from '../lib/help'
import { hoursOf, seedOf } from '../game/hours'
import { VIEW, isFree, useFreeCam } from './freeCam'
import { FreeCam } from './FreeCam'
import { TutorialCamera } from './TutorialCamera'
import { TownTouch, townFingers } from './TownTouch'
import { tapOwnedBy } from './pick'
import { useLite } from '../lib/prefs'

// Meadow ground that drifting cloud shadows pass over, one per tiling.
const meadows = new Map<number, MeshStandardMaterial>()
const meadow = (repeat: number) => meadows.get(repeat) ?? meadows.set(repeat, cloudyGround(meadowTex(repeat))).get(repeat)!

// Every controls instance (a new one is made whenever the camera swaps) aims at
// the same shared point, so the view stays put across the swap.
const shareView = (c: { target: Vector3 } | null) => {
  if (c) c.target = VIEW
}

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
const dragging = () => useDrag.getState().drag !== null

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()
// Tile under the pointer at ground level, even when the pointer is on a rooftop.
const groundTile = (e: ThreeEvent<PointerEvent>) => {
  const p = e.ray.intersectPlane(GROUND, hit)
  return p ? toTile(p.x, p.z) : toTile(e.point.x, e.point.z)
}

// Pick a building up. Letting go drops it there if it fits, or snaps it back.
// It stays picked in move mode, so the edit bar (Rotate, Upgrade, Done) is
// still there after the mouse button or finger lifts.
function startDrag(b: PlacedBuilding, tile: [number, number], pointerId: number) {
  useGame.getState().select(b.uid)
  useDrag.setState({ drag: { uid: b.uid, x: b.x, z: b.z, gx: tile[0] - b.x, gz: tile[1] - b.z } })
  const end = (e: PointerEvent) => {
    // A second finger tapping Rotate mustn't drop the building.
    if (e.pointerId !== pointerId) return
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    const d = useDrag.getState().drag
    useDrag.setState({ drag: null })
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
    // A finger resting on a building while another pinches is zooming, not picking it up.
    if (s.mode !== 'play' || s.panel || s.visiting || townFingers() > 1) return
    held = true
    navigator.vibrate?.(15)
    sfx.click()
    // again: the "Build another" offer belongs to the last build, not this move.
    useGame.setState({ mode: 'move', placing: null, again: null })
    startDrag(b, tile, pointerId)
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
// `picked` (the building picked in Move) draws live, outside the merged town.
// `turn`: quarter turns to face its road (World works it out, so laying a road
// only re-renders the buildings that turn to face it).
type BuildingProps = { b: PlacedBuilding; turn: number; group?: MergeGroup; picked?: boolean; city?: string }

// Starting or collecting a job swaps every building object, but none of that
// shows in the model. Re-rendering a whole town of models at once is what made
// Collect All stall phones, so a building only re-renders when its lot or look changes.
const sameLook = (a: PlacedBuilding, b: PlacedBuilding) =>
  a.uid === b.uid && a.def === b.def && a.x === b.x && a.z === b.z && a.rot === b.rot && a.level === b.level && a.merge === b.merge && a.mturn === b.mturn && a.tint === b.tint
export const sameBuilding = (p: BuildingProps, n: BuildingProps) => p.turn === n.turn && p.city === n.city && p.group === n.group && p.picked === n.picked && sameLook(p.b, n.b)

const Building = memo(BuildingLot, sameBuilding)

function BuildingLot({ b, turn, group, picked, city }: BuildingProps) {
  const d = buildingDef(b.def)
  const [cx, cz] = group ? groupCenter(group) : centerOf(b.def, b.x, b.z, b.rot)
  const [sx, sy, sz] = group ? groupScale(group, turn) : [1, 1, 1]
  // Four max-level houses in a square are a landmark built for a 2x2 lot, not a scaled-up house.
  const mark = group && isLandmark(group)
  const k = mark ? group.cols / 2 : 1
  // Hidden while dragged away; the ghost shows where it would land.
  const away = useDrag((g) => g.drag?.uid === b.uid && (g.drag.x !== b.x || g.drag.z !== b.z))
  if (away) return null
  return (
    <group
      position={[cx, 0, cz]}
      rotation-y={(turn * Math.PI) / 2}
      userData={{ hours: { seed: seedOf(b.uid), kind: hoursOf(b.def) }, noBatch: !!picked }}
      onPointerDown={(e) => {
        const s = useGame.getState()
        if (s.visiting || e.button !== 0) return
        // The building actually under the finger takes the press, not a neighbour whose faint
        // shadow or glow sits in front of it (its own handler runs further along the ray).
        if (!tapOwnedBy(e.intersections, e.eventObject)) return
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
        if (!tapOwnedBy(e.intersections, e.eventObject)) return
        // In move mode the tap already picked it up; don't let it fall through and deselect.
        if (s.mode === 'move' || held) {
          held = false
          return e.stopPropagation()
        }
        // In a friend's town, tapping a shop that's asking for help helps it.
        const ask = s.visiting && s.mode === 'play' && e.delta <= 6 ? anchorEls.get(b.uid)?.querySelector('.badge-help') : null
        if (ask) {
          e.stopPropagation()
          return void helpBuilding(b.uid, ask)
        }
        if (s.mode !== 'play' || s.visiting || e.delta > 6) return
        e.stopPropagation()
        if (mark) launchTower(b.uid)
        s.tapBuilding(b.uid)
      }}
      onPointerOver={() => {
        const mode = useGame.getState().mode
        if (mode === 'move' && movable(b.def)) document.body.style.cursor = 'grab'
        else if (mode === 'play' && (!useGame.getState().visiting || (d.kind !== 'decor' && helpable(d)))) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {d.kind !== 'decor' && d.kind !== 'obstacle' && (
        <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot} receiveShadow>
          <planeGeometry args={[d.w * TILE * sx - 0.1, d.h * TILE * sz - 0.1]} />
          <meshStandardMaterial map={paverTex(d.w * sx, d.h * sz)} />
        </mesh>
      )}
      <group scale={mark ? [k, k, k] : [sx, sy, sz]}>
        <MergeScale.Provider value={mark ? [k, k, k] : group ? [sx, sy, sz] : ONE}>
          <PopGroup uid={b.uid}>
            <KeepShapes limit={limitFor(d)}>
              <Tint theme={themeFor(b.tint, city, d.kind === 'decor')}>
                {mark ? <VanguardTower uid={b.uid} /> : <BuildingModel def={d} level={buildingLevel(b)} />}
              </Tint>
            </KeepShapes>
          </PopGroup>
        </MergeScale.Provider>
      </group>
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
// A tile's corners in CornerCurb turn order: [east/west arm, south/north arm, diagonal step].
const CORNERS: [number, number, number, number][] = [[0, 2, 1, 1], [0, 3, 1, -1], [1, 3, -1, -1], [1, 2, -1, 1]]
const SIDE_INDEX = { e: 0, w: 1, s: 2, n: 3 } as const
// What the sidewalk on side `i` meets at each end.
const endsOf = (arms: boolean[], xing: boolean[], i: number): [End, End] =>
  ENDS[SIDES[i]].map((sd) => {
    const j = SIDE_INDEX[sd]
    return !arms[j] ? 'corner' : xing[j] ? 'ramp' : 'open'
  }) as [End, End]

type Tile = ReturnType<typeof layoutRoads>['tiles'] extends Map<string, infer T> ? T & { xing: boolean[]; corners: (string | null)[] } : never
// Painting one road tile changes only it and its neighbours; the rest skip re-rendering.
const sameTile = (a: { t: Tile; asphalt: MeshStandardMaterial }, b: { t: Tile; asphalt: MeshStandardMaterial }) =>
  a.asphalt === b.asphalt &&
  a.t.x === b.t.x &&
  a.t.z === b.t.z &&
  a.t.junction === b.t.junction &&
  a.t.oneWay === b.t.oneWay &&
  a.t.mate === b.t.mate &&
  a.t.arms.join() === b.t.arms.join() &&
  a.t.xing.join() === b.t.xing.join() &&
  a.t.corners.join() === b.t.corners.join()

const RoadTile = memo(function RoadTile({ t, asphalt }: { t: Tile; asphalt: MeshStandardMaterial }) {
  const { x, z, arms, junction, oneWay, mate, xing, corners } = t
  const [wx, wz] = toWorld(x, z)
  const [e, w, s, nn] = arms
  const straightX = !junction && (e || w) && !s && !nn
  const straightZ = !junction && (s || nn) && !e && !w
  const avenue = oneWay >= 0
  const plain = (straightX || straightZ) && !xing.some(Boolean)
  // Lamps go on the outside edge of an avenue.
  const outer = avenue ? SIDES[mate ^ 1] : null
  return (
    <group position={[wx, 0, wz]}>
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.lot} receiveShadow>
        <planeGeometry args={[TILE, TILE]} />
        <primitive object={asphalt} attach="material" dispose={null} />
      </mesh>
      {/* Drains and manholes only on plain straight stretches, clear of crossings. */}
      {SIDES.map((sd, i) => !arms[i] && <Sidewalk key={sd} side={sd} ends={endsOf(arms, xing, i)} drain={plain && (x * 2 + z + i) % 4 === 0} />)}
      {corners.map((c, i) => (c === 'curb' ? <CornerCurb key={i} turn={i} /> : c === 'fillet' ? <CornerFillet key={i} turn={i} /> : null))}
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
}, sameTile)

function Roads() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const tiles = useMemo(() => {
    const { tiles: all } = layoutRoads(roadsList)
    return [...all.values()].map((t) => {
      const near = DIRS.map(([dx, dz]) => all.get(`${t.x + dx},${t.z + dz}`))
      // Zebra crossings where a road meets an intersection.
      const xing = near.map((n) => !t.junction && !!n?.junction)
      // Corners, south-east round to south-west (CornerCurb turns), as [east/west, south/north] arms.
      const corners = CORNERS.map(([a, b, dx, dz]) => {
        if (!t.arms[a] && !t.arms[b]) return 'fillet'
        // Both roads lead off and the block between them isn't road: round the sidewalk off.
        if (t.arms[a] && t.arms[b] && !all.has(`${t.x + dx},${t.z + dz}`)) return 'curb'
        return null
      })
      return { ...t, xing, corners }
    })
  }, [roadsList])
  // Shared so rain and snow can change every road at once (weatherLook.ts).
  const asphalt = roadMat()

  return (
    <group>
      {tiles.map((t) => (
        <RoadTile key={t.key} t={t} asphalt={asphalt} />
      ))}
    </group>
  )
}


// No touch gesture: MapControls leaves fingers alone.
const NO_TOUCH = { ONE: -1 as TOUCH, TWO: -1 as TOUCH }

function Interaction() {
  const mode = useGame((s) => s.mode)
  const placing = useGame((s) => s.placing)
  const placeRot = useGame((s) => s.placeRot)
  // Placing from the inventory: the stored building's level, so the ghost shows it as it is.
  const storedLevel = useGame((s) => {
    const b = s.placingStored ? s.stored?.find((o) => o.uid === s.placingStored) : undefined
    return b ? buildingLevel(b) : undefined
  })
  const selected = useGame((s) => s.selected)
  const drag = useDrag((g) => g.drag)
  const free = useFreeCam((f) => f.on)
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
    const fromStore = useGame.getState().placingStored
    if (fromStore) {
      if (useGame.getState().placeStored(fromStore, ox, oz, placeRot ?? undefined)) useGame.setState({ mode: 'move', placing: null, placingStored: null, selected: fromStore, again: null })
      return
    }
    if (useGame.getState().placeBuilding(placing, ox, oz, placeRot ?? undefined)) {
      // Keep the new building picked so Rotate (and dragging) can still adjust it.
      const s = useGame.getState()
      const built = s.buildings[s.buildings.length - 1]
      useGame.setState({ mode: 'move', placing: null, selected: built.uid, again: !d.unique && s.coins >= buildPrice(s, placing).coins && s.bucks >= buildPrice(s, placing).bucks ? placing : null })
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
          <BuildingModel def={d} ghost valid={valid} level={storedLevel} />
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
        <primitive object={meadow(ALL / 16)} attach="material" dispose={null} />
      </mesh>
      {ghost}
      <MapControls
        ref={shareView}
        makeDefault
        // The free view steers itself (FreeCam.tsx); these stay in charge of the bird's-eye view.
        enabled={!(free || mode === 'road' || mode === 'bulldoze' || drag)}
        enableRotate={false}
        minZoom={12}
        maxZoom={90}
        screenSpacePanning={false}
        // Fingers are TownTouch's; these keep the mouse and trackpad.
        touches={NO_TOUCH}
      />
      <TownTouch enabled={!(free || mode === 'road' || mode === 'bulldoze' || drag)} busy={dragging} />
    </>
  )
}

// Pick a zoom that frames a similar slice of town on any screen size.
function ResponsiveZoom() {
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  // Only when the screen changes size: coming back from the free view keeps the player's zoom.
  const last = useRef('')
  useEffect(() => {
    if (isFree(camera) || last.current === `${width}x${height}`) return
    last.current = `${width}x${height}`
    camera.zoom = Math.min(38, Math.max(18, Math.sqrt(width * height) / 24))
    camera.updateProjectionMatrix()
  }, [camera, width, height])
  return null
}

// Pull the camera back while buying land so the For Sale signs are in view.
function ExpandZoom() {
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  const controls = useThree((s) => s.controls) as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null
  const mode = useGame((s) => s.mode)
  const saved = useRef<number | null>(null)
  useEffect(() => {
    // Read the live camera: leaving the free view for land mode swaps it back in this same commit.
    const camera = get().camera
    if (isFree(camera)) return
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
  }, [mode, camera, controls, get])
  return null
}

// Where each building stands and how it looks: everything about the town's
// buildings that shows, leaving out job timers.
export const shapeOf = (buildings: PlacedBuilding[]) =>
  buildings.map((b) => `${b.uid}:${b.def}:${b.x}:${b.z}:${b.rot}:${b.level ?? 1}:${b.merge ?? ''}:${b.mturn ?? ''}:${b.tint ?? ''}`).join()

// World re-renders when the picked building or the town's layout
// changes. Everything that doesn't depend on those is built once here and handed
// back as the same elements each time, so React skips it: on a big town, re-running
// the roads, outskirts, cars and effects on every mode switch (or every panel the
// HUD opens) cost a phone hundreds of milliseconds.
const small = () => Math.min(window.innerWidth, window.innerHeight) < 700

export const World = memo(function World() {
  // Collect All starts or collects every job at once, which swaps the whole
  // buildings array. The town only re-renders when its shape changes.
  const shape = useGame((s) => shapeOf((s.visiting ?? s).buildings))
  const buildings = useMemo(() => {
    const s = useGame.getState()
    return (s.visiting ?? s).buildings
  }, [shape]) // eslint-disable-line react-hooks/exhaustive-deps
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const roads = useMemo(() => new Set(roadsList), [roadsList])
  const land = useGame((s) => (s.visiting ? (s.visiting.land ?? START_LAND) : s.land))
  const popping = usePops((s) => Object.keys(s.pops).join())
  const free = useFreeCam((f) => f.on)
  // Saver draws the effects at their phone-sized counts on every screen.
  const lite = useLite()
  // Rebuild the merged town only when something's footprint changes, not on every job timer.
  const merges = useMemo(() => mergeGroups(buildings), [buildings])
  const turns = useMemo(
    () => buildings.map((b) => {
      const group = merges.groups.get(b.uid)
      return group ? groupTurn(group, roads) : turnOf(b, roads)
    }),
    [buildings, merges, roads],
  )
  // The building picked in Move draws live; the rest stays merged.
  const picked = useGame((s) => (s.mode === 'move' ? s.selected : null))
  // City look (Menu > Town): a friend's town is drawn without the player's own theme.
  const city = useGame((s) => (s.visiting ? undefined : s.cityTheme))
  const post = useGame((s) => lampPost(s.lights))
  const fixed = useMemo(
    () => ({
      before: (
        <>
          <DayNight small={small()} />
          <LampTone />
          <TechnoLights />
          {/* Countryside beyond the buildable lot. Its meadow lines up with the one under
              unbought plots (both repeat every 16 units from a half-repeat offset). */}
          <mesh rotation-x={-Math.PI / 2} position-y={LAYER.outer}>
            <planeGeometry args={[OUTER, OUTER]} />
            <primitive object={meadow(OUTER / 16)} attach="material" dispose={null} />
          </mesh>
        </>
      ),
      controls: (
        <>
          <ResponsiveZoom />
          <ExpandZoom />
          <TutorialCamera />
          <Interaction />
        </>
      ),
      land: <Land />,
      roads: <Roads />,
      after: (
        <>
          <AnchorProjector />
          <Ear />
          <TownCars />
          <Townspeople />
          <WorldFx small={lite || small()} />
        </>
      ),
      sky: (
        <>
          <SeasonFx small={lite || small()} />
          <Weather small={lite || small()} />
          <Atmosphere />
          <SkyExtras />
          <SkyEnv />
          <FreeCam />
        </>
      ),
    }),
    [],
  )
  const outskirts = useMemo(() => <Outskirts land={land} roads={roadsList} small={small()} />, [land, roadsList])
  const tufts = useMemo(() => <GrassTufts land={land} roads={roadsList} buildings={buildings} />, [land, roadsList, buildings])
  return (
    <>
      {fixed.before}
      {outskirts}
      {fixed.controls}
      {/* Ground and buildings merge separately, and only what changed is merged
          again (see Batch): laying road re-merges the road's patch of ground. */}
      <Batch version={`${roadsList.join()}/${land.join()}/${shape}/${post}`} cell={24} freeze>
        {fixed.land}
        {tufts}
        {fixed.roads}
      </Batch>
      <Batch version={`${shape}/${turns.join('')}/${popping}|${picked ?? ''}|${city ?? ''}|${post}`} cell={24} freeze>
        {buildings.map((b, i) =>
          merges.owner.has(b.uid) && !merges.groups.has(b.uid) ? null : <Building key={b.uid} b={b} turn={turns[i]} group={merges.groups.get(b.uid)} picked={b.uid === picked} city={city} />,
        )}
      </Batch>
      {fixed.after}
      {/* The free view's sky draws its own clouds; these puffs hang at camera height there. */}
      {!free && <Clouds />}
      {fixed.sky}
      <PostFx look={townLook} town tiltShift={!free} />
    </>
  )
})
