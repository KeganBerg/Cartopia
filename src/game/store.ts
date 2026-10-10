import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  GRID, buildingDef, carDef, xpToNext, baseFuelCap, FUEL_REGEN_SECONDS, BUILDINGS,
  upgradeCost, MAX_UPGRADE, GOALS, DAILY_BONUS, PAINTS, PAINT_COST, STRIPE_COST, FLAT_CHANCE, flatFixCost, type UpgradeSlot, type StatKey,
} from './data'
import { sfx } from '../lib/sound'

export type PlacedBuilding = { uid: string; def: string; x: number; z: number; jobEndsAt: number | null }
export type OwnedCar = { uid: string; model: string; color: string; upgrades: Record<UpgradeSlot, number>; flat?: boolean; stripe?: string | null }

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
  updatedAt: number
}

export type Mode = 'play' | 'place' | 'road' | 'bulldoze'
export type Resource = 'coins' | 'parts' | 'fuel' | 'bucks' | 'level'
export type Need = { res: Resource; missing: number; what?: string }

export type Panel = null | 'need' | 'shop' | 'garage' | 'showroom' | 'race' | 'account' | 'goals' | 'daily' | 'flat' | 'friends'

// A read-only copy of another player's town while visiting it.
export type VisitedTown = { ownerId: string; townName: string; level: number; trophies: number; roads: string[]; buildings: PlacedBuilding[]; cars: OwnedCar[] }

type UiState = {
  mode: Mode
  placing: string | null
  panel: Panel
  selectedCar: string | null
  toasts: { id: number; text: string }[]
  visiting: VisitedTown | null
  need: Need | null
}

type Actions = {
  setMode: (m: Mode, placing?: string | null) => void
  showNeed: (res: Resource, missing: number, what?: string) => void
  openPanel: (p: Panel) => void
  selectCar: (uid: string | null) => void
  toast: (text: string) => void
  tick: (now: number) => void
  placeBuilding: (def: string, x: number, z: number) => boolean
  paintRoad: (x: number, z: number) => void
  bulldoze: (x: number, z: number) => void
  tapBuilding: (uid: string) => void
  buyCar: (model: string, color: string) => boolean
  upgradeCar: (uid: string, slot: UpgradeSlot) => boolean
  sellCar: (uid: string) => void
  finishRace: (won: boolean, reward: number) => void
  renameTown: (name: string) => void
  claimGoal: (id: string) => void
  claimDaily: () => void
  fixFlat: (uid: string, tow: boolean) => void
  paintCar: (uid: string, color: string) => void
  visit: (town: VisitedTown | null) => void
  helpFriend: () => void
  setTutorial: (step: number) => void
  stripeCar: (uid: string, stripe: string | null) => void
  loadSave: (s: SaveState) => void
}

export type GameState = SaveState & UiState & Actions

const key = (x: number, z: number) => `${x},${z}`
let uidCounter = 0
const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const emptyStats = (): Record<StatKey, number> => ({ rusty: 0, jobs: 0, carsBought: 0, upgrades: 0, racesWon: 0, built: 0, roads: 0, coinsEarned: 0, flatsFixed: 0 })
export const today = () => new Date().toISOString().slice(0, 10)
const noUpgrades = (): Record<UpgradeSlot, number> => ({ engine: 0, turbo: 0, tires: 0, weight: 0 })

export function fuelCap(s: Pick<SaveState, 'level' | 'buildings'>) {
  const gas = s.buildings.reduce((n, b) => n + (buildingDef(b.def).fuelCap ?? 0), 0)
  return baseFuelCap(s.level) + gas
}

export function footprint(def: string, x: number, z: number) {
  const d = buildingDef(def)
  const tiles: [number, number][] = []
  for (let dx = 0; dx < d.w; dx++) for (let dz = 0; dz < d.h; dz++) tiles.push([x + dx, z + dz])
  return tiles
}

// Map of tile key -> what occupies it.
export function occupancy(s: Pick<SaveState, 'roads' | 'buildings'>) {
  const occ = new Map<string, string>()
  for (const r of s.roads) occ.set(r, 'road')
  for (const b of s.buildings) for (const [x, z] of footprint(b.def, b.x, b.z)) occ.set(key(x, z), b.uid)
  return occ
}

export function canPlace(s: Pick<SaveState, 'roads' | 'buildings'>, def: string, x: number, z: number) {
  const occ = occupancy(s)
  return footprint(def, x, z).every(([tx, tz]) => tx >= 0 && tz >= 0 && tx < GRID && tz < GRID && !occ.has(key(tx, tz)))
}

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
  const unlocked = BUILDINGS.filter((d) => d.unlockLevel === level).map((d) => d.name)
  setTimeout(sfx.levelUp, 250)
  s.toast(`Level up! You're level ${level}. +1 buck${unlocked.length ? `. Unlocked: ${unlocked.join(', ')}` : ''}`)
  return { level, xp, bucks, coins, fuel: fuelCap(fresh), fuelUpdatedAt: Date.now() }
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...starterTown(),
      mode: 'play',
      placing: null,
      panel: null,
      selectedCar: null,
      toasts: [],
      visiting: null,
      need: null,

      setMode: (mode, placing = null) => set({ mode, placing, panel: null }),
      showNeed: (res, missing, what) => {
        sfx.error()
        set({ need: { res, missing: Math.max(0, Math.ceil(missing)), what }, panel: 'need', mode: 'play', placing: null })
      },
      openPanel: (panel) => set({ panel, mode: 'play', placing: null }),
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

      placeBuilding: (def, x, z) => {
        const s = get()
        const d = buildingDef(def)
        if (!canPlace(s, def, x, z)) {
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
        if (def === 'rescue') setTimeout(() => get().toast("Rusty's open for business! The Showroom is unlocked."), 400)
        sfx.click()
        set({
          coins: s.coins - d.price,
          bucks: s.bucks - (d.bucks ?? 0),
          buildings: [...s.buildings, { uid: uid(), def, x, z, jobEndsAt: null }],
          stats: def === 'rescue' ? { ...bump(s, 'built'), rusty: 1 } : bump(s, 'built'),
          ...addXp(s, Math.max(1, Math.round(d.price / 100))),
          updatedAt: Date.now(),
        })
        return true
      },

      paintRoad: (x, z) => {
        const s = get()
        if (x < 0 || z < 0 || x >= GRID || z >= GRID) return
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
        if (!d.jobSeconds) return
        const now = Date.now()
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
            buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: now + d.jobSeconds! * 1000 } : o)),
            updatedAt: now,
          })
        } else if (now >= b.jobEndsAt) {
          const parts = d.partsPayout ?? 0
          sfx.coin()
          s.toast(`+${d.payout} coins${parts ? `, +${parts} parts` : ''}, +${d.xp} XP`)
          // Sometimes a car out on the job comes back with a flat.
          let cars = s.cars
          const rolling = cars.filter((c) => !c.flat)
          if (rolling.length > 1 && Math.random() < FLAT_CHANCE) {
            const victim = rolling[Math.floor(Math.random() * rolling.length)]
            cars = cars.map((c) => (c.uid === victim.uid ? { ...c, flat: true } : c))
            setTimeout(() => get().toast(`Oh no, your ${carDef(victim.model).name} got a flat tire! Tap it to fix.`), 600)
          }
          set({
            coins: s.coins + d.payout!,
            parts: s.parts + parts,
            cars,
            stats: { ...bump(s, 'jobs'), coinsEarned: (s.stats.coinsEarned ?? 0) + d.payout! },
            buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: null } : o)),
            ...addXp(s, d.xp!),
            updatedAt: now,
          })
        }
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
        set({
          coins: s.coins - c.price,
          bucks: s.bucks - (c.bucks ?? 0),
          cars: [...s.cars, { uid: uid(), model, color, upgrades: noUpgrades() }],
          stats: bump(s, 'carsBought'),
          ...addXp(s, 20 + Math.round(c.price / 200)),
          updatedAt: Date.now(),
        })
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
        set({
          coins: s.coins - cost.coins,
          parts: s.parts - cost.parts,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, upgrades: { ...c.upgrades, [slot]: lvl + 1 } } : c)),
          stats: bump(s, 'upgrades'),
          ...addXp(s, 15 + lvl * 10),
          updatedAt: Date.now(),
        })
        return true
      },

      sellCar: (cuid) => {
        const s = get()
        if (s.cars.length <= 1) return s.toast('You need at least one car')
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return
        const value = Math.floor(carDef(car.model).price * 0.5)
        set({ cars: s.cars.filter((c) => c.uid !== cuid), coins: s.coins + value, selectedCar: null, updatedAt: Date.now() })
      },

      finishRace: (won, reward) => {
        const s = get()
        set({
          coins: s.coins + (won ? reward : Math.round(reward * 0.1)),
          trophies: s.trophies + (won ? 1 : 0),
          racesWon: s.racesWon + (won ? 1 : 0),
          stats: { ...bump(s, 'racesWon', won ? 1 : 0), coinsEarned: (s.stats.coinsEarned ?? 0) + (won ? reward : Math.round(reward * 0.1)) },
          ...addXp(s, won ? 30 : 8),
          updatedAt: Date.now(),
        })
      },

      renameTown: (townName) => set({ townName: townName.slice(0, 24) || 'My Town', updatedAt: Date.now() }),

      claimGoal: (id) => {
        const s = get()
        const g = GOALS.find((o) => o.id === id)
        if (!g || s.claimedGoals.includes(id) || !goalDone(s, g)) return
        sfx.coin()
        s.toast(`Goal complete! +${g.coins} coins${g.bucks ? `, +${g.bucks} bucks` : ''}, +${g.xp} XP`)
        set({
          coins: s.coins + g.coins,
          bucks: s.bucks + (g.bucks ?? 0),
          claimedGoals: [...s.claimedGoals, id],
          ...addXp(s, g.xp),
          updatedAt: Date.now(),
        })
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
        set({
          coins: s.coins - cost,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, flat: false } : c)),
          stats: bump(s, 'flatsFixed'),
          panel: null,
          ...addXp(s, tow ? 15 : 5),
          updatedAt: Date.now(),
        })
        s.toast(tow ? "Rusty towed it in and patched it up. +15 XP" : `Tire fixed for $${cost}`)
      },

      visit: (visiting) => set({ visiting, panel: null, mode: 'play', placing: null, selectedCar: null }),

      helpFriend: () => {
        const s = get()
        const v = s.visiting
        if (!v) return
        if (s.helped[v.ownerId] === today()) return s.toast('You already helped this town today')
        const coins = 100 + v.level * 20
        sfx.coin()
        s.toast(`You helped ${v.townName}! +${coins} coins, +10 XP`)
        set({ coins: s.coins + coins, helped: { ...s.helped, [v.ownerId]: today() }, ...addXp(s, 10), updatedAt: Date.now() })
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
        set({
          coins: s.coins - coins,
          bucks: s.bucks - bucks,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, color } : c)),
          ...addXp(s, 5),
          updatedAt: Date.now(),
        })
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
    }),
    {
      name: 'cartopia-save',
      partialize: (s) => saveOf(s),
      merge: (persisted, current) => (persisted ? { ...current, ...starterDefaults(), ...(persisted as Partial<SaveState>) } : current),
    },
  ),
)

export function saveOf(s: GameState): SaveState {
  const { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings, cars, stats, claimedGoals, lastDaily, dailyStreak, helped, tutorial, updatedAt } = s
  return { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings, cars, stats, claimedGoals, lastDaily, dailyStreak, helped, tutorial, updatedAt }
}

// Fields added after launch, so older saves load with sensible values.
function starterDefaults(): Pick<SaveState, 'stats' | 'claimedGoals' | 'lastDaily' | 'dailyStreak' | 'helped' | 'tutorial'> {
  // Saves from before the tutorial existed skip it.
  return { stats: emptyStats(), claimedGoals: [], lastDaily: null, dailyStreak: 0, helped: {}, tutorial: 99 }
}

export const spendFuel = (amount: number) => {
  const s = useGame.getState()
  if (s.fuel < amount) return false
  const cap = fuelCap(s)
  useGame.setState({ fuel: s.fuel - amount, fuelUpdatedAt: s.fuel >= cap ? Date.now() : s.fuelUpdatedAt })
  return true
}
