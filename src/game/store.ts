import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  PLOT, PLOT_MIN, PLOT_MAX, START_LAND, plotPrice, buildingDef, carDef, xpToNext, baseFuelCap, FUEL_REGEN_SECONDS,
  upgradeCost, MAX_UPGRADE, upgradable, buildingLevel, jobLevel, upgradePayout, upgradePartsPayout, upgradeXp, upgradeJobSeconds, upgradeFuelCap, buildingUpgradeCost, buildingUpgradeXp, MAX_BUILDING_LEVEL, RESCUE_SPOTS, RESCUE_PINS, STORAGE_MAX, RARITY, restoreCost, rushBucks, REFILL_BUCKS, GP_SERIES, GP_ROUNDS, gpReward, type Rarity, GOALS, DAILY_BONUS, PAINTS, PAINT_COST, STRIPE_COST, FLAT_CHANCE, LOW_FUEL_CHANCE, servicePay, gasCanCost, flatFixCost, type UpgradeSlot, type StatKey,
} from './data'
import { sfx } from '../lib/sound'
import { requestTrip } from './trips'

// rot: quarter turns the player chose (0 faces south). Unset means face the nearest road.
// level: upgrade level 1-10 (see MAX_BUILDING_LEVEL); unset means 1.
// jobLevel: the level the running job started at, so an upgrade mid-job only pays from the next job.
export type PlacedBuilding = { uid: string; def: string; x: number; z: number; jobEndsAt: number | null; rot?: number; level?: number; jobLevel?: number }
export type OwnedCar = { uid: string; model: string; color: string; upgrades: Record<UpgradeSlot, number>; flat?: boolean; lowFuel?: boolean; stripe?: string | null; plate?: string }
// A rusty find waiting in Rusty's storage, and the one car in the restore bay.
export type JunkCar = { uid: string; model: string; rarity: Rarity }
export type Restoring = JunkCar & { endsAt: number; minutes: number }
export type Loot =
  | { kind: 'car'; model: string; rarity: Rarity }
  | { kind: 'coins' | 'parts' | 'fuel'; n: number }
  | { kind: 'trophy' }
  | { kind: 'nothing' }
// A search in progress. Not saved: leaving mid-search forfeits it.
export type Search = { spot: string; pins: Loot[]; revealed: boolean[]; truckAt: number | null; flatAt: number | null; flat: boolean }

export type SaveState = {
  version: 1
  townName: string
  level: number
  xp: number
  coins: number
  bucks: number
  parts: number
  fuel: number
  fuelUpdatedAt: number
  trophies: number
  racesWon: number
  roads: string[]
  buildings: PlacedBuilding[]
  cars: OwnedCar[]
  stats: Record<StatKey, number>
  claimedGoals: string[]
  lastDaily: string | null
  dailyStreak: number
  helped: Record<string, string>
  tutorial: number
  junkyard: JunkCar[]
  restoring: Restoring | null
  gp: Record<string, { round: number; clears: number }>
  land: string[]
  updatedAt: number
}

export type Mode = 'play' | 'place' | 'move' | 'road' | 'bulldoze' | 'expand'
export type Resource = 'coins' | 'parts' | 'fuel' | 'bucks' | 'level'
export type Need = { res: Resource; missing: number; what?: string }

export type Panel = null | 'need' | 'shop' | 'garage' | 'showroom' | 'race' | 'account' | 'goals' | 'daily' | 'flat' | 'friends' | 'rescue' | 'bank' | 'invites' | 'leaders' | 'clan' | 'upgrade'

// A read-only copy of another player's town while visiting it.
export type VisitedTown = { ownerId: string; townName: string; level: number; trophies: number; roads: string[]; buildings: PlacedBuilding[]; cars: OwnedCar[] }

type UiState = {
  mode: Mode
  placing: string | null
  // Quarter turns for the building being placed; null follows the nearest road.
  placeRot: number | null
  // The placed building picked in move mode, for dragging and rotating.
  selected: string | null
  // Building type just placed, so the edit bar can offer to build another.
  again: string | null
  panel: Panel
  selectedCar: string | null
  toasts: { id: number; text: string }[]
  visiting: VisitedTown | null
  need: Need | null
  search: Search | null
  // Building types whose bubbles pulse after a "Show me" tap.
  highlight: string[] | null
  shopFocus: string | null // building the Shop scrolls to and points out
  // The placed building the upgrade panel is showing.
  upgrading: string | null
  // A Grand Prix mystery box waiting to be opened.
  gpPrize: { series: string; model: string; color: string } | null
  // The signed-in player's clan, shown on the Crew House.
  clanBadge: { tag: string; emblem: string; color: string } | null
  // Level-up splash: the levels just reached and the rewards they paid.
  levelUp: { from: number; to: number; coins: number; bucks: number } | null
}

type Actions = {
  setMode: (m: Mode, placing?: string | null) => void
  showNeed: (res: Resource, missing: number, what?: string) => void
  openPanel: (p: Panel) => void
  openShop: (focus?: string) => void
  selectCar: (uid: string | null) => void
  toast: (text: string) => void
  tick: (now: number) => void
  placeBuilding: (def: string, x: number, z: number, rot?: number) => boolean
  setPlaceRot: (rot: number | null) => void
  select: (uid: string | null) => void
  moveBuilding: (uid: string, x: number, z: number, rot?: number) => boolean
  paintRoad: (x: number, z: number) => void
  bulldoze: (x: number, z: number) => void
  tapBuilding: (uid: string) => void
  openUpgrade: (uid: string) => void
  upgradeBuilding: (uid: string) => boolean
  buyCar: (model: string, color: string) => boolean
  upgradeCar: (uid: string, slot: UpgradeSlot) => boolean
  sellCar: (uid: string) => void
  finishRace: (won: boolean, reward: number) => void
  renameTown: (name: string) => void
  claimGoal: (id: string) => void
  claimDaily: () => void
  fixFlat: (uid: string, tow: boolean) => void
  serviceCar: (uid: string, how: 'tires' | 'gas' | 'can') => void
  paintCar: (uid: string, color: string) => void
  visit: (town: VisitedTown | null) => void
  helpFriend: () => void
  setTutorial: (step: number) => void
  stripeCar: (uid: string, stripe: string | null) => void
  loadSave: (s: SaveState) => void
  showMe: (defs: string[], text: string) => void
  refillFuel: () => void
  buyPlot: (px: number, pz: number) => void
  gpResult: (series: string, won: boolean) => void
  closePrize: () => void
  closeLevelUp: () => void
  focusShop: (panel: 'shop' | 'showroom' | 'rescue' | 'race', id: string | null) => void
  startSearch: (spot: string) => void
  revealPin: (i: number) => void
  fixTruck: () => void
  abandonSearch: () => void
  towHome: () => void
  restoreCar: (uid: string) => void
  rushRestore: () => void
  collectRestored: (plate: string) => void
  scrapCar: (uid: string) => void
  collectAll: () => void
}

export type GameState = SaveState & UiState & Actions

const key = (x: number, z: number) => `${x},${z}`
let uidCounter = 0
const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const emptyStats = (): Record<StatKey, number> => ({ rusty: 0, jobs: 0, carsBought: 0, upgrades: 0, racesWon: 0, built: 0, roads: 0, coinsEarned: 0, flatsFixed: 0, rescued: 0, searches: 0, gpWins: 0 })
export const today = () => new Date().toISOString().slice(0, 10)
const noUpgrades = (): Record<UpgradeSlot, number> => ({ engine: 0, turbo: 0, tires: 0, weight: 0 })

export function fuelCap(s: Pick<SaveState, 'level' | 'buildings'>) {
  const gas = s.buildings.reduce((n, b) => n + upgradeFuelCap(buildingDef(b.def), buildingLevel(b)), 0)
  return baseFuelCap(s.level) + gas
}

// Lot width and depth in tiles; a quarter turn swaps them.
export function lotSize(def: string, rot?: number): [number, number] {
  const d = buildingDef(def)
  return (rot ?? 0) % 2 ? [d.h, d.w] : [d.w, d.h]
}

export function footprint(def: string, x: number, z: number, rot?: number) {
  const [w, h] = lotSize(def, rot)
  const tiles: [number, number][] = []
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < h; dz++) tiles.push([x + dx, z + dz])
  return tiles
}

// Map of tile key -> what occupies it.
// `ignore` leaves out a building that is being moved, so it doesn't block its own new spot.
export function occupancy(s: Pick<SaveState, 'roads' | 'buildings'>, ignore?: string) {
  const occ = new Map<string, string>()
  for (const r of s.roads) occ.set(r, 'road')
  for (const b of s.buildings) if (b.uid !== ignore) for (const [x, z] of footprint(b.def, b.x, b.z, b.rot)) occ.set(key(x, z), b.uid)
  return occ
}

export const plotOf = (x: number, z: number) => `${Math.floor(x / PLOT)},${Math.floor(z / PLOT)}`
export const owns = (land: string[], x: number, z: number) => land.includes(plotOf(x, z))

// Plots next to owned land that can be bought.
export function buyablePlots(land: string[]) {
  const out: [number, number][] = []
  for (let px = PLOT_MIN; px <= PLOT_MAX; px++) {
    for (let pz = PLOT_MIN; pz <= PLOT_MAX; pz++) {
      if (land.includes(`${px},${pz}`)) continue
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => land.includes(`${px + dx},${pz + dz}`))) out.push([px, pz])
    }
  }
  return out
}

export function canPlace(s: Pick<SaveState, 'roads' | 'buildings' | 'land'>, def: string, x: number, z: number, rot?: number, ignore?: string) {
  const occ = occupancy(s, ignore)
  return footprint(def, x, z, rot).every(([tx, tz]) => owns(s.land, tx, tz) && !occ.has(key(tx, tz)))
}

// Obstacles get cleared, not moved.
export const movable = (def: string) => buildingDef(def).kind !== 'obstacle'

function starterTown(): SaveState {
  const roads: string[] = []
  // A loop road with a cross street, like a fresh Car Town Streets lot.
  for (let i = 4; i <= 19; i++) {
    roads.push(key(i, 4), key(i, 19), key(4, i), key(19, i), key(i, 11))
  }
  const now = Date.now()
  const b = (def: string, x: number, z: number): PlacedBuilding => ({ uid: uid(), def, x, z, jobEndsAt: null })
  return {
    version: 1,
    townName: 'My Town',
    level: 1,
    xp: 0,
    coins: 2500,
    bucks: 10,
    parts: 10,
    fuel: 25,
    fuelUpdatedAt: now,
    trophies: 0,
    racesWon: 0,
    roads: [...new Set(roads)],
    buildings: [
      b('showroom', 9, 9), b('garage', 13, 9), b('gas', 6, 3), b('pizza', 10, 3), b('pizza', 12, 3),
      b('pizza', 17, 10), b('house', 5, 9), b('house', 6, 9), b('house', 7, 9), b('house', 5, 10),
      b('house', 15, 17), b('house', 16, 17), b('house', 17, 17), b('tree', 5, 7), b('tree', 16, 9),
      b('tree', 17, 15), b('tree', 8, 16), b('tree', 6, 14), b('tree', 11, 17), b('tree', 18, 6),
      b('tree', 14, 7), b('tree', 2, 2), b('tree', 21, 3), b('tree', 2, 21), b('tree', 21, 21),
    ],
    cars: [
      { uid: uid(), model: 'pip', color: '#e53935', upgrades: noUpgrades() },
      { uid: uid(), model: 'civic', color: '#1e88e5', upgrades: noUpgrades() },
    ],
    stats: emptyStats(),
    claimedGoals: [],
    lastDaily: null,
    dailyStreak: 0,
    helped: {},
    tutorial: 0,
    junkyard: [],
    restoring: null,
    gp: {},
    land: [...START_LAND],
    updatedAt: now,
  }
}

const bump = (s: SaveState, key: StatKey, by = 1) => ({ ...s.stats, [key]: (s.stats[key] ?? 0) + by })

export const hasRusty = (s: Pick<SaveState, 'buildings'>) => s.buildings.some((b) => b.def === 'rescue')

export function activeGoals(s: Pick<SaveState, 'claimedGoals'>) {
  return GOALS.filter((g) => !s.claimedGoals.includes(g.id)).slice(0, 3)
}
// Rusty's Rescue counts from the buildings so older towns that already have one get credit.
export const statValue = (s: Pick<SaveState, 'stats' | 'buildings'>, key: StatKey) =>
  key === 'rusty' ? (s.buildings.some((b) => b.def === 'rescue') ? 1 : 0) : (s.stats[key] ?? 0)
export const goalDone = (s: Pick<SaveState, 'stats' | 'buildings'>, g: (typeof GOALS)[number]) => statValue(s, g.stat) >= g.target

function addXp(s: GameState, amount: number): Partial<GameState> {
  let { level, xp, bucks, coins } = s
  xp += amount
  const ups: number[] = []
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
    bucks += 1
    coins += level * 100
    ups.push(level)
  }
  if (!ups.length) return { xp }
  const fresh = { ...s, level }
  setTimeout(sfx.levelUp, 250)
  // Fold into a splash that's still open, so two quick level-ups show as one.
  const prev = s.levelUp
  const levelUp = {
    from: prev ? prev.from : s.level,
    to: level,
    coins: (prev?.coins ?? 0) + (coins - s.coins),
    bucks: (prev?.bucks ?? 0) + (bucks - s.bucks),
  }
  return { level, xp, bucks, coins, fuel: fuelCap(fresh), fuelUpdatedAt: Date.now(), levelUp }
}

// Apply an action's changes, then its XP. Level-up bonuses add on top of the
// action's own coins and bucks instead of replacing them.
function withXp(s: GameState, amount: number, patch: Partial<GameState>): Partial<GameState> {
  return { ...patch, ...addXp({ ...s, ...patch }, amount) }
}

export const cleanPlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 7)

// Collect all can be used once a minute; the last use survives a reload.
export const COLLECT_ALL_MS = 60_000
export const collectAllListeners = new Set<() => void>()
export function lastCollectAll() {
  try {
    return Number(localStorage.getItem('cartopia-collect-all')) || 0
  } catch {
    return 0
  }
}
function setLastCollectAll(t: number) {
  try {
    localStorage.setItem('cartopia-collect-all', String(t))
  } catch {
    // Private mode: the cooldown just won't survive a reload.
  }
  collectAllListeners.forEach((fn) => fn())
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...starterTown(),
      mode: 'play',
      placing: null,
      placeRot: null,
      selected: null,
      again: null,
      panel: null,
      selectedCar: null,
      toasts: [],
      visiting: null,
      need: null,
      search: null,
      highlight: null,
      clanBadge: null,
      shopFocus: null,
      upgrading: null,
      gpPrize: null,
      levelUp: null,

      setMode: (mode, placing = null) => set((s) => ({ mode, placing, panel: null, selected: null, again: null, placeRot: placing && placing === s.placing ? s.placeRot : null })),
      select: (selected) => set({ selected }),
      setPlaceRot: (placeRot) => set({ placeRot }),
      showNeed: (res, missing, what) => {
        sfx.error()
        set({ need: { res, missing: Math.max(0, Math.ceil(missing)), what }, panel: 'need', mode: 'play', placing: null, selected: null })
      },
      openPanel: (panel) => set({ panel, mode: 'play', placing: null, selected: null, shopFocus: null }),
      openShop: (focus) => set({ panel: 'shop', mode: 'play', placing: null, selected: null, shopFocus: focus ?? null }),
      selectCar: (selectedCar) => set({ selectedCar }),
      toast: (text) => {
        const id = Date.now() + Math.random()
        set((s) => ({ toasts: [...s.toasts, { id, text }] }))
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
      },

      tick: (now) => {
        const s = get()
        const cap = fuelCap(s)
        if (s.fuel >= cap) {
          if (s.fuelUpdatedAt !== now) set({ fuelUpdatedAt: now })
          return
        }
        const gained = Math.floor((now - s.fuelUpdatedAt) / (FUEL_REGEN_SECONDS * 1000))
        if (gained > 0) {
          set({ fuel: Math.min(cap, s.fuel + gained), fuelUpdatedAt: s.fuelUpdatedAt + gained * FUEL_REGEN_SECONDS * 1000 })
        }
      },

      placeBuilding: (def, x, z, rot) => {
        const s = get()
        const d = buildingDef(def)
        if (!canPlace(s, def, x, z, rot)) {
          sfx.error()
          return false
        }
        if (d.unique && s.buildings.some((o) => o.def === def)) {
          s.toast(`You already have a ${d.name}`)
          return false
        }
        if (s.coins < d.price) {
          s.showNeed('coins', d.price - s.coins, d.name)
          return false
        }
        if (s.bucks < (d.bucks ?? 0)) {
          s.showNeed('bucks', (d.bucks ?? 0) - s.bucks, d.name)
          return false
        }
        if (def === 'rescue') setTimeout(() => get().toast("Rusty's is open! Tap his shop to search for cars. The Showroom is unlocked too."), 400)
        sfx.click()
        set(withXp(s, Math.max(1, Math.round(d.price / 100)), {
          coins: s.coins - d.price,
          bucks: s.bucks - (d.bucks ?? 0),
          buildings: [...s.buildings, { uid: uid(), def, x, z, jobEndsAt: null, ...(rot == null ? {} : { rot }) }],
          stats: def === 'rescue' ? { ...bump(s, 'built'), rusty: 1 } : bump(s, 'built'),
          updatedAt: Date.now(),
        }))
        return true
      },

      // Free, and a running job keeps running. Leaving out rot keeps the building's
      // current turn (or keeps it facing the nearest road if it never had one).
      moveBuilding: (buid, x, z, rot) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b || !movable(b.def)) return false
        const turn = rot ?? b.rot
        if (!canPlace(s, b.def, x, z, turn, buid)) return false
        if (b.x === x && b.z === z && b.rot === turn) return true
        set({
          buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, x, z, ...(turn == null ? {} : { rot: turn }) } : o)),
          updatedAt: Date.now(),
        })
        return true
      },

      paintRoad: (x, z) => {
        const s = get()
        if (!owns(s.land, x, z)) return
        if (occupancy(s).has(key(x, z))) return
        if (s.coins < 10) return s.showNeed('coins', 10 - s.coins, 'a road tile')
        set({ roads: [...s.roads, key(x, z)], coins: s.coins - 10, stats: bump(s, 'roads'), updatedAt: Date.now() })
      },

      bulldoze: (x, z) => {
        const s = get()
        const k = key(x, z)
        const what = occupancy(s).get(k)
        if (!what) return
        if (what === 'road') return set({ roads: s.roads.filter((r) => r !== k), updatedAt: Date.now() })
        const b = s.buildings.find((b) => b.uid === what)!
        const d = buildingDef(b.def)
        if (d.kind === 'showroom' || d.kind === 'garage') return s.toast(`${d.name} can't be removed`)
        if (d.parked) return s.toast('This one is coming in a future update, so it stays put')
        if (d.kind === 'obstacle') return s.toast(`Tap the ${d.name.toLowerCase()} in play mode to clear it`)
        // Upgrades would be lost, and a drag can sweep over a building by accident.
        if (buildingLevel(b) > 1) return s.toast(`Your ${d.name} is upgraded, so it can't be bulldozed. Use Move to put it somewhere else.`)
        set({
          buildings: s.buildings.filter((o) => o.uid !== what),
          coins: s.coins + Math.floor(d.price / 2),
          updatedAt: Date.now(),
        })
      },

      tapBuilding: (buid) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b) return
        const d = buildingDef(b.def)
        if (d.kind === 'showroom') return s.openPanel('showroom')
        if (d.kind === 'garage') return s.openPanel('garage')
        if (b.def === 'rescue') return s.openPanel('rescue')
        if (b.def === 'crew') return s.openPanel('clan')
        if (d.kind === 'obstacle') {
          const now = Date.now()
          if (b.jobEndsAt === null) {
            if (s.coins < d.price) return s.showNeed('coins', d.price - s.coins, `clearing the ${d.name.toLowerCase()}`)
            sfx.start()
            return set({ coins: s.coins - d.price, buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: now + d.jobSeconds! * 1000 } : o)), updatedAt: now })
          }
          if (now < b.jobEndsAt) return
          sfx.coin()
          s.toast(`Cleared! +${d.xp} XP`)
          return set(withXp(s, d.xp!, { buildings: s.buildings.filter((o) => o.uid !== buid), updatedAt: now }))
        }
        // Gas stations have no jobs; a tap shows their upgrades.
        if (!d.jobSeconds) return upgradable(d) ? s.openUpgrade(buid) : undefined
        const now = Date.now()
        const lvl = buildingLevel(b)
        const jobLvl = jobLevel(b)
        const secs = upgradeJobSeconds(d, lvl)
        if (b.jobEndsAt !== null && now < b.jobEndsAt) return s.openUpgrade(buid)
        if (b.jobEndsAt === null) {
          if (s.fuel < d.fuelCost!) {
            return s.showNeed('fuel', d.fuelCost! - s.fuel, `a ${d.name} job`)
          }
          sfx.start()
          const cap = fuelCap(s)
          set({
            fuel: s.fuel - d.fuelCost!,
            // Restart the regen clock if we were sitting at the cap.
            fuelUpdatedAt: s.fuel >= cap ? now : s.fuelUpdatedAt,
            buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: now + secs * 1000, jobLevel: lvl } : o)),
            updatedAt: now,
          })
        } else {
          const pay = upgradePayout(d, jobLvl)
          const parts = upgradePartsPayout(d, jobLvl)
          const xp = upgradeXp(d, jobLvl)
          sfx.coin()
          s.toast(`+${pay} coins${parts ? `, +${parts} parts` : ''}, +${xp} XP`)
          // Sometimes a car out on the job comes back with a flat.
          let cars = s.cars
          const rolling = cars.filter((c) => !c.flat && !c.lowFuel)
          const roll = Math.random()
          if (rolling.length > 1 && roll < FLAT_CHANCE + LOW_FUEL_CHANCE) {
            const victim = rolling[Math.floor(Math.random() * rolling.length)]
            const flat = roll < FLAT_CHANCE
            cars = cars.map((c) => (c.uid === victim.uid ? (flat ? { ...c, flat: true } : { ...c, lowFuel: true }) : c))
            setTimeout(() => get().toast(flat ? `Oh no, your ${carDef(victim.model).name} got a flat tire! Tap it to fix.` : `Your ${carDef(victim.model).name} ran out of gas! Tap it to fill up.`), 600)
          }
          set(withXp(s, xp, {
            coins: s.coins + pay,
            parts: s.parts + parts,
            cars,
            stats: { ...bump(s, 'jobs'), coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
            buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: null, jobLevel: undefined } : o)),
            updatedAt: now,
          }))
        }
      },

      openUpgrade: (buid) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b || s.visiting || !upgradable(buildingDef(b.def))) return
        set({ panel: 'upgrade', upgrading: buid })
      },

      upgradeBuilding: (buid) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b) return false
        const d = buildingDef(b.def)
        const lvl = buildingLevel(b)
        if (!upgradable(d) || lvl >= MAX_BUILDING_LEVEL) return false
        const cost = buildingUpgradeCost(d, lvl)
        const what = `upgrading your ${d.name}`
        if (s.coins < cost.coins) {
          s.showNeed('coins', cost.coins - s.coins, what)
          return false
        }
        if (s.parts < cost.parts) {
          s.showNeed('parts', cost.parts - s.parts, what)
          return false
        }
        sfx.buy()
        s.toast(`${d.name} is now level ${lvl + 1}!`)
        set(withXp(s, buildingUpgradeXp(lvl), {
          coins: s.coins - cost.coins,
          parts: s.parts - cost.parts,
          buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, level: lvl + 1 } : o)),
          stats: bump(s, 'upgrades'),
          updatedAt: Date.now(),
        }))
        return true
      },

      // One tap: collect every finished job and cleared obstacle, restart
      // every idle business while fuel lasts, and fill up cars out of gas.
      collectAll: () => {
        const s = get()
        const now = Date.now()
        const left = COLLECT_ALL_MS - (now - lastCollectAll())
        if (left > 0) return s.toast(`Ready again in ${Math.ceil(left / 1000)}s`)
        let coins = s.coins
        let parts = s.parts
        let fuel = s.fuel
        let xp = 0
        let collected = 0
        let started = 0
        let cleared = 0
        let earned = 0
        const removed = new Set<string>()
        let buildings = s.buildings.map((b) => {
          const d = buildingDef(b.def)
          if (!d.jobSeconds || b.jobEndsAt === null || now < b.jobEndsAt) return b
          if (d.kind === 'obstacle') {
            removed.add(b.uid)
            xp += d.xp ?? 0
            cleared++
            return b
          }
          const lvl = jobLevel(b)
          coins += upgradePayout(d, lvl)
          earned += upgradePayout(d, lvl)
          parts += upgradePartsPayout(d, lvl)
          xp += upgradeXp(d, lvl)
          collected++
          return { ...b, jobEndsAt: null, jobLevel: undefined }
        }).filter((b) => !removed.has(b.uid))
        const cap = fuelCap(s)
        buildings = buildings.map((b) => {
          const d = buildingDef(b.def)
          if (!d.jobSeconds || d.kind === 'obstacle' || b.jobEndsAt !== null || fuel < (d.fuelCost ?? 0)) return b
          fuel -= d.fuelCost ?? 0
          started++
          return { ...b, jobEndsAt: now + upgradeJobSeconds(d, buildingLevel(b)) * 1000, jobLevel: buildingLevel(b) }
        })
        // Cars out of gas fill up at your Gas Station, if you have one.
        let cars = s.cars
        let filled = 0
        if (s.buildings.some((b) => b.def === 'gas')) {
          const pay = servicePay(s.level, 'gas')
          cars = cars.map((c) => {
            if (!c.lowFuel) return c
            filled++
            coins += pay
            earned += pay
            xp += 8
            requestTrip(c.uid, 'gas')
            return { ...c, lowFuel: false }
          })
        }
        if (!collected && !started && !cleared && !filled) return s.toast('Nothing to collect or fuel right now')
        setLastCollectAll(now)
        if (collected || filled) sfx.coin()
        else sfx.start()
        const bits = [
          collected && `collected ${collected} job${collected > 1 ? 's' : ''}`,
          started && `started ${started}`,
          filled && `filled up ${filled} car${filled > 1 ? 's' : ''}`,
          cleared && `cleared ${cleared}`,
        ].filter(Boolean) as string[]
        s.toast(`${bits.join(', ').replace(/^./, (c) => c.toUpperCase())}${earned ? `. +${earned} coins` : ''}${parts > s.parts ? `, +${parts - s.parts} parts` : ''}`)
        if (!started && buildings.some((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle' && b.jobEndsAt === null)) {
          setTimeout(() => get().toast('Out of fuel for the rest. It refills over time.'), 900)
        }
        set(withXp(s, xp, {
          buildings,
          cars,
          coins,
          parts,
          fuel,
          fuelUpdatedAt: s.fuel >= cap && fuel < cap ? now : s.fuelUpdatedAt,
          stats: { ...bump(s, 'jobs', collected), coinsEarned: (s.stats.coinsEarned ?? 0) + earned },
          updatedAt: now,
        }))
      },

      buyCar: (model, color) => {
        const s = get()
        const c = carDef(model)
        if (s.level < c.unlockLevel) {
          s.showNeed('level', c.unlockLevel, c.name)
          return false
        }
        if (!hasRusty(s)) {
          s.toast("Build Rusty's Rescue first. Rusty finds you new cars!")
          return false
        }
        if (s.coins < c.price) {
          s.showNeed('coins', c.price - s.coins, c.name)
          return false
        }
        if (s.bucks < (c.bucks ?? 0)) {
          s.showNeed('bucks', (c.bucks ?? 0) - s.bucks, c.name)
          return false
        }
        sfx.buy()
        s.toast(`${c.name} added to your garage!`)
        set(withXp(s, 20 + Math.round(c.price / 200), {
          coins: s.coins - c.price,
          bucks: s.bucks - (c.bucks ?? 0),
          cars: [...s.cars, { uid: uid(), model, color, upgrades: noUpgrades() }],
          stats: bump(s, 'carsBought'),
          updatedAt: Date.now(),
        }))
        return true
      },

      upgradeCar: (cuid, slot) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return false
        const lvl = car.upgrades[slot]
        if (lvl >= MAX_UPGRADE) return false
        const cost = upgradeCost(carDef(car.model), lvl)
        if (s.parts < cost.parts) {
          s.showNeed('parts', cost.parts - s.parts, 'this upgrade')
          return false
        }
        if (s.coins < cost.coins) {
          s.showNeed('coins', cost.coins - s.coins, 'this upgrade')
          return false
        }
        sfx.buy()
        set(withXp(s, 15 + lvl * 10, {
          coins: s.coins - cost.coins,
          parts: s.parts - cost.parts,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, upgrades: { ...c.upgrades, [slot]: lvl + 1 } } : c)),
          stats: bump(s, 'upgrades'),
          updatedAt: Date.now(),
        }))
        return true
      },

      sellCar: (cuid) => {
        const s = get()
        if (s.cars.length <= 1) return s.toast('You need at least one car')
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return
        if (carDef(car.model).parked) return s.toast('This car is coming in a future update, so it stays in your garage')
        const value = Math.floor(carDef(car.model).price * 0.5)
        set({ cars: s.cars.filter((c) => c.uid !== cuid), coins: s.coins + value, selectedCar: null, updatedAt: Date.now() })
      },

      finishRace: (won, reward) => {
        const s = get()
        set(withXp(s, won ? 30 : 8, {
          coins: s.coins + (won ? reward : Math.round(reward * 0.1)),
          trophies: s.trophies + (won ? 1 : 0),
          racesWon: s.racesWon + (won ? 1 : 0),
          stats: { ...bump(s, 'racesWon', won ? 1 : 0), coinsEarned: (s.stats.coinsEarned ?? 0) + (won ? reward : Math.round(reward * 0.1)) },
          updatedAt: Date.now(),
        }))
      },

      renameTown: (townName) => set({ townName: townName.slice(0, 24) || 'My Town', updatedAt: Date.now() }),

      claimGoal: (id) => {
        const s = get()
        const g = GOALS.find((o) => o.id === id)
        if (!g || s.claimedGoals.includes(id) || !goalDone(s, g)) return
        sfx.coin()
        s.toast(`Goal complete! +${g.coins} coins${g.bucks ? `, +${g.bucks} bucks` : ''}, +${g.xp} XP`)
        set(withXp(s, g.xp, {
          coins: s.coins + g.coins,
          bucks: s.bucks + (g.bucks ?? 0),
          claimedGoals: [...s.claimedGoals, id],
          updatedAt: Date.now(),
        }))
      },

      claimDaily: () => {
        const s = get()
        const t = today()
        if (s.lastDaily === t) return
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        const streak = s.lastDaily === yesterday ? s.dailyStreak + 1 : 1
        const r = DAILY_BONUS[Math.min(streak, DAILY_BONUS.length) - 1]
        set({
          coins: s.coins + r.coins,
          fuel: s.fuel + (r.fuel ?? 0),
          parts: s.parts + (r.parts ?? 0),
          bucks: s.bucks + (r.bucks ?? 0),
          lastDaily: t,
          dailyStreak: streak,
          panel: null,
          updatedAt: Date.now(),
        })
        s.toast(`Daily bonus: +${r.coins} coins`)
      },

      fixFlat: (cuid, tow) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car?.flat) return
        const hasRusty = s.buildings.some((b) => b.def === 'rescue')
        const cost = tow && hasRusty ? 0 : flatFixCost(s.level)
        if (tow && !hasRusty) return s.toast("Build Rusty's Rescue to tow for free")
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'the tire repair')
        set(withXp(s, tow ? 15 : 5, {
          coins: s.coins - cost,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, flat: false } : c)),
          stats: bump(s, 'flatsFixed'),
          panel: null,
          updatedAt: Date.now(),
        }))
        if (tow) requestTrip(cuid, 'tow')
        s.toast(tow ? "Rusty towed it in and patched it up. +15 XP" : `Tire fixed for $${cost}`)
      },

      serviceCar: (cuid, how) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return
        const owns = (def: string) => s.buildings.some((b) => b.def === def)
        if (how === 'tires') {
          if (!car.flat) return
          if (!owns('tires')) return s.toast('Build a Tire Shop to fix flats for profit')
          const pay = servicePay(s.level, 'tires')
          sfx.coin()
          s.toast(`Your Tire Shop fixed it! +${pay} coins, +12 XP`)
          requestTrip(cuid, 'tires')
          return set(withXp(s, 12, {
            coins: s.coins + pay,
            cars: s.cars.map((c) => (c.uid === cuid ? { ...c, flat: false } : c)),
            stats: { ...bump(s, 'flatsFixed'), coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
            panel: null,
            updatedAt: Date.now(),
          }))
        }
        if (!car.lowFuel) return
        if (how === 'gas') {
          if (!owns('gas')) return s.toast('Build a Gas Station to fill up for profit')
          const pay = servicePay(s.level, 'gas')
          sfx.coin()
          s.toast(`Filled up at your Gas Station! +${pay} coins, +8 XP`)
          requestTrip(cuid, 'gas')
          return set(withXp(s, 8, {
            coins: s.coins + pay,
            cars: s.cars.map((c) => (c.uid === cuid ? { ...c, lowFuel: false } : c)),
            stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
            panel: null,
            updatedAt: Date.now(),
          }))
        }
        const cost = gasCanCost(s.level)
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'a gas can')
        sfx.click()
        s.toast(`Gas can delivered for $${cost}`)
        set({ coins: s.coins - cost, cars: s.cars.map((c) => (c.uid === cuid ? { ...c, lowFuel: false } : c)), panel: null, updatedAt: Date.now() })
      },

      visit: (visiting) => set({ visiting, panel: null, mode: 'play', placing: null, selected: null, selectedCar: null }),

      helpFriend: () => {
        const s = get()
        const v = s.visiting
        if (!v) return
        if (s.helped[v.ownerId] === today()) return s.toast('You already helped this town today')
        const coins = 100 + v.level * 20
        sfx.coin()
        s.toast(`You helped ${v.townName}! +${coins} coins, +10 XP`)
        set(withXp(s, 10, { coins: s.coins + coins, helped: { ...s.helped, [v.ownerId]: today() }, updatedAt: Date.now() }))
      },

      setTutorial: (tutorial) => set({ tutorial, updatedAt: Date.now() }),

      paintCar: (cuid, color) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const paint = PAINTS.find((p) => p.color === color)
        if (!car || !paint || car.color === color) return
        const bucks = paint.bucks ?? 0
        const coins = bucks ? 0 : PAINT_COST
        if (s.coins < coins) return s.showNeed('coins', coins - s.coins, 'a paint job')
        if (s.bucks < bucks) return s.showNeed('bucks', bucks - s.bucks, `${paint.name} paint`)
        set(withXp(s, 5, {
          coins: s.coins - coins,
          bucks: s.bucks - bucks,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, color } : c)),
          updatedAt: Date.now(),
        }))
        sfx.buy()
        s.toast(`Painted ${paint.name}!`)
      },

      stripeCar: (cuid, stripe) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car || (car.stripe ?? null) === stripe) return
        const cost = stripe ? STRIPE_COST : 0
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'racing stripes')
        set({ coins: s.coins - cost, cars: s.cars.map((c) => (c.uid === cuid ? { ...c, stripe } : c)), updatedAt: Date.now() })
      },

      loadSave: (save) => set({ ...starterDefaults(), ...save }),

      gpResult: (seriesId, won) => {
        const s = get()
        const series = GP_SERIES.find((o) => o.id === seriesId)
        if (!series) return
        const cur = s.gp[seriesId] ?? { round: 0, clears: 0 }
        const reward = gpReward(series, cur.round)
        s.finishRace(won, reward)
        if (!won) return
        const round = cur.round + 1
        if (round < GP_ROUNDS) return set({ gp: { ...s.gp, [seriesId]: { ...cur, round } } })
        const model = series.box[Math.floor(Math.random() * series.box.length)]
        const def = carDef(model)
        const color = def.colors[Math.floor(Math.random() * def.colors.length)]
        setTimeout(sfx.levelUp, 200)
        set((g) => ({
          gp: { ...g.gp, [seriesId]: { round: 0, clears: cur.clears + 1 } },
          gpPrize: { series: seriesId, model, color },
          cars: [...g.cars, { uid: uid(), model, color, upgrades: noUpgrades() }],
          trophies: g.trophies + 5,
          stats: { ...g.stats, carsBought: (g.stats.carsBought ?? 0) + 1, gpWins: (g.stats.gpWins ?? 0) + 1 },
          updatedAt: Date.now(),
        }))
      },

      closePrize: () => set({ gpPrize: null }),
      closeLevelUp: () => set({ levelUp: null }),
      focusShop: (panel, shopFocus) => set({ levelUp: null, panel, shopFocus, mode: 'play', placing: null, selected: null }),

      buyPlot: (px, pz) => {
        const s = get()
        if (!buyablePlots(s.land).some(([x, z]) => x === px && z === pz)) return
        const cost = plotPrice(s.land.length - START_LAND.length)
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'more land')
        // Scatter a few obstacles on the new plot.
        const obstacles: PlacedBuilding[] = []
        const used = new Set<string>()
        const count = 3 + Math.floor(Math.random() * 4)
        while (obstacles.length < count) {
          const x = px * PLOT + Math.floor(Math.random() * PLOT)
          const z = pz * PLOT + Math.floor(Math.random() * PLOT)
          if (used.has(key(x, z))) continue
          used.add(key(x, z))
          const r = Math.random()
          obstacles.push({ uid: uid(), def: r < 0.5 ? 'bush' : r < 0.85 ? 'rock' : 'cactus', x, z, jobEndsAt: null })
        }
        sfx.buy()
        s.toast('New land! Clear the obstacles to make room.')
        set(withXp(s, 50, {
          coins: s.coins - cost,
          land: [...s.land, `${px},${pz}`],
          buildings: [...s.buildings, ...obstacles],
          updatedAt: Date.now(),
        }))
      },

      refillFuel: () => {
        const s = get()
        const cap = fuelCap(s)
        if (s.fuel >= cap) return s.toast('Your tank is already full')
        if (s.bucks < REFILL_BUCKS) return s.showNeed('bucks', REFILL_BUCKS - s.bucks, 'a fuel refill')
        sfx.buy()
        s.toast(`Tank filled! +${cap - s.fuel} fuel`)
        set({ bucks: s.bucks - REFILL_BUCKS, fuel: cap, fuelUpdatedAt: Date.now(), panel: s.panel === 'need' ? null : s.panel, updatedAt: Date.now() })
      },

      showMe: (defs, text) => {
        set({ highlight: defs, panel: null, mode: 'play', placing: null, selected: null })
        get().toast(text)
        setTimeout(() => { if (get().highlight === defs) set({ highlight: null }) }, 6000)
      },

      startSearch: (spotId) => {
        const s = get()
        const spot = RESCUE_SPOTS.find((o) => o.id === spotId)
        if (!spot) return
        if (!hasRusty(s)) return s.toast("Build Rusty's Rescue first")
        if (s.level < spot.unlockLevel) return s.showNeed('level', spot.unlockLevel, spot.name)
        if (s.junkyard.length >= STORAGE_MAX) return s.toast('Storage is full. Restore or scrap a car first.')
        if (s.coins < spot.cost) return s.showNeed('coins', spot.cost - s.coins, `a search in the ${spot.name}`)
        sfx.start()
        set({
          coins: s.coins - spot.cost,
          search: rollSearch(spotId),
          stats: bump(s, 'searches'),
          updatedAt: Date.now(),
        })
      },

      revealPin: (i) => {
        const s = get()
        const q = s.search
        if (!q || q.flat || q.revealed[i]) return
        if (q.flatAt === i) {
          sfx.error()
          return set({ search: { ...q, truckAt: i, flat: true } })
        }
        const loot = q.pins[i]
        if (loot.kind === 'car') sfx.levelUp()
        else if (loot.kind !== 'nothing') sfx.coin()
        else sfx.click()
        set({ search: { ...q, truckAt: i, revealed: q.revealed.map((r, j) => r || j === i) } })
      },

      fixTruck: () => {
        const s = get()
        const q = s.search
        if (!q?.flat) return
        if (s.bucks < 1) return s.showNeed('bucks', 1, 'fixing the tow truck')
        sfx.buy()
        const i = q.flatAt!
        set({ bucks: s.bucks - 1, search: { ...q, flat: false, flatAt: null, revealed: q.revealed.map((r, j) => r || j === i) }, updatedAt: Date.now() })
      },

      abandonSearch: () => {
        const s = get()
        if (s.search?.flat) s.toast('The tow truck limped home empty-handed.')
        set({ search: null })
      },

      towHome: () => {
        const s = get()
        const q = s.search
        if (!q || q.flat) return
        const found = q.pins.filter((_, i) => q.revealed[i])
        let { coins, parts, fuel, trophies } = s
        const junkyard = [...s.junkyard]
        const notes: string[] = []
        let scrapped = 0
        for (const l of found) {
          if (l.kind === 'coins') coins += l.n
          else if (l.kind === 'parts') parts += l.n
          else if (l.kind === 'fuel') fuel += l.n
          else if (l.kind === 'trophy') trophies += 1
          else if (l.kind === 'car') {
            if (junkyard.length < STORAGE_MAX) {
              junkyard.push({ uid: uid(), model: l.model, rarity: l.rarity })
              notes.push(carDef(l.model).name)
            } else {
              scrapped += RARITY[l.rarity].scrapParts
            }
          }
        }
        parts += scrapped
        sfx.coin()
        s.toast(notes.length ? `Rusty towed home: ${notes.join(', ')}!` : 'Rusty hauled everything home.')
        if (scrapped) setTimeout(() => get().toast(`Storage was full, so extra finds were scrapped for ${scrapped} parts.`), 600)
        set(withXp(s, 10 + notes.length * 10, {
          coins, parts, fuel, trophies, junkyard,
          search: null,
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + (coins - s.coins) },
          updatedAt: Date.now(),
        }))
      },

      restoreCar: (juid) => {
        const s = get()
        const car = s.junkyard.find((c) => c.uid === juid)
        if (!car) return
        if (carDef(car.model).parked) return s.toast('This car is coming in a future update. Check back soon!')
        if (s.restoring) return s.toast('The restore bay is busy. Finish that car first.')
        const cost = restoreCost(carDef(car.model))
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, `restoring the ${carDef(car.model).name}`)
        const minutes = RARITY[car.rarity].minutes
        sfx.start()
        set({
          coins: s.coins - cost,
          junkyard: s.junkyard.filter((c) => c.uid !== juid),
          restoring: { ...car, minutes, endsAt: Date.now() + minutes * 60000 },
          updatedAt: Date.now(),
        })
      },

      rushRestore: () => {
        const s = get()
        const r = s.restoring
        if (!r) return
        const left = r.endsAt - Date.now()
        if (left <= 0) return
        const cost = rushBucks(left)
        if (s.bucks < cost) return s.showNeed('bucks', cost - s.bucks, 'finishing the restore now')
        sfx.buy()
        set({ bucks: s.bucks - cost, restoring: { ...r, endsAt: Date.now() }, updatedAt: Date.now() })
      },

      collectRestored: (plate) => {
        const s = get()
        const r = s.restoring
        if (!r || Date.now() < r.endsAt) return
        const c = carDef(r.model)
        sfx.buy()
        s.toast(`${c.name} restored and added to your garage!`)
        set(withXp(s, 25 + Math.round(c.price / 200), {
          restoring: null,
          cars: [...s.cars, { uid: r.uid, model: r.model, color: c.colors[0], upgrades: noUpgrades(), plate: cleanPlate(plate) || undefined }],
          stats: { ...s.stats, rescued: (s.stats.rescued ?? 0) + 1, carsBought: (s.stats.carsBought ?? 0) + 1 },
          updatedAt: Date.now(),
        }))
      },

      scrapCar: (juid) => {
        const s = get()
        const car = s.junkyard.find((c) => c.uid === juid)
        if (!car) return
        if (carDef(car.model).parked) return s.toast('This car is coming in a future update, so it stays in storage')
        const n = RARITY[car.rarity].scrapParts
        sfx.coin()
        s.toast(`Scrapped the ${carDef(car.model).name} for ${n} parts`)
        set({ junkyard: s.junkyard.filter((c) => c.uid !== juid), parts: s.parts + n, updatedAt: Date.now() })
      },
    }),
    {
      name: 'cartopia-save',
      partialize: (s) => saveOf(s),
      merge: (persisted, current) => (persisted ? { ...current, ...starterDefaults(), ...(persisted as Partial<SaveState>) } : current),
    },
  ),
)

export function saveOf(s: GameState): SaveState {
  const { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings, cars, stats, claimedGoals, lastDaily, dailyStreak, helped, tutorial, junkyard, restoring, gp, land, updatedAt } = s
  return { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings, cars, stats, claimedGoals, lastDaily, dailyStreak, helped, tutorial, junkyard, restoring, gp, land, updatedAt }
}

// Fields added after launch, so older saves load with sensible values.
function starterDefaults(): Pick<SaveState, 'stats' | 'claimedGoals' | 'lastDaily' | 'dailyStreak' | 'helped' | 'tutorial' | 'junkyard' | 'restoring' | 'gp' | 'land'> {
  // Saves from before the tutorial existed skip it.
  return { stats: emptyStats(), claimedGoals: [], lastDaily: null, dailyStreak: 0, helped: {}, tutorial: 99, junkyard: [], restoring: null, gp: {}, land: [...START_LAND] }
}


const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const range = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))

function rollCar(spotId: string): Loot {
  const spot = RESCUE_SPOTS.find((o) => o.id === spotId)!
  const total = spot.cars.reduce((n, c) => n + RARITY[c.rarity].weight, 0)
  let r = Math.random() * total
  for (const c of spot.cars) {
    r -= RARITY[c.rarity].weight
    if (r <= 0) return { kind: 'car', ...c }
  }
  return { kind: 'car', ...spot.cars[0] }
}

// Pre-rolls what every pin hides. Each search finds at least one car, and
// about one in four gives the tow truck a flat partway through.
function rollSearch(spotId: string): Search {
  const spot = RESCUE_SPOTS.find((o) => o.id === spotId)!
  const scale = spot.cost / 500
  const pins: Loot[] = Array.from({ length: RESCUE_PINS }, () => {
    const r = Math.random()
    if (r < 0.1) return rollCar(spotId)
    if (r < 0.42) return { kind: 'coins', n: Math.round(range(4, 14) * 5 * scale) }
    if (r < 0.62) return { kind: 'parts', n: range(1, 3) + Math.floor(scale / 3) }
    if (r < 0.74) return { kind: 'fuel', n: range(1, 3) }
    if (r < 0.77) return { kind: 'trophy' }
    return { kind: 'nothing' }
  })
  if (!pins.some((p) => p.kind === 'car')) pins[Math.floor(Math.random() * RESCUE_PINS)] = rollCar(spotId)
  const flatAt = Math.random() < 0.25 ? pick(Array.from({ length: RESCUE_PINS }, (_, i) => i).filter((i) => pins[i].kind !== 'car')) : null
  return { spot: spotId, pins, revealed: pins.map(() => false), truckAt: null, flatAt: flatAt ?? null, flat: false }
}

export const spendFuel = (amount: number) => {
  const s = useGame.getState()
  if (s.fuel < amount) return false
  const cap = fuelCap(s)
  useGame.setState({ fuel: s.fuel - amount, fuelUpdatedAt: s.fuel >= cap ? Date.now() : s.fuelUpdatedAt })
  return true
}
