import { create } from 'zustand'
import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { sfx } from './sound'
import { useGame, type JunkCar } from '../game/store'
import { townTraffic } from '../game/traffic'
import { CARS, RESCUE_SPOTS, STORAGE_MAX, VISITORS, VISIT_GAP_MIN, BARN_RARITY, TOURIST_GAP_MIN, touristGroup, touristScore, touristWeight, carDef, performance, visitorPrize, type Body, type Rarity, type VisitorKind } from '../game/data'

// Surprise visitors in town: every few minutes someone turns up (see VISITORS in data.ts).
// Signed-in players get theirs from the server (visitor_next() and visitor_claim() in
// supabase/migrations/0032_town_visitors.sql), which fixes the prize so the save guard can pay it.
// Guests roll here; their towns aren't saved to the cloud.

export type Visitor = {
  id: string
  kind: VisitorKind
  coins: number
  xp: number
  parts: number
  bucks: number
  expiresAt: number
  // A server visitor (claimed through visitor_claim()) rather than a guest's.
  server: boolean
  // How it looks in town (barn tips have no car).
  model: string
  color: string
  // Street racer: who, and how quick.
  name: string
  pi: number
  body: Body
  // On its way out of town: still drawn while it fades.
  gone?: boolean
  // Tourists: how many campers came together (grown gardens and statues draw groups). Just for looks.
  group?: number
}

type VisitorState = { visitor: Visitor | null; card: boolean; busy: boolean }
export const useVisitors = create<VisitorState>(() => ({ visitor: null, card: false, busy: false }))

const RACERS = ['Vinnie Vroom', 'Dash Delgado', 'Skid Malone', 'Roxy Redline', 'Turbo Tess', 'Nitro Nate', 'Clutch Carla', 'Burnout Bo']
const TOWNS = ['Nitro Bay', 'Piston Peak', 'Chrome City', 'Turbo Falls', 'Gearville', 'Muffler Hills']
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const signedIn = () => !!supabase && !!signedInUser()

// How long until the next visitor is asked for (ms since epoch). Starts a minute or so after load.
let nextAt = Date.now() + 60_000 + Math.random() * 30_000
let off = false // the server doesn't have visitors yet
let asking = false
// A street race against the visitor is underway (it doesn't leave mid-race).
let racing = false
export const setRacing = (on: boolean) => {
  racing = on
}

const gap = () => (VISIT_GAP_MIN + Math.random() * 2) * 60_000

function bestPi() {
  const cars = useGame.getState().cars
  return Math.max(10, ...cars.map((c) => performance(carDef(c.model), c.upgrades, c.mods)))
}

// A street racer's PI against your best car: most are within 5% either way, one in five is
// 5-10% quicker.
export const visitorPiFactor = (r = Math.random(), r2 = Math.random()) => (r < 0.2 ? 1.05 + r2 * 0.05 : 0.95 + r2 * 0.1)

// The look of a visitor: a racer close to your best car, a camper full of tourists,
// a mysterious black supercar.
function dress(id: string, kind: VisitorKind, prize: { coins: number; xp: number; parts: number; bucks: number }, expiresAt: number, server: boolean): Visitor {
  let model = 'camper'
  let color = pick(['#ffe082', '#80deea', '#f8bbd0', '#c5e1a5'])
  let pi = 0
  if (kind === 'racer') {
    pi = Math.round(bestPi() * visitorPiFactor())
    const car = [...CARS].filter((c) => !c.bucks).sort((a, b) => Math.abs(performance(a, zero) - pi) - Math.abs(performance(b, zero) - pi))[0]
    model = car.id
    color = pick(car.colors)
  } else if (kind === 'mystery') {
    model = 'zenith'
    color = '#15151d'
  }
  const name = kind === 'racer' ? `${pick(RACERS)} from ${pick(TOWNS)}` : ''
  const group = kind === 'tourist' ? touristGroup(touristScore(useGame.getState().buildings)) : 1
  return { id, kind, ...prize, expiresAt, server, model, color, name, pi, body: carDef(model).body, ...(group > 1 ? { group } : {}) }
}

// A guest's visitor kind: tourists come more often to a town with grown gardens and statues,
// and half as often to a jammed one (src/game/traffic.ts).
export function rollKind(barn: boolean, score: number, roll = Math.random(), tourists = 1): VisitorKind {
  const kinds = (Object.keys(VISITORS) as VisitorKind[]).filter((k) => k !== 'barn' || barn)
  const weight = (k: VisitorKind) => (k === 'tourist' ? touristWeight(score) * tourists : VISITORS[k].weight)
  let r = roll * kinds.reduce((n, k) => n + weight(k), 0)
  let kind = kinds[0]
  for (const k of kinds) {
    kind = k
    r -= weight(k)
    if (r <= 0) break
  }
  return kind
}

function rollLocal(barn: boolean): Visitor {
  const g = useGame.getState()
  const kind = rollKind(barn, touristScore(g.buildings), Math.random(), townTraffic(g).tourists)
  return dress(`g${Date.now()}`, kind, visitorPrize(kind, useGame.getState().level), Date.now() + VISITORS[kind].minutes * 60_000, false)
}

// A guest's barn find, rolled like the server's: the cars at the spots their level has opened.
function rollBarnCar(): JunkCar {
  const level = useGame.getState().level
  const pool = RESCUE_SPOTS.filter((s) => s.unlockLevel <= level).flatMap((s) => s.cars)
  let r = Math.random() * pool.reduce((n, c) => n + BARN_RARITY[c.rarity], 0)
  let c = pool[0]
  for (const o of pool) {
    c = o
    r -= BARN_RARITY[o.rarity]
    if (r <= 0) break
  }
  return { uid: `j${Date.now()}${Math.floor(Math.random() * 1e6)}`, model: c.model, rarity: c.rarity }
}

const roomForBarn = () => {
  const s = useGame.getState()
  return s.buildings.some((b) => b.def === 'rescue') && s.junkyard.length < STORAGE_MAX
}

// Is the town in a state to have a visitor turn up? Not while visiting a friend, building, or
// still in the tutorial; and only with a few roads to drive on.
function ready() {
  const s = useGame.getState()
  return !s.visiting && s.mode === 'play' && s.tutorial >= 99 && s.roads.length >= 4 && document.visibilityState === 'visible'
}

async function ask() {
  if (asking || off) return
  asking = true
  try {
    if (!signedIn()) {
      useVisitors.setState({ visitor: rollLocal(roomForBarn()) })
      arrived()
      return
    }
    // The server reads the level and Rusty's from the saved town.
    await flushSave()
    const { data, error } = await supabase!.rpc('visitor_next', { p_barn: roomForBarn() })
    if (error) {
      if (error.code === 'PGRST202') off = true // not on this server yet
      nextAt = Date.now() + 5 * 60_000
      return
    }
    const d = data as { wait?: number; id?: number; kind?: VisitorKind; coins: number; xp: number; parts: number; bucks: number; expires_in: number }
    if (d.wait !== undefined || !d.id || !d.kind) {
      nextAt = Date.now() + Math.max(30, d.wait ?? 60) * 1000
      return
    }
    useVisitors.setState({ visitor: dress(String(d.id), d.kind, d, Date.now() + d.expires_in * 1000, true) })
    arrived()
  } catch {
    nextAt = Date.now() + 5 * 60_000
  } finally {
    asking = false
  }
}

const HELLO: Record<VisitorKind, string> = {
  racer: '🏁 A street racer rolled into town!',
  tourist: '📸 Tourists are driving around town!',
  mystery: '❓ A mystery car! Tap it before it leaves!',
  barn: '📞 Rusty got a tip about a barn find!',
}

function arrived() {
  const v = useVisitors.getState().visitor
  if (!v) return
  sfx.horn(v.body)
  useGame.getState().toast(v.group ? `📸 A tour group of ${v.group} campers rolled into town!` : HELLO[v.kind])
}

// Sends the visitor on its way: it fades out of town, and the next one comes a few minutes later.
export function leave() {
  const v = useVisitors.getState().visitor
  if (!v || v.gone) return
  useVisitors.setState({ visitor: { ...v, gone: true }, card: false })
  setTimeout(() => {
    if (useVisitors.getState().visitor?.id === v.id) useVisitors.setState({ visitor: null })
  }, 1200)
  // Tourists, alone or in a group, never pop up more than once every TOURIST_GAP_MIN minutes.
  nextAt = Date.now() + (v.kind === 'tourist' ? Math.max(gap(), TOURIST_GAP_MIN * 60_000) : gap())
}

// Collects the visitor's prize. Returns false if it couldn't (it left, or storage is full).
export async function claim(): Promise<boolean> {
  const v = useVisitors.getState().visitor
  if (!v || v.gone || useVisitors.getState().busy) return false
  const g = useGame.getState()
  if (v.kind === 'barn' && g.junkyard.length >= STORAGE_MAX) {
    g.toast('Storage is full. Restore or scrap a car first, then call Rusty back.')
    return false
  }
  useVisitors.setState({ busy: true })
  try {
    let paid: { coins: number; xp: number; parts: number; bucks: number; seq?: number; car?: JunkCar | null }
    if (v.server) {
      const { data, error } = await supabase!.rpc('visitor_claim', { p_id: Number(v.id) })
      if (error) {
        g.toast(v.kind === 'mystery' ? 'Too slow! The mystery car got away.' : 'Your visitor already left town.')
        leave()
        return false
      }
      const d = data as { coins: number; xp: number; parts: number; bucks: number; seq: number; car: { uid: string; model: string; rarity: Rarity } | null }
      paid = d
    } else {
      paid = { ...v, car: v.kind === 'barn' ? rollBarnCar() : null }
    }
    useGame.getState().visitorPrize(paid)
    sfx.coin()
    useGame.getState().toast(thanks(v, paid))
    leave()
    return true
  } finally {
    useVisitors.setState({ busy: false })
  }
}

function thanks(v: Visitor, p: { coins: number; parts: number; bucks: number; xp: number; car?: JunkCar | null }) {
  const bits = [p.coins && `+$${p.coins.toLocaleString()}`, p.parts && `+${p.parts} parts`, p.bucks && `+${p.bucks} gems`, p.xp && `+${p.xp} XP`].filter(Boolean).join(', ')
  if (v.kind === 'barn' && p.car) return `🚜 Rusty towed a ${carDef(p.car.model).name} home from an old barn! It's in storage.`
  if (v.kind === 'racer') return `🏁 You beat the street racer! Bonus ${bits}`
  if (v.kind === 'tourist') return `📸 The tourists loved your town! Tip: ${bits}`
  return `❓ Caught the mystery car! ${bits}`
}

// Called every second from the game tick.
export function visitorTick(now = Date.now()) {
  const v = useVisitors.getState().visitor
  if (v) {
    // Ran out of time (a racer mid-race gets to finish first).
    if (!v.gone && now > v.expiresAt && !useVisitors.getState().busy && !racing) leave()
    return
  }
  if (now >= nextAt && ready()) {
    nextAt = now + 60_000
    void ask()
  }
}


// For testing: bring a visitor now (?visitor=racer|tourist|mystery|barn).
export function forceVisitor(kind: VisitorKind) {
  if (signedIn()) return // a signed-in player's visitors come from the server
  const v = rollLocal(kind === 'barn')
  const prize = visitorPrize(kind, useGame.getState().level)
  useVisitors.setState({ visitor: dress(v.id, kind, prize, Date.now() + VISITORS[kind].minutes * 60_000, false) })
  arrived()
}

// Tapping a visitor in town: a racer asks for a race; the rest pay out there and then.
export function tapVisitor() {
  const v = useVisitors.getState().visitor
  if (!v || v.gone) return
  if (v.kind === 'racer') useVisitors.setState({ card: true })
  else void claim()
}
