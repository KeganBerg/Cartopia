import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Color, Matrix4, Object3D, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { useGame } from '../game/store'
import { START_LAND, buildingDef } from '../game/data'
import { buildWalkGraph, findPath, pedestrianCrossings, stepsFor, transit, sideOf, SIDES, type Pt, type Step, type WalkGraph, type WalkNode } from '../game/walkGraph'
import { anchors } from './anchors'
import { liveTraffic, crossingSignal } from './traffic/live'
import { useThought } from '../game/thoughts'
import { SEASON } from './season'
import { dayPhase, nightAmount } from './dayNight'

// Townspeople: little figures like the race crowd who live in the houses and
// walk the sidewalks to grab a pizza, browse the showroom, sit on a park bench
// or look at the fountain, then head home. Everything is drawn with a handful
// of instanced meshes and the count is capped, so phones stay smooth.
// Some go jogging or walk the dog, the town gets busier as you level up, and
// tapping someone shows a thought bubble with what they're up to.

const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
const MAX_PEOPLE = SMALL ? 16 : 36
const PER_HOUSE = 2
// Extra residents as the town levels up: one more for every two levels.
const extraPeople = (level: number) => Math.min(10, Math.floor(level / 2))
const LEG = 0.24
// Figures are modelled at race-crowd proportions and drawn a little bigger so they read from the town camera.
const SCALE = 1.3

const SHIRTS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#ff7043', '#fafafa', '#26c6da', '#ec407a', '#5c6bc0']
const PANTS = ['#37474f', '#1565c0', '#5d4037', '#212121', '#78909c', '#283593']
const SKIN = ['#f5d0b5', '#e0ac8a', '#c68863', '#8d5a3b', '#5c3a24', '#f1c27d']
const HAIR = ['#3e2723', '#212121', '#6d4c41', '#fbc02d', '#bf360c', '#9e9e9e']
const BEANIES = ['#d32f2f', '#1976d2', '#388e3c', '#fbc02d', '#7b1fa2']

const NAMES = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Quinn', 'Avery', 'Rowan', 'Skyler', 'Drew', 'Kai', 'Robin', 'Charlie', 'Frankie', 'Jesse', 'Remy', 'Sage']
const DOGS = ['Biscuit', 'Rocket', 'Pepper', 'Daisy', 'Turbo', 'Maple', 'Nugget', 'Scout']
const DOG_COATS = ['#8d6e63', '#f5f5f5', '#3e2723', '#d4a056', '#a1887f', '#212121']

// What people carry out of each shop: size and colour of a little box in their
// hands, and how a thought bubble describes taking it home.
const ITEMS: Record<string, { size: [number, number, number]; color: string; emoji: string; thing: string }> = {
  pizza: { size: [0.22, 0.04, 0.22], color: '#fff3e0', emoji: '🍕', thing: 'a pizza' },
  donut: { size: [0.18, 0.07, 0.13], color: '#f8bbd0', emoji: '🍩', thing: 'a box of donuts' },
  burger: { size: [0.12, 0.15, 0.08], color: '#c8a165', emoji: '🍔', thing: 'burgers' },
  icecream: { size: [0.06, 0.15, 0.06], color: '#f48fb1', emoji: '🍦', thing: 'an ice cream' },
  diner: { size: [0.15, 0.09, 0.11], color: '#eceff1', emoji: '🥡', thing: 'takeout' },
  gas: { size: [0.06, 0.12, 0.06], color: '#29b6f6', emoji: '🥤', thing: 'a cold drink' },
  cinema: { size: [0.09, 0.13, 0.09], color: '#e53935', emoji: '🍿', thing: 'leftover popcorn' },
  bowling: { size: [0.11, 0.11, 0.11], color: '#6a1b9a', emoji: '🎳', thing: 'their bowling ball' },
  motel: { size: [0.17, 0.13, 0.06], color: '#795548', emoji: '🧳', thing: 'their suitcase' },
  coffee: { size: [0.06, 0.1, 0.06], color: '#fafafa', emoji: '☕', thing: 'a coffee' },
  tacos: { size: [0.14, 0.05, 0.1], color: '#ffca28', emoji: '🌮', thing: 'tacos' },
  market: { size: [0.16, 0.14, 0.1], color: '#d7a86e', emoji: '🛒', thing: 'groceries' },
  hotdog: { size: [0.12, 0.04, 0.05], color: '#e0a052', emoji: '🌭', thing: 'a hot dog' },
}

// Thought bubbles: what someone is off to do, and what they're doing when they get there.
const SHOP_THOUGHTS: Record<string, [string, string]> = {
  pizza: ['🍕', 'grabbing a pizza'], donut: ['🍩', 'getting donuts'], burger: ['🍔', 'getting a burger'],
  icecream: ['🍦', 'getting ice cream'], diner: ['🥞', 'heading to the diner'], gas: ['🥤', 'grabbing a cold drink'],
  cinema: ['🍿', 'catching a movie'], bowling: ['🎳', 'going bowling'], motel: ['🧳', 'checking in at the motel'],
  carwash: ['🧽', 'checking out the car wash'], rescue: ['🔧', "dropping by Rusty's"], tires: ['🛞', 'asking about tires'],
  parts: ['🔩', 'picking up parts'], crew: ['🤝', 'hanging out at the Crew House'], tuner: ['🔩', 'browsing the tuner shop'], stadium: ['🏁', 'going to the speedway'],
  coffee: ['☕', 'grabbing a coffee'], tacos: ['🌮', 'getting tacos'], lube: ['🛢', 'booking an oil change'], arcade: ['🕹️', 'chasing a high score'],
  bodyshop: ['🎨', 'picking a new paint colour'], market: ['🛒', 'doing the grocery run'], firehouse: ['🚒', 'visiting the firefighters'],
  police: ['👮', 'dropping by the police station'], parkade: ['🅿️', 'fetching the car from the garage'],
}
const PARK_GO: Record<string, [string, string]> = {
  bench: ['🪑', 'heading for a bench'], fountain: ['⛲', 'going to see the fountain'], pond: ['🦆', 'going to see the ducks'],
  flowers: ['🌷', 'going to smell the flowers'], tree: ['🌳', 'taking a walk in the park'], palm: ['🌴', 'taking a walk in the park'],
  statue: ['🏆', 'going to see the golden car'], pine: ['🌲', 'taking a walk in the park'], picnic: ['🧺', 'off for a picnic'],
  busstop: ['🚌', 'catching the bus'], hotdog: ['🌭', 'getting a hot dog'], flagpole: ['🚩', 'going to see the town flag'],
  arch: ['🏁', 'taking a photo at the finish line'], playground: ['🛝', 'heading to the playground'], gazebo: ['🎶', 'going to the gazebo'],
  clocktower: ['🕰️', 'meeting a friend at the clock tower'],
}
const PARK_AT: Record<string, [string, string]> = {
  bench: ['🪑', 'resting on the bench'], fountain: ['⛲', 'watching the fountain'], pond: ['🦆', 'watching the ducks'],
  flowers: ['🌷', 'smelling the flowers'], tree: ['🌳', 'enjoying the shade'], palm: ['🌴', 'enjoying the shade'],
  statue: ['🏆', 'admiring the golden car'], pine: ['🌲', 'enjoying the shade'], picnic: ['🧺', 'having a picnic'],
  busstop: ['🚌', 'waiting for the bus'], hotdog: ['🌭', 'eating a hot dog'], flagpole: ['🚩', 'saluting the town flag'],
  arch: ['📸', 'posing under the finish line'], playground: ['🛝', 'playing on the swings'], gazebo: ['🎶', 'listening to the band'],
  clocktower: ['🕰️', 'waiting by the clock tower'],
}

// Where to stand at each decoration, as a distance from its middle.
const SPOT: Record<string, number> = {
  bench: 0.06, fountain: 0.98, flowers: 0.86, tree: 0.5, palm: 0.5, statue: 0.78, lamp: 0.45, billboard: 0.7,
  pine: 0.7, picnic: 0.45, busstop: -0.22, hotdog: 0.5, flagpole: 0.6, arch: 0.4, gazebo: 0.25, clocktower: 0.8,
}
// How long people linger, in seconds.
const LINGER: Record<string, [number, number]> = {
  bench: [10, 24], fountain: [5, 12], statue: [4, 9], pond: [6, 14],
  picnic: [12, 26], busstop: [8, 18], hotdog: [4, 8], gazebo: [8, 18], playground: [10, 22], clocktower: [4, 9],
}
const PARKS = new Set(['bench', 'fountain', 'flowers', 'tree', 'palm', 'statue', 'pond', 'pine', 'picnic', 'busstop', 'hotdog', 'flagpole', 'arch', 'gazebo', 'clocktower'])
// Big decorations people walk up to, like the duck pond.
const BIG_PARKS = new Set(['pond', 'playground'])
// Seats: benches and the bus stop face out the front; at a picnic table people face the table.
const SEATS: Record<string, 'out' | 'in'> = { bench: 'out', busstop: 'out', picnic: 'in' }

type Kind = 'shop' | 'browse' | 'friend' | 'park' | 'home' | 'jog'
type Dest = { kind: Kind; key: string; def: string }
type Person = {
  id: string
  type: 'walker' | 'jogger' | 'dog'
  name: string
  dogName: string
  dogPos: Pt
  dogHeading: number
  home: string // building uid
  at: string // graph node key where they last stopped
  pos: Pt
  heading: number
  face: number | null // heading to turn to while lingering
  speed: number
  stride: number
  state: 'inside' | 'walk' | 'linger'
  sit: boolean
  timer: number
  waited: number
  steps: Step[]
  si: number
  crossing: string | null
  dest: Dest | null
  outings: number // stops on this trip out
  item: string | null
  colors: { shirt: string; pants: string; skin: string; hair: string; dog: string }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const hash = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
const nodePos = (n: WalkNode): Pt => (n.kind === 'v' ? n.pos : n.center)

function person(id: string, home: string, pos: Pt): Person {
  const h = hash(id)
  // About one in six jogs and one in six walks a dog.
  const type = h % 6 === 0 ? 'jogger' : h % 6 === 1 ? 'dog' : 'walker'
  return {
    id, type, name: NAMES[(h >> 4) % NAMES.length], dogName: DOGS[(h >> 7) % DOGS.length],
    dogPos: [...pos], dogHeading: 0,
    home, at: `b${home}`, pos: [...pos], heading: 0, face: null,
    speed: type === 'jogger' ? rand(1.5, 1.8) : rand(0.65, 0.9), stride: rand(0, 6),
    state: 'inside', sit: false, timer: rand(0.5, 10), waited: 0,
    steps: [], si: 0, crossing: null, dest: null, outings: 0, item: null,
    colors: {
      shirt: SHIRTS[h % SHIRTS.length], pants: PANTS[(h >> 3) % PANTS.length],
      skin: SKIN[(h >> 6) % SKIN.length], hair: (SEASON === 'winter' ? BEANIES : HAIR)[(h >> 9) % 5],
      dog: DOG_COATS[(h >> 11) % DOG_COATS.length],
    },
  }
}

type Places = ReturnType<typeof destinations>
type Ctx = { graph: WalkGraph; places: Places; dirty: { current: boolean } }

// Places worth walking to, sorted by what kind of outing they make.
function destinations(g: WalkGraph) {
  const shops: Dest[] = []
  const browse: Dest[] = []
  const parks: Dest[] = []
  const houses: Dest[] = []
  // Street corners, for joggers to run to.
  const corners: Dest[] = [...g.byKey.keys()].filter((k) => k[0] === 'v').map((key) => ({ kind: 'jog', key, def: '' }))
  for (const n of g.nodes) {
    if (n.kind === 'b') {
      const kind = buildingDef(n.def).kind
      const d = (k: Kind): Dest => ({ kind: k, key: `b${n.uid}`, def: n.def })
      if (kind === 'business' || kind === 'gas' || kind === 'parts') {
        // Food is the big draw, so it goes in twice.
        shops.push(d('shop'))
        if (ITEMS[n.def] && n.def !== 'motel') shops.push(d('shop'))
      } else if (kind === 'showroom' || kind === 'garage') browse.push(d('browse'))
      else if (kind === 'house') houses.push(d('friend'))
      else if (BIG_PARKS.has(n.def)) parks.push(d('park'), d('park'))
    } else if (n.kind === 't' && n.decor && PARKS.has(n.decor)) {
      parks.push({ kind: 'park', key: `t${n.tile[0]},${n.tile[1]}`, def: n.decor })
    }
  }
  return { shops, browse, parks, houses, corners }
}

export function Townspeople() {
  const roadsList = useGame((s) => (s.visiting ?? s).roads)
  const buildings = useGame((s) => (s.visiting ?? s).buildings)
  const land = useGame((s) => (s.visiting ? (s.visiting.land ?? START_LAND) : s.land))
  const visitKey = useGame((s) => s.visiting?.ownerId ?? 'home')
  const level = useGame((s) => (s.visiting ?? s).level)
  const graph = useMemo(() => buildWalkGraph(new Set(roadsList), buildings, land), [roadsList, buildings, land])
  const places = useMemo(() => destinations(graph), [graph])
  const people = useRef<Person[]>([])
  const colorsDirty = useRef(true)

  const torso = useRef<InstancedMesh>(null)
  const head = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const items = useRef<InstancedMesh>(null)
  const dogBody = useRef<InstancedMesh>(null)
  const dogHead = useRef<InstancedMesh>(null)
  const hits = useRef<InstancedMesh>(null)

  // Two people per house plus a few more as the town levels up (or a few
  // visitors in a town with no houses yet).
  // People who already exist keep walking; anyone mid-walk re-plans on the new streets.
  useEffect(() => {
    const homes = graph.nodes.filter((n): n is Extract<WalkNode, { kind: 'b' }> => n.kind === 'b' && buildingDef(n.def).kind === 'house')
    const fallback = graph.nodes.find((n): n is Extract<WalkNode, { kind: 'b' }> => n.kind === 'b')
    const wanted: { id: string; home: Extract<WalkNode, { kind: 'b' }> }[] = []
    if (homes.length) {
      for (let i = 0; i < PER_HOUSE; i++) for (const h of homes) wanted.push({ id: `${visitKey}:${h.uid}:${i}`, home: h })
      for (let i = 0; i < extraPeople(level); i++) {
        const h = homes[i % homes.length]
        wanted.push({ id: `${visitKey}:${h.uid}:${PER_HOUSE + Math.floor(i / homes.length)}`, home: h })
      }
    } else if (fallback) {
      for (let i = 0; i < 4; i++) wanted.push({ id: `${visitKey}:${fallback.uid}:${i}`, home: fallback })
    }
    const old = new Map(people.current.map((p) => [p.id, p]))
    people.current = wanted.slice(0, MAX_PEOPLE).map(({ id, home }) => {
      const p = old.get(id) ?? person(id, home.uid, home.center)
      if (p.state === 'walk') replan(p)
      return p
    })
    colorsDirty.current = true
    for (const k of [...pedestrianCrossings.keys()]) pedestrianCrossings.delete(k)

    // Re-route someone who was walking when the town changed: from wherever
    // they stand now to the same place, or home if that's gone.
    function replan(p: Person) {
      leaveCrossing(p)
      const start = nearestNode(graph, p.pos)
      const goal = graph.byKey.get(p.dest?.key ?? '') ?? graph.byKey.get(`b${p.home}`)
      const route = start != null && goal != null ? findPath(graph, start, goal) : null
      if (!route) {
        // Nowhere to go: pop indoors at home.
        p.state = 'inside'
        p.at = `b${p.home}`
        p.timer = rand(2, 8)
        return
      }
      if (graph.byKey.get(p.dest?.key ?? '') == null) p.dest = { kind: 'home', key: `b${p.home}`, def: 'house' }
      p.steps = stepsFor(graph, route, p.pos)
      p.si = 0
    }
  }, [graph, visitKey, level])

  const dummy = useMemo(() => {
    const o = new Object3D()
    o.rotation.order = 'YXZ' // heading, then the leg swing
    return o
  }, [])
  const hidden = useMemo(() => new Matrix4().makeScale(0, 0, 0), [])
  const color = useMemo(() => new Color(), [])

  // Tap someone to see what they're up to.
  const onTap = (e: ThreeEvent<MouseEvent>) => {
    const s = useGame.getState()
    if (s.mode !== 'play' || e.delta > 6 || e.instanceId == null) return
    const p = people.current[e.instanceId]
    if (!p || p.state === 'inside') return
    e.stopPropagation()
    useThought.setState({ id: p.id, text: thought(p), until: performance.now() + 6000 })
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const list = people.current
    const night = nightAmount(dayPhase()) > 0.5
    const ctx: Ctx = { graph, places, dirty: colorsDirty }
    const t = torso.current
    const hd = head.current
    const hr = hair.current
    const lg = legs.current
    const it = items.current
    const db = dogBody.current
    const dh = dogHead.current
    const hit = hits.current
    if (!t || !hd || !hr || !lg || !it || !db || !dh || !hit) return

    if (colorsDirty.current) {
      colorsDirty.current = false
      list.forEach((p, i) => {
        t.setColorAt(i, color.set(p.colors.shirt))
        hd.setColorAt(i, color.set(p.colors.skin))
        hr.setColorAt(i, color.set(p.colors.hair))
        lg.setColorAt(i * 2, color.set(p.colors.pants))
        lg.setColorAt(i * 2 + 1, color)
        it.setColorAt(i, color.set(p.item ? ITEMS[p.item].color : '#ffffff'))
        db.setColorAt(i, color.set(p.colors.dog))
        dh.setColorAt(i, color)
      })
      for (const m of [t, hd, hr, lg, it, db, dh]) if (m.instanceColor) m.instanceColor.needsUpdate = true
    }

    list.forEach((p, i) => {
      update(ctx, p, dt, night)
      draw(p, i)
    })
    t.count = hd.count = hr.count = it.count = db.count = dh.count = hit.count = list.length
    lg.count = list.length * 2
    for (const m of [t, hd, hr, lg, it, db, dh, hit]) m.instanceMatrix.needsUpdate = true
    followThought(list)

    function draw(p: Person, i: number) {
      if (p.state === 'inside') {
        for (const m of [t!, hd!, hr!, it!, db!, dh!, hit!]) m.setMatrixAt(i, hidden)
        lg!.setMatrixAt(i * 2, hidden)
        lg!.setMatrixAt(i * 2 + 1, hidden)
        return
      }
      const moving = p.state === 'walk' && p.waited === 0
      const jog = p.type === 'jogger'
      const swing = moving ? Math.sin(p.stride) * (jog ? 0.85 : 0.55) : 0
      const bob = moving ? Math.abs(Math.cos(p.stride)) * (jog ? 0.05 : 0.025) : 0
      const hip = (p.sit ? 0.26 : LEG) + bob
      const h = p.heading
      const sin = Math.sin(h)
      const cos = Math.cos(h)
      const x = p.pos[0] / SCALE
      const z = p.pos[1] / SCALE
      // Body, head and hair stack up from the hips.
      const part = (m: InstancedMesh, y: number, fwd: number, sx: number, sy: number, sz: number) => {
        dummy.position.set(x + sin * fwd, hip + y, z + cos * fwd)
        dummy.rotation.set(0, h, 0)
        dummy.scale.set(sx, sy, sz)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      part(t!, 0.15, 0, 1, 1, 1)
      part(hd!, 0.36, 0, 1, 1, 1)
      if (SEASON === 'winter') part(hr!, 0.4, -0.005, 1.05, 0.75, 1.05) // beanie
      else part(hr!, 0.385, -0.02, 1, 0.8, 1)
      if (p.item) {
        const [sx, sy, sz] = ITEMS[p.item].size
        part(it!, 0.1, 0.13, sx, sy, sz)
      } else it!.setMatrixAt(i, hidden)
      // An invisible, roomier box around each person makes them easy to tap on a phone.
      dummy.position.set(x, 0.45, z)
      dummy.rotation.set(0, h, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      hit!.setMatrixAt(i, dummy.matrix)
      if (p.type === 'dog') {
        const dx = p.dogPos[0] / SCALE
        const dz = p.dogPos[1] / SCALE
        const trot = moving ? Math.abs(Math.sin(p.stride * 1.6)) * 0.03 : 0
        const ds = Math.sin(p.dogHeading)
        const dc = Math.cos(p.dogHeading)
        dummy.position.set(dx, 0.1 + trot, dz)
        dummy.rotation.set(0, p.dogHeading, 0)
        dummy.updateMatrix()
        db!.setMatrixAt(i, dummy.matrix)
        dummy.position.set(dx + ds * 0.12, 0.17 + trot, dz + dc * 0.12)
        dummy.updateMatrix()
        dh!.setMatrixAt(i, dummy.matrix)
      } else {
        db!.setMatrixAt(i, hidden)
        dh!.setMatrixAt(i, hidden)
      }
      // Legs swing from the hips; sitting folds them forward.
      for (const side of [-1, 1]) {
        const a = p.sit ? -Math.PI / 2 : swing * side
        const lx = side * 0.045
        // Leg hangs half its length below the hip, rotated by the swing.
        const dy = -Math.cos(a) * LEG * 0.5
        const dz = -Math.sin(a) * LEG * 0.5
        dummy.position.set(x + cos * lx + sin * dz, hip + dy, z - sin * lx + cos * dz)
        dummy.rotation.set(a, h, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        lg!.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix)
      }
    }
  })

  return (
    <group scale={SCALE}>
      <instancedMesh ref={torso} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false} castShadow={!SMALL}>
        <capsuleGeometry args={[0.085, 0.16, 3, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false}>
        <sphereGeometry args={[0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, MAX_PEOPLE * 2]} frustumCulled={false}>
        <boxGeometry args={[0.06, LEG, 0.07]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={items} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={dogBody} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.08, 0.2]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={dogHead} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false}>
        <boxGeometry args={[0.08, 0.08, 0.09]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hits} args={[undefined, undefined, MAX_PEOPLE]} frustumCulled={false} onClick={onTap}>
        <boxGeometry args={[0.45, 0.9, 0.45]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  )
}

function update(ctx: Ctx, p: Person, dt: number, night: boolean) {
  if (p.state === 'inside' || p.state === 'linger') {
    if (p.face != null) turnTo(p, p.face, dt)
    if (p.state === 'linger') walkDog(p, dt)
    p.timer -= dt
    if (p.timer <= 0) setOff(ctx, p, night)
    return
  }
  // Walking.
  const step = p.steps[p.si]
  if (!step) return arrive(ctx, p, night)
  if (step.cross && p.crossing !== step.cross.id) {
    // At lights, wait for the walk signal (and still mind cars turning across);
    // elsewhere look both ways and wait while a car is close to the crossing.
    const signal = crossingSignal(step.cross.tile, step.cross.dir)
    const hold = signal === 'wait' ? p.waited < 30 : carNear(step.cross.mid, signal === 'walk' ? 1.1 : 1.7) && p.waited < 8
    if (hold) {
      p.waited += dt
      turnTo(p, Math.atan2(step.p[0] - p.pos[0], step.p[1] - p.pos[1]), dt)
      walkDog(p, dt)
      return
    }
    p.crossing = step.cross.id
    pedestrianCrossings.set(p.crossing, (pedestrianCrossings.get(p.crossing) ?? 0) + 1)
  }
  p.waited = 0
  const dx = step.p[0] - p.pos[0]
  const dz = step.p[1] - p.pos[1]
  const len = Math.hypot(dx, dz)
  const move = p.speed * dt
  if (len <= move) {
    p.pos[0] = step.p[0]
    p.pos[1] = step.p[1]
    if (step.cross) leaveCrossing(p)
    p.si++
  } else {
    p.pos[0] += (dx / len) * move
    p.pos[1] += (dz / len) * move
    turnTo(p, Math.atan2(dx, dz), dt)
  }
  p.stride += dt * p.speed * (p.type === 'jogger' ? 10 : 14)
  walkDog(p, dt)
}

// The dog trots along at heel, a little behind and to the side, and sits beside its owner when they stop.
function walkDog(p: Person, dt: number) {
  if (p.type !== 'dog') return
  const sin = Math.sin(p.heading)
  const cos = Math.cos(p.heading)
  const still = p.state === 'linger'
  const back = still ? -0.1 : 0.4
  const side = still ? 0.35 : 0.22
  const tx = p.pos[0] - sin * back + cos * side
  const tz = p.pos[1] - cos * back - sin * side
  const dx = tx - p.dogPos[0]
  const dz = tz - p.dogPos[1]
  const k = Math.min(1, dt * 6)
  p.dogPos[0] += dx * k
  p.dogPos[1] += dz * k
  const target = Math.hypot(dx, dz) > 0.03 ? Math.atan2(dx, dz) : p.heading
  let diff = target - p.dogHeading
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  p.dogHeading += diff * Math.min(1, dt * 8)
}

// Done with the current stop (or time to leave home): work out the next one.
function setOff(ctx: Ctx, p: Person, night: boolean) {
  const g = ctx.graph
  p.sit = false
  p.face = null
  const atHome = p.at === `b${p.home}`
  if (atHome && night && Math.random() < 0.85) {
    p.timer = rand(20, 45) // most people stay in after dark
    return
  }
  let dest: Dest | null = null
  if (!atHome && (p.outings >= 3 || Math.random() < 0.4 || night)) dest = { kind: 'home', key: `b${p.home}`, def: 'house' }
  const start = g.byKey.get(p.at) ?? nearestNode(g, p.pos)
  for (let tries = 0; tries < 4; tries++) {
    const d = dest ?? outing(ctx, p)
    if (!d || d.key === p.at) continue
    const goal = g.byKey.get(d.key)
    const route = start != null && goal != null ? findPath(g, start, goal) : null
    if (!route) {
      dest = null
      continue
    }
    p.dest = d
    p.steps = stepsFor(g, route, p.pos)
    p.si = 0
    const last = g.nodes[goal!]
    if (last.kind === 't') settle(p, last)
    if (p.state === 'inside') {
      // Step out of the front door.
      const first = p.steps[0]
      if (first) {
        p.pos = [...first.p]
        p.heading = Math.atan2(first.p[0] - nodePos(g.nodes[start!])[0], first.p[1] - nodePos(g.nodes[start!])[1])
        p.si = 1
      }
      p.dogPos = [...p.pos]
      p.dogHeading = p.heading
    }
    p.state = 'walk'
    p.outings++
    return
  }
  // Nowhere reachable: try again in a bit.
  p.timer = rand(6, 14)
}

// Somewhere to go on an outing: food most often, then parks, the showroom or a neighbour.
function outing(ctx: Ctx, p: Person): Dest | null {
  // Joggers run to a far street corner and on to another.
  if (p.type === 'jogger' && ctx.places.corners.length) {
    let best: Dest | null = null
    let bestD = -1
    for (let i = 0; i < 4; i++) {
      const c = pick(ctx.places.corners)
      const n = ctx.graph.nodes[ctx.graph.byKey.get(c.key)!]
      const [x, z] = nodePos(n)
      const d = Math.hypot(x - p.pos[0], z - p.pos[1])
      if (d > bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }
  // Dogs want the park.
  if (p.type === 'dog' && ctx.places.parks.length && Math.random() < 0.7) return pick(ctx.places.parks)
  const r = Math.random()
  const order =
    r < 0.45 ? [ctx.places.shops, ctx.places.parks, ctx.places.browse]
    : r < 0.8 ? [ctx.places.parks, ctx.places.shops, ctx.places.browse]
    : r < 0.9 ? [ctx.places.browse, ctx.places.shops, ctx.places.parks]
    : [ctx.places.houses.filter((h) => h.key !== `b${p.home}`), ctx.places.parks, ctx.places.shops]
  const pool = order.find((l) => l.length)
  return pool ? pick(pool) : null
}

// Add the last few steps from the edge of a decoration to a good spot at it.
function settle(p: Person, n: Extract<WalkNode, { kind: 't' }>) {
  const entry = p.steps.length ? p.steps[p.steps.length - 1].p : p.pos
  const c = n.center
  const seat = SEATS[n.decor ?? '']
  const bench = seat === 'out'
  // Picnic benches run along the front and back of the table.
  const near = sideOf(c, entry)
  const side = bench ? n.turn : seat === 'in' && (near - n.turn) % 2 !== 0 ? n.turn : near
  const [dx, dz] = SIDES[side]
  const r = SPOT[n.decor ?? ''] ?? 0.8
  // Benches seat two: shuffle along the seat.
  const along = bench ? rand(-0.25, 0.25) : rand(-0.3, 0.3)
  const spot: Pt = [c[0] + dx * r + dz * along, c[1] + dz * r - dx * along]
  for (const w of transit(n, entry, spot)) p.steps.push({ p: w })
  p.steps.push({ p: spot })
}

function arrive(ctx: Ctx, p: Person, night: boolean) {
  leaveCrossing(p)
  const d = p.dest
  p.steps = []
  p.si = 0
  if (!d) {
    p.state = 'inside'
    p.timer = 1
    return
  }
  p.at = d.key
  const node = ctx.graph.nodes[ctx.graph.byKey.get(d.key) ?? -1]
  if (d.kind === 'jog') {
    // Catch a breath at the corner, then keep going.
    p.state = 'linger'
    p.timer = rand(0.2, 0.8)
    return
  }
  if (d.kind === 'park') {
    p.state = 'linger'
    const [lo, hi] = LINGER[d.def] ?? [3, 8]
    p.timer = rand(lo, hi)
    if (node?.kind === 't') {
      p.sit = !!SEATS[d.def]
      p.face = SEATS[d.def] === 'out' ? Math.atan2(SIDES[node.turn][0], SIDES[node.turn][1]) : Math.atan2(node.center[0] - p.pos[0], node.center[1] - p.pos[1])
      // A hot dog to go.
      if (ITEMS[d.def]) {
        p.item = d.def
        ctx.dirty.current = true
      }
    } else if (node?.kind === 'b') {
      // Watching the ducks.
      p.face = Math.atan2(node.center[0] - p.pos[0], node.center[1] - p.pos[1])
    }
    return
  }
  p.state = 'inside'
  if (d.kind === 'home') {
    p.item = null
    p.outings = 0
    p.timer = night ? rand(40, 90) : rand(12, 35)
  } else {
    p.timer = d.kind === 'shop' ? rand(5, 12) : rand(6, 14)
    if (d.kind === 'shop' && ITEMS[d.def]) p.item = d.def
  }
  ctx.dirty.current = true
}

// Keep the thought bubble over the person it belongs to, and let it fade after a few seconds.
const bubbleAt = new Vector3()
function followThought(list: Person[]) {
  const th = useThought.getState()
  if (!th.id) return
  const p = list.find((o) => o.id === th.id)
  if (!p || p.state === 'inside' || performance.now() > th.until) {
    useThought.setState({ id: null })
    anchors.delete('person')
    return
  }
  anchors.set('person', bubbleAt.set(p.pos[0], 1.2, p.pos[1]))
  const text = thought(p)
  if (text !== th.text) useThought.setState({ text })
}

// One line for the thought bubble: who it is and what they're up to.
function thought(p: Person): string {
  const who = p.type === 'dog' ? `${p.name} and ${p.dogName} are` : `${p.name} is`
  const d = p.dest
  let idea: [string, string] = ['🚶', 'out for a walk']
  if (p.type === 'jogger' && d?.kind !== 'home') idea = ['🏃', 'out for a run']
  else if (d?.kind === 'home') idea = p.item ? [ITEMS[p.item].emoji, `taking ${ITEMS[p.item].thing} home`] : ['🏠', 'heading home']
  else if (d?.kind === 'shop') idea = SHOP_THOUGHTS[d.def] ?? ['🛍️', 'running an errand']
  else if (d?.kind === 'browse') idea = d.def === 'garage' ? ['🔧', 'peeking into your garage'] : ['🚗', 'looking at cars in the showroom']
  else if (d?.kind === 'friend') idea = ['👋', 'visiting a neighbour']
  else if (d?.kind === 'park') idea = (p.state === 'linger' ? PARK_AT : PARK_GO)[d.def] ?? ['🌳', 'enjoying the park']
  return `${idea[0]} ${who} ${idea[1]}`
}

function leaveCrossing(p: Person) {
  if (!p.crossing) return
  const n = (pedestrianCrossings.get(p.crossing) ?? 1) - 1
  if (n > 0) pedestrianCrossings.set(p.crossing, n)
  else pedestrianCrossings.delete(p.crossing)
  p.crossing = null
}

function turnTo(p: Person, target: number, dt: number) {
  let diff = target - p.heading
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  p.heading += diff * Math.min(1, dt * 10)
}

// Any car from the shared traffic sim within `r` of a point.
function carNear(at: Pt, r: number) {
  for (const a of liveTraffic.agents.values()) {
    if (Math.hypot(a.x - at[0], a.z - at[1]) < r) return true
  }
  return false
}

// Closest sidewalk corner, lawn or decoration to a point, for re-planning.
function nearestNode(g: WalkGraph, at: Pt) {
  let best: number | null = null
  let bestD = Infinity
  g.nodes.forEach((n, i) => {
    if (n.kind === 'b') return
    const [x, z] = nodePos(n)
    const d = Math.hypot(x - at[0], z - at[1])
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
