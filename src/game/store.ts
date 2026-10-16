import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  PLOT, PLOT_MIN, PLOT_MAX, START_LAND, plotPrice, buildingDef, carDef, xpToNext, baseFuelCap, FUEL_REGEN_SECONDS,
  upgradeCost, MAX_UPGRADE, upgradable, buildingLevel, jobLevel, upgradePartsPayout, jobXp, raceXp, serviceXp, jobSeconds, upgradeFuelCap, buildingUpgradeCost, buildingUpgradeXp, maxLevel, themable, RESCUE_SPOTS, RESCUE_CAR_CHANCE, STORAGE_MAX, RARITY, restoreCost, rushBucks, refillBucks, LEVEL_GEMS, TOW_FIX_BUCKS, GP_SERIES, GP_ROUNDS, gpReward, CAMPAIGN, campaignRaceId, campaignReward, campaignStars, campaignCleared, campaignPerfect, type Rarity, GOALS, activeEvent, PAINTS, STRIPES, FINISHES, paintJobCost, type Finish, type PaintJob, FLAT_CHANCE, LOW_FUEL_CHANCE, servicePay, gasCanCost, flatFixCost, type UpgradeSlot, type StatKey, modDef, modXp, modFits, ownedMods, driverPayout, mergedParts, mergeBonus, mergeGain, takesDriver, loves, isOpen, type CarDef, CAR_SETS, setComplete, type CounterKey, type GoalDef, COUNTERS, DAILY_TASKS, WEEKLY_TASKS, QUEST_PAY, CREW_CHEST, TASKS_PER_PERIOD, payAt, dayKey, weekKey, drawTasks, garagePower, seasonNumber, seasonOf, SEASON_STARS, skinDef, ownedSkins, seasonSkin, modSkinDef, ownedModSkins, seasonModSkin, SKINNED_SLOTS, type SkinnedSlot, fittedMods, SEASON_TIERS, STARS_PER_TIER, SEASON_CAR_BUCKS, dealsFor, dealOffer, type DealDef, type DealKind,
} from './data'
import { PAINT_COST, hasCustomPaint, isHexColor, PANELS, PATTERNS, STARTER_PAINTS, isBike, panelJobCost, tidyPanels, type Panels, RUSTY_SETS, hotSpot, rarityWeight, truckOf, TRUCK, BAY2_LEVEL } from './data'
import { cleanHat, earnedHats, hatDef, hatQuestOf, newHatQuest, ownedHats, sameHat, type HatFit, type HatQuest } from './hats'
import { raceCarOf } from './raceCar'
import { sfx } from '../lib/sound'
import { applyAutoJobs, autoJobs, autoJobsChange } from './autoJobs'
import { fx } from './fx'
import { clearCost, wildPlot } from './wildLand'
import { opensLabel } from './clock'
import { requestTrip, requestVisit } from './trips'
import { trialPrize } from './trial'
import { RIVALS, RIVAL_VISITS, RIVAL_BACK_MS, type RivalProgress } from './rivals'
import { earnHint, paintOpen, paintRival, rivalForPaint, rowPrize } from './paintRivals'
import { PRESET_SLOTS, sameTrim, tidyTrim, trimCost, trimLocked, type Trim } from './trim'
import { WORLD_TOUR, worldDone, worldPrize } from './worldTour'
import type { Recap, SeasonBase } from './recap'
import { FRIEND_LEVELS, FRIEND_POINTS, friendLevel, type FriendAct } from './friendship'
import { tunerPrize, tunerTrial } from './tuner'
import { tourIsBoss, tourLegBonus, tourLegOf, tourPrize } from './tour'
import { EVENT_RACES, eventBonus, eventFor, eventIsBoss, eventPrize, eventProgress, type EventProgress } from './events'
import { trialWeek } from './trial'
import { groupOf, groupTurn, mergeCandidates, mergeBoosts, mergeFuel, applyMerge, applySplit, rotateGroup, moveGroup, isLandmark, LANDMARK_NAME, type MergeGroup } from './merge'
import { togglePick } from './meet'
import { crateCost, crateDef, crateOwnedSkins, pityHit, rollCrate, rollSourcePiece, type CrateId, type CrateOpen } from './crates'
import { pieceId } from './resto'
import { rollWheel, type WheelSpin } from './wheel'
import { LIVE_LOSS_SHARE, LOSS_SHARE, boostFor, placeShare, boostLabel, emptyBoosts, welcomeBack, type BoostMode, type Boosts } from './boosts'
import { claim, type WagerEntry } from './wager'
import { carClassTier, classTier, classWon, galaxy, masteryTier, masteryXp, noteRace, type Mastery, type MasteryMode } from './mastery'
import { roadClaim, roadOpen, roadReached } from './trophyRoad'
import { CHEERS, TRAILS, flairOpen, flairOpenCount } from './flair'
import { DAILY_MEDALS, DAILY_PAY, dailyMedal, dailyRun, type DailySave } from './daily'
import { cupCrateSource, cupPrize, cupRace } from './cups'
import { CAR_CLASSES } from './classes'
import type { CarClassId } from './classes'
import { cleanLights, colorTheme, DEFAULT_LIGHTS, type Lights } from './cityLook'

// rot: quarter turns the player chose (0 faces south). Unset means face the nearest road.
// level: upgrade level 1-10 (see MAX_BUILDING_LEVEL); unset means 1.
// jobLevel: the level the running job started at, so an upgrade mid-job only pays from the next job.
// car: uid of the owned car assigned to drive for this business (see DRIVER_BONUS).
// merge: set on the top-left building of a merged block (see merge.ts); mturn: the turn the player gave that block.
// tint: the building's own colour theme (game/cityLook.ts COLOR_THEMES); unset keeps its colours.
// stored: only in the saved copy, on a bulldozed building waiting in the inventory (see saveOf).
export type PlacedBuilding = { uid: string; def: string; x: number; z: number; jobEndsAt: number | null; rot?: number; level?: number; jobLevel?: number; car?: string; merge?: number; mturn?: number; tint?: string; stored?: boolean }
// A saved look: a car's paint, panels and trim.
export type Preset = { color: string; finish?: Finish; stripe?: string | null; panels?: Panels; trim?: Trim }
export type OwnedCar = { uid: string; model: string; color: string; upgrades: Record<UpgradeSlot, number>; flat?: boolean; lowFuel?: boolean; stripe?: string | null; finish?: Finish; plate?: string; mods?: string[]; ownedMods?: string[]; skin?: string; modSkin?: Partial<Record<SkinnedSlot, string>>; panels?: Panels; trim?: Trim; hat?: HatFit | null }
// A rusty find waiting in Rusty's storage, and the one car in the restore bay.
export type JunkCar = { uid: string; model: string; rarity: Rarity }
export type Restoring = JunkCar & { endsAt: number; minutes: number }
export type Loot =
  | { kind: 'car'; model: string; rarity: Rarity; uid?: string }
  | { kind: 'coins' | 'parts' | 'fuel'; n: number }
  | { kind: 'trophy' }
  | { kind: 'nothing' }
// A search in progress. Not saved: leaving mid-search forfeits it.
// piece: a resto-mod piece the search turned up (Rusty's top spot), already added by applyCrate().
export type Search = { spot: string; pins: Loot[]; revealed: boolean[]; truckAt: number | null; flatAt: number | null; flat: boolean; piece?: { model: string; piece: number } }

// Daily and weekly tasks. Each period keeps the three tasks drawn for it (with their targets),
// the counters as they stood when it began (progress is counted from there), which tasks were
// collected, and whether the chest for finishing all three was opened. The server guard pays at
// most three tasks and one chest per day and per week (see econ_catalog().quests).
export type TaskSlot = { id: string; n: number }
export type Quests = {
  day: string; daily: TaskSlot[]; dayBase: Partial<Record<CounterKey, number>>; dayDone: string[]; dayChest: boolean
  week: string; weekly: TaskSlot[]; weekBase: Partial<Record<CounterKey, number>>; weekDone: string[]; weekChest: boolean
}
export type Period = 'daily' | 'weekly'
// A paid gem pack, as the server's purchases table records it (src/lib/payments.ts).
// car: a car pack's car, which joins the garage as uid pk-<seq> (the save guard checks that pairing).
export type Purchase = { seq: number; pack?: string; bucks: number; coins: number; parts: number; car?: string | null }

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
  stats: Record<CounterKey, number>
  claimedGoals: string[]
  quests: Quests | null
  lastDaily: string | null
  dailyStreak: number
  helped: Record<string, string>
  tutorial: number
  junkyard: JunkCar[]
  restoring: Restoring | null
  // Rusty's second restore bay (from BAY2_LEVEL), and the tow truck's upgrade level (TRUCK).
  restoring2: Restoring | null
  truck: number
  gp: Record<string, { round: number; clears: number }>
  // Campaign races won, by race id, with the best stars earned (1-3).
  campaign: Record<string, number>
  // Collection book sets whose one-time reward has been claimed.
  claimedSets: string[]
  // Crew chests opened. The server guard pays one chest per crew_chests row it holds for this player.
  crewChests: number
  // Town visitor prizes collected: the server's number for the latest claim (visitor_claim()). The
  // guard pays the prizes of the claims this goes up by.
  visits: number
  // Crates opened: the server's number for the latest open added here (crate_open()). The guard
  // charges and pays the opens this goes up by.
  crates: number
  // Crate opens in a row without a guaranteed prize, by crate (see CrateDef.pity).
  cratePity?: Partial<Record<CrateId, number>>
  // First-win-of-the-day and welcome-back bonuses (game/boosts.ts).
  boosts?: Boosts
  // Wager races: the last server ledger row (wager_ledger) whose coins this save includes.
  wagers?: number
  // Gem packs bought: the last server purchases row (seq) whose gems this save includes.
  purchases?: number
  // Season track: the season number, stars earned in it, and tiers (0-based) collected.
  season: SeasonProgress | null
  // Daily deals used today (UTC), by deal id. The server guard allows each discount once a day.
  deals: { day: string; used: string[] } | null
  // Weekly time trial prizes claimed, by week (its Monday, YYYY-MM-DD), with the place that paid.
  trials: { claimed: Record<string, number> }
  // Town rivals: times each one has been beaten (0-3) and when a beaten one comes back.
  // The server guard pays a rival's bonus once, when they're first beaten three times.
  rivals: Record<string, RivalProgress>
  // Paint rivals (game/paintRivals.ts): wins over each one. The first win unlocks their colour.
  rivalRow: Record<string, number>
  // Tuner Trials (game/tuner.ts): wins in each. Some first wins unlock a paint pattern.
  tuner?: Record<string, number>
  // Car mastery by car model (game/mastery.ts): race counts and tiers reached.
  mastery?: Record<string, Mastery>
  // Trophy Road stops claimed, and the mystery cosmetics they gave, in order (game/trophyRoad.ts).
  road?: number
  roadItems?: string[]
  // Free crates waiting in the Crate Depot, by source (a Class Cup race: `cup:<id>`).
  freeCrates?: string[]
  // Flair (game/flair.ts): the boost trail and win celebration picked, and how many were open when last seen.
  trail?: string
  cheer?: string
  flairSeen?: number
  // The Daily Run (game/daily.ts): today's best time and whether its pay is taken.
  daily?: DailySave
  // The last reputation title announced (game/reputation.ts).
  repSeen?: number
  // Season recap (game/recap.ts): the snapshot taken when this season began, and a recap of
  // the last one waiting to be shown.
  seasonBase?: SeasonBase
  recap?: Recap | null
  // Friendship points by friend id (game/friendship.ts).
  friendship?: Record<string, number>
  // Saved looks (paint, panels and trim) to put on any car, by slot (game/trim.ts PRESET_SLOTS).
  presets?: (Preset | null)[]
  // World Tour racers beaten, in order (game/worldTour.ts).
  worldTour?: number
  // The tutorial was skipped before its free paint pick, so the next coin colour is free.
  freePaint?: boolean
  // Class Cups (game/cups.ts): wins in each race.
  cups?: Record<string, number>
  // True for towns from before paint rivals, which keep every colour they could already buy.
  oldPaints?: boolean
  // Pro Tour races won (game/tour.ts); the next race is this one.
  tour: number
  // This week's event (game/events.ts): its week, the rival base PI and races won. Older weeks are ignored.
  event: EventProgress | null
  // Car uids on show at the Car Meet and cruising Main Street (see game/meet.ts).
  showcase: string[]
  // The car picked for racing (game/raceCar.ts). Missing = the highest-PI car.
  raceCar?: string | null
  // Skins bought or won (season track, crates). Level and set skins aren't listed; see ownedSkins().
  skins: string[]
  // Mod skins bought or won; level and set ones are worked out (ownedModSkins()).
  modSkins: string[]
  // Resto-mod pieces won from crates, as "model:piece" (game/resto.ts).
  restoParts?: string[]
  // Hats won by challenges or from crates (game/hats.ts); each car wears one of them (OwnedCar.hat).
  hats: string[]
  // Hat challenge progress (game/hats.ts HatQuest). Never resets.
  hatQuest: HatQuest
  // City look (game/cityLook.ts), cosmetic only: street lights and a theme for every building.
  lights?: Lights
  cityTheme?: string
  land: string[]
  // Bulldozed buildings and decor, kept with their level to place again for free. Saved inside
  // `buildings` with `stored: true` (saveOf), so the server's guard still counts their worth.
  stored?: PlacedBuilding[]
  updatedAt: number
}
export type SeasonProgress = { n: number; stars: number; claimed: number[] }

export type Mode = 'play' | 'place' | 'move' | 'road' | 'bulldoze' | 'expand' | 'merge'
export type Resource = 'coins' | 'parts' | 'fuel' | 'bucks' | 'level'
export type Need = { res: Resource; missing: number; what?: string }

export type Panel = null | 'need' | 'shop' | 'garage' | 'showroom' | 'race' | 'account' | 'goals' | 'daily' | 'flat' | 'friends' | 'rescue' | 'bank' | 'invites' | 'leaders' | 'clan' | 'upgrade' | 'welcome' | 'gifts' | 'season' | 'deals' | 'ghost' | 'taunts' | 'meet' | 'arcade' | 'crates' | 'battle' | 'chat' | 'inventory' | 'carpacks' | 'admin'

// A read-only copy of another player's town while visiting it.
export type VisitedTown = { ownerId: string; townName: string; level: number; trophies: number; roads: string[]; buildings: PlacedBuilding[]; cars: OwnedCar[]; land?: string[]; showcase?: string[] }

type UiState = {
  mode: Mode
  placing: string | null
  // Quarter turns for the building being placed; null follows the nearest road.
  placeRot: number | null
  // The placed building picked in move mode, for dragging and rotating.
  selected: string | null
  // The inventory building being placed (placing holds its def).
  placingStored: string | null
  // Building type just placed, so the edit bar can offer to build another.
  again: string | null
  panel: Panel
  // Menus opened on the way to this one, so closing it goes back a step instead of to the town.
  panelBack: Exclude<Panel, null>[]
  selectedCar: string | null
  toasts: { id: number; text: string }[]
  visiting: VisitedTown | null
  // Signed in as an admin (server says so: public.is_admin()). Not saved.
  admin: boolean
  need: Need | null
  search: Search | null
  // Building types whose bubbles pulse after a "Show me" tap.
  highlight: string[] | null
  shopFocus: string | null // building the Shop scrolls to and points out
  // The placed building the upgrade panel is showing.
  upgrading: string | null
  // A Grand Prix mystery box waiting to be opened.
  gpPrize: { series: string; model: string; color: string } | null
  // A campaign chapter just cleared (or perfected), with what it paid.
  campaignPrize: { chapter: string; coins: number; bucks: number; trophies: number; cleared: boolean; perfect: boolean } | null
  // A Pro Tour leg just cleared, with its bonus.
  tourPrize: { leg: number; coins: number } | null
  // A weekly event just cleared: its id, the skin it gave (null: already owned) and the bonus coins.
  eventPrize: { id: string; skin: string | null; coins: number } | null
  // A paint rival just beaten for the first time: their id (their colour is now unlocked).
  paintPrize: string | null
  // A Tuner Trial just won for the first time: its id.
  tunerPrize: string | null
  // Mastery news from a race: the car model and the step it just reached (0: none), class tiers
  // just reached, Galaxy, and classes whose first-win colour just opened.
  masteryPrize: { model: string; tier: number; classes: { cls: CarClassId; tier: number }[]; galaxy: boolean; first: CarClassId[]; xp?: number } | null
  // A Class Cup race just won for the first time: its id (it gave a free crate).
  cupPrize: string | null
  // The signed-in player's clan, shown on the Crew House.
  clanBadge: { tag: string; emblem: string; color: string } | null
  // Level-up splash: the levels just reached and the rewards they paid.
  levelUp: { from: number; to: number; coins: number; bucks: number } | null
}

// Opening a menu from another one remembers the way back. Opening from the town (or
// going to the town) starts a fresh trail; reopening a menu already on the trail cuts
// back to it, so the trail never loops.
export function navTo(s: { panel: Panel; panelBack: Exclude<Panel, null>[] }, next: Panel): { panel: Panel; panelBack: Exclude<Panel, null>[] } {
  if (!next || !s.panel) return { panel: next, panelBack: [] }
  if (next === s.panel) return { panel: next, panelBack: s.panelBack }
  const at = s.panelBack.indexOf(next)
  // A not-enough popup is a stop on the way, not a menu to come back to.
  const keep = s.panel === 'need' ? s.panelBack : [...s.panelBack, s.panel]
  return { panel: next, panelBack: at >= 0 ? s.panelBack.slice(0, at) : keep }
}

type Actions = {
  setMode: (m: Mode, placing?: string | null) => void
  showNeed: (res: Resource, missing: number, what?: string) => void
  openPanel: (p: Panel) => void
  // Close the open menu: back to the one it was opened from, or the town.
  closePanel: () => void
  // Switch to a sibling menu from a tab row (Garage / Showroom / Crates, Friends / Crew): same place in the trail.
  swapPanel: (p: Exclude<Panel, null>) => void
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
  // Picks a building from the inventory to place, then puts it down (free, level kept).
  pickStored: (uid: string) => void
  placeStored: (uid: string, x: number, z: number, rot?: number) => boolean
  mergeBlock: (anchor: string, size: number) => void
  splitBlock: (uid: string) => void
  rotateBlock: (uid: string) => boolean
  tapBuilding: (uid: string) => void
  openUpgrade: (uid: string) => void
  upgradeBuilding: (uid: string) => boolean
  // Put a car to work at a business (null takes the driver off).
  assignCar: (buildingUid: string, carUid: string | null) => void
  // Puts the best working car on every business (game/autoJobs.ts).
  autoAssign: () => void
  buyCar: (model: string, color: string) => boolean
  upgradeCar: (uid: string, slot: UpgradeSlot) => boolean
  sellCar: (uid: string) => void
  // Pays a race: the prize for a win, a share of it for a loss (see game/boosts.ts), plus any bonus.
  // `loss` overrides what a loss pays (kart parties pay by place).
  finishRace: (won: boolean, reward: number, opts?: { mode?: BoostMode; live?: boolean; loss?: number }) => void
  // Coming back after a long break turns on the welcome-back bonus.
  noteAway: (ms: number) => void
  // A drag race finished in a car: counts towards its mastery, and pays any tier it reaches.
  masteryRace: (model: string, won: boolean, mode: MasteryMode, upset: boolean) => void
  closeMasteryPrize: () => void
  // Claims every Trophy Road stop the trophies reach.
  claimRoad: () => void
  // A Class Cup race finished (game/cups.ts).
  cupResult: (id: string, won: boolean) => void
  closeCupPrize: () => void
  // Picks a boost trail or win celebration (only ones whose challenge is done).
  pickFlair: (kind: 'trail' | 'cheer', id: string) => void
  seeFlair: () => void
  // A finished Daily Run: keeps the day's best and pays the first run of the day.
  dailyResult: (time: number) => void
  worldTourResult: (i: number, won: boolean) => void
  // A ghost race against a crewmate: no prize, but it counts as a race for the crew goal and battle.
  crewRace: () => void
  // Arcade mini games pay a little coin and XP (see game/arcade.ts).
  finishArcade: (coins: number, xp: number) => void
  renameTown: (name: string) => void
  setLights: (l: Partial<Lights>) => void
  setCityTheme: (id: string | null) => void
  setBuildingTint: (uid: string, id: string | null) => void
  claimGoal: (id: string) => void
  claimTask: (period: Period, id: string) => void
  claimChest: (period: Period) => void
  claimTier: (tier: number) => void
  claimSet: (id: string) => void
  // Adds a crew chest's reward once the server has recorded the chest (open_crew_chest).
  openCrewChest: () => void
  // Marks today's wheel spin taken (the spin itself is a crate open: see spinWheel).
  markSpun: (day: string) => void
  fixFlat: (uid: string, tow: boolean) => void
  serviceCar: (uid: string, how: 'tires' | 'gas' | 'can') => void
  paintCar: (uid: string, job: PaintJob) => boolean
  // Paints single panels (hood, doors, roof, rims) and patterns, tried on in the garage first.
  paintPanels: (uid: string, panels: Panels) => boolean
  setTrim: (uid: string, trim: Trim) => boolean
  closeRecap: () => void
  befriend: (id: string, act: FriendAct, name?: string) => void
  savePreset: (slot: number, uid: string) => void
  clearPreset: (slot: number) => void
  applyPreset: (slot: number, uid: string) => boolean
  // The tutorial's one free pick (src/ui/Tutorial.tsx): a starter colour for the body and one
  // for the rims. Only while the tutorial runs; no coins, XP or stats either way.
  tutorialStyle: (uid: string, color: string, rim: string) => boolean
  // Puts an unlocked skin on a car (null takes it off), buying it with gems first if it's for sale.
  skinCar: (uid: string, skin: string | null) => boolean
  // Adds a skin to the garage (crates and other prizes). False when it was already unlocked.
  grantSkin: (id: string) => boolean
  // Puts an unlocked mod skin on the part in one slot of a car (null takes it off), buying it with gems if it's for sale.
  skinMod: (uid: string, slot: SkinnedSlot, skin: string | null) => boolean
  // Adds a mod skin to the garage (crates and other prizes). False when it was already unlocked.
  grantModSkin: (id: string) => boolean
  // Puts an owned hat (with its colours) on a car; null takes it off. Hats are never bought.
  hatCar: (uid: string, hat: HatFit | null) => boolean
  visit: (town: VisitedTown | null) => void
  // Every business in this town has had today's help (the Friends list shows it).
  markHelped: (ownerId: string) => void
  // Put a car on show at the Car Meet, or take it off.
  toggleShowcase: (uid: string) => void
  setRaceCar: (uid: string) => void
  setTutorial: (step: number) => void
  // Ends the tutorial; skipping it before the paint pick keeps that free paint for later.
  skipTutorial: (pickStep: number) => void
  // Fuel and parts friends left for you (already checked and claimed server-side).
  receiveGifts: (fuel: number, parts: number) => void
  // Fit a mod (replacing whatever is in its slot; buys it first if this car doesn't own it), or take it off with remove.
  modCar: (uid: string, modId: string, remove?: boolean) => boolean
  loadSave: (s: SaveState) => void
  showMe: (defs: string[], text: string) => void
  refillFuel: () => void
  buyDeal: (id: string) => boolean
  buyPlot: (px: number, pz: number) => void
  // A Grand Prix race finished: won, and the place out of how many karts (for what a loss pays).
  gpResult: (series: string, won: boolean, place?: number, of?: number) => void
  // Records a campaign race; returns the stars earned (0 for a loss).
  campaignResult: (chapter: string, race: number, myTime: number, theirTime: number) => number
  closeCampaignPrize: () => void
  // Records the next Pro Tour race.
  // pi: the rival PI raced (lower than the ladder's when it was eased to the player's car).
  tourResult: (won: boolean, pi?: number) => void
  closeTourPrize: () => void
  // Enters this week's event with rivals set from this PI (no change once entered).
  eventEnter: (pi: number) => void
  // Records the next race of this week's event.
  eventResult: (won: boolean) => void
  closeEventPrize: () => void
  // Records a race against the town rival at this prize. Returns the rival's one-time bonus when this win made them quit.
  rivalResult: (id: string, won: boolean, prize: number) => { coins: number; bucks: number; trophies: number } | null
  // Settles a double-or-nothing rematch: wins the stake again, or gives it back.
  rivalBet: (won: boolean, stake: number) => void
  // Records a race against a paint rival; the first win unlocks their colour.
  rowResult: (id: string, won: boolean) => void
  // Records a Tuner Trial race; the first win can unlock a pattern.
  tunerResult: (id: string, won: boolean) => void
  closeTunerPrize: () => void
  closePaintPrize: () => void
  // Pays a finished week's time trial prize (the place comes from the server's board).
  claimTrialPrize: (week: string, place: number) => void
  // Pays a town visitor's prize (fixed by the server for signed-in players); seq is the server's claim number.
  visitorPrize: (p: { coins: number; xp: number; parts: number; bucks: number; seq?: number; car?: JunkCar | null }) => void
  // Adds an opened crate to the town: takes its price and gives its prize (see openCrate).
  applyCrate: (o: CrateOpen) => void
  // Adds the server's wager rows after the save's count: stakes held, races won, refunds.
  applyWagers: (entries: WagerEntry[]) => number
  // Adds paid gem packs (the server's purchases rows) after the save's count. Returns gems added.
  applyPurchases: (rows: Purchase[]) => number
  closePrize: () => void
  closeLevelUp: () => void
  focusShop: (panel: 'shop' | 'showroom' | 'rescue' | 'race', id: string | null) => void
  startSearch: (spot: string) => void
  revealPin: (i: number) => void
  fixTruck: () => void
  abandonSearch: () => void
  towHome: () => void
  // Puts a car in the first free bay. bay 1 is the second bay (restoring2).
  restoreCar: (uid: string) => void
  rushRestore: (bay?: 0 | 1) => void
  collectRestored: (plate: string, bay?: 0 | 1) => void
  upgradeTruck: () => void
  scrapCar: (uid: string) => void
  // force skips the once-a-minute wait (the welcome back screen uses it).
  collectAll: (force?: boolean) => void
}

export type GameState = SaveState & UiState & Actions

// The level that level locks check. The admin account skips them all (the server keeps
// cars it buys above its level, 0099); everyone else uses their own level.
export const gateLevel = (s: { level: number; admin?: boolean }) => (s.admin ? Infinity : s.level)

// Cars a signed-in player's search finds come from the server (rescue_roll() in
// supabase/migrations/0022_rescue_rolls.sql), which keeps them so the guard can tell real
// finds from made-up ones. src/lib/rescue.ts plugs it in; null means roll here (guests, or a server
// without it yet). Rusty's top spot can hand back a resto-mod piece as a crate open.
export type ServerFind = { i: number; uid: string; model: string; rarity: Rarity }
export type ServerSearch = { cars: ServerFind[]; piece?: CrateOpen | null }
let rescueRoller: ((spot: string) => Promise<ServerSearch | null>) | null = null
let rolling = false
export const setRescueRoller = (f: typeof rescueRoller) => {
  rescueRoller = f
}

// A signed-in player's crates are opened by the server (crate_open() in
// supabase/migrations/0040_crates.sql); src/lib/crates.ts plugs it in. It returns the opens to add
// (normally one; more when earlier ones never reached the save), or null to roll here (guests).
// It throws 'soon' when the server can't open crates yet.
// `count` above 1 opens that many in one go (the ×10 open), all rolled on the server.
let crateOpener: ((id: CrateId, free?: string, count?: number) => Promise<CrateOpen[] | null>) | null = null
export const setCrateOpener = (f: typeof crateOpener) => {
  crateOpener = f
}

// A signed-in player's daily spin is rolled by the server too (wheel_spin() in
// supabase/migrations/0064_wheel_spin.sql); src/lib/crates.ts plugs it in. It returns the spin and any
// earlier opens the save never counted, or null to roll here (guests). Throws 'soon' or 'spun today'.
export type ServerSpin = { spin: WheelSpin | null; day: string; pending: CrateOpen[] }
let wheelSpinner: (() => Promise<ServerSpin | null>) | null = null
export const setWheelSpinner = (f: typeof wheelSpinner) => {
  wheelSpinner = f
}

const key = (x: number, z: number) => `${x},${z}`
let uidCounter = 0
const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const emptyStats = () => Object.fromEntries(COUNTERS.map((k) => [k, 0])) as Record<CounterKey, number>
export const today = () => new Date().toISOString().slice(0, 10)
const noUpgrades = (): Record<UpgradeSlot, number> => ({ engine: 0, turbo: 0, tires: 0, weight: 0 })

export function fuelCap(s: Pick<SaveState, 'level' | 'buildings'>) {
  const gas = s.buildings.reduce((n, b) => n + upgradeFuelCap(buildingDef(b.def), buildingLevel(b)), 0)
    + (s.buildings.some((b) => b.merge) ? mergeFuel(s.buildings) : 0)
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

// Whether a merged block fits with its top-left corner at x, z (its own buildings don't get in the way).
export function canPlaceBlock(s: Pick<SaveState, 'roads' | 'buildings' | 'land'>, g: Pick<MergeGroup, 'w' | 'h' | 'members'>, x: number, z: number) {
  const ids = new Set(g.members.map((o) => o.uid))
  const occ = occupancy(s)
  for (let i = 0; i < g.w; i++) {
    for (let j = 0; j < g.h; j++) {
      const o = occ.get(key(x + i, z + j))
      if (!owns(s.land, x + i, z + j) || (o && !ids.has(o))) return false
    }
  }
  return true
}

// Obstacles get cleared, not moved.
export const movable = (def: string) => buildingDef(def).kind !== 'obstacle'

export function starterTown(): SaveState {
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
    bucks: 100,
    parts: 10,
    fuel: 25,
    fuelUpdatedAt: now,
    trophies: 0,
    racesWon: 0,
    roads: [...new Set(roads)],
    // Everything a new player needs sits on the cross street in the middle of the screen:
    // the pizza places either side of RUSTY_LOT (kept empty for Rusty's), the showroom and
    // garage across the street. The open lots further along invite the next builds.
    buildings: [
      b('showroom', 9, 9), b('garage', 13, 9), b('gas', 6, 9), b('pizza', 10, 12), b('pizza', 15, 12),
      b('pizza', 8, 12), b('house', 5, 5), b('house', 6, 5), b('house', 7, 5), b('house', 5, 6),
      b('house', 15, 17), b('house', 16, 17), b('house', 17, 17), b('tree', 5, 7), b('tree', 17, 9),
      b('tree', 17, 15), b('tree', 8, 16), b('tree', 6, 14), b('tree', 11, 17), b('tree', 18, 6),
      b('tree', 14, 7), b('tree', 2, 2), b('tree', 21, 3), b('tree', 2, 21), b('tree', 21, 21),
    ],
    cars: [
      { uid: uid(), model: 'pip', color: '#e53935', upgrades: noUpgrades() },
      { uid: uid(), model: 'civic', color: '#1e88e5', upgrades: noUpgrades() },
    ],
    stats: emptyStats(),
    claimedGoals: [],
    quests: null,
    season: null,
    lastDaily: null,
    dailyStreak: 0,
    helped: {},
    tutorial: 0,
    junkyard: [],
    restoring: null,
    restoring2: null,
    truck: 0,
    gp: {},
    campaign: {},
    claimedSets: [],
    crewChests: 0,
    visits: 0,
    crates: 0,
    cratePity: {},
    boosts: emptyBoosts(),
    trials: { claimed: {} },
    rivals: {},
    rivalRow: {},
    tuner: {},
    mastery: {},
    road: 0,
    cups: {},
    oldPaints: false,
    tour: 0,
    event: null,
    deals: null,
    showcase: [],
    skins: [],
    modSkins: [],
    hats: [],
    hatQuest: newHatQuest(),
    land: [...START_LAND],
    updatedAt: now,
  }
}

let driverTipShown = false

// The car driving for a business, if it is fit to work (no flat, has gas).
export function workingDriver(s: Pick<SaveState, 'cars'>, b: PlacedBuilding): CarDef | null {
  const car = b.car ? s.cars.find((c) => c.uid === b.car) : undefined
  return car && !car.flat && !car.lowFuel ? carDef(car.model) : null
}

const bump = (s: SaveState, key: CounterKey, by = 1) => ({ ...s.stats, [key]: (s.stats[key] ?? 0) + by })

// What a Collect All would pay right now: finished jobs, cleared obstacles
// and (with a Gas Station) cars out of gas. Mirrors collectAll's payouts.
export type ReadyReport = { jobs: { def: string; n: number; coins: number }[]; coins: number; parts: number; xp: number; collected: number; cleared: number; filled: number }
export function readyRewards(s: Pick<SaveState, 'buildings' | 'cars' | 'level'>, now: number): ReadyReport {
  const r: ReadyReport = { jobs: [], coins: 0, parts: 0, xp: 0, collected: 0, cleared: 0, filled: 0 }
  const byDef = new Map<string, { def: string; n: number; coins: number }>()
  const boost = mergeBoosts(s.buildings)
  for (const b of s.buildings) {
    const d = buildingDef(b.def)
    if (!d.jobSeconds || b.jobEndsAt === null || now < b.jobEndsAt) continue
    if (d.kind === 'obstacle') {
      r.xp += d.xp ?? 0
      r.cleared++
      continue
    }
    const lvl = jobLevel(b)
    const pay = driverPayout(d, lvl, workingDriver(s, b), boost.get(b.uid))
    r.coins += pay
    r.parts += mergedParts(d, lvl, boost.get(b.uid))
    r.xp += jobXp(d, lvl, s.level)
    r.collected++
    const row = byDef.get(d.id) ?? { def: d.id, n: 0, coins: 0 }
    row.n++
    row.coins += pay
    byDef.set(d.id, row)
  }
  if (s.buildings.some((b) => b.def === 'gas')) {
    r.filled = s.cars.filter((c) => c.lowFuel).length
    r.coins += r.filled * servicePay(s.level, 'gas')
    r.xp += r.filled * serviceXp('gas', s.level)
  }
  r.jobs = [...byDef.values()].sort((a, b) => b.coins - a.coins)
  return r
}

export const hasRusty = (s: Pick<SaveState, 'buildings'>) => s.buildings.some((b) => b.def === 'rescue')

type StatSource = Pick<SaveState, 'stats' | 'buildings' | 'level' | 'cars' | 'land' | 'campaign'>

// Story goals showing now: the first three unclaimed ones the player's level allows.
export function activeGoals(s: Pick<SaveState, 'claimedGoals' | 'level'>) {
  return GOALS.filter((g) => !g.event && !s.claimedGoals.includes(g.id) && s.level >= (g.level ?? 1)).slice(0, 3)
}
// The running event's goals, claimed ones included (shown ticked).
export function eventGoals(now = Date.now()) {
  const e = activeEvent(now)
  return e ? GOALS.filter((g) => g.event === e.id) : []
}
export const goalOpen = (s: Pick<SaveState, 'claimedGoals' | 'level'>, g: GoalDef) =>
  !s.claimedGoals.includes(g.id) && s.level >= (g.level ?? 1) && (g.event ? activeEvent()?.id === g.event : true)
export function statValue(s: StatSource, key: StatKey, def?: string): number {
  switch (key) {
    // Rusty's Rescue counts from the buildings so older towns that already have one get credit.
    case 'rusty': return s.buildings.some((b) => b.def === 'rescue') ? 1 : 0
    case 'owns': return s.buildings.some((b) => b.def === def) ? 1 : 0
    case 'spooky': return s.buildings.filter((b) => buildingDef(b.def).event === 'spooky').length
    case 'level': return s.level
    case 'carsOwned': return s.cars.length
    case 'drivers': return s.buildings.filter((b) => b.car && s.cars.some((c) => c.uid === b.car)).length
    case 'plots': return s.land.length
    case 'bldgLevel': return s.buildings.reduce((n, b) => (upgradable(buildingDef(b.def)) ? Math.max(n, buildingLevel(b)) : n), 0)
    case 'stars': return Object.values(s.campaign ?? {}).reduce((n, v) => n + Math.min(3, v), 0)
    case 'chapters': return CAMPAIGN.filter((ch) => campaignCleared(s.campaign ?? {}, ch)).length
    case 'power': return garagePower(s.cars)
    default: return s.stats[key] ?? 0
  }
}
export const goalDone = (s: StatSource, g: GoalDef) => statValue(s, g.stat, g.def) >= g.target

// Tasks: what's drawn for the current day and week, and progress since each began.
export const taskPool = (period: Period) => (period === 'daily' ? DAILY_TASKS : WEEKLY_TASKS)
export const taskDef = (period: Period, id: string) => taskPool(period).find((t) => t.id === id)
export const taskText = (period: Period, slot: TaskSlot) => (taskDef(period, slot.id)?.text ?? '').replace('#', slot.n.toLocaleString())
export function taskProgress(s: Pick<SaveState, 'stats' | 'quests'>, period: Period, slot: TaskSlot) {
  const def = taskDef(period, slot.id)
  const base = period === 'daily' ? s.quests?.dayBase : s.quests?.weekBase
  if (!def) return 0
  return Math.max(0, (s.stats[def.stat] ?? 0) - (base?.[def.stat] ?? 0))
}
export const taskDone = (s: Pick<SaveState, 'stats' | 'quests'>, period: Period, slot: TaskSlot) => taskProgress(s, period, slot) >= slot.n
export const periodSlots = (q: Quests | null, period: Period) => (period === 'daily' ? q?.daily : q?.weekly) ?? []
export const periodDone = (q: Quests | null, period: Period) => (period === 'daily' ? q?.dayDone : q?.weekDone) ?? []
export const chestOpened = (q: Quests | null, period: Period) => !!(period === 'daily' ? q?.dayChest : q?.weekChest)

// Starts a new day or week of tasks when the calendar has moved on. Returns null when nothing changed.
// This season's progress, starting fresh when a new season begins.
export function currentSeason(s: Pick<SaveState, 'season'>, now = Date.now()): SeasonProgress {
  const n = seasonNumber(now)
  return s.season && s.season.n === n ? s.season : { n, stars: 0, claimed: [] }
}
export const tierReady = (p: SeasonProgress, tier: number) => !p.claimed.includes(tier) && p.stars >= (tier + 1) * STARS_PER_TIER
export const seasonClaimable = (s: Pick<SaveState, 'season'>) => {
  const p = currentSeason(s)
  return SEASON_TIERS.filter((_, i) => tierReady(p, i)).length
}
const addStars = (s: Pick<SaveState, 'season'>, n: number): SeasonProgress => {
  const p = currentSeason(s)
  return { ...p, stars: p.stars + n }
}

export function rolledQuests(s: Pick<SaveState, 'quests' | 'stats' | 'level' | 'buildings'>, now = Date.now()): Quests | null {
  const day = dayKey(now)
  const week = weekKey(now)
  const q = s.quests
  if (q && q.day === day && q.week === week) return null
  const owned = (def: string) => s.buildings.some((b) => b.def === def)
  const base = { ...s.stats }
  const fresh: Quests = q ?? { day: '', daily: [], dayBase: {}, dayDone: [], dayChest: false, week: '', weekly: [], weekBase: {}, weekDone: [], weekChest: false }
  return {
    ...fresh,
    ...(fresh.day === day ? {} : { day, daily: drawTasks(DAILY_TASKS, day, s.level, owned), dayBase: base, dayDone: [], dayChest: false }),
    ...(fresh.week === week ? {} : { week, weekly: drawTasks(WEEKLY_TASKS, week, s.level, owned), weekBase: base, weekDone: [], weekChest: false }),
  }
}

// Everything ready to collect: finished story goals, tasks and chests.
export function claimable(s: GameState) {
  const goals = [...activeGoals(s), ...eventGoals()].filter((g) => goalOpen(s, g) && goalDone(s, g)).length
  let tasks = 0
  for (const p of ['daily', 'weekly'] as const) {
    const done = periodDone(s.quests, p)
    tasks += periodSlots(s.quests, p).filter((t) => !done.includes(t.id) && taskDone(s, p, t)).length
    if (done.length >= TASKS_PER_PERIOD && !chestOpened(s.quests, p)) tasks++
  }
  return goals + tasks
}

function addXp(s: GameState, amount: number): Partial<GameState> {
  let { level, xp, bucks, coins } = s
  xp += amount
  const ups: number[] = []
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
    bucks += LEVEL_GEMS
    coins += level * 100
    ups.push(level)
  }
  if (!ups.length) return { xp }
  const fresh = { ...s, level }
  // The splash plays the level-up sound (a beat drop) when it opens.
  // Fold into a splash that's still open, so two quick level-ups show as one.
  const prev = s.levelUp
  const levelUp = {
    from: prev ? prev.from : s.level,
    to: level,
    coins: (prev?.coins ?? 0) + (coins - s.coins),
    bucks: (prev?.bucks ?? 0) + (bucks - s.bucks),
  }
  // Tops the tank up to the new cap, but never takes away fuel already above it.
  return { level, xp, bucks, coins, fuel: Math.max(s.fuel, fuelCap(fresh)), fuelUpdatedAt: Date.now(), levelUp }
}

// Apply an action's changes, then its XP. Level-up bonuses add on top of the
// action's own coins and bucks instead of replacing them.
// A tap on a merged business works the whole block as one: collect every
// finished job, otherwise start every idle one the fuel covers, otherwise
// show its upgrades. Each building still runs and pays its own job.
function tapMerged(s: GameState, set: (p: Partial<GameState>) => void, uids: string[]): void {
  const now = Date.now()
  const members = s.buildings.filter((o) => uids.includes(o.uid))
  const d = buildingDef(members[0].def)
  const ready = members.filter((o) => o.jobEndsAt !== null && now >= o.jobEndsAt)
  if (ready.length) {
    let pay = 0, parts = 0, xp = 0
    const boost = mergeBoosts(s.buildings)
    for (const o of ready) {
      pay += driverPayout(d, jobLevel(o), workingDriver(s, o), boost.get(o.uid))
      parts += mergedParts(d, jobLevel(o), boost.get(o.uid))
      xp += jobXp(d, jobLevel(o), s.level)
    }
    const done = new Set(ready.map((o) => o.uid))
    sfx.coin()
    fx({ kind: 'collect', uids: [members[0].uid, ...uids], coins: pay, parts, xp })
    s.toast(`+${pay.toLocaleString()} coins${parts ? `, +${parts} parts` : ''}, +${xp} XP`)
    return set(withXp(s, xp, {
      coins: s.coins + pay,
      parts: s.parts + parts,
      stats: { ...s.stats, jobs: (s.stats.jobs ?? 0) + ready.length, coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
      buildings: s.buildings.map((o) => (done.has(o.uid) ? { ...o, jobEndsAt: null, jobLevel: undefined } : o)),
      updatedAt: now,
    }))
  }
  const idle = members.filter((o) => o.jobEndsAt === null)
  if (!idle.length) return s.openUpgrade(members[0].uid)
  if (!isOpen(d, now)) return s.toast(`The ${d.name} only opens at night. Doors open ${opensLabel(now)}.`)
  const cost = d.fuelCost ?? 0
  const n = cost ? Math.min(idle.length, Math.floor(s.fuel / cost)) : idle.length
  if (!n) return s.showNeed('fuel', cost * idle.length - s.fuel, `the merged ${d.name}`)
  if (n < idle.length) s.toast(`Fuel for ${n} of ${idle.length} jobs. The rest start when you tap again.`)
  sfx.start()
  const go = new Set(idle.slice(0, n).map((o) => o.uid))
  for (const o of idle.slice(0, n)) if (o.car) requestVisit(o.car, o.uid)
  const cap = fuelCap(s)
  set({
    fuel: s.fuel - n * cost,
    fuelUpdatedAt: s.fuel >= cap ? now : s.fuelUpdatedAt,
    buildings: s.buildings.map((o) => {
      if (!go.has(o.uid)) return o
      const lvl = buildingLevel(o)
      return { ...o, jobEndsAt: now + jobSeconds(d, lvl, s.stats.jobs ?? 0) * 1000, jobLevel: lvl }
    }),
    updatedAt: now,
  })
}

// The XP the last finished race paid (boosts included), for the result screen.
let lastRaceXp = 0
export const lastRaceXpPaid = () => lastRaceXp
export const resetRaceXp = () => { lastRaceXp = 0 }

// Bulldoze a wild obstacle (a tap in play mode or the Bulldoze tool): pay its clearing cost,
// get its XP, and the tile is free at once. One already paid for under the old timed clearing
// goes for free.
function clearObstacle(s: GameState, set: (p: Partial<GameState>) => void, b: PlacedBuilding) {
  const d = buildingDef(b.def)
  const cost = b.jobEndsAt === null ? clearCost(d, s.level) : 0
  if (s.coins < cost) return s.showNeed('coins', cost - s.coins, `bulldozing the ${d.name.toLowerCase()}`)
  sfx.bulldoze(b.def.endsWith('rock'))
  fx({ kind: 'cleared', uid: b.uid })
  fx({ kind: 'collect', uids: [b.uid], coins: 0, parts: 0, xp: d.xp ?? 0 })
  set(withXp(s, d.xp ?? 0, { coins: s.coins - cost, buildings: s.buildings.filter((o) => o.uid !== b.uid), updatedAt: Date.now() }))
}

function withXp(s: GameState, amount: number, patch: Partial<GameState>): Partial<GameState> {
  return { ...patch, ...addXp({ ...s, ...patch }, amount) }
}

export const cleanPlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 7)

// Daily deals: today's three, which are used up, and the deal (if any) that discounts an item.
export const dealUsed = (s: Pick<SaveState, 'deals'>, id: string, day = today()) => s.deals?.day === day && s.deals.used.includes(id)
export function liveDeal(s: Pick<SaveState, 'deals' | 'level'>, kind: DealKind, item?: string): DealDef | null {
  const d = dealsFor(today()).find((x) => x.kind === kind && x.item === item)
  return d && !dealUsed(s, d.id) && s.level >= dealOffer(d).unlockLevel ? d : null
}
export const openDeals = (s: Pick<SaveState, 'deals' | 'level'>) =>
  dealsFor(today()).filter((d) => !dealUsed(s, d.id) && s.level >= dealOffer(d).unlockLevel).length
const spendDeal = (s: Pick<SaveState, 'deals'>, d: DealDef | null) =>
  d ? { deals: { day: today(), used: [...(s.deals?.day === today() ? s.deals.used : []), d.id] } } : {}
// What placing a building costs today, after any deal on it.
export function buildPrice(s: Pick<SaveState, 'deals' | 'level'>, def: string) {
  const d = buildingDef(def)
  const deal = d.kind === 'decor' ? liveDeal(s, 'decor', def) : null
  return deal ? { coins: dealOffer(deal).now.coins, bucks: dealOffer(deal).now.bucks, deal } : { coins: d.price, bucks: d.bucks ?? 0, deal: null }
}
// What a mod costs today, after any deal on it (deals only cut the coins).
export function modPrice(s: Pick<SaveState, 'deals' | 'level'>, modId: string) {
  const m = modDef(modId)
  const deal = liveDeal(s, 'mod', modId)
  return { coins: deal ? dealOffer(deal).now.coins : m?.coins ?? 0, parts: m?.parts ?? 0, bucks: m?.bucks ?? 0, deal }
}
// A colour change the skipped tutorial's free pick covers: any coin colour.
const freeColour = (s: { freePaint?: boolean }, car: OwnedCar, job: PaintJob) =>
  !!s.freePaint && job.color !== car.color && !PAINTS.find((p) => p.color === job.color)?.bucks
// What a paint job costs today: a finish deal cuts the finish part of the bill.
export function paintPrice(s: Pick<SaveState, 'deals' | 'level'> & { freePaint?: boolean }, car: OwnedCar, job: PaintJob) {
  const cost = paintJobCost(car, job)
  // A skipped tutorial leaves its free paint pick: one coin colour, once.
  const free = freeColour(s, car, job) ? PAINT_COST : 0
  const deal = job.finish !== (car.finish ?? 'gloss') ? liveDeal(s, 'paint', job.finish) : null
  if (!deal) return { coins: cost.coins - free, bucks: cost.bucks, deal: null, free: free > 0 }
  const o = dealOffer(deal)
  return { coins: cost.coins - free - (o.was.coins - o.now.coins), bucks: cost.bucks, deal, free: free > 0 }
}

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
// What the last Collect All had to leave: idle jobs the fuel didn't cover, and
// repairs or gas cans the coins didn't cover. The button shows them as icons.
export type CollectSkips = { fuel: number; coins: number; at: number }
let skips: CollectSkips = { fuel: 0, coins: 0, at: 0 }
export const collectAllSkips = () => skips
function setLastCollectAll(t: number, left?: { fuel: number; coins: number }) {
  skips = { fuel: left?.fuel ?? 0, coins: left?.coins ?? 0, at: Date.now() }
  try {
    localStorage.setItem('cartopia-collect-all', String(t))
  } catch {
    // Private mode: the cooldown just won't survive a reload.
  }
  collectAllListeners.forEach((fn) => fn())
}

// The hat quest after a race win: the race car's model joins the cars that have won.
function hatRaceWin(s: SaveState): HatQuest {
  const q = hatQuestOf(s)
  const model = raceCarOf(s.cars, s.raceCar)?.model
  return !model || q.cars.includes(model) ? q : { ...q, cars: [...q.cars, model] }
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...starterTown(),
      mode: 'play',
      placing: null,
      placeRot: null,
      selected: null,
      placingStored: null,
      again: null,
      panel: null,
      panelBack: [],
      selectedCar: null,
      toasts: [],
      visiting: null,
      admin: false,
      need: null,
      search: null,
      highlight: null,
      clanBadge: null,
      shopFocus: null,
      upgrading: null,
      gpPrize: null,
      campaignPrize: null,
      tourPrize: null,
      eventPrize: null,
      paintPrize: null,
      tunerPrize: null,
      masteryPrize: null,
      cupPrize: null,
      levelUp: null,

      // Building, roads and land edit your own town, which isn't on screen while visiting.
      setMode: (mode, placing = null) => {
        if (mode !== 'play' && get().visiting) return get().toast('Head home to build in your own town')
        set((s) => ({ mode, placing, placingStored: null, panel: null, selected: null, again: null, placeRot: placing && placing === s.placing ? s.placeRot : null }))
      },
      select: (selected) => set({ selected }),
      setPlaceRot: (placeRot) => set({ placeRot }),
      showNeed: (res, missing, what) => {
        sfx.error()
        set((st) => ({ need: { res, missing: Math.max(0, Math.ceil(missing)), what }, ...navTo(st, 'need'), mode: 'play', placing: null, selected: null }))
      },
      openPanel: (panel) => set((s) => {
        if (s.panel !== panel) sfx.menuOpen()
        return { ...navTo(s, panel), mode: 'play', placing: null, placingStored: null, selected: null, shopFocus: null }
      }),
      closePanel: () =>
        set((s) => {
          const back = s.panelBack.slice(0, -1)
          const prev = s.panel ? s.panelBack[s.panelBack.length - 1] ?? null : null
          if (s.panel) sfx.menuClose()
          return { panel: prev, panelBack: prev ? back : [], mode: 'play', placing: null, placingStored: null, selected: null, shopFocus: null }
        }),
      swapPanel: (panel) => set((s) => {
        if (s.panel !== panel) sfx.tab()
        return { panel, panelBack: s.panelBack.filter((p) => p !== panel), mode: 'play', placing: null, placingStored: null, selected: null, shopFocus: null }
      }),
      openShop: (focus) => set((s) => ({ ...navTo(s, 'shop'), mode: 'play', placing: null, selected: null, shopFocus: focus ?? null })),
      selectCar: (selectedCar) => set({ selectedCar }),
      toast: (text) => {
        const id = Date.now() + Math.random()
        set((s) => ({ toasts: [...s.toasts, { id, text }] }))
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
      },

      tick: (now) => {
        const s = get()
        const quests = rolledQuests(s, now)
        if (quests) set({ quests })
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
        if (d.event && activeEvent()?.id !== d.event) {
          s.toast(`The ${d.name} comes back next event`)
          return false
        }
        if (d.unique && [...s.buildings, ...(s.stored ?? [])].some((o) => o.def === def)) {
          s.toast(`You already have a ${d.name}`)
          return false
        }
        const cost = buildPrice(s, def)
        if (s.coins < cost.coins) {
          s.showNeed('coins', cost.coins - s.coins, d.name)
          return false
        }
        if (s.bucks < cost.bucks) {
          s.showNeed('bucks', cost.bucks - s.bucks, d.name)
          return false
        }
        if (def === 'rescue') setTimeout(() => get().toast("Rusty's is open! Tap his shop to search for cars. The Showroom is unlocked too."), 400)
        sfx.click()
        const nid = uid()
        fx({ kind: 'built', uid: nid })
        set(withXp(s, Math.max(1, Math.round(d.price / 100)), {
          coins: s.coins - cost.coins,
          bucks: s.bucks - cost.bucks,
          ...spendDeal(s, cost.deal),
          buildings: [...s.buildings, { uid: nid, def, x, z, jobEndsAt: null, ...(rot == null ? {} : { rot }) }],
          stats: bump(s, 'built'),
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
        // Moving any building of a merged block moves the whole block with it.
        const g = groupOf(s.buildings, buid)
        if (g) {
          if (rot != null && rot !== b.rot) return false
          const gx = g.x + x - b.x
          const gz = g.z + z - b.z
          if (!canPlaceBlock(s, g, gx, gz)) return false
          if (gx !== g.x || gz !== g.z) set({ buildings: moveGroup(s.buildings, g, gx, gz), updatedAt: Date.now() })
          return true
        }
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
        // Rusty's holds the lot and the restore bay, so losing it would strand those cars.
        if (b.def === 'rescue') return s.toast(`${d.name} can't be removed. Use Move to put it somewhere else.`)
        if (d.parked) return s.toast('This one is coming in a future update, so it stays put')
        if (d.kind === 'obstacle') return clearObstacle(s, set, b)
        if (groupOf(s.buildings, b.uid)) return s.toast(`Split your merged ${d.name} first (Edit, then Merge)`)
        // It goes to the inventory with its level, theme and any job; its driver goes back to the garage.
        const { car: _driver, ...kept } = b
        sfx.click()
        set({
          buildings: s.buildings.filter((o) => o.uid !== what),
          stored: [...(s.stored ?? []), kept],
          updatedAt: Date.now(),
        })
      },

      pickStored: (suid) => {
        const s = get()
        const b = s.stored?.find((o) => o.uid === suid)
        if (!b) return
        s.setMode('place', b.def)
        set({ placingStored: suid, placeRot: b.rot ?? null })
      },

      placeStored: (suid, x, z, rot) => {
        const s = get()
        const b = s.stored?.find((o) => o.uid === suid)
        if (!b || !canPlace(s, b.def, x, z, rot)) {
          sfx.error()
          return false
        }
        sfx.click()
        fx({ kind: 'built', uid: suid })
        const { rot: _old, ...rest } = b
        set({
          buildings: [...s.buildings, { ...rest, x, z, ...(rot == null ? {} : { rot }) }],
          stored: (s.stored ?? []).filter((o) => o.uid !== suid),
          updatedAt: Date.now(),
        })
        return true
      },

      mergeBlock: (anchor, size) => {
        const s = get()
        const c = mergeCandidates(s.buildings).find((o) => o.anchor.uid === anchor && o.code === size)
        if (!c) return
        sfx.buy()
        const d = buildingDef(c.anchor.def)
        const gain = mergeGain(d)
        const bonus = gain ? ` ${gain} +${Math.round(mergeBonus(c.members.length) * 100)}%` : ''
        s.toast((isLandmark(c) && size === 2 ? `Four Sky Towers became the ${LANDMARK_NAME}!` : size === 4 ? `Giant ${isLandmark(c) ? LANDMARK_NAME : d.name}! 16 in one.` : `Merged ${c.members.length} into one big ${d.name}!`) + bonus)
        set({ buildings: applyMerge(s.buildings, c), updatedAt: Date.now() })
      },

      splitBlock: (uid) => {
        const s = get()
        const g = groupOf(s.buildings, uid)
        if (!g) return
        sfx.click()
        set({ buildings: applySplit(s.buildings, g), updatedAt: Date.now() })
      },

      // Turns a merged block a quarter clockwise as one building.
      rotateBlock: (uid) => {
        const s = get()
        const g = groupOf(s.buildings, uid)
        if (!g) return false
        const ids = new Set(g.members.map((o) => o.uid))
        const occ = occupancy(s)
        const free = (x: number, z: number) => {
          const o = occ.get(key(x, z))
          return owns(s.land, x, z) && (!o || ids.has(o))
        }
        const buildings = rotateGroup(s.buildings, g, groupTurn(g, new Set(s.roads)), free)
        if (!buildings) {
          sfx.error()
          s.toast('No room to turn it here. Clear some space around it first.')
          return false
        }
        sfx.click()
        set({ buildings, updatedAt: Date.now() })
        return true
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
        if (d.kind === 'obstacle') return clearObstacle(s, set, b)
        // Gas stations, houses and decor have no jobs; a tap shows their upgrades and colour themes.
        if (!d.jobSeconds) return s.openUpgrade(buid)
        const merged = groupOf(s.buildings, buid)
        if (merged) return tapMerged(s, set, merged.members.map((o) => o.uid))
        const now = Date.now()
        const lvl = buildingLevel(b)
        const jobLvl = jobLevel(b)
        const secs = jobSeconds(d, lvl, s.stats.jobs ?? 0)
        if (b.jobEndsAt !== null && now < b.jobEndsAt) return s.openUpgrade(buid)
        if (b.jobEndsAt === null) {
          if (!isOpen(d, now)) return s.toast(`The ${d.name} only opens at night. Doors open ${opensLabel(now)}.`)
          if (s.fuel < d.fuelCost!) {
            return s.showNeed('fuel', d.fuelCost! - s.fuel, `a ${d.name} job`)
          }
          sfx.start()
          if (b.car) requestVisit(b.car, buid)
          else if (!driverTipShown && takesDriver(d) && !s.buildings.some((o) => o.car)) {
            driverTipShown = true
            setTimeout(() => get().toast(`Tip: tap the busy ${d.name} to give it a driver for more coins`), 900)
          }
          const cap = fuelCap(s)
          set({
            fuel: s.fuel - d.fuelCost!,
            // Restart the regen clock if we were sitting at the cap.
            fuelUpdatedAt: s.fuel >= cap ? now : s.fuelUpdatedAt,
            buildings: s.buildings.map((o) => (o.uid === buid ? { ...o, jobEndsAt: now + secs * 1000, jobLevel: lvl } : o)),
            updatedAt: now,
          })
        } else {
          const pay = driverPayout(d, jobLvl, workingDriver(s, b))
          const parts = upgradePartsPayout(d, jobLvl)
          const xp = jobXp(d, jobLvl, s.level)
          sfx.coin()
          fx({ kind: 'collect', uids: [buid], coins: pay, parts, xp })
          s.toast(`+${pay} coins${parts ? `, +${parts} parts` : ''}, +${xp} XP`)
          // Sometimes a car out on the job comes back with a flat (never during the tutorial).
          let cars = s.cars
          const rolling = cars.filter((c) => !c.flat && !c.lowFuel)
          const roll = Math.random()
          if (s.tutorial >= 99 && rolling.length > 1 && roll < FLAT_CHANCE + LOW_FUEL_CHANCE) {
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
        if (!b || s.visiting || !themable(buildingDef(b.def))) return
        // Through navTo, so closing it goes back to the menu it was opened from (the Shop's Upgrades list, Goals, a car's job).
        set({ ...navTo(s, 'upgrade'), upgrading: groupOf(s.buildings, buid)?.anchor.uid ?? buid })
      },

      upgradeBuilding: (buid) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b) return false
        const d = buildingDef(b.def)
        const lvl = buildingLevel(b)
        if (!upgradable(d) || lvl >= maxLevel(d)) return false
        // A merged block upgrades all its buildings together, so they stay merged.
        const ids = new Set(groupOf(s.buildings, buid)?.members.map((o) => o.uid) ?? [buid])
        const one = buildingUpgradeCost(d, lvl)
        const cost = { coins: one.coins * ids.size, parts: one.parts * ids.size }
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
        fx({ kind: 'upgraded', uids: [...ids] })
        s.toast(`${d.name} is now level ${lvl + 1}!`)
        set(withXp(s, buildingUpgradeXp(lvl) * ids.size, {
          coins: s.coins - cost.coins,
          parts: s.parts - cost.parts,
          buildings: s.buildings.map((o) => (ids.has(o.uid) ? { ...o, level: lvl + 1 } : o)),
          stats: bump(s, 'upgrades', ids.size),
          updatedAt: Date.now(),
        }))
        return true
      },

      assignCar: (buid, cuid) => {
        const s = get()
        const b = s.buildings.find((o) => o.uid === buid)
        if (!b || s.visiting || !takesDriver(buildingDef(b.def))) return
        const d = buildingDef(b.def)
        const car = cuid ? s.cars.find((c) => c.uid === cuid) : undefined
        if (cuid && !car) return
        // A car works one business at a time: take it off its old one.
        // (An undefined car is dropped when the save is written.)
        const buildings = s.buildings.map((o) => (o.uid === buid ? { ...o, car: cuid ?? undefined } : cuid && o.car === cuid ? { ...o, car: undefined } : o))
        if (car) {
          const cd = carDef(car.model)
          sfx.buy()
          s.toast(loves(cd, d.id) ? `${cd.name} loves the ${d.name}! +25% coins per job.` : `${cd.name} now drives for the ${d.name}. +10% coins per job.`)
          requestVisit(car.uid, buid)
        }
        set({ buildings, updatedAt: Date.now() })
      },
      autoAssign: () => {
        const s = get()
        if (s.visiting) return
        const plan = autoJobs(s.buildings, s.cars)
        if (!autoJobsChange(plan)) return
        sfx.dispatch(plan.filter((p) => p.car !== p.was).length)
        // The cars with a new job drive over to it.
        for (const p of plan) if (p.car !== p.was) requestVisit(p.car, p.building)
        set({ buildings: applyAutoJobs(s.buildings, plan), updatedAt: Date.now() })
      },

      // One tap does every chore: fix flats, fill up cars out of gas, collect
      // every finished job and cleared obstacle, and restart every idle
      // business while fuel lasts. Each chore pays or costs exactly what doing
      // it by hand would (Tire Shop or Gas Station pay, Rusty tows free, else
      // coins); a chore the coins or fuel can't cover is skipped.
      collectAll: (force) => {
        const s = get()
        const now = Date.now()
        const left = COLLECT_ALL_MS - (now - lastCollectAll())
        if (left > 0 && !force) return s.toast(`Ready again in ${Math.ceil(left / 1000)}s`)
        let coins = s.coins
        let parts = s.parts
        let fuel = s.fuel
        let xp = 0
        let collected = 0
        let started = 0
        let cleared = 0
        let earned = 0
        let filled = 0
        let fixed = 0
        let serviced = 0
        const owns = (def: string) => s.buildings.some((b) => b.def === def)
        const tireShop = owns('tires')
        const gasStation = owns('gas')
        const rusty = hasRusty(s)
        // Cars first, so drivers are back at work before their jobs pay out.
        // Chores that cost coins run again after collecting, when the coins
        // just earned may cover them, as they would by hand.
        let cars = s.cars
        const service = (paid: boolean) => {
          cars = cars.map((c) => {
            let car = c
            if (car.flat) {
              if (tireShop) {
                const pay = servicePay(s.level, 'tires')
                coins += pay
                earned += pay
                xp += serviceXp('tires', s.level)
                serviced++
                requestTrip(car.uid, 'tires')
              } else if (rusty) {
                xp += serviceXp('tow', s.level)
                requestTrip(car.uid, 'tow')
              } else if (paid && coins >= flatFixCost(s.level)) {
                coins -= flatFixCost(s.level)
                xp += serviceXp('fix', s.level)
              } else return car
              fixed++
              car = { ...car, flat: false }
            }
            if (car.lowFuel) {
              if (gasStation) {
                const pay = servicePay(s.level, 'gas')
                coins += pay
                earned += pay
                xp += serviceXp('gas', s.level)
                serviced++
                requestTrip(car.uid, 'gas')
              } else if (paid && coins >= gasCanCost(s.level)) {
                coins -= gasCanCost(s.level)
              } else return car
              filled++
              car = { ...car, lowFuel: false }
            }
            return car
          })
        }
        service(false)
        const removed = new Set<string>()
        const paid: string[] = []
        const boost = mergeBoosts(s.buildings)
        let buildings = s.buildings.map((b) => {
          const d = buildingDef(b.def)
          if (!d.jobSeconds || b.jobEndsAt === null || now < b.jobEndsAt) return b
          if (d.kind === 'obstacle') {
            removed.add(b.uid)
            paid.push(b.uid)
            xp += d.xp ?? 0
            cleared++
            return b
          }
          const lvl = jobLevel(b)
          const pay = driverPayout(d, lvl, workingDriver({ cars }, b), boost.get(b.uid))
          coins += pay
          earned += pay
          parts += mergedParts(d, lvl, boost.get(b.uid))
          xp += jobXp(d, lvl, s.level)
          paid.push(b.uid)
          collected++
          return { ...b, jobEndsAt: null, jobLevel: undefined }
        }).filter((b) => !removed.has(b.uid))
        service(true)
        const cap = fuelCap(s)
        let noFuel = 0
        buildings = buildings.map((b) => {
          const d = buildingDef(b.def)
          if (!d.jobSeconds || d.kind === 'obstacle' || b.jobEndsAt !== null || !isOpen(d, now)) return b
          if (fuel < (d.fuelCost ?? 0)) {
            noFuel++
            return b
          }
          fuel -= d.fuelCost ?? 0
          started++
          return { ...b, jobEndsAt: now + jobSeconds(d, buildingLevel(b), s.stats.jobs ?? 0) * 1000, jobLevel: buildingLevel(b) }
        })
        const noCoins = cars.filter((c) => c.flat || c.lowFuel).length
        if (!collected && !started && !cleared && !filled && !fixed) {
          if (noFuel || noCoins) {
            sfx.error()
            setLastCollectAll(lastCollectAll(), { fuel: noFuel, coins: noCoins })
            return
          }
          return s.toast('Nothing to collect or fuel right now')
        }
        setLastCollectAll(now, { fuel: noFuel, coins: noCoins })
        sfx.sweep(collected + cleared, started, fixed + filled)
        for (const u of removed) fx({ kind: 'cleared', uid: u })
        if (paid.length || earned) fx({ kind: 'collect', uids: paid, coins: earned, parts: parts - s.parts, xp })
        const bits = [
          collected && `${collected} collected`,
          started && `${started} started`,
          fixed && `${fixed} fixed`,
          filled && `${filled} filled`,
          cleared && `${cleared} cleared`,
        ].filter(Boolean) as string[]
        s.toast(`${bits.join(' · ')}${earned ? ` · +${earned} coins` : ''}${parts > s.parts ? ` · +${parts - s.parts} parts` : ''}`)
        set(withXp(s, xp, {
          buildings,
          cars,
          coins,
          parts,
          fuel,
          fuelUpdatedAt: s.fuel >= cap && fuel < cap ? now : s.fuelUpdatedAt,
          stats: {
            ...bump(s, 'jobs', collected),
            flatsFixed: (s.stats.flatsFixed ?? 0) + fixed,
            serviced: (s.stats.serviced ?? 0) + serviced,
            coinsEarned: (s.stats.coinsEarned ?? 0) + earned,
          },
          updatedAt: now,
        }))
      },

      buyCar: (model, color) => {
        const s = get()
        const c = carDef(model)
        if (c.season || c.rescueOnly || c.secret || c.pack) return false
        if (gateLevel(s) < c.unlockLevel) {
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
        // Gem cars have no coin price, so selling one would pay nothing.
        if (carDef(car.model).bucks) return s.toast('Gem cars stay in your garage')
        const value = Math.floor(carDef(car.model).price * 0.5)
        const buildings = s.buildings.map((b) => (b.car === cuid ? { ...b, car: undefined } : b))
        // A sold car leaves the meet display and stops being the race car too.
        set({
          cars: s.cars.filter((c) => c.uid !== cuid), buildings, coins: s.coins + value, selectedCar: null,
          showcase: (s.showcase ?? []).filter((u) => u !== cuid), ...(s.raceCar === cuid ? { raceCar: null } : {}),
          updatedAt: Date.now(),
        })
        sfx.coin()
      },

      finishRace: (won, reward, opts = {}) => {
        const s = get()
        const base = won ? reward : opts.loss ?? Math.round(reward * (opts.live ? LIVE_LOSS_SHARE : LOSS_SHARE))
        const b = boostFor(s.boosts, opts.mode ?? 'race', won, Date.now(), base > 0)
        const coins = Math.round(base * b.mult)
        // Boosts (first win of the day, welcome back, weekend, streaks) multiply the XP too.
        const xp = Math.round(raceXp(won, s.level) * b.mult)
        lastRaceXp = xp
        if (b.mult > 1) s.toast(`${boostLabel(b)}: +${coins} coins, +${xp} XP`)
        set(withXp(s, xp, {
          ...(won ? { hatQuest: hatRaceWin(s) } : {}),
          coins: s.coins + coins,
          trophies: s.trophies + (won ? 1 : 0),
          racesWon: s.racesWon + (won ? 1 : 0),
          boosts: b.next,
          stats: { ...bump(s, 'racesWon', won ? 1 : 0), races: (s.stats.races ?? 0) + 1, coinsEarned: (s.stats.coinsEarned ?? 0) + coins },
          updatedAt: Date.now(),
        }))
      },

      noteAway: (ms) => set((s) => ({ boosts: welcomeBack(s.boosts, ms) })),

      masteryRace: (model, won, mode, upset) => {
        const s = get()
        const { next, reached } = noteRace(s.mastery?.[model], won, mode, upset)
        const mastery = { ...s.mastery, [model]: next }
        const bucks = reached.reduce((a, t) => a + t.bucks, 0)
        const trophies = reached.reduce((a, t) => a + t.trophies, 0)
        // What else this race opened: a class tier, Galaxy, or a class's first-win colour.
        const classes = CAR_CLASSES.filter((c) => classTier(mastery, c.id) > classTier(s.mastery, c.id)).map((c) => ({ cls: c.id, tier: classTier(mastery, c.id) }))
        const sky = galaxy(mastery) && !galaxy(s.mastery)
        const first = CAR_CLASSES.filter((c) => classWon(mastery, c.id) && !classWon(s.mastery, c.id)).map((c) => c.id)
        const news = reached.length > 0 || classes.length > 0 || sky || first.length > 0
        if (news) setTimeout(sfx.levelUp, 300)
        const was = s.mastery?.[model]?.tier ?? 0
        const xp = masteryXp(s.level, reached.map((_, i) => was + i),
          classes.flatMap((c) => Array.from({ length: c.tier - classTier(s.mastery, c.cls) }, (_, i) => c.tier - i)), sky)
        set(withXp(s, xp, {
          mastery,
          ...(reached.length ? { bucks: s.bucks + bucks, trophies: s.trophies + trophies } : {}),
          ...(news ? { masteryPrize: { model, tier: reached.length ? next.tier : 0, classes, galaxy: sky, first, xp } } : {}),
          updatedAt: Date.now(),
        }))
      },

      closeMasteryPrize: () => set({ masteryPrize: null }),

      claimRoad: () => {
        const s = get()
        const from = s.road ?? 0
        const to = roadReached(s.trophies)
        if (to <= from) return
        const { coins, parts, items } = roadClaim(from, to, s.roadItems ?? [])
        sfx.levelUp()
        set({
          road: to,
          roadItems: items,
          coins: s.coins + coins,
          parts: s.parts + parts,
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + coins },
          updatedAt: Date.now(),
        })
      },

      cupResult: (id, won) => {
        const s = get()
        const r = cupRace(id)
        if (!r) return
        const wins = s.cups?.[id] ?? 0
        s.finishRace(won, cupPrize(r, wins === 0))
        if (!won) return
        const cups = { ...s.cups, [id]: wins + 1 }
        if (wins > 0) return set({ cups, updatedAt: Date.now() })
        // The first win gives a free crate, opened from the Crate Depot.
        setTimeout(sfx.levelUp, 200)
        set((g) => ({ cups, freeCrates: [...(g.freeCrates ?? []), cupCrateSource(id)], cupPrize: id, updatedAt: Date.now() }))
      },

      closeCupPrize: () => set({ cupPrize: null }),

      pickFlair: (kind, id) => {
        const s = get()
        const d = kind === 'trail' ? TRAILS.find((t) => t.id === id) : CHEERS.find((c) => c.id === id)
        if (!d || !flairOpen(d.challenge, s)) return
        set({ [kind]: id, updatedAt: Date.now() })
        sfx.equip()
      },
      dailyResult: (time) => {
        const s = get()
        const run = dailyRun()
        const was = s.daily?.day === run.day ? s.daily : { day: run.day, best: null, paid: false }
        const best = was.best === null ? time : Math.min(was.best, time)
        set({ daily: { day: run.day, best, paid: true } })
        if (was.paid) return
        const medal = dailyMedal(run, time)
        s.finishRace(medal < DAILY_MEDALS.length, DAILY_PAY[Math.min(medal, DAILY_MEDALS.length - 1)], { loss: DAILY_PAY[DAILY_MEDALS.length] })
      },
      seeFlair: () => {
        const n = flairOpenCount(get())
        if (n !== get().flairSeen) set({ flairSeen: n })
      },

      crewRace: () => {
        const s = get()
        set({ stats: { ...s.stats, races: (s.stats.races ?? 0) + 1 }, updatedAt: Date.now() })
      },

      finishArcade: (pay, xp) => {
        const s = get()
        const b = boostFor(s.boosts, 'arcade', pay > 0, Date.now(), pay > 0)
        const coins = Math.round(pay * b.mult)
        const gain = Math.round(xp * b.mult)
        if (b.mult > 1) s.toast(`${boostLabel(b)}: +${coins} coins, +${gain} XP`)
        const q = hatQuestOf(s)
        set(withXp(s, gain, {
          hatQuest: { ...q, arcade: q.arcade + 1 },
          coins: s.coins + coins,
          boosts: b.next,
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + coins },
          updatedAt: Date.now(),
        }))
      },

      renameTown: (townName) => (sfx.equip(), set({ townName: townName.slice(0, 24) || 'My Town', updatedAt: Date.now() })),
      setLights: (l) => (sfx.equip(), set((s) => ({ lights: cleanLights({ ...DEFAULT_LIGHTS, ...s.lights, ...l }), updatedAt: Date.now() }))),
      setCityTheme: (id) => (sfx.equip(), set({ cityTheme: colorTheme(id)?.id, updatedAt: Date.now() })),
      // A merged block takes the theme as one building.
      setBuildingTint: (uid, id) => set((s) => {
        sfx.equip()
        const ids = new Set(groupOf(s.buildings, uid)?.members.map((o) => o.uid) ?? [uid])
        const tint = colorTheme(id)?.id
        return { buildings: s.buildings.map((o) => (ids.has(o.uid) ? cleanTint({ ...o, tint }) : o)), updatedAt: Date.now() }
      }),

      claimGoal: (id) => {
        const s = get()
        const g = GOALS.find((o) => o.id === id)
        if (!g || !goalOpen(s, g) || !goalDone(s, g)) return
        sfx.coin()
        s.toast(`Goal complete! +${g.coins} coins${g.bucks ? `, +${g.bucks} gems` : ''}, +${g.xp} XP`)
        set(withXp(s, g.xp, {
          coins: s.coins + g.coins,
          bucks: s.bucks + (g.bucks ?? 0),
          claimedGoals: [...s.claimedGoals, id],
          updatedAt: Date.now(),
        }))
      },

      claimTask: (period, id) => {
        const s = get()
        const q = s.quests
        const slot = periodSlots(q, period).find((t) => t.id === id)
        const done = periodDone(q, period)
        if (!q || !slot || done.includes(id) || !taskDone(s, period, slot)) return
        const pay = payAt(QUEST_PAY[period].task, s.level)
        sfx.coin()
        const stars = period === 'daily' ? SEASON_STARS.dailyTask : SEASON_STARS.weeklyTask
        s.toast(`Task done! +${pay.coins.toLocaleString()} coins, +${pay.xp} XP, +${stars} ⭐`)
        const quests = period === 'daily' ? { ...q, dayDone: [...done, id] } : { ...q, weekDone: [...done, id] }
        set(withXp(s, pay.xp, { coins: s.coins + pay.coins, quests, season: addStars(s, stars), updatedAt: Date.now() }))
      },

      claimChest: (period) => {
        const s = get()
        const q = s.quests
        if (!q || chestOpened(q, period) || periodDone(q, period).length < TASKS_PER_PERIOD) return
        const c = QUEST_PAY[period].chest
        const pay = payAt(c, s.level)
        setTimeout(sfx.levelUp, 150)
        const stars = period === 'daily' ? SEASON_STARS.dailyChest : SEASON_STARS.weeklyChest
        s.toast(`Chest opened! +${pay.coins.toLocaleString()} coins, +${c.parts} parts${c.bucks ? `, +${c.bucks} gems` : ''}${c.fuel ? `, +${c.fuel} fuel` : ''}, +${stars} ⭐`)
        const quests = period === 'daily' ? { ...q, dayChest: true } : { ...q, weekChest: true }
        set(withXp(s, pay.xp, {
          coins: s.coins + pay.coins, parts: s.parts + c.parts, bucks: s.bucks + c.bucks, fuel: s.fuel + c.fuel,
          quests, season: addStars(s, stars), updatedAt: Date.now(),
        }))
      },

      claimTier: (tier) => {
        const s = get()
        const p = currentSeason(s)
        const prize = SEASON_TIERS[tier]
        if (!prize || !tierReady(p, tier)) return
        const season = { ...p, claimed: [...p.claimed, tier] }
        const now = Date.now()
        const car = prize.car ? seasonOf(p.n).car : undefined
        setTimeout(sfx.levelUp, 150)
        const skin = seasonSkin(tier + 1)
        const modSkin = seasonModSkin(tier + 1)
        const skins = {
          ...(skin && !s.skins?.includes(skin.id) ? { skins: [...(s.skins ?? []), skin.id] } : {}),
          ...(modSkin && !s.modSkins?.includes(modSkin.id) ? { modSkins: [...(s.modSkins ?? []), modSkin.id] } : {}),
        }
        if (skin) setTimeout(() => get().toast(`🎨 New skin: ${skin.name}! Try it in the Garage.`), 900)
        if (modSkin) setTimeout(() => get().toast(`🪽 New mod skin: ${modSkin.name}! Try it in the Garage's Mods tab.`), 900)
        if (car) {
          const d = carDef(car)
          s.toast(`🏁 Season prize! The ${d.name} is yours.`)
          return set({ season, ...skins, cars: [...s.cars, { uid: uid(), model: car, color: d.colors[0], upgrades: noUpgrades() }], stats: bump(s, 'carsBought'), updatedAt: now })
        }
        const bucks = prize.bucks + (prize.car ? SEASON_CAR_BUCKS : 0)
        s.toast(`Tier ${tier + 1}! ${[prize.coins && `+${prize.coins.toLocaleString()} coins`, prize.parts && `+${prize.parts} parts`, bucks && `+${bucks} gems`].filter(Boolean).join(', ')}`)
        set({ season, ...skins, coins: s.coins + prize.coins, parts: s.parts + prize.parts, bucks: s.bucks + bucks, updatedAt: now })
      },

      claimSet: (id) => {
        const s = get()
        const set_ = [...CAR_SETS, ...RUSTY_SETS].find((o) => o.id === id)
        if (!set_ || s.claimedSets.includes(id) || !setComplete(set_, s.cars)) return
        setTimeout(sfx.levelUp, 200)
        s.toast(`${set_.icon} ${set_.name} complete! +${set_.coins.toLocaleString()} coins, +${set_.bucks} gems, +${set_.trophies} 🏆`)
        set(withXp(s, set_.xp, {
          coins: s.coins + set_.coins,
          bucks: s.bucks + set_.bucks,
          trophies: s.trophies + set_.trophies,
          claimedSets: [...s.claimedSets, id],
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + set_.coins },
          updatedAt: Date.now(),
        }))
      },

      openCrewChest: () => {
        const s = get()
        const c = CREW_CHEST
        const pay = payAt(c, s.level)
        setTimeout(sfx.levelUp, 150)
        s.toast(`Crew chest opened! +${pay.coins.toLocaleString()} coins, +${c.parts} parts, +${c.bucks} gems`)
        set(withXp(s, pay.xp, {
          coins: s.coins + pay.coins, parts: s.parts + c.parts, bucks: s.bucks + c.bucks, fuel: s.fuel + c.fuel,
          crewChests: (s.crewChests ?? 0) + 1,
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + pay.coins },
          updatedAt: Date.now(),
        }))
      },

      applyCrate: (o) => {
        const s = get()
        // A server open the save already counted is never added twice.
        if (o.seq != null && o.seq <= (s.crates ?? 0)) return
        const d = o.drop
        const def = crateDef(o.crate)
        const won = d.kind === 'coins' || d.kind === 'dupe' || d.kind === 'skindupe' || d.kind === 'piecedupe' ? d.coins : 0
        let cars = s.cars
        // A new car counts for the "Get a new car" goals, like one bought or restored. The
        // fourth resto-mod piece builds its car.
        const car = d.kind === 'car' ? d : d.kind === 'piece' && d.uid && d.color ? { uid: d.uid, model: d.model, color: d.color } : null
        const newCar = !!car && !cars.some((c) => c.uid === car.uid)
        if (car && newCar) cars = [...cars, { uid: car.uid, model: car.model, color: car.color, upgrades: noUpgrades() }]
        const piece = d.kind === 'piece' ? pieceId(d.model, d.piece) : null
        if (d.kind === 'mod') cars = cars.map((c) => (c.uid === d.car ? { ...c, ownedMods: [...new Set([...ownedMods(c), d.mod])] } : c))
        set({
          coins: Math.max(0, s.coins - o.cost.coins + won),
          bucks: Math.max(0, s.bucks - o.cost.bucks),
          cars,
          ...(d.kind === 'skin' && !d.part && !(s.skins ?? []).includes(d.skin) ? { skins: [...(s.skins ?? []), d.skin] } : {}),
          ...(d.kind === 'skin' && d.part && !(s.modSkins ?? []).includes(d.skin) ? { modSkins: [...(s.modSkins ?? []), d.skin] } : {}),
          ...(piece && !(s.restoParts ?? []).includes(piece) ? { restoParts: [...(s.restoParts ?? []), piece] } : {}),
          ...(d.kind === 'hat' && hatDef(d.hat) && !(s.hats ?? []).includes(d.hat) ? { hats: [...(s.hats ?? []), d.hat] } : {}),
          crates: o.seq ?? s.crates ?? 0,
          ...(def?.pity ? { cratePity: { ...s.cratePity, [o.crate]: pityHit(def, d) ? 0 : (s.cratePity?.[o.crate as CrateId] ?? 0) + 1 } } : {}),
          stats: { ...s.stats, ...(won ? { coinsEarned: (s.stats.coinsEarned ?? 0) + won } : {}), ...(newCar ? { carsBought: (s.stats.carsBought ?? 0) + 1 } : {}) },
          updatedAt: Date.now(),
        })
      },

      applyWagers: (entries) => {
        const s = get()
        const { n, coins } = claim(s.wagers ?? 0, entries)
        if (n === (s.wagers ?? 0)) return 0
        set({
          coins: Math.max(0, s.coins + coins),
          wagers: n,
          stats: coins > 0 ? { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + coins } : s.stats,
          updatedAt: Date.now(),
        })
        return coins
      },

      applyPurchases: (rows) => {
        const s = get()
        const from = s.purchases ?? 0
        const fresh = rows.filter((r) => r.seq > from).sort((a, b) => a.seq - b.seq)
        if (!fresh.length) return 0
        const sum = (k: 'bucks' | 'coins' | 'parts') => fresh.reduce((a, r) => a + r[k], 0)
        const cars: OwnedCar[] = fresh
          .filter((r) => r.car && !s.cars.some((c) => c.uid === `pk-${r.seq}`))
          .map((r) => ({ uid: `pk-${r.seq}`, model: r.car!, color: carDef(r.car!).colors[0], upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }))
        set({
          bucks: s.bucks + sum('bucks'), coins: s.coins + sum('coins'), parts: s.parts + sum('parts'),
          ...(cars.length ? { cars: [...s.cars, ...cars] } : {}),
          purchases: fresh[fresh.length - 1].seq,
          updatedAt: Date.now(),
        })
        return sum('bucks')
      },

      visitorPrize: (p) => {
        const s = get()
        set(withXp(s, p.xp, {
          coins: s.coins + p.coins, parts: s.parts + p.parts, bucks: s.bucks + p.bucks,
          visits: Math.max(s.visits ?? 0, p.seq ?? 0),
          junkyard: p.car ? [...s.junkyard, p.car] : s.junkyard,
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + p.coins },
          updatedAt: Date.now(),
        }))
      },

      markSpun: (day) => {
        const s = get()
        if (s.lastDaily != null && s.lastDaily >= day) return
        const yesterday = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10)
        set({ lastDaily: day, dailyStreak: s.lastDaily === yesterday ? s.dailyStreak + 1 : 1, updatedAt: Date.now() })
      },

      fixFlat: (cuid, tow) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car?.flat) return
        const hasRusty = s.buildings.some((b) => b.def === 'rescue')
        const cost = tow && hasRusty ? 0 : flatFixCost(s.level)
        if (tow && !hasRusty) return s.toast("Build Rusty's Rescue to tow for free")
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'the tire repair')
        const xp = serviceXp(tow ? 'tow' : 'fix', s.level)
        set(withXp(s, xp, {
          coins: s.coins - cost,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, flat: false } : c)),
          stats: bump(s, 'flatsFixed'),
          panel: null,
          updatedAt: Date.now(),
        }))
        if (tow) requestTrip(cuid, 'tow')
        else sfx.buy()
        s.toast(tow ? `Rusty towed it in and patched it up. +${xp} XP` : `Tire fixed for $${cost}`)
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
          const xp = serviceXp('tires', s.level)
          s.toast(`Your Tire Shop fixed it! +${pay} coins, +${xp} XP`)
          requestTrip(cuid, 'tires')
          return set(withXp(s, xp, {
            coins: s.coins + pay,
            cars: s.cars.map((c) => (c.uid === cuid ? { ...c, flat: false } : c)),
            stats: { ...bump(s, 'flatsFixed'), serviced: (s.stats.serviced ?? 0) + 1, coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
            panel: null,
            updatedAt: Date.now(),
          }))
        }
        if (!car.lowFuel) return
        if (how === 'gas') {
          if (!owns('gas')) return s.toast('Build a Gas Station to fill up for profit')
          const pay = servicePay(s.level, 'gas')
          sfx.coin()
          const xp = serviceXp('gas', s.level)
          s.toast(`Filled up at your Gas Station! +${pay} coins, +${xp} XP`)
          requestTrip(cuid, 'gas')
          return set(withXp(s, xp, {
            coins: s.coins + pay,
            cars: s.cars.map((c) => (c.uid === cuid ? { ...c, lowFuel: false } : c)),
            stats: { ...bump(s, 'serviced'), coinsEarned: (s.stats.coinsEarned ?? 0) + pay },
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

      toggleShowcase: (cuid) => {
        const s = get()
        if (!s.cars.some((c) => c.uid === cuid)) return
        set({ showcase: togglePick(s.showcase ?? [], cuid), updatedAt: Date.now() })
        sfx.equip()
      },

      setRaceCar: (cuid) => {
        const s = get()
        if (s.raceCar === cuid || !s.cars.some((c) => c.uid === cuid)) return
        set({ raceCar: cuid, updatedAt: Date.now() })
        sfx.equip()
      },

      markHelped: (ownerId) => {
        const s = get()
        if (s.helped[ownerId] === today()) return
        set({ helped: { ...s.helped, [ownerId]: today() }, updatedAt: Date.now() })
      },

      setTutorial: (tutorial) => set({ tutorial, updatedAt: Date.now() }),
      skipTutorial: (pickStep) => set((s) => ({ tutorial: 99, ...(s.tutorial <= pickStep ? { freePaint: true } : {}), updatedAt: Date.now() })),

      receiveGifts: (fuel, parts) => {
        const s = get()
        sfx.coin()
        s.toast(`Collected${fuel ? ` +${fuel} ⛽` : ''}${parts ? ` +${parts} ⚙` : ''} from friends`)
        set({ fuel: s.fuel + fuel, parts: s.parts + parts, updatedAt: Date.now() })
      },

      // Colour, finish and stripes in one paint job, tried on in the garage first.
      paintCar: (cuid, job) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const paint = PAINTS.find((p) => p.color === job.color)
        const fin = FINISHES.find((f) => f.id === job.finish)
        // A car can keep a factory colour that isn't on the paint chart; Custom Colour paints any.
        if (!car || (!paint && job.color !== car.color && !(hasCustomPaint(s) && isHexColor(job.color))) || !fin || !STRIPES.includes(job.stripe)) return false
        if (job.color !== car.color && !paintOpen(s, job.color)) {
          const r = rivalForPaint(job.color)
          sfx.error()
          s.toast(r ? `Beat ${r.name} to unlock ${paint!.name}` : paint?.earn ? `${paint.name}: ${earnHint(job.color)}` : 'That colour is locked')
          return false
        }
        if (gateLevel(s) < fin.unlockLevel && fin.id !== (car.finish ?? 'gloss')) {
          sfx.error()
          s.toast(`${fin.name} unlocks at level ${fin.unlockLevel}`)
          return false
        }
        if (fin.mastery && carClassTier(s.mastery, car.model) < fin.mastery && fin.id !== car.finish) {
          sfx.error()
          s.toast(fin.blurb)
          return false
        }
        const { coins, bucks, deal, free } = paintPrice(s, car, job)
        const recolour = job.color !== car.color || job.finish !== (car.finish ?? 'gloss')
        if (!recolour && job.stripe === (car.stripe ?? null)) return false
        if (s.coins < coins) { s.showNeed('coins', coins - s.coins, 'a paint job'); return false }
        if (s.bucks < bucks) { s.showNeed('bucks', bucks - s.bucks, `${paint?.name ?? 'Custom'} paint`); return false }
        const patch = {
          coins: s.coins - coins,
          bucks: s.bucks - bucks,
          ...spendDeal(s, deal),
          ...(free ? { freePaint: false } : {}),
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, color: job.color, finish: job.finish === 'gloss' ? undefined : job.finish, stripe: job.stripe } : c)),
          // Taking stripes off is free, so it doesn't count as a paint job for goals and tasks.
          ...(coins || bucks ? { stats: bump(s, 'painted') } : {}),
          updatedAt: Date.now(),
        }
        set(recolour ? withXp(s, 5, patch) : patch)
        sfx.buy()
        s.toast(recolour ? (paint ? `Painted ${fin.id === 'gloss' ? '' : fin.name + ' '}${paint.name}!` : `${fin.name} finish on!`) : job.stripe ? 'Stripes on!' : 'Stripes off')
        return true
      },

      paintPanels: (cuid, want) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return false
        const next = tidyPanels(want)
        const was = tidyPanels(car.panels)
        if (JSON.stringify(next ?? {}) === JSON.stringify(was ?? {})) return false
        const bike = isBike(carDef(car.model).body)
        for (const pn of PANELS) {
          const v = next?.[pn.id]
          if (!v) continue
          if ((bike && pn.car) || (v.color && (!pn.color || !(PAINTS.some((p) => p.color === v.color) || (hasCustomPaint(s) && isHexColor(v.color))))) || (v.pattern && !pn.pattern)) return false
          // Rival colours stay locked panel by panel too, but a panel keeps the colour it has.
          if (v.color && v.color !== was?.[pn.id]?.color && !paintOpen(s, v.color)) {
            const r = rivalForPaint(v.color)
            sfx.error()
            s.toast(r ? `Beat ${r.name} to unlock that colour` : earnHint(v.color) || 'That colour is locked')
            return false
          }
          const pat = v.pattern ? PATTERNS.find((p) => p.id === v.pattern) : undefined
          if (v.pattern && !pat) return false
          if (pat?.trial && !((s.tuner?.[pat.trial] ?? 0) > 0) && was?.[pn.id]?.pattern !== pat.id) {
            sfx.error()
            s.toast(`Win ${tunerTrial(pat.trial)?.name ?? 'a Tuner Trial'} to unlock ${pat.name}`)
            return false
          }
          if (pat?.mastery && masteryTier(s.mastery, car.model) < pat.mastery && was?.[pn.id]?.pattern !== pat.id) {
            sfx.error()
            s.toast(`Reach ${pat.name} mastery in this car to unlock it`)
            return false
          }
          if (pat?.road && !roadOpen(s.roadItems, pat.id) && was?.[pn.id]?.pattern !== pat.id) {
            sfx.error()
            s.toast(`${pat.name}: Trophy Road mystery prize`)
            return false
          }
          if (pat && gateLevel(s) < pat.unlockLevel && was?.[pn.id]?.pattern !== pat.id) {
            sfx.error()
            s.toast(`${pat.name} unlocks at level ${pat.unlockLevel}`)
            return false
          }
        }
        const { coins, bucks } = panelJobCost(was, next)
        if (s.coins < coins) { s.showNeed('coins', coins - s.coins, 'custom paint'); return false }
        if (s.bucks < bucks) { s.showNeed('bucks', bucks - s.bucks, 'custom paint'); return false }
        const patch = {
          coins: s.coins - coins,
          bucks: s.bucks - bucks,
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, panels: next } : c)),
          // Back to stock is free, so it doesn't count as a paint job.
          ...(coins || bucks ? { stats: bump(s, 'painted') } : {}),
          updatedAt: Date.now(),
        }
        set(coins || bucks ? withXp(s, 5, patch) : patch)
        sfx.buy()
        s.toast(coins || bucks ? 'Custom paint on!' : 'Back to stock')
        return true
      },

      closeRecap: () => set({ recap: null, updatedAt: Date.now() }),

      befriend: (id, act, name) => {
        const s = get()
        const was = s.friendship?.[id] ?? 0
        const now = was + FRIEND_POINTS[act]
        set({ friendship: { ...s.friendship, [id]: now }, updatedAt: Date.now() })
        const lv = friendLevel(now)
        if (lv > friendLevel(was)) sfx.reward()
        if (lv > friendLevel(was)) s.toast(`${FRIEND_LEVELS[lv].icon} ${name ?? 'Your friend'} is now your ${FRIEND_LEVELS[lv].name}!`)
      },

      // Window tint, headlights and door handles: each new pick costs coins once; stock is free.
      setTrim: (cuid, want) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car) return false
        const next = tidyTrim(want)
        if (sameTrim(next, car.trim)) return false
        const lock = trimLocked(s.level, car.trim, next)
        if (lock) { s.toast(`${lock.name} unlocks at level ${lock.level}`); return false }
        const coins = trimCost(car.trim, next)
        if (s.coins < coins) { s.showNeed('coins', coins - s.coins, 'new trim'); return false }
        set({ coins: s.coins - coins, cars: s.cars.map((c) => (c.uid === cuid ? { ...c, trim: next } : c)), updatedAt: Date.now() })
        sfx.buy()
        s.toast(coins ? 'New trim on!' : 'Back to stock trim')
        return true
      },

      savePreset: (slot, cuid) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car || slot < 0 || slot >= PRESET_SLOTS) return
        const presets = Array.from({ length: PRESET_SLOTS }, (_, i) => s.presets?.[i] ?? null)
        presets[slot] = { color: car.color, ...(car.finish ? { finish: car.finish } : {}), ...(car.stripe ? { stripe: car.stripe } : {}), ...(car.panels ? { panels: car.panels } : {}), ...(car.trim ? { trim: car.trim } : {}) }
        set({ presets, updatedAt: Date.now() })
        sfx.equip()
        s.toast(`Look saved to slot ${slot + 1}`)
      },

      clearPreset: (slot) => {
        const s = get()
        if (!s.presets?.[slot]) return
        set({ presets: s.presets.map((p, i) => (i === slot ? null : p)), updatedAt: Date.now() })
      },

      // Puts a saved look on a car: paint, then panels, then trim, each at its usual price, once
      // the whole lot is affordable. A locked colour or pattern stops that part with its usual toast.
      applyPreset: (slot, cuid) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const pr = s.presets?.[slot]
        if (!car || !pr) return false
        const job: PaintJob = { color: pr.color, finish: pr.finish ?? 'gloss', stripe: pr.stripe ?? null }
        const repaint = job.color !== car.color || job.finish !== (car.finish ?? 'gloss') || job.stripe !== (car.stripe ?? null)
        const paint = repaint ? paintPrice(s, car, job) : { coins: 0, bucks: 0 }
        const pan = panelJobCost(tidyPanels(car.panels), tidyPanels(pr.panels))
        const coins = paint.coins + pan.coins + trimCost(car.trim, pr.trim)
        const bucks = paint.bucks + pan.bucks
        if (s.coins < coins) { s.showNeed('coins', coins - s.coins, 'this look'); return false }
        if (s.bucks < bucks) { s.showNeed('bucks', bucks - s.bucks, 'this look'); return false }
        let done = false
        if (repaint) done = get().paintCar(cuid, job) || done
        if (JSON.stringify(tidyPanels(pr.panels) ?? {}) !== JSON.stringify(tidyPanels(car.panels) ?? {})) done = get().paintPanels(cuid, pr.panels ?? {}) || done
        if (!sameTrim(pr.trim, car.trim)) done = get().setTrim(cuid, pr.trim ?? {}) || done
        if (!done && !repaint) s.toast('This car already has that look')
        return done
      },

      tutorialStyle: (cuid, color, rim) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        if (!car || s.tutorial >= 99 || !STARTER_PAINTS.includes(color) || !STARTER_PAINTS.includes(rim)) return false
        const panels = tidyPanels({ ...car.panels, rims: { color: rim } })
        set({ cars: s.cars.map((c) => (c.uid === cuid ? { ...c, color, panels } : c)), freePaint: false, updatedAt: Date.now() })
        sfx.buy()
        return true
      },

      skinCar: (cuid, id) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const d = skinDef(id)
        if (!car || (id && !d) || (car.skin ?? null) === id) return false
        let patch: Partial<SaveState> = {}
        if (d && !ownedSkins(s).includes(d.id)) {
          if (!('bucks' in d.unlock)) return false
          const price = d.unlock.bucks
          if (s.bucks < price) { s.showNeed('bucks', price - s.bucks, `the ${d.name} skin`); return false }
          patch = { bucks: s.bucks - price, skins: [...(s.skins ?? []), d.id] }
          sfx.buy()
        }
        set({ ...patch, cars: s.cars.map((c) => (c.uid === cuid ? { ...c, skin: id ?? undefined } : c)), updatedAt: Date.now() })
        s.toast(d ? `${d.name} skin on!` : 'Skin off')
        return true
      },

      grantSkin: (id) => {
        const s = get()
        if (!skinDef(id) || ownedSkins(s).includes(id)) return false
        set({ skins: [...(s.skins ?? []), id], updatedAt: Date.now() })
        return true
      },

      skinMod: (cuid, slot, id) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const d = modSkinDef(id)
        if (!car || (id && !d) || !SKINNED_SLOTS.includes(slot) || (car.modSkin?.[slot] ?? null) === id) return false
        if (id && !fittedMods(car.mods, carDef(car.model).body)[slot]) return false
        let patch: Partial<SaveState> = {}
        if (d && !ownedModSkins(s).includes(d.id)) {
          if (!('bucks' in d.unlock)) return false
          const price = d.unlock.bucks
          if (s.bucks < price) { s.showNeed('bucks', price - s.bucks, `the ${d.name} mod skin`); return false }
          patch = { bucks: s.bucks - price, modSkins: [...(s.modSkins ?? []), d.id] }
          sfx.buy()
        }
        const next = { ...car.modSkin }
        if (id) next[slot] = id
        else delete next[slot]
        set({ ...patch, cars: s.cars.map((c) => (c.uid === cuid ? { ...c, modSkin: Object.keys(next).length ? next : undefined } : c)), updatedAt: Date.now() })
        s.toast(d ? `${d.name} on!` : 'Mod skin off')
        return true
      },

      grantModSkin: (id) => {
        const s = get()
        if (!modSkinDef(id) || ownedModSkins(s).includes(id)) return false
        set({ modSkins: [...(s.modSkins ?? []), id], updatedAt: Date.now() })
        return true
      },

      hatCar: (cuid, want) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const next = want ? cleanHat(want) : null
        if (!car || (want && !next) || sameHat(car.hat, next)) return false
        const d = hatDef(next?.id)
        if (d && !ownedHats(s).includes(d.id)) { sfx.error(); s.toast(`🔒 ${d.name}`); return false }
        set({ cars: s.cars.map((c) => (c.uid === cuid ? { ...c, hat: next ?? undefined } : c)), updatedAt: Date.now() })
        sfx.equip()
        s.toast(d ? `${d.icon} ${d.name} on!` : 'Hat off')
        return true
      },

      modCar: (cuid, modId, remove) => {
        const s = get()
        const car = s.cars.find((c) => c.uid === cuid)
        const m = modDef(modId)
        if (!car || !m) return false
        if (!remove && !modFits(m, carDef(car.model).body)) return false
        const others = (car.mods ?? []).filter((id) => modDef(id)?.slot !== m.slot)
        if (remove) {
          // Taken-off parts stay owned.
          set({ cars: s.cars.map((c) => (c.uid === cuid ? { ...c, mods: others, ownedMods: ownedMods(c) } : c)), updatedAt: Date.now() })
          return true
        }
        if ((car.mods ?? []).includes(modId)) return false
        const owned = ownedMods(car)
        if (owned.includes(modId)) {
          // Already bought for this car: putting it back on is free.
          set({ cars: s.cars.map((c) => (c.uid === cuid ? { ...c, mods: [...others, modId], ownedMods: owned } : c)), updatedAt: Date.now() })
          s.toast(`${m.name} back on!`)
          return true
        }
        if (gateLevel(s) < m.unlockLevel) {
          s.showNeed('level', m.unlockLevel, m.name)
          return false
        }
        const cost = modPrice(s, modId)
        if (s.bucks < cost.bucks) {
          s.showNeed('bucks', cost.bucks - s.bucks, `the ${m.name}`)
          return false
        }
        if (s.parts < cost.parts) {
          s.showNeed('parts', cost.parts - s.parts, `the ${m.name}`)
          return false
        }
        if (s.coins < cost.coins) {
          s.showNeed('coins', cost.coins - s.coins, `the ${m.name}`)
          return false
        }
        sfx.buy()
        set(withXp(s, modXp(modId), {
          coins: s.coins - cost.coins,
          parts: s.parts - cost.parts,
          bucks: s.bucks - cost.bucks,
          ...spendDeal(s, cost.deal),
          cars: s.cars.map((c) => (c.uid === cuid ? { ...c, mods: [...others, modId], ownedMods: [...owned, modId] } : c)),
          stats: bump(s, 'modsBought'),
          updatedAt: Date.now(),
        }))
        s.toast(`${m.name} fitted!`)
        return true
      },

      loadSave: (save) => set({ ...starterDefaults(), ...unfoldStored(save), hatQuest: hatQuestOf(save), oldPaints: save.oldPaints ?? true }),

      gpResult: (seriesId, won, place = won ? 1 : 2, of = 2) => {
        const s = get()
        const series = GP_SERIES.find((o) => o.id === seriesId)
        if (!series) return
        const cur = s.gp[seriesId] ?? { round: 0, clears: 0 }
        const reward = gpReward(series, cur.round)
        s.finishRace(won, reward, { mode: 'kart', loss: Math.round(reward * placeShare(place, of)) })
        if (!won) return
        set((g) => ({ hatQuest: { ...hatQuestOf(g), kart: hatQuestOf(g).kart + 1 } }))
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

      campaignResult: (chapterId, i, myTime, theirTime) => {
        const s = get()
        const ch = CAMPAIGN.find((o) => o.id === chapterId)
        if (!ch) return 0
        const id = campaignRaceId(ch, i)
        const before = s.campaign[id] ?? 0
        const stars = campaignStars(myTime, theirTime)
        s.finishRace(stars > 0, campaignReward(ch, i, before === 0))
        if (stars > 0) set((g) => ({ stats: { ...g.stats, campaignWins: (g.stats.campaignWins ?? 0) + 1 } }))
        if (stars <= before) return stars
        const campaign = { ...s.campaign, [id]: stars }
        // One-time bonuses: clearing the chapter, and three stars on all of it.
        const cleared = !campaignCleared(s.campaign, ch) && campaignCleared(campaign, ch)
        const perfect = !campaignPerfect(s.campaign, ch) && campaignPerfect(campaign, ch)
        if (!cleared && !perfect) {
          set({ campaign, updatedAt: Date.now() })
          return stars
        }
        const coins = cleared ? ch.coins : 0
        const bucks = (cleared ? ch.bucks : 0) + (perfect ? ch.starBucks : 0)
        const trophies = cleared ? ch.trophies : 0
        setTimeout(sfx.levelUp, 200)
        set((g) => ({
          campaign,
          coins: g.coins + coins,
          bucks: g.bucks + bucks,
          trophies: g.trophies + trophies,
          stats: { ...g.stats, coinsEarned: (g.stats.coinsEarned ?? 0) + coins },
          campaignPrize: { chapter: ch.id, coins, bucks, trophies, cleared, perfect },
          updatedAt: Date.now(),
        }))
        return stars
      },

      closeCampaignPrize: () => set({ campaignPrize: null }),

      tourResult: (won, pi) => {
        const s = get()
        const race = s.tour ?? 0
        s.finishRace(won, tourPrize(race, pi))
        if (!won) return
        if (!tourIsBoss(race)) return set({ tour: race + 1, updatedAt: Date.now() })
        const leg = tourLegOf(race)
        const coins = tourLegBonus(leg)
        setTimeout(sfx.levelUp, 200)
        set((g) => ({
          tour: race + 1,
          coins: g.coins + coins,
          stats: { ...g.stats, coinsEarned: (g.stats.coinsEarned ?? 0) + coins },
          tourPrize: { leg, coins },
          updatedAt: Date.now(),
        }))
      },

      closeTourPrize: () => set({ tourPrize: null }),

      eventEnter: (pi) => {
        const week = trialWeek()
        if (eventProgress(get().event, week)) return
        set({ event: { week, pi: Math.round(pi), won: 0 }, updatedAt: Date.now() })
      },

      eventResult: (won) => {
        const s = get()
        // Not eventProgress(): a race started before the Monday reset still counts for its own week.
        const p = s.event
        if (!p || p.won >= EVENT_RACES) return
        s.finishRace(won, eventPrize(p.pi, p.won))
        if (!won) return
        const event = { ...p, won: p.won + 1 }
        if (!eventIsBoss(p.won)) return set({ event, updatedAt: Date.now() })
        // The boss: the event's skin, and the bonus (twice over when the skin was already won).
        const def = eventFor(p.week)
        const fresh = get().grantSkin(def.skin)
        const coins = eventBonus(p.pi) * (fresh ? 1 : 2)
        setTimeout(sfx.levelUp, 200)
        set((g) => ({
          event,
          coins: g.coins + coins,
          stats: { ...g.stats, coinsEarned: (g.stats.coinsEarned ?? 0) + coins },
          eventPrize: { id: def.id, skin: fresh ? def.skin : null, coins },
          updatedAt: Date.now(),
        }))
      },

      closeEventPrize: () => set({ eventPrize: null }),

      rivalResult: (id, won, prize) => {
        const s = get()
        const def = RIVALS.find((r) => r.id === id)
        if (!def) return null
        s.finishRace(won, prize)
        if (!won) return null
        const beaten = Math.min(RIVAL_VISITS, (s.rivals[id]?.beaten ?? 0) + 1)
        const quit = beaten >= RIVAL_VISITS && (s.rivals[id]?.beaten ?? 0) < RIVAL_VISITS
        const rivals = { ...get().rivals, [id]: beaten < RIVAL_VISITS ? { beaten, back: Date.now() + RIVAL_BACK_MS } : { beaten } }
        if (!quit) {
          set({ rivals, updatedAt: Date.now() })
          return null
        }
        setTimeout(sfx.levelUp, 200)
        set((g) => ({
          rivals,
          coins: g.coins + def.coins,
          bucks: g.bucks + def.bucks,
          trophies: g.trophies + def.trophies,
          stats: { ...g.stats, coinsEarned: (g.stats.coinsEarned ?? 0) + def.coins },
          updatedAt: Date.now(),
        }))
        return { coins: def.coins, bucks: def.bucks, trophies: def.trophies }
      },

      worldTourResult: (i, won) => {
        const s = get()
        const r = WORLD_TOUR[i]
        if (!r) return
        const beaten = s.worldTour ?? 0
        if (i > beaten) return
        s.finishRace(won, worldPrize(i, i === beaten))
        if (!won || i < beaten) return
        set({ worldTour: beaten + 1, updatedAt: Date.now() })
        if (worldDone(beaten + 1)) {
          setTimeout(sfx.levelUp, 200)
          s.toast('🌍 World Tour champion! Tour Blue paint unlocked')
        } else s.toast(`${r.flag} ${r.country} done! Next stop: ${WORLD_TOUR[i + 1].flag} ${WORLD_TOUR[i + 1].country}`)
      },

      rowResult: (id, won) => {
        const s = get()
        const r = paintRival(id)
        if (!r) return
        const wins = s.rivalRow[id] ?? 0
        s.finishRace(won, rowPrize(r, wins === 0))
        if (!won) return
        if (wins === 0) setTimeout(sfx.levelUp, 200)
        set((g) => ({ rivalRow: { ...g.rivalRow, [id]: wins + 1 }, paintPrize: wins === 0 ? id : g.paintPrize, updatedAt: Date.now() }))
      },

      closePaintPrize: () => set({ paintPrize: null }),

      tunerResult: (id, won) => {
        const s = get()
        const t = tunerTrial(id)
        if (!t) return
        const wins = s.tuner?.[id] ?? 0
        s.finishRace(won, tunerPrize(t, wins === 0))
        if (!won) return
        if (wins === 0) setTimeout(sfx.levelUp, 200)
        set((g) => ({ tuner: { ...g.tuner, [id]: wins + 1 }, tunerPrize: wins === 0 && t.pattern ? id : g.tunerPrize, updatedAt: Date.now() }))
      },

      closeTunerPrize: () => set({ tunerPrize: null }),

      rivalBet: (won, stake) => {
        const s = get()
        const amount = won ? stake : -Math.min(stake, s.coins)
        set({
          ...(won ? { hatQuest: hatRaceWin(s) } : {}),
          coins: s.coins + amount,
          racesWon: s.racesWon + (won ? 1 : 0),
          stats: { ...bump(s, 'racesWon', won ? 1 : 0), races: (s.stats.races ?? 0) + 1, coinsEarned: (s.stats.coinsEarned ?? 0) + Math.max(0, amount) },
          updatedAt: Date.now(),
        })
      },

      claimTrialPrize: (week, place) => {
        const s = get()
        if (s.trials.claimed[week] !== undefined || !(place >= 1)) return
        const p = trialPrize(place)
        setTimeout(sfx.levelUp, 200)
        set({
          coins: s.coins + p.coins,
          bucks: s.bucks + p.bucks,
          trophies: s.trophies + p.trophies,
          trials: { ...s.trials, claimed: { ...s.trials.claimed, [week]: place } },
          stats: { ...s.stats, coinsEarned: (s.stats.coinsEarned ?? 0) + p.coins },
          updatedAt: Date.now(),
        })
      },
      closePrize: () => set({ gpPrize: null }),
      closeLevelUp: () => set({ levelUp: null }),
      focusShop: (panel, shopFocus) => set({ levelUp: null, panel, shopFocus, mode: 'play', placing: null, selected: null }),

      buyPlot: (px, pz) => {
        const s = get()
        if (!buyablePlots(s.land).some(([x, z]) => x === px && z === pz)) return
        const cost = plotPrice(s.land.length - START_LAND.length)
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, 'more land')
        // The new plot comes wild: trees, boulders and bushes to bulldoze (game/wildLand.ts).
        const obstacles: PlacedBuilding[] = wildPlot(px, pz).map((w) => ({ uid: uid(), def: w.def, x: w.x, z: w.z, jobEndsAt: null }))
        sfx.buy()
        s.toast('New land! Bulldoze the trees and rocks to build')
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
        const price = refillBucks(cap - s.fuel)
        if (s.bucks < price) return s.showNeed('bucks', price - s.bucks, 'a fuel refill')
        sfx.buy()
        s.toast(`Tank filled! +${cap - s.fuel} fuel`)
        set({ bucks: s.bucks - price, fuel: cap, fuelUpdatedAt: Date.now(), panel: s.panel === 'need' ? null : s.panel, updatedAt: Date.now() })
      },

      // Supplies deals (parts and fuel) are bought straight from the Deals panel.
      buyDeal: (id) => {
        const s = get()
        const d = dealsFor(today()).find((x) => x.id === id)
        if (!d || (d.kind !== 'parts' && d.kind !== 'fuel') || dealUsed(s, id)) return false
        const o = dealOffer(d)
        if (d.kind === 'fuel' && s.fuel >= fuelCap(s)) { s.toast('Your tank is already full'); return false }
        if (s.coins < o.now.coins) { s.showNeed('coins', o.now.coins - s.coins, o.name); return false }
        if (s.bucks < o.now.bucks) { s.showNeed('bucks', o.now.bucks - s.bucks, o.name); return false }
        sfx.buy()
        set({
          coins: s.coins - o.now.coins,
          bucks: s.bucks - o.now.bucks,
          ...(d.kind === 'parts' ? { parts: s.parts + (d.n ?? 0) } : { fuel: fuelCap(s), fuelUpdatedAt: Date.now() }),
          ...spendDeal(s, d),
          updatedAt: Date.now(),
        })
        s.toast(d.kind === 'parts' ? `+${d.n} parts!` : 'Tank filled!')
        return true
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
        if (gateLevel(s) < spot.unlockLevel) return s.showNeed('level', spot.unlockLevel, spot.name)
        if (s.junkyard.length >= STORAGE_MAX) return s.toast('Storage is full. Restore or scrap a car first.')
        if (s.coins < spot.cost) return s.showNeed('coins', spot.cost - s.coins, `a search in the ${spot.name}`)
        const go = (res: ServerSearch | null) => {
          const g = get()
          if (g.search || g.coins < spot.cost) return
          // A piece from the server, or rolled here for guests (PIECE_SOURCES.rusty_track).
          const local = !res && spotId === 'track' ? rollSourcePiece('rusty_track', g.level, g.cars, g.restoParts ?? []) : null
          const open: CrateOpen | null = res?.piece ?? (local ? { crate: 'rusty_track', cost: { coins: 0, bucks: 0 }, drop: local } : null)
          const d = open?.drop
          const piece = d && (d.kind === 'piece' || d.kind === 'piecedupe') ? { model: d.model, piece: d.piece } : undefined
          sfx.start()
          set({
            coins: g.coins - spot.cost,
            search: { ...rollSearch(spotId, res?.cars ?? null, { truck: g.truck, hot: hotSpot(g.level) === spotId }), ...(piece ? { piece } : {}) },
            stats: bump(g, 'searches'),
            updatedAt: Date.now(),
          })
          if (open) get().applyCrate(open)
        }
        if (!rescueRoller) return go(null)
        if (rolling) return
        rolling = true
        rescueRoller(spotId)
          .then(go, () => get().toast("Rusty's radio can't reach the yard. Check your connection and try again."))
          .finally(() => {
            rolling = false
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
        // The search scene plays the reveal's build-up and sting itself, in time with the tarp.
        set({ search: { ...q, truckAt: i, revealed: q.revealed.map((r, j) => r || j === i) } })
      },

      fixTruck: () => {
        const s = get()
        const q = s.search
        if (!q?.flat) return
        if (s.bucks < TOW_FIX_BUCKS) return s.showNeed('bucks', TOW_FIX_BUCKS - s.bucks, 'fixing the tow truck')
        sfx.buy()
        const i = q.flatAt!
        set({ bucks: s.bucks - TOW_FIX_BUCKS, search: { ...q, flat: false, flatAt: null, revealed: q.revealed.map((r, j) => r || j === i) }, updatedAt: Date.now() })
      },

      abandonSearch: () => {
        const s = get()
        if (s.search?.flat) s.toast('The tow truck limped home empty-handed.')
        sfx.menuClose()
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
              junkyard.push({ uid: l.uid ?? uid(), model: l.model, rarity: l.rarity })
              notes.push(carDef(l.model).name)
            } else {
              scrapped += RARITY[l.rarity].scrapParts
            }
          }
        }
        parts += scrapped
        // Rusty's panel shows the haul card with its fanfare.
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
        const bay = !s.restoring ? 'restoring' : !s.restoring2 && gateLevel(s) >= BAY2_LEVEL ? 'restoring2' : null
        if (!bay) return s.toast('The restore bay is busy. Finish that car first.')
        const cost = restoreCost(carDef(car.model))
        if (s.coins < cost) return s.showNeed('coins', cost - s.coins, `restoring the ${carDef(car.model).name}`)
        const minutes = RARITY[car.rarity].minutes
        sfx.start()
        set({
          coins: s.coins - cost,
          junkyard: s.junkyard.filter((c) => c.uid !== juid),
          [bay]: { ...car, minutes, endsAt: Date.now() + minutes * 60000 },
          updatedAt: Date.now(),
        })
      },

      rushRestore: (bay = 0) => {
        const s = get()
        const key = bay ? 'restoring2' : 'restoring'
        const r = s[key]
        if (!r) return
        const left = r.endsAt - Date.now()
        if (left <= 0) return
        const cost = rushBucks(left)
        if (s.bucks < cost) return s.showNeed('bucks', cost - s.bucks, 'finishing the restore now')
        sfx.buy()
        set({ bucks: s.bucks - cost, [key]: { ...r, endsAt: Date.now() }, updatedAt: Date.now() })
      },

      collectRestored: (plate, bay = 0) => {
        const s = get()
        const key = bay ? 'restoring2' : 'restoring'
        const r = s[key]
        if (!r || Date.now() < r.endsAt) return
        const c = carDef(r.model)
        sfx.buy()
        s.toast(`${c.name} restored and added to your garage!`)
        set(withXp(s, 25 + Math.round(c.price / 200), {
          [key]: null,
          cars: [...s.cars, { uid: r.uid, model: r.model, color: c.colors[0], upgrades: noUpgrades(), plate: cleanPlate(plate) || undefined }],
          stats: { ...s.stats, rescued: (s.stats.rescued ?? 0) + 1, carsBought: (s.stats.carsBought ?? 0) + 1 },
          updatedAt: Date.now(),
        }))
      },

      upgradeTruck: () => {
        const s = get()
        const next = TRUCK[(s.truck ?? 0) + 1]
        if (!next) return
        if (gateLevel(s) < next.level) return s.showNeed('level', next.level, 'the next tow truck upgrade')
        if (s.parts < next.parts) return s.showNeed('parts', next.parts - s.parts, 'the next tow truck upgrade')
        sfx.buy()
        set({ parts: s.parts - next.parts, truck: (s.truck ?? 0) + 1, updatedAt: Date.now() })
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
      // A town saved before paint rivals has no oldPaints and keeps its colours.
      merge: (persisted, current) => (persisted ? { ...current, ...starterDefaults(), ...unfoldStored(persisted as Partial<SaveState>), hatQuest: hatQuestOf(persisted as Partial<SaveState>), oldPaints: (persisted as Partial<SaveState>).oldPaints ?? true } : current),
    },
  ),
)

export function saveOf(s: GameState): SaveState {
  const { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings, cars, stats, claimedGoals, quests, lastDaily, dailyStreak, helped, tutorial, junkyard, restoring, restoring2, truck, gp, campaign, claimedSets, crewChests, visits, crates, cratePity, boosts, wagers, purchases, season, deals, trials, rivals, rivalRow, tuner, mastery, road, roadItems, freeCrates, trail, cheer, flairSeen, daily, repSeen, worldTour, presets, seasonBase, recap, friendship, cups, freePaint, oldPaints, tour, event, showcase, raceCar, skins, modSkins, hats, hatQuest, lights, cityTheme, restoParts, land, stored, updatedAt } = s
  return { version, townName, level, xp, coins, bucks, parts, fuel, fuelUpdatedAt, trophies, racesWon, roads, buildings: foldStored(buildings, stored), cars, stats, claimedGoals, quests, lastDaily, dailyStreak, helped, tutorial, junkyard, restoring, restoring2: restoring2 ?? null, truck: truck ?? 0, gp, campaign, claimedSets, crewChests, visits, crates, cratePity: cratePity ?? {}, boosts: boosts ?? emptyBoosts(), ...(wagers ? { wagers } : {}), ...(purchases ? { purchases } : {}), season, deals, trials, rivals, rivalRow, tuner: tuner ?? {}, mastery: mastery ?? {}, road: road ?? 0, roadItems: roadItems ?? [], freeCrates: freeCrates ?? [], ...(trail ? { trail } : {}), ...(cheer ? { cheer } : {}), ...(flairSeen ? { flairSeen } : {}), ...(daily ? { daily } : {}), ...(repSeen !== undefined ? { repSeen } : {}), ...(worldTour ? { worldTour } : {}), ...(presets?.some(Boolean) ? { presets } : {}), ...(seasonBase ? { seasonBase } : {}), ...(recap ? { recap } : {}), ...(friendship ? { friendship } : {}), cups: cups ?? {}, ...(freePaint ? { freePaint } : {}), oldPaints: !!oldPaints, tour, event, showcase, ...(raceCar ? { raceCar } : {}), skins, modSkins, hats: hats ?? [], hatQuest: hatQuestOf({ stats, hatQuest }), ...(cleanLights(lights) ? { lights: cleanLights(lights) } : {}), ...(colorTheme(cityTheme) ? { cityTheme } : {}), ...(restoParts?.length ? { restoParts } : {}), land, updatedAt }
}

// The inventory travels inside `buildings`, flagged, so the server's guard sees the same town worth
// and levels whether a building is placed or stored. unfoldStored splits it back out on load.
function foldStored(buildings: PlacedBuilding[], stored: PlacedBuilding[] | undefined): PlacedBuilding[] {
  return stored?.length ? [...buildings, ...stored.map((b) => ({ ...b, stored: true }))] : buildings
}
export function unfoldStored<T extends Partial<SaveState>>(save: T): T & { stored: PlacedBuilding[] } {
  const all = Array.isArray(save.buildings) ? save.buildings : []
  const flagged = all.filter((b) => b.stored).map(({ stored: _s, ...b }) => b)
  const stored = [...(save.stored ?? []), ...flagged]
  return { ...save, ...(save.buildings ? { buildings: all.filter((b) => !b.stored) } : {}), stored }
}

// Fields added after launch, so older saves load with sensible values.
function starterDefaults(): Pick<SaveState, 'stats' | 'claimedGoals' | 'quests' | 'lastDaily' | 'dailyStreak' | 'helped' | 'tutorial' | 'junkyard' | 'restoring' | 'restoring2' | 'truck' | 'gp' | 'campaign' | 'claimedSets' | 'crewChests' | 'visits' | 'crates' | 'cratePity' | 'boosts' | 'wagers' | 'purchases' | 'season' | 'deals' | 'trials' | 'rivals' | 'rivalRow' | 'tuner' | 'mastery' | 'road' | 'cups' | 'tour' | 'event' | 'showcase' | 'skins' | 'modSkins' | 'hats' | 'land' | 'stored'> {
  // Saves from before the tutorial existed skip it.
  return { stats: emptyStats(), claimedGoals: [], quests: null, lastDaily: null, dailyStreak: 0, helped: {}, tutorial: 99, junkyard: [], restoring: null, restoring2: null, truck: 0, gp: {}, campaign: {}, claimedSets: [], crewChests: 0, visits: 0, crates: 0, cratePity: {}, boosts: emptyBoosts(), wagers: 0, purchases: 0, season: null, deals: null, trials: { claimed: {} }, rivals: {}, rivalRow: {}, tuner: {}, mastery: {}, road: 0, cups: {}, tour: 0, event: null, showcase: [], skins: [], modSkins: [], hats: [], land: [...START_LAND], stored: [] }
}


const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const range = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))

function rollCar(spotId: string, hot = false): Loot {
  const spot = RESCUE_SPOTS.find((o) => o.id === spotId)!
  const total = spot.cars.reduce((n, c) => n + rarityWeight(c.rarity, hot), 0)
  let r = Math.random() * total
  for (const c of spot.cars) {
    r -= rarityWeight(c.rarity, hot)
    if (r <= 0) return { kind: 'car', ...c }
  }
  return { kind: 'car', ...spot.cars[0] }
}

// Pre-rolls what every pin hides. Each search finds at least one car, and
// about one in four gives the tow truck a flat partway through.
export function rollSearch(spotId: string, finds: ServerFind[] | null = null, opts: { truck?: number; hot?: boolean } = {}): Search {
  const spot = RESCUE_SPOTS.find((o) => o.id === spotId)!
  const scale = spot.cost / 500
  const truck = truckOf(opts.truck)
  const n = truck.pins
  const pins: Loot[] = Array.from({ length: n }, () => {
    // With server finds, every other pin hides something else.
    const r = finds ? RESCUE_CAR_CHANCE + Math.random() * (1 - RESCUE_CAR_CHANCE) : Math.random()
    if (r < RESCUE_CAR_CHANCE) return rollCar(spotId, !!opts.hot)
    if (r < 0.42) return { kind: 'coins', n: Math.round(range(4, 14) * 5 * scale) }
    if (r < 0.62) return { kind: 'parts', n: range(1, 3) + Math.floor(scale / 3) }
    if (r < 0.74) return { kind: 'fuel', n: range(1, 3) }
    if (r < 0.77) return { kind: 'trophy' }
    return { kind: 'nothing' }
  })
  for (const f of finds ?? []) if (f.i >= 0 && f.i < n) pins[f.i] = { kind: 'car', model: f.model, rarity: f.rarity, uid: f.uid }
  if (!pins.some((p) => p.kind === 'car')) pins[Math.floor(Math.random() * n)] = rollCar(spotId, !!opts.hot)
  const flatAt = Math.random() < truck.flat ? pick(Array.from({ length: n }, (_, i) => i).filter((i) => pins[i].kind !== 'car')) : null
  return { spot: spotId, pins, revealed: pins.map(() => false), truckAt: null, flatAt: flatAt ?? null, flat: false }
}

export const spendFuel = (amount: number) => {
  const s = useGame.getState()
  if (s.fuel < amount) return false
  const cap = fuelCap(s)
  useGame.setState({ fuel: s.fuel - amount, fuelUpdatedAt: s.fuel >= cap ? Date.now() : s.fuelUpdatedAt })
  return true
}

// Opens a crate: checks the level and price, rolls it (on the server when signed in), adds it to
// the town and returns what was opened for the reveal. Null when it couldn't be opened. A free
// crate (`free` is its source in freeCrates, see cups.ts) skips the level and price. `count`
// opens that many at once (the ×10 open: never free, the price times count, one server call).
export async function openCrate(id: CrateId, free?: string, count = 1): Promise<CrateOpen[] | null> {
  const s = useGame.getState()
  const def = crateDef(id)
  if (!def) return null
  if (free && !s.freeCrates?.includes(free)) return null
  if (free) count = 1
  const one = free ? { coins: 0, bucks: 0 } : crateCost(def, s.level)
  const cost = { coins: one.coins * count, bucks: one.bucks * count }
  if (!free && s.level < def.unlockLevel) {
    s.showNeed('level', def.unlockLevel, def.name)
    return null
  }
  if (s.coins < cost.coins) {
    s.showNeed('coins', cost.coins - s.coins, def.name)
    return null
  }
  if (s.bucks < cost.bucks) {
    s.showNeed('bucks', cost.bucks - s.bucks, def.name)
    return null
  }
  const used = () => useGame.setState((g) => ({ freeCrates: (g.freeCrates ?? []).filter((x) => x !== free) }))
  let opens: CrateOpen[] | null = null
  try {
    opens = crateOpener ? await crateOpener(id, free, count) : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (free && msg.includes('already opened')) used()
    useGame.getState().toast(msg === 'soon' ? (count > 1 ? 'Open ×10 is coming very soon!' : 'Crates open for signed-in towns very soon!') : msg.includes('one crate') ? 'One crate at a time!' : "Couldn't open the crate. Try again.")
    return null
  }
  if (opens) {
    for (const o of opens) useGame.getState().applyCrate(o)
  } else {
    // A guest rolls in the browser, one after another, so each roll knows what the last one gave.
    opens = []
    for (let i = 0; i < count; i++) {
      const g = useGame.getState()
      const o: CrateOpen = { crate: id, cost: one, drop: rollCrate(def, g.level, g.cars, Math.random, { skins: crateOwnedSkins(g), modSkins: ownedModSkins(g), hats: ownedHats(g), pieces: g.restoParts ?? [] }, g.cratePity?.[id] ?? 0) }
      g.applyCrate(o)
      opens.push(o)
    }
  }
  // The server may hand back earlier opens the save missed instead: the free crate is only used once one opened free.
  if (free && opens.some((o) => o.crate === id && !o.cost.coins && !o.cost.bucks)) used()
  return opens
}

// Today's free spin on the prize wheel (once a UTC day): rolled on the server when signed in,
// added to the town like a crate open, and returned for the wheel to land on. Null when it can't spin.
export async function spinWheel(): Promise<WheelSpin | null> {
  const s = useGame.getState()
  if (s.lastDaily === today()) return null
  let got: ServerSpin | null = null
  try {
    got = wheelSpinner ? await wheelSpinner() : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('spun today')) useGame.getState().markSpun(today())
    useGame.getState().toast(msg === 'soon' ? 'The prize wheel opens very soon!' : msg.includes('spun today') ? 'Spun today. Back tomorrow!' : "Couldn't spin. Try again.")
    return null
  }
  if (got) {
    for (const o of got.pending) useGame.getState().applyCrate(o)
    if (got.spin) useGame.getState().applyCrate(got.spin.open)
    useGame.getState().markSpun(got.day)
    if (!got.spin) useGame.getState().toast('Spun today. Your prize is in!')
    return got.spin
  }
  const spin = rollWheel(s.level, s.cars, { skins: ownedSkins(s), modSkins: ownedModSkins(s) })
  useGame.getState().applyCrate(spin.open)
  useGame.getState().markSpun(today())
  return spin
}

// A hat is won the moment its challenge is done, whatever finished it (game/hats.ts).
useGame.subscribe((s, prev) => {
  if (s.stats === prev.stats && s.hatQuest === prev.hatQuest && s.hats === prev.hats) return
  const won = earnedHats(s)
  if (!won.length) return
  useGame.setState({ hats: [...ownedHats(s), ...won], updatedAt: Date.now() })
  for (const id of won) {
    const d = hatDef(id)!
    s.toast(`${d.icon} ${d.name} unlocked!`)
  }
  sfx.levelUp()
})

// Drops an empty tint so saves stay as they were for untinted buildings.
function cleanTint(b: PlacedBuilding): PlacedBuilding {
  if (b.tint) return b
  const { tint: _, ...rest } = b
  return rest
}
