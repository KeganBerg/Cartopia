import { Icon } from './Icon'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { bestCar, raceCarOf } from '../game/raceCar'
import { CARS, SKILLS, carDef, performance, RACE_FUEL, GP_SERIES, GP_ROUNDS, gpRivalPi, gpReward, CAMPAIGN, CAMPAIGN_RACES, campaignRaceId, campaignRivalPi, campaignShift, campaignRivalSkills, campaignReward, campaignCleared, type CampaignChapter, skillBoost, skillDrag, liveSkillBoost, smoothShift, type Body, type GpSeries, type SkillId } from '../game/data'
import { TRACK, freshRacer, stepRacer, shiftQuality, shiftBand, launchRacer, revLaunch, shiftRacer, fireBoost, aiReaction, AI_BOOST_GEAR, TOP_GEAR, LAUNCH_BAND, IDLE, REV_UP, REV_DOWN, RACE_DT } from '../game/race'
import { CarThumb } from '../scene/BuildingPreview'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { StageSlot, useStageReady, warmStage } from '../scene/Stage'
import { pauseTownDraw } from '../scene/renderGate'
import { RaceScene, startLights, finishView } from '../scene/RaceScene'
import { pickVenue, venue as venueById } from '../scene/venues'
import { sfx } from '../lib/sound'
import { raceAudio, type RaceAudio } from '../lib/engineAudio'
import { PlayerName } from './Username'
import { useLive, challenge, cancelChallenge, refreshPresence, raceChannel, endLiveRace, answer, pruneInvites, mute, hostParty, INVITE_MS, PARTY_MAX, type LiveRace } from '../lib/live'
import { displayName } from '../lib/names'
import { joinRefereed, reportFinish, serverPi, type Verdict } from '../lib/referee'
import { ghostDist, shortLeft, trialWeek, TRIAL_FUEL } from '../game/trial'
import { raceWeather } from '../game/weather'
import { carGrip, conditions, conditionsNote, gripMul, spinning } from '../game/grip'
import { TrialTab, TrialResult, beginTrialRun, type TrialRun } from './TimeTrial'
import { claim as claimVisitor, leave as leaveVisitor, setRacing, type Visitor } from '../lib/visitors'
import { RivalResult, type RivalMatch, type RivalBonus } from './Rivals'
import { RaceBar, RaceHub, Rounds, campaignFocus, type HubTab } from './RaceHub'
import { artStyle } from './venueArt'
import { PaintRivals, firstRowPick, rowChip, rowPrizeOf } from './PaintRivals'
import { TunerTrials, firstTrialPick, fixBuild, trialChip, trialPrizeOf } from './TunerTrials'
import { buildChecks, hostMods, tunerShift, tunerTrial, type TunerTrial } from '../game/tuner'
import { paintRival, rowShift, rowSkills, type PaintRival } from '../game/paintRivals'
import { TileClip } from './TileClip'
import './race-menu.css'
import { KartGame, playerRacer, type KartRacer } from './Kart'
import { LiveKart } from './LiveKart'
import { LiveKartParty } from './LiveKartParty'
import { BLAST_PI, TRACKS, gpField, gpTrack } from '../game/kart'
import { gpClearPi } from '../game/gpBeat'
import { look as kartLook } from './ArcadeBits'
import { TOUR_RACES, tourLeg, tourLegOf, tourIsBoss, tourRivalPi, tourShift, tourSkills, tourRivalName, tourPrize, tourLegBonus } from '../game/tour'
import type { WeatherKind } from '../game/weather'
import { WEEKLY_EVENTS, EVENT_RACES, eventBonus, eventFor, eventIsBoss, eventPrize, eventProgress, eventRivalPi, eventShift, nextEventWeek } from '../game/events'
import { msToNextWeek, skinDef, SKIN_TIERS, carStats } from '../game/data'
import { DIST, character, characterMul, tourDist, type RaceDist } from '../game/distance'
import { playerName } from '../lib/profiles'
import { LoadingScene } from './Loading'
import { settleWager, startWager, startWagers, voidWager, wagersOn } from '../lib/wagers'
import { shortCoins, stakesFor } from '../game/wager'
import { usePrefs } from '../lib/prefs'

// skill: the rival car's race skill. AI rivals use it; live players use theirs on their own device.
// shift: how cleanly an AI rival shifts, 0 (sloppy) to 1 (always perfect, the default).
type Rival = { id: string; town: string; level: number; carName: string; color: string; pi: number; online: boolean; body: Body; model?: string; mods?: string[]; skill?: SkillId; shift?: number; boss?: boolean }

const TOWNS = ['Transamsylvania', 'Gearville', 'Piston Peak', 'Nitro Bay', 'Chrome City', 'Rustbelt Row', 'Turbo Falls', 'Muffler Hills']
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)
const liveReward = (oppPi: number) => 300 + oppPi * 8
const reward = (r: Rival) => (r.id.startsWith('live:') ? liveReward(r.pi) : 150 + r.pi * 6)
const performance_now = () => window.performance.now()

const GP_CUP = ['🥉', '🏆', '🏆', '👑']

function carNear(target: number) {
  return [...CARS].sort((a, b) => Math.abs(performance(a, zero) - target) - Math.abs(performance(b, zero) - target))[0]
}

function gpRival(series: GpSeries, round: number, clears: number): Rival {
  const target = gpRivalPi(series, round, clears)
  const car = carNear(target)
  return { id: `gp-${series.id}-${round}`, town: series.rivals[round], level: series.unlockLevel + round, carName: car.name, color: car.colors[round % car.colors.length], pi: target, online: false, body: car.body, model: car.id, skill: car.skill }
}

// A Grand Prix race's grid: the round's named rival in their usual car and PI, the rest
// of the series' cast a little slower, and the player (see game/kart.ts gpField).
function gpKartField(series: GpSeries, round: number, rival: Rival, car: OwnedCar): KartRacer[] {
  return gpField(series.rivals, round, rival.pi, { name: 'You', pi: pi(car) }).map((f, i) => {
    if (!f.ai) return playerRacer(car)
    const c = f.name === rival.town ? carDef(rival.model ?? '') : carNear(f.pi)
    return { name: f.name, pi: f.pi, ai: true, skill: f.skill, look: kartLook({ uid: '', model: c.id, color: f.name === rival.town ? rival.color : c.colors[i % c.colors.length], upgrades: zero }) }
  })
}

// Bumper Blast: five rivals in random cars, every kart tuned the same (game/kart.ts BLAST_PI).
const BLASTERS = ['Crash Carla', 'Dent Dexter', 'Fender Fran', 'Wreck Rex', 'Smash Sami', 'Bonk Benny', 'Crunch Cleo', 'Rumble Ray']
function blastField(car: OwnedCar): KartRacer[] {
  const names = [...BLASTERS].sort(() => Math.random() - 0.5)
  const field: KartRacer[] = Array.from({ length: 5 }, (_, i) => {
    const c = CARS[Math.floor(Math.random() * CARS.length)]
    return { name: names[i], pi: BLAST_PI, ai: true, skill: 0.45 + i * 0.1, look: kartLook({ uid: '', model: c.id, color: c.colors[i % c.colors.length], upgrades: zero }) }
  })
  return [...field, playerRacer(car)]
}
const blastSetup = (car: OwnedCar) => ({ track: Math.floor(Math.random() * TRACKS.length), reverse: Math.random() < 0.5, field: blastField(car) })

// The car PI the series' final race needs before the server will accept the clear (0 before the final).
export function gpFinalNeed(series: GpSeries, clears: number, round: number) {
  return round === GP_ROUNDS - 1 ? gpClearPi(gpRivalPi(series, GP_ROUNDS - 1, clears)) : 0
}

function makeRivals(myPi: number, level: number): Rival[] {
  const towns = [...TOWNS].sort(() => Math.random() - 0.5)
  return [0.8, 0.95, 1.1].map((f, i) => {
    const target = Math.max(10, Math.round(myPi * f + (Math.random() * 6 - 3)))
    const car = [...CARS].sort((a, b) => Math.abs(performance(a, zero) - target) - Math.abs(performance(b, zero) - target))[0]
    return {
      id: `ai-${i}`,
      town: towns[i],
      level: Math.max(1, level + i - 1),
      carName: car.name,
      color: car.colors[Math.floor(Math.random() * car.colors.length)],
      pi: target,
      online: false,
      body: car.body,
      model: car.id,
      skill: car.skill,
    }
  })
}

// Real players' best cars, from their cloud saves.
async function fetchOnlineRivals(): Promise<Rival[]> {
  if (!supabase) return []
  const { data: auth } = await supabase.auth.getUser()
  let q = supabase.from('game_saves').select('owner_id, town_name, level, best_car').order('updated_at', { ascending: false }).limit(12)
  if (auth.user) q = q.neq('owner_id', auth.user.id)
  const { data, error } = await q
  if (error || !data) return []
  return data
    .filter((r) => r.best_car)
    .map((r) => ({
      id: r.owner_id,
      town: displayName(r.town_name, r.owner_id),
      level: r.level,
      carName: r.best_car.name,
      color: r.best_car.color,
      pi: r.best_car.pi,
      online: true,
      body: (r.best_car.body ?? 'sedan') as Body,
      model: CARS.find((c) => c.name === r.best_car.name)?.id,
      mods: Array.isArray(r.best_car.mods) ? r.best_car.mods : undefined,
      skill: CARS.find((c) => c.name === r.best_car.name)?.skill,
    }))
}

// How long a live race waits for the other player before offering to call it off.
const JOIN_PATIENCE_MS = 30000

type RaceTab = 'hub' | HubTab
let nextRaceTab: RaceTab = 'hub'
// A street racer visiting town (src/lib/visitors.ts): the race opens straight away, at no fuel.
let nextStreet: Visitor | null = null
export function openStreetRace(v: Visitor) {
  nextStreet = v
  nextRaceTab = 'quick'
  useGame.getState().openPanel('race')
}
// Opens the Race menu on a given tab (goals use it to send players to the campaign or Grand Prix).
export function openRaceTab(tab: RaceTab) {
  nextRaceTab = tab
  useGame.getState().openPanel('race')
}

const RACE_CAM = { position: [0.4, 2.2, -4] as [number, number, number], fov: 55, near: 0.3, far: 150 }

// Phones (portrait or on their side): the menu covers the town, so the town stops drawing
// while it's open and the tile clips get the phone to themselves.
const COVERS_TOWN = '(max-width: 600px), (max-height: 500px)'
function usePauseTownUnderMenu() {
  useEffect(() => {
    const mq = window.matchMedia(COVERS_TOWN)
    let release: (() => void) | undefined
    const sync = () => {
      release?.()
      release = mq.matches ? pauseTownDraw() : undefined
    }
    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      release?.()
    }
  }, [])
}

export function RacePanel() {
  useEffect(() => warmStage(), [])
  usePauseTownUnderMenu()
  const cars = useGame((s) => s.cars)
  const level = useGame((s) => s.level)
  const best = useMemo(() => bestCar(cars), [cars])
  const raceCar = useGame((s) => s.raceCar)
  const setRaceCar = useGame((s) => s.setRaceCar)
  const car = raceCarOf(cars, raceCar)
  const [rivals] = useState(() => makeRivals(best ? pi(best) : 10, level))
  const [online, setOnline] = useState<Rival[]>([])
  const [race, setRace] = useState<Rival | null>(null)
  const [gpRace, setGpRace] = useState<{ series: GpSeries; rival: Rival; prize: number; field: KartRacer[] } | null>(null)
  const [cRace, setCRace] = useState<{ chapter: CampaignChapter; race: number; rival: Rival; prize: number } | null>(null)
  const [tRace, setTRace] = useState<{ race: number; rival: Rival; prize: number } | null>(null)
  const [eRace, setERace] = useState<{ race: number; rival: Rival; prize: number } | null>(null)
  const [pRace, setPRace] = useState<{ def: PaintRival; rival: Rival; prize: number } | null>(null)
  const [kRace, setKRace] = useState<{ def: TunerTrial; rival: Rival; prize: number } | null>(null)
  const [blast, setBlast] = useState<{ track: number; reverse: boolean; field: KartRacer[] } | null>(null)
  const tuner = useGame((s) => s.tuner)
  const [trialSel, setTrialSel] = useState(() => firstTrialPick(useGame.getState().tuner))
  const rivalRow = useGame((s) => s.rivalRow)
  const oldPaints = useGame((s) => s.oldPaints)
  // The paint rival on show.
  const [rowSel, setRowSel] = useState(() => firstRowPick(useGame.getState().rivalRow))
  // Bumped for every race started, so "Next race" mounts a fresh one.
  const [seq, setSeq] = useState(0)
  const [tab, setTab] = useState<RaceTab>(() => {
    const t = nextRaceTab
    nextRaceTab = 'hub'
    return t
  })
  const done = useGame((s) => s.campaign)
  const gpState = useGame((s) => s.gp)
  const tourWon = useGame((s) => s.tour ?? 0)
  // The campaign chapter on show; it opens on the first one not yet cleared.
  const [campSel, setCampSel] = useState(() => campaignFocus(done, level).ci)
  const [street, setStreet] = useState<Visitor | null>(() => {
    const v = nextStreet
    nextStreet = null
    if (v) setRacing(true)
    return v
  })
  const [trial, setTrial] = useState<(TrialRun & { n: number }) | null>(null)
  // The town rival race; bet: the double-or-nothing rematch. n remounts the race for each run.
  const [rv, setRv] = useState<{ match: RivalMatch; bet: boolean; n: number } | null>(null)
  const rvBonus = useRef<RivalBonus>(null)
  // A double-or-nothing stake that's on the line until its race finishes. Leaving
  // early (the ✕ or closing the menu) counts as a loss, so a bet can't be dodged.
  const betStake = useRef<number | null>(null)
  const forfeitBet = () => {
    if (betStake.current !== null) useGame.getState().rivalBet(false, betStake.current)
    betStake.current = null
  }
  useEffect(() => forfeitBet, [])
  const gpResult = useGame((s) => s.gpResult)
  const campaignResult = useGame((s) => s.campaignResult)
  const tourResult = useGame((s) => s.tourResult)
  const eventResult = useGame((s) => s.eventResult)
  const ev = eventProgress(useGame((s) => s.event))
  const evBase = ev?.pi ?? (best ? pi(best) : 0)

  const livePlayers = useLive((l) => l.players)
  const liveSignedIn = useLive((l) => l.signedIn)
  const outgoing = useLive((l) => l.outgoing)
  const mutedIds = useLive((l) => l.muted)
  const cooldownTo = useLive((l) => l.cooldownTo)
  const coins = useGame((s) => s.coins)
  // The live player whose stake chips are open (wager match).
  const [betFor, setBetFor] = useState<string | null>(null)
  // Picking players for a kart party: the lobby ids ticked so far (null: not picking).
  const [pick, setPick] = useState<string[] | null>(null)
  const hosting = useLive((l) => !!l.party)

  // Closing the race menu ends a street race too.
  useEffect(() => () => setRacing(false), [])

  useEffect(() => {
    fetchOnlineRivals().then(setOnline)
    refreshPresence()
    void startWagers()
  }, [])

  // An accepted live challenge takes over the screen, so don't start a race that it would cut short.
  const waiting = () => {
    if (!useLive.getState().outgoing) return false
    useGame.getState().toast('Waiting for your live challenge to be answered')
    return true
  }

  const startTrial = (run: TrialRun) => {
    if (waiting()) return
    if (!spendFuel(TRIAL_FUEL)) return useGame.getState().showNeed('fuel', TRIAL_FUEL - useGame.getState().fuel, 'a time trial run')
    beginTrialRun()
    setTrial((t) => ({ ...run, n: (t?.n ?? 0) + 1 }))
  }

  if (race && car) return <DragRace key={seq} car={car} rival={race} next={{ label: '↻ Rematch', go: () => { setRace(null); start(race) } }} onExit={() => setRace(null)} />
  if (street && car) {
    const rival: Rival = { id: `street-${street.id}`, town: street.name, level, carName: carDef(street.model).name, color: street.color, pi: street.pi, online: false, body: street.body, model: street.model, skill: carDef(street.model).skill }
    return (
      <DragRace
        car={car}
        rival={rival}
        title="🏁 Street challenge"
        onFinish={(won) => {
          useGame.getState().finishRace(won, reward(rival))
          setRacing(false)
          if (won) void claimVisitor()
          else {
            useGame.getState().toast(`${street.name.split(' from ')[0]} smoked you and drove off laughing.`)
            leaveVisitor()
          }
        }}
        onExit={() => { setRacing(false); setStreet(null); useGame.getState().openPanel(null) }}
      />
    )
  }
  if (gpRace && car) {
    const round = Number(gpRace.rival.id.split('-').pop())
    const { def, reverse } = gpTrack(round)
    return (
      <KartGame
        key={seq}
        car={car}
        track={def}
        reverse={reverse}
        field={gpRace.field}
        rules={{ obstacles: reverse }}
        next={gpNext(gpRace.series)}
        prize={gpRace.prize}
        title={`${GP_CUP[GP_SERIES.indexOf(gpRace.series)] ?? '🏆'} ${round + 1}/${GP_ROUNDS} · ${def.icon} ${def.short}${reverse ? ' ↺' : ''}`}
        onFinish={(place) => gpResult(gpRace.series.id, place === 1)}
        onExit={() => { setGpRace(null); setTab('gp') }}
      />
    )
  }

  if (blast && car) {
    const def = TRACKS[blast.track]
    return (
      <KartGame
        key={seq}
        car={car}
        track={def}
        reverse={blast.reverse}
        field={blast.field}
        rules={{ blast: true }}
        next={{ label: '↻ Again', go: () => { setBlast(null); startBlast() } }}
        title={`💥 Bumper Blast · ${def.icon} ${def.short}`}
        onFinish={() => {}}
        onExit={() => setBlast(null)}
      />
    )
  }

  if (trial && car) {
    const d = carDef(car.model)
    const again = (myTime: number) => {
      // Chase the new best next time, if this run set one.
      const next = myTime < trial.target || trial.ghost === 'Your best' ? { ...trial, target: Math.min(myTime, trial.target), ghost: 'Your best' } : trial
      startTrial(next)
    }
    return (
      <DragRace
        key={trial.n}
        car={car}
        rival={{ id: 'trial', town: `👻 ${trial.ghost}`, level: 0, carName: d.name, color: '#eceff1', pi: pi(car), online: false, body: d.body, model: d.id }}
        trial={{ target: trial.target }}
        venueId={trial.venue}
        title={`⏱️ Time trial · ${venueById(trial.venue).name}`}
        onFinish={() => {}}
        resultView={(r) => <TrialResult myTime={r.myTime} target={trial.target} ghost={trial.ghost} onAgain={() => again(r.myTime)} onExit={() => { setTrial(null); setTab('trial') }} />}
        onExit={() => { setTrial(null); setTab('trial') }}
      />
    )
  }

  if (rv && car) {
    const { match, bet } = rv
    return (
      <DragRace
        key={rv.n}
        car={car}
        rival={match.rival}
        prize={match.prize}
        title={bet ? `🎲 Double or nothing · $${match.prize.toLocaleString()}` : `${match.def.icon} ${match.def.name} · Round ${match.visit + 1} of 3`}
        onFinish={(won) => {
          if (bet) {
            betStake.current = null
            useGame.getState().rivalBet(won, match.prize)
          } else rvBonus.current = useGame.getState().rivalResult(match.def.id, won, match.prize)
        }}
        resultView={(r) => (
          <RivalResult match={match} won={r.won} bet={bet} bonus={bet ? null : rvBonus.current} myTime={r.myTime} theirTime={r.theirTime}
            onBet={() => { betStake.current = match.prize; setRv({ match, bet: true, n: rv.n + 1 }) }}
            onRetry={() => startRival(match, rv.n + 1)}
            onExit={() => setRv(null)} />
        )}
        onExit={() => { forfeitBet(); setRv(null) }}
      />
    )
  }

  if (cRace && car) {
    return (
      <DragRace
        key={seq}
        car={car}
        rival={cRace.rival}
        next={campNextOf(cRace.chapter, cRace.race)}
        prize={cRace.prize}
        venueId={cRace.chapter.venue}
        title={`${cRace.chapter.name} · ${cRace.race === CAMPAIGN_RACES - 1 ? 'Boss race' : `Race ${cRace.race + 1} of ${CAMPAIGN_RACES}`}`}
        onFinish={(_, myTime, theirTime) => campaignResult(cRace.chapter.id, cRace.race, myTime, theirTime)}
        onExit={() => { setCRace(null); setTab('campaign') }}
      />
    )
  }

  if (pRace && car) {
    const won = (rivalRow[pRace.def.id] ?? 0) > 0
    return (
      <DragRace
        key={seq}
        car={car}
        rival={pRace.rival}
        next={{ label: won ? `↻ Rematch · $${rowPrizeOf(pRace.def, rivalRow).toLocaleString()}` : '↻ Retry', go: () => { setPRace(null); startRow(pRace.def.id) } }}
        prize={pRace.prize}
        venueId={pRace.def.venue}
        night={pRace.def.night}
        weatherSeed={`row-${pRace.def.id}`}
        dist={pRace.def.dist}
        title={`${pRace.def.icon} ${pRace.def.name}`}
        onFinish={(won) => useGame.getState().rowResult(pRace.def.id, won)}
        onExit={() => { setPRace(null); setTab('rivals') }}
      />
    )
  }

  if (kRace && car) {
    const won = (tuner?.[kRace.def.id] ?? 0) > 0
    return (
      <DragRace
        key={seq}
        car={car}
        rival={kRace.rival}
        next={{ label: won ? `↻ Rematch · $${trialPrizeOf(kRace.def, tuner).toLocaleString()}` : '↻ Retry', go: () => { setKRace(null); startTuner(kRace.def.id) } }}
        prize={kRace.prize}
        venueId={kRace.def.venue}
        night={kRace.def.night}
        weatherSeed={`tuner-${kRace.def.id}`}
        dist={kRace.def.dist}
        title={`${kRace.def.icon} ${kRace.def.name}`}
        onFinish={(won) => useGame.getState().tunerResult(kRace.def.id, won)}
        onExit={() => { setKRace(null); setTab('tuner') }}
      />
    )
  }

  if (tRace && car) {
    const leg = tourLeg(tourLegOf(tRace.race))
    const step = tRace.race % TOUR_RACES
    return (
      <DragRace
        key={seq}
        car={car}
        rival={tRace.rival}
        next={{ label: tRace.race < tourWon ? `▶ Next · $${tourPrize(tourWon).toLocaleString()}` : '↻ Retry', go: () => { setTRace(null); startTour() } }}
        prize={tRace.prize}
        venueId={leg.venue}
        night={leg.night}
        weatherSeed={`tour-${tRace.race}`}
        dist={tourDist(tRace.race)}
        title={`${leg.night ? '🌙' : '🌍'} Pro Tour · Leg ${leg.index + 1} · ${tourIsBoss(tRace.race) ? 'Boss race' : `Race ${step + 1} of ${TOUR_RACES}`} · ${DIST[tourDist(tRace.race)].label}`}
        onFinish={(won) => tourResult(won)}
        onExit={() => { setTRace(null); setTab('tour') }}
      />
    )
  }

  if (eRace && car) {
    const e = eventFor()
    return (
      <DragRace
        key={seq}
        car={car}
        rival={eRace.rival}
        next={(ev?.won ?? 0) >= EVENT_RACES ? null : { label: eRace.race < (ev?.won ?? 0) ? `▶ Next · $${eventPrize(evBase, ev?.won ?? 0).toLocaleString()}` : '↻ Retry', go: () => { setERace(null); startEvent() } }}
        prize={eRace.prize}
        venueId={e.venue}
        night={e.night}
        sky={e.sky}
        title={`📅 ${e.name} · ${eventIsBoss(eRace.race) ? 'Boss race' : `Race ${eRace.race + 1} of ${EVENT_RACES}`}`}
        onFinish={(won) => eventResult(won)}
        onExit={() => { setERace(null); setTab('event') }}
      />
    )
  }

  function start(r: Rival) {
    if (waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a race')
    setSeq((n) => n + 1)
    setRace(r)
  }

  function startCampaign(ci: number, i: number) {
    const ch = CAMPAIGN[ci]
    if (waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a campaign race')
    const stars = useGame.getState().campaign
    setSeq((n) => n + 1)
    setCRace({ chapter: ch, race: i, rival: campaignRival(ch, ci, i), prize: campaignReward(ch, i, (stars[campaignRaceId(ch, i)] ?? 0) === 0) })
  }
  function startRow(id: string) {
    const def = paintRival(id)
    if (!def || waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a rival race')
    setSeq((n) => n + 1)
    setRowSel(id)
    setPRace({ def, rival: rowRival(def), prize: rowPrizeOf(def, useGame.getState().rivalRow) })
  }
  function startTuner(id: string) {
    const def = tunerTrial(id)
    if (!def || !car || waiting()) return
    const checks = buildChecks(def, car)
    if (!checks.every((c) => c.ok)) return fixBuild(car, checks)
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a Tuner Trial')
    setSeq((n) => n + 1)
    setTrialSel(id)
    setKRace({ def, rival: trialRival(def), prize: trialPrizeOf(def, useGame.getState().tuner) })
  }
  function startTour() {
    if (waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a Pro Tour race')
    const won = useGame.getState().tour ?? 0
    setSeq((n) => n + 1)
    setTRace({ race: won, rival: tourRival(won), prize: tourPrize(won) })
  }
  function startEvent() {
    if (waiting()) return
    if ((eventProgress(useGame.getState().event)?.won ?? 0) >= EVENT_RACES) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'an event race')
    useGame.getState().eventEnter(evBase)
    const p = eventProgress(useGame.getState().event)!
    setSeq((n) => n + 1)
    setERace({ race: p.won, rival: eventRival(p.pi, p.won), prize: eventPrize(p.pi, p.won) })
  }
  // Free to play and no prize: it's a party mode, every kart the same.
  function startBlast() {
    if (waiting() || !car) return
    setSeq((n) => n + 1)
    setBlast(blastSetup(car))
  }
  function startGp(series: GpSeries, rival: Rival, prize: number) {
    if (waiting() || !car) return
    const round = Number(rival.id.split('-').pop())
    const need = gpFinalNeed(series, gpState[series.id]?.clears ?? 0, round)
    if (need && (best ? pi(best) : 0) < need) return useGame.getState().toast(`The final needs a car with PI ${need} or more`)
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a Grand Prix race')
    setSeq((n) => n + 1)
    setGpRace({ series, rival, prize, field: gpKartField(series, round, rival, car) })
  }
  // The result card's next race: the next one in the chapter after a win, or this one again.
  function campNextOf(ch: CampaignChapter, i: number): NextRace | null {
    const ci = CAMPAIGN.indexOf(ch)
    const won = (done[campaignRaceId(ch, i)] ?? 0) > 0
    const n = won ? i + 1 : i
    if (n >= CAMPAIGN_RACES) return null
    const label = won ? `▶ Next · $${campaignReward(ch, n, (done[campaignRaceId(ch, n)] ?? 0) === 0).toLocaleString()}` : '↻ Retry'
    return { label, go: () => { setCRace(null); startCampaign(ci, n) } }
  }
  // The next round of a Grand Prix, or a retry; nothing once the series is won (the prize pops up).
  function gpNext(series: GpSeries): NextRace | null {
    const prog = gpState[series.id] ?? { round: 0, clears: 0 }
    const was = gpRace ? Number(gpRace.rival.id.split('-').pop()) : 0
    if (prog.round !== was && prog.round !== was + 1) return null
    const label = prog.round === was ? '↻ Retry' : `▶ Race ${prog.round + 1} · $${gpReward(series, prog.round).toLocaleString()}`
    return { label, go: () => { setGpRace(null); startGp(series, gpRival(series, prog.round, prog.clears), gpReward(series, prog.round)) } }
  }

  function startRival(match: RivalMatch, n = 0) {
    if (waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a rival race')
    rvBonus.current = null
    setRv({ match, bet: false, n })
  }


  // The bar's big button: the next race on this screen, if it has one.
  const campNext = (() => {
    const ch = CAMPAIGN[campSel]
    if (!campaignFocus(done, level).opened(campSel)) return -1
    return Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(ch, i)] ?? 0).findIndex((n) => n === 0)
  })()
  const go = tab === 'campaign' && campNext >= 0 ? { label: `$${campaignReward(CAMPAIGN[campSel], campNext, true).toLocaleString()}`, onClick: () => startCampaign(campSel, campNext) }
    : tab === 'tour' && campaignCleared(done, CAMPAIGN[0]) ? { label: `$${tourPrize(tourWon).toLocaleString()}`, onClick: startTour }
    : tab === 'event' && (ev?.won ?? 0) < EVENT_RACES ? { label: `$${eventPrize(evBase, ev?.won ?? 0).toLocaleString()}`, onClick: startEvent }
    : tab === 'rivals' ? { label: `$${rowPrizeOf(paintRival(rowSel)!, rivalRow).toLocaleString()}`, onClick: () => startRow(rowSel) }
    : tab === 'tuner' && car ? (buildChecks(tunerTrial(trialSel)!, car).every((c) => c.ok)
      ? { label: `$${trialPrizeOf(tunerTrial(trialSel)!, tuner).toLocaleString()}`, onClick: () => startTuner(trialSel) }
      : { label: '🔧 Fit parts', onClick: () => startTuner(trialSel), fix: true })
    : null
  const stars = Object.values(done).reduce((a, n) => a + n, 0)
  const TITLES: Record<RaceTab, string> = { hub: 'Race', quick: 'Quick Race', campaign: 'Campaign', tour: 'Pro Tour', gp: 'Grand Prix', trial: 'Time Trial', event: 'Weekly Event', rivals: 'Rivals', tuner: 'Tuner Trials' }
  const chip = tab === 'campaign' ? `⭐ ${stars}/${CAMPAIGN.length * CAMPAIGN_RACES * 3}`
    : tab === 'tour' ? `🌍 ${tourWon.toLocaleString()} wins`
    : tab === 'gp' ? `🏁 ×${GP_ROUNDS} → 🎁`
    : tab === 'event' ? `⏳ ${shortLeft(msToNextWeek())}`
    : tab === 'rivals' ? rowChip(rivalRow, oldPaints)
    : tab === 'tuner' ? trialChip(tuner)
    : null

  return (
    <Panel title={TITLES[tab]} wide className="race-panel" onBack={tab === 'hub' ? undefined : () => setTab('hub')} head={chip && <span className="rm-head-chip">{chip}</span>}>
      <div className={`rm-screen rm-s-${tab}`}>
        {tab === 'hub' ? (
          <RaceHub onOpen={setTab} onCampaign={startCampaign} onTour={startTour} onEvent={startEvent} onRival={(m) => startRival(m)} onBlast={startBlast} />
        ) : tab === 'rivals' ? (
          <PaintRivals sel={rowSel} setSel={setRowSel} car={car} />
        ) : tab === 'tuner' ? (
          <TunerTrials sel={trialSel} setSel={setTrialSel} car={car} />
        ) : tab === 'campaign' ? (
          <Campaign sel={campSel} setSel={setCampSel} onTour={() => setTab('tour')} onRace={(ci, i) => startCampaign(ci, i)} />
        ) : tab === 'tour' ? (
          <Tour onCampaign={() => setTab('campaign')} onRace={startTour} />
        ) : tab === 'event' ? (
          <WeeklyEvent base={evBase} car={car} />
        ) : tab === 'trial' ? (
          car && <TrialTab myPi={pi(car)} onRun={startTrial} />
        ) : tab === 'gp' ? (
          <GrandPrix onRace={startGp} />
        ) : (
          <div className="rm-q-grid">
            {supabase && !liveSignedIn && (
              <button className="rm-qc rm-qc-live rm-qc-signin" onClick={() => useGame.getState().openPanel('account')}>
                <span className="rm-qc-top"><span className="rm-mi">🟢</span><span className="tag live">LIVE</span></span>
                <span className="rm-qc-body"><b>Race players live</b><span className="buy small alt">Sign in</span></span>
              </button>
            )}
            {supabase && livePlayers.filter((p) => !mutedIds[p.id] && !p.closed).length >= 2 && (
              <div className={`rm-qc rm-qc-live rm-qc-party${pick ? ' on' : ''}`}>
                <span className="rm-qc-top"><span className="rm-mi">🏎️</span><span className="tag live">👥 {PARTY_MAX}</span></span>
                <span className="rm-qc-body">
                  <b>Kart party</b>
                  {pick ? (
                    <span className="rm-qc-pair">
                      <button className="buy small" disabled={!pick.length || hosting} onClick={() => { void hostParty(pick); setPick(null) }}>🏁 ×{pick.length + 1}</button>
                      <button className="sell small" onClick={() => setPick(null)} aria-label="Close">✕</button>
                    </span>
                  ) : (
                    <button className="buy small alt" disabled={!!outgoing || hosting} onClick={() => setPick([])}>🎉 Pick</button>
                  )}
                </span>
              </div>
            )}
            {supabase && livePlayers.filter((p) => !mutedIds[p.id]).map((p) => {
              const wait = (cooldownTo[p.id] ?? 0) > Date.now()
              if (pick && !p.closed) {
                const on = pick.includes(p.id)
                const full = !on && pick.length >= PARTY_MAX - 1
                return (
                  <button key={p.id} className={`rm-qc rm-qc-live rm-qc-pick${on ? ' on' : ''}`} style={{ ['--qc' as string]: p.color }} disabled={full}
                    onClick={() => setPick(on ? pick.filter((x) => x !== p.id) : [...pick, p.id])} aria-pressed={on}>
                    <span className="rm-qc-top"><CarThumb size="sm" color={p.color} body={p.body} mods={p.mods} /><span className="rm-pick-tick">{on ? '✅' : '➕'}</span></span>
                    <span className="rm-qc-body">
                      <b><PlayerName id={p.uid} town={p.town} /></b>
                      <span className="rm-qc-chips"><span>Lv {p.level}</span><span className="rm-pi">PI {p.pi}</span></span>
                    </span>
                  </button>
                )
              }
              const stakes = wagersOn() ? stakesFor(level, p.level, coins) : []
              if (betFor === p.id) return (
                <div key={p.id} className="rm-qc rm-qc-live rm-qc-bet" style={{ ['--qc' as string]: p.color }}>
                  <span className="rm-qc-top"><CarThumb size="sm" color={p.color} body={p.body} mods={p.mods} /><span className="tag bet">🪙 BET</span></span>
                  <span className="rm-qc-body">
                    <b><PlayerName id={p.uid} town={p.town} /></b>
                    <span className="rm-bet-chips">
                      {stakes.map((st) => (
                        <button key={st} className="rm-bet-chip" title={`Bet ${st.toLocaleString()} coins. Winner takes ${(st * 2).toLocaleString()}.`} onClick={() => { setBetFor(null); void challenge(p.id, 'drag', st) }}>🪙{shortCoins(st)}</button>
                      ))}
                      <button className="rm-bet-chip x" onClick={() => setBetFor(null)} aria-label="Close">✕</button>
                    </span>
                  </span>
                </div>
              )
              return (
                <div key={p.id} className="rm-qc rm-qc-live" style={{ ['--qc' as string]: p.color }}>
                  <span className="rm-qc-top">
                    <CarThumb size="sm" color={p.color} body={p.body} mods={p.mods} /><span className="tag live">LIVE</span>
                    {!p.closed && !wait && !outgoing && stakes.length > 0 && (
                      <button className="rm-bet-btn" onClick={() => setBetFor(p.id)} title="Wager match: bet coins, winner takes both" aria-label="Wager match">🪙</button>
                    )}
                  </span>
                  <span className="rm-qc-body">
                    <b><PlayerName id={p.uid} town={p.town} /></b>
                    <span className="rm-qc-chips"><span>Lv {p.level}</span><span className="rm-pi">PI {p.pi}</span></span>
                    {outgoing?.to === p.id ? (
                      <button className="buy small alt" onClick={cancelChallenge} title="Waiting for an answer. Tap to call it off.">⏳ {outgoing.stake ? `🪙${shortCoins(outgoing.stake)}` : 'Cancel'}</button>
                    ) : (
                      <span className="rm-qc-pair">
                        <button className="buy small alt" disabled={!!outgoing || p.closed || wait} onClick={() => void challenge(p.id)} title="Drag race">
                          {p.closed ? '🚫 Busy' : wait ? '⏱ Soon' : `⚔️ $${liveReward(p.pi)}`}
                        </button>
                        {!p.closed && !wait && (
                          <button className="buy small alt" disabled={!!outgoing} onClick={() => void challenge(p.id, 'kart')} title="Kart race" aria-label="Kart race">🏎️</button>
                        )}

                      </span>
                    )}
                  </span>
                </div>
              )
            })}
            {[...online, ...rivals].map((r) => (
              <div key={r.id} className="rm-qc" style={{ ['--qc' as string]: r.color }}>
                <span className="rm-qc-top"><CarThumb size="sm" color={r.color} body={r.body} mods={r.mods} />{r.online && <span className="tag">PLAYER</span>}</span>
                <span className="rm-qc-body">
                  <b>{r.online ? <PlayerName id={r.id} town={r.town} /> : r.town}</b>
                  <span className="rm-qc-chips"><span>Lv {r.level}</span><span className="rm-pi">PI {r.pi}</span>{r.skill && <span title={`${SKILLS[r.skill].name}: ${SKILLS[r.skill].text}`}>{SKILLS[r.skill].icon}</span>}</span>
                  <button className="buy small" onClick={() => start(r)}>🏁 ${reward(r)} <small>⛽{RACE_FUEL}</small></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <RaceBar cars={cars} car={car} onPick={setRaceCar} go={go} note={tab === 'gp' ? 'Races every round' : tab === 'event' ? 'Back next week' : undefined}
        dist={tab === 'tour' ? tourDist(tourWon) : tab === 'gp' ? null : undefined} />
    </Panel>
  )
}


// A race's distance, as a small tag.
const DistChip = ({ d }: { d: RaceDist }) => <span className={`rm-dist d-${d}`} title={`${DIST[d].label} race`}>{DIST[d].label}</span>

// Which circuit a Grand Prix race runs on, as a small tag.
function TrackChip({ round }: { round: number }) {
  const { def, reverse } = gpTrack(round)
  return <span className="rm-dist rm-track" title={`${def.name}${reverse ? ', the other way round' : ''}`}>{def.short}{reverse ? ' ↺' : ''}</span>
}

function GrandPrix({ onRace }: { onRace: (s: GpSeries, r: Rival, prize: number) => void }) {
  const level = useGame((s) => s.level)
  const carCount = useGame((s) => s.cars.length)
  const gp = useGame((s) => s.gp)
  const showNeed = useGame((s) => s.showNeed)
  const openPanel = useGame((s) => s.openPanel)
  const cars = useGame((s) => s.cars)
  const myBest = useMemo(() => { const b = bestCar(cars); return b ? pi(b) : 0 }, [cars])
  return (
    <div className="rm-gp-grid">
      {GP_SERIES.map((s, si) => {
        const prog = gp[s.id] ?? { round: 0, clears: 0 }
        const locked = level < s.unlockLevel
        const short = carCount < s.minCars
        const rival = gpRival(s, prog.round, prog.clears)
        const prize = gpReward(s, prog.round)
        const need = gpFinalNeed(s, prog.clears, prog.round)
        const box = carDef(s.box[0])
        return (
          <div key={s.id} className={`rm-gpc rm-gp-${si}${locked ? ' locked' : ''}`}>
            <div className="rm-gpc-top">
              <span className="rm-cup" aria-hidden>{GP_CUP[si] ?? '🏆'}</span>
              <b className="rm-ttl">{s.name}</b>
              <Rounds round={prog.round} />
              {prog.clears > 0 && <span className="rm-wchip">🏆×{prog.clears}</span>}
            </div>
            <div className="rm-gpc-body">
              <span className="rm-next"><TrackChip round={prog.round} /> Race {prog.round + 1}: <b>{rival.town}</b> · PI {rival.pi}</span>
              <span className="rm-box" title={`Mystery box: ${s.box.map((m) => carDef(m).name).join(', ')}`}>
                <CarThumb size="sm" color={box.colors[0]} body={box.body} model={box.id} />
                <small>🎁 {box.name}{s.box.length > 1 ? ` +${s.box.length - 1}` : ''}</small>
              </span>
              {locked ? (
                <button className="buy small locked-btn" onClick={() => showNeed('level', s.unlockLevel, s.name)}>🔒 Level {s.unlockLevel}</button>
              ) : need > myBest ? (
                <button className="buy small locked-btn" onClick={() => openPanel('garage')}>🔒 Final needs PI {need}</button>
              ) : short ? (
                <button className="buy small alt" onClick={() => openPanel('rescue')}>Need {s.minCars} cars ({carCount})</button>
              ) : (
                <button className="buy small" onClick={() => onRace(s, rival, prize)}>🏁 ${prize.toLocaleString()}</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function campaignRival(ch: CampaignChapter, chIndex: number, i: number): Rival {
  const target = campaignRivalPi(ch, i)
  const car = (ch.cars?.[i] && CARS.find((c) => c.id === ch.cars![i])) || carNear(target)
  return {
    id: `camp-${ch.id}-${i}`, town: ch.rivals[i], level: ch.unlockLevel + i * 2, carName: car.name, color: car.colors[(chIndex + i) % car.colors.length],
    pi: target, online: false, body: car.body, model: car.id, skill: campaignRivalSkills(chIndex, i) ? car.skill : undefined, shift: campaignShift(chIndex, i), boss: i === CAMPAIGN_RACES - 1,
  }
}

function Stars({ n, big }: { n: number; big?: boolean }) {
  return <span className={big ? 'stars big' : 'stars'} aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>
}

function Campaign({ sel, setSel, onRace, onTour }: { sel: number; setSel: (ci: number) => void; onRace: (ci: number, race: number) => void; onTour: () => void }) {
  const level = useGame((s) => s.level)
  const done = useGame((s) => s.campaign)
  const showNeed = useGame((s) => s.showNeed)
  const { opened } = campaignFocus(done, level)
  const starsOf = (ch: CampaignChapter) => Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(ch, i)] ?? 0)
  const ch = CAMPAIGN[sel]
  const stars = starsOf(ch)
  const v = venueById(ch.venue)
  const cleared = campaignCleared(done, ch)
  const perfect = stars.every((n) => n >= 3)
  return (
    <div className="rm-split">
      <div className="rm-left">
        <div className="rm-nodes" role="tablist">
          {CAMPAIGN.map((c, ci) => {
            const open = opened(ci)
            const n = starsOf(c).reduce((a, x) => a + x, 0)
            return (
              <button key={c.id} role="tab" aria-selected={ci === sel} aria-label={c.name}
                className={`rm-node${ci === sel ? ' sel' : ''}${open ? '' : ' locked'}${campaignCleared(done, c) ? ' done' : ''}`}
                onClick={() => setSel(ci)}>
                <span>{open ? venueById(c.venue).icon : '🔒'}</span>
                <small>{open ? `★${n}` : `Lv${c.unlockLevel}`}</small>
              </button>
            )
          })}
        </div>
        <div className="rm-banner rm-photo" style={artStyle('camp', ch.venue)}>
          <TileClip mode="camp" venue={ch.venue} />
          <span className="rm-eyebrow">Chapter {sel + 1} · {v.name}</span>
          <b className="rm-ttl">{ch.name}</b>
          <span className="rm-chips">
            <span className={cleared ? 'got' : ''} title="Clear bonus (once)">{cleared ? '✔' : '🏁'} ${ch.coins >= 1000 ? `${ch.coins / 1000}k` : ch.coins} <span className="ico buck-ico">💎</span>{ch.bucks} 🏆{ch.trophies}</span>
            <span className={perfect ? 'got' : ''} title="Three stars on every race (once)">{perfect ? '✔' : '★★★'} <span className="ico buck-ico">💎</span>{ch.starBucks}</span>
          </span>
        </div>
      </div>
      <div className="rm-right">
        {!opened(sel) ? (
          <div className="rm-locked-box">
            {level < ch.unlockLevel
              ? <>
                  <button className="buy small alt" onClick={() => showNeed('level', ch.unlockLevel, ch.name)}>🔒 Opens at level {ch.unlockLevel}</button>
                  {campaignCleared(done, CAMPAIGN[0]) && <button className="buy small" onClick={onTour}>🌍 Race the Pro Tour</button>}
                </>
              : <span>🔒 Beat {CAMPAIGN[sel - 1].rivals[CAMPAIGN_RACES - 1]} to open</span>}
          </div>
        ) : (
          <div className="rm-rows">
            {stars.map((n, i) => {
              const r = campaignRival(ch, sel, i)
              const prize = campaignReward(ch, i, n === 0)
              const can = i === 0 || stars[i - 1] > 0
              const next = can && n === 0
              return (
                <div key={i} className={`rm-row${r.boss ? ' boss' : ''}${can ? '' : ' locked'}${next ? ' next' : ''}${n > 0 ? ' done' : ''}`}>
                  <span className="rm-step">{r.boss ? '👑' : i + 1}</span>
                  <CarThumb size="xs" color={r.color} body={r.body} model={r.model} />
                  <div className="rm-who">
                    <b>{r.town}</b>
                    <small>{n > 0 && <Stars n={n} />} PI {r.pi}{r.skill && <span className="rival-skill" title={`${SKILLS[r.skill].name}: ${SKILLS[r.skill].text}`}> {SKILLS[r.skill].icon}</span>}</small>
                  </div>
                  <button className={`buy small${n > 0 ? ' alt' : ''}`} disabled={!can} onClick={() => onRace(sel, i)}>
                    {!can ? '🔒' : `${n > 0 ? '↻' : '🏁'} $${prize.toLocaleString()}`}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function rowRival(r: PaintRival): Rival {
  const car = carDef(r.car)
  return {
    id: `row-${r.id}`, town: `${r.icon} ${r.name}`, level: r.tier * 8, carName: car.name, color: r.paint, pi: r.pi, online: false,
    body: car.body, model: car.id, skill: rowSkills(r) ? car.skill : undefined, shift: rowShift(r), boss: r.tier === 5,
  }
}

function trialRival(t: TunerTrial): Rival {
  const car = carDef(t.car)
  return {
    id: `tuner-${t.id}`, town: `${t.icon} ${t.host}`, level: t.tier * 10, carName: car.name, color: t.color, pi: t.pi, online: false,
    body: car.body, model: car.id, mods: hostMods(t), skill: t.tier >= 2 ? car.skill : undefined, shift: tunerShift(t), boss: t.tier === 3,
  }
}

function tourRival(race: number): Rival {
  const target = tourRivalPi(race)
  const car = carNear(target)
  const leg = tourLegOf(race)
  return {
    id: `tour-${race}`, town: tourRivalName(race), level: Math.min(99, 3 + leg * 2 + (race % TOUR_RACES)), carName: car.name, color: car.colors[race % car.colors.length],
    pi: target, online: false, body: car.body, model: car.id, skill: tourSkills(race) ? car.skill : undefined, shift: tourShift(race), boss: tourIsBoss(race),
  }
}

const SKY_ICON: Record<WeatherKind, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', drizzle: '🌦️', fog: '🌫️', wind: '💨', snow: '🌨️', blizzard: '❄️', dust: '🌪️', mist: '🌁', clearing: '🌈', heat: '🔆' }

// Pro Tour (game/tour.ts): the endless ladder. Shows the leg being raced, the legs
// either side of it on a strip, and the five races of the current leg.
function Tour({ onRace, onCampaign }: { onRace: () => void; onCampaign: () => void }) {
  const done = useGame((s) => s.campaign)
  const won = useGame((s) => s.tour ?? 0)
  const open = campaignCleared(done, CAMPAIGN[0])
  const cur = tourLegOf(won)
  const leg = tourLeg(cur)
  const v = venueById(leg.venue)
  const first = cur * TOUR_RACES
  // The next race's sky, rolled from its number so it matches the race itself.
  const sky = useMemo(() => raceWeather(leg.venue, `tour-${won}`).kind, [leg.venue, won])
  const strip = Array.from({ length: 6 }, (_, i) => Math.max(0, cur - 2) + i)
  return (
    <div className="rm-split">
      <div className="rm-left">
        <div className="rm-nodes">
          {strip.map((k) => {
            const l = tourLeg(k)
            return (
              <div key={k} className={`rm-node${k === cur ? ' sel' : ''}${k < cur ? ' done' : ''}${k > cur ? ' locked' : ''}${l.night ? ' night' : ''}`}>
                <span>{k < cur ? '✔' : venueById(l.venue).icon}</span>
                <small>Leg {k + 1}</small>
              </div>
            )
          })}
        </div>
        <div className="rm-banner rm-photo" style={artStyle('tour', leg.venue, leg.night)}>
          <TileClip mode="tour" venue={leg.venue} night={leg.night} sky={sky} />
          <span className="rm-eyebrow">Leg {cur + 1} · {leg.night ? '🌙 Under the lights' : 'Daytime'} · {SKY_ICON[sky]}</span>
          <b className="rm-ttl">{leg.night ? `${v.name} at Midnight` : `${v.name} ${leg.name}`}</b>
          <span className="rm-chips">
            <span title="Beat the boss for this bonus">👑 Boss bonus ${tourLegBonus(cur).toLocaleString()}</span>
            <span>{won - first} of {TOUR_RACES} won</span>
          </span>
        </div>
      </div>
      <div className="rm-right">
        {!open ? (
          <div className="rm-locked-box">
            <button className="buy small alt" onClick={onCampaign}>🔒 Clear Back Streets to open</button>
          </div>
        ) : (
          <div className="rm-rows">
            {Array.from({ length: TOUR_RACES }, (_, i) => {
              const race = first + i
              const r = tourRival(race)
              const beat = race < won
              const next = race === won
              return (
                <div key={race} className={`rm-row${r.boss ? ' boss' : ''}${!beat && !next ? ' locked' : ''}${next ? ' next' : ''}${beat ? ' done' : ''}`}>
                  <span className="rm-step">{beat ? '✔' : r.boss ? '👑' : i + 1}</span>
                  <CarThumb size="xs" color={r.color} body={r.body} model={r.model} />
                  <div className="rm-who">
                    <b>{r.town}</b>
                    <small><DistChip d={tourDist(race)} /> PI {r.pi}{r.skill && <span className="rival-skill" title={`${SKILLS[r.skill].name}: ${SKILLS[r.skill].text}`}> {SKILLS[r.skill].icon}</span>}</small>
                  </div>
                  {beat ? <span className="tour-beat" title="Beaten">✔</span> : (
                    <button className="buy small" disabled={!next} onClick={onRace}>
                      {next ? `🏁 $${tourPrize(race).toLocaleString()}` : '🔒'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function eventRival(base: number, race: number): Rival {
  const e = eventFor()
  const target = eventRivalPi(base, race)
  const car = carNear(target)
  return {
    id: `event-${e.id}-${race}`, town: e.rivals[race], level: 0, carName: car.name, color: car.colors[race % car.colors.length],
    pi: target, online: false, body: car.body, model: car.id, skill: race >= 2 ? car.skill : undefined, shift: eventShift(race), boss: eventIsBoss(race),
  }
}

// Weekly event (game/events.ts): this week's venue, its five rivals as a ladder of
// cars, and the exclusive skin shown on your own car. The race bar's button races
// the next rival, so the screen has no per-row buttons.
function WeeklyEvent({ base, car }: { base: number; car: OwnedCar | undefined }) {
  const p = eventProgress(useGame((s) => s.event))
  const owned = useGame((s) => s.skins ?? [])
  const e = eventFor()
  const won = p?.won ?? 0
  const done = won >= EVENT_RACES
  const skin = skinDef(e.skin)!
  const has = owned.includes(e.skin)
  const v = venueById(e.venue)
  const next = eventFor(nextEventWeek())
  const d = car ? carDef(car.model) : CARS[0]
  const rivals = Array.from({ length: EVENT_RACES }, (_, i) => eventRival(base, i))
  const vs = done ? null : rivals[won]
  const bonus = has && !done ? eventBonus(base) * 2 : eventBonus(base)
  return (
    <div className="rm-split rm-event" style={{ '--ev': e.color } as React.CSSProperties}>
      <div className="rm-left">
        <div className="rm-banner rm-photo" style={artStyle('tour', e.venue, e.night)}>
          <TileClip mode="tour" venue={e.venue} night={e.night} sky={e.sky} event={e.id} />
          <span className="rm-eyebrow">{v.icon} {v.name}{e.night && ' · 🌙'} · {SKY_ICON[e.sky]}</span>
          <b className="rm-ttl">{e.name}</b>
          <span className="rm-chips">
            <span title={`Next week: ${next.name}`}>⏭ {next.name}</span>
          </span>
        </div>
      </div>
      <div className="rm-right">
        <div className="ev-ladder">
          <div className="ev-steps">
            {rivals.map((r, i) => {
              const state = i < won ? 'done' : i === won ? 'next' : 'locked'
              return (
                <div key={i} className={`ev-step ${state}${r.boss ? ' boss' : ''}`} title={`${r.town} · PI ${r.pi}`}>
                  <CarThumb size="sm" color={r.color} body={r.body} model={r.model} skin={r.boss ? e.skin : undefined} />
                  <span className="ev-badge">{state === 'done' ? '✔' : r.boss ? '👑' : i + 1}</span>
                  <b>PI {r.pi}</b>
                </div>
              )
            })}
          </div>
          <div className={`ev-vs${done ? ' done' : ''}`}>
            {vs ? (
              <>
                <span className="ev-vs-tag">VS</span>
                <b>{vs.town}</b>
                {vs.skill && <span className="rival-skill" title={`${SKILLS[vs.skill].name}: ${SKILLS[vs.skill].text}`}>{SKILLS[vs.skill].icon}</span>}
              </>
            ) : <b>🏆 {EVENT_RACES}/{EVENT_RACES}</b>}
          </div>
        </div>
        <div className={`ev-reward${done ? ' got' : ''}`} title={done ? 'Yours: put it on any car in the Paint Shop' : 'Beat the boss to win it'}>
          <div className="ev-reward-car">
            <CarThumb size="lg" color={car?.color ?? d.colors[0]} finish={car?.finish} skin={e.skin} body={d.body} model={d.id} stripe={car?.stripe} mods={car?.mods} />
            <span className="ev-reward-state">{done || has ? '✔' : '👑'}</span>
          </div>
          <div className="ev-reward-info">
            <b>{skin.name}</b>
            <span className="ev-reward-chips">
              <i className="skin-chip" style={{ background: skin.swatch }} />
              <em style={{ background: SKIN_TIERS[skin.tier].color }}>{SKIN_TIERS[skin.tier].name}</em>
              {!done && <span className="ev-bonus">👑 +${bonus.toLocaleString()}</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EventPrizePopup() {
  const prize = useGame((s) => s.eventPrize)
  const close = useGame((s) => s.closeEventPrize)
  const cars = useGame((s) => s.cars)
  if (!prize) return null
  const e = WEEKLY_EVENTS.find((x) => x.id === prize.id)
  if (!e) return null
  const skin = skinDef(e.skin)!
  const top = [...cars].sort((a, b) => pi(b) - pi(a))[0]
  const d = top ? carDef(top.model) : CARS[0]
  return (
    <div className="overlay prize-overlay">
      <div className="prize ev-prize">
        <h2>{e.name} cleared!</h2>
        <CarThumb size="lg" color={top?.color ?? d.colors[0]} finish={top?.finish} skin={e.skin} body={d.body} model={d.id} stripe={top?.stripe} mods={top?.mods} />
        <h3>{prize.skin ? <>🎨 {skin.name} skin unlocked</> : <>You already have {skin.name}</>}</h3>
        <p className="camp-prize"><span>💵 +${prize.coins.toLocaleString()}</span></p>
        <p className="camp-prize"><span title="Next week's event">⏭ {eventFor(nextEventWeek()).name}</span></p>
        <div className="row">
          <button className="buy" onClick={close}>Awesome!</button>
        </div>
      </div>
    </div>
  )
}

export function TourPrizePopup() {
  const prize = useGame((s) => s.tourPrize)
  const close = useGame((s) => s.closeTourPrize)
  if (!prize) return null
  const next = tourLeg(prize.leg + 1)
  const nv = venueById(next.venue)
  return (
    <div className="overlay prize-overlay">
      <div className="prize">
        <h2>Leg {prize.leg + 1} cleared!</h2>
        <div className="mystery-box" aria-hidden>👑</div>
        <p className="camp-prize"><span>💵 +${prize.coins.toLocaleString()}</span></p>
        <p>Next up: {nv.icon} {next.night ? `${nv.name} at Midnight 🌙` : `${nv.name} ${next.name}`}</p>
        <div className="row">
          <button className="buy" onClick={close}>Keep going!</button>
        </div>
      </div>
    </div>
  )
}

export function CampaignPrizePopup() {
  const prize = useGame((s) => s.campaignPrize)
  const close = useGame((s) => s.closeCampaignPrize)
  if (!prize) return null
  const ch = CAMPAIGN.find((c) => c.id === prize.chapter)
  if (!ch) return null
  const next = CAMPAIGN[CAMPAIGN.indexOf(ch) + 1]
  return (
    <div className="overlay prize-overlay">
      <div className="prize">
        <h2>{prize.cleared ? `${ch.name} cleared!` : `${ch.name}: all three stars!`}</h2>
        <div className="mystery-box" aria-hidden>{prize.cleared ? '🏁' : '🌟'}</div>
        <p className="camp-prize">
          {prize.coins > 0 && <span>💵 +${prize.coins.toLocaleString()}</span>}
          {prize.bucks > 0 && <span><span className="ico buck-ico">💎</span> +{prize.bucks}</span>}
          {prize.trophies > 0 && <span>🏆 +{prize.trophies}</span>}
        </p>
        {prize.cleared && (
          <p className="camp-prize">
            {prize.perfect && <span title="Three-star bonus">★★★</span>}
            {next ? <span>⏭ {next.name}{next.unlockLevel > useGame.getState().level && ` · 🔒 Lv ${next.unlockLevel}`}</span> : <span>🏆 Campaign done · 🌍 Pro Tour</span>}
          </p>
        )}
        <div className="row">
          <button className="buy" onClick={close}>Awesome!</button>
        </div>
      </div>
    </div>
  )
}

export function PrizePopup() {
  const prize = useGame((s) => s.gpPrize)
  const close = useGame((s) => s.closePrize)
  const openPanel = useGame((s) => s.openPanel)
  const [open, setOpen] = useState(false)
  if (!prize) return null
  const series = GP_SERIES.find((s) => s.id === prize.series)!
  const def = carDef(prize.model)
  return (
    <div className="overlay prize-overlay">
      <div className="prize">
        <h2>{series.name} champion!</h2>
        {!open ? (
          <>
            <button className="mystery-box" aria-label="Open the mystery box" onClick={() => { sfx.win(); setOpen(true) }}>🎁</button>
          </>
        ) : (
          <>
            <button className="close prize-close" aria-label="Close" onClick={() => { close(); setOpen(false) }}>✕</button>
            <CarThumb size="lg" color={prize.color} body={def.body} model={def.id} />
            <h3>{def.name}</h3>
            <div className="prize-stats"><span className="rm-pi">PI {performance(def, zero)}</span><span>+5 🏆</span></div>
            <button className="buy prize-go" onClick={() => { close(); setOpen(false); openPanel('garage') }}>See it</button>
          </>
        )}
      </div>
    </div>
  )
}


// A live opponent is replayed on our own race clock from the samples they
// send, so the strip and the result both compare the same race times.
type Sample = { dist: number; t: number; speed: number }
function sampleAt(samples: Sample[], t: number, finished: number | null) {
  if (finished !== null && t >= finished) return TRACK
  if (!samples.length) return 0
  const last = samples[samples.length - 1]
  // Not heard that far yet: extrapolate, but never past the line until they report finishing.
  if (t >= last.t) return Math.min(finished === null ? TRACK - 0.5 : TRACK, last.dist + last.speed * (t - last.t))
  let i = samples.length - 1
  while (i > 0 && samples[i - 1].t > t) i--
  const a = samples[i - 1] ?? { dist: 0, t: 0, speed: 0 }
  const b = samples[i]
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
  return a.dist + (b.dist - a.dist) * Math.max(0, Math.min(1, f))
}

const fresh = freshRacer
const step = stepRacer

// trial: a solo run against a ghost that finishes in `target` seconds; the run ends when you cross the line.
// resultView: replaces the usual result card.
type Result = { won: boolean; myTime: number; theirTime: number }
type NextRace = { label: string; go: () => void }
// How the run went, for the result card: reaction off the line (null for a jump start), clean shifts, top speed.
type RunStats = { launch: string; perfect: number; shifts: number; top: number }
// dist: a Grand Prix or Pro Tour distance (game/distance.ts); the car's build counts in these.
// next: the result card's button for the next race in this series (or a retry), when there is one.
export function DragRace({ car, rival: shownRival, onExit, live, prize, onFinish, title, venueId, trial, resultView, night, weatherSeed, sky, next, dist }: { car: OwnedCar; rival: Rival; onExit: () => void; next?: NextRace | null; live?: LiveRace; prize?: number; onFinish?: (won: boolean, myTime: number, theirTime: number) => number | void; title?: string; venueId?: string; trial?: { target: number }; resultView?: (r: Result) => ReactNode; night?: boolean; weatherSeed?: string; sky?: WeatherKind; dist?: RaceDist }) {
  // A signed-in live rival's PI comes from the server, not from their browser.
  const [serverRivalPi, setServerRivalPi] = useState<number | null>(null)
  const rival = useMemo(() => (serverRivalPi === null ? shownRival : { ...shownRival, pi: serverRivalPi }), [shownRival, serverRivalPi])
  const payout = prize ?? reward(rival)
  const rivalRef = useRef(rival)
  rivalRef.current = rival
  const finishCb = useRef(onFinish)
  finishCb.current = onFinish
  const myPi = pi(car)
  // Both cars wait on the line; the player holds the pedal through the countdown to rev, and the
  // car launches at GO on whatever revs it has.
  const me = useRef(fresh(false))
  const them = useRef(fresh(!!(live || trial)))
  // The pedal is held down (pointer or Space) before GO.
  const pedal = useRef(false)
  const samples = useRef<Sample[]>([])
  const def = carDef(car.model)
  const track = dist ? DIST[dist].m : TRACK
  // The car's build (sprinter to long-hauler) only counts over a set distance; AI rivals have none.
  const build = useMemo(() => (dist ? character(carStats(def, car.upgrades, car.mods)) : null), [dist, def, car.upgrades, car.mods])
  const skillActive = useRef(false)
  const [skillShown, setSkillShown] = useState(false)
  // The AI rival's skill, flashed while it is working (live rivals use theirs on their own device).
  const theirSkill = live || trial ? undefined : rival.skill
  // Somewhere different each race; both sides of a live race get the same place.
  const [venue] = useState(() => (venueId ? venueById(venueId) : pickVenue(live?.raceId)))
  // The sky over the strip, rolled once: a live race from its id (both racers match), the weekly
  // time trial from its week (everyone races the same conditions), a Pro Tour race from its number
  // (so the card can show it), anything else from the town.
  // Weather off in Settings clears the sky for casual races only (see prefs.ts).
  const [weather] = useState(() => raceWeather(venue.id, live?.raceId ?? (trial ? `trial-${trialWeek()}` : weatherSeed), live ? undefined : (sky ?? (!trial && !usePrefs.getState().raceWeather ? 'clear' : undefined))))
  // What the weather and venue do to each car's grip (see grip.ts). AI rivals race on stock tires.
  const grip = useMemo(() => conditions(weather.kind, venue.id, carGrip(def, car.upgrades, car.mods), car.mods), [weather, venue, def, car.upgrades, car.mods])
  const theirGrip = useMemo(() => conditions(weather.kind, venue.id, CARS.find((c) => c.name === shownRival.carName)?.grip ?? 50), [weather, venue, shownRival.carName])
  const gripNote = conditionsNote(grip)
  const spinShown = useRef(false)
  const [spin, setSpin] = useState(false)
  const theirActive = useRef(false)
  const [theirShown, setTheirShown] = useState(false)
  const t = useRef(0)
  const [, force] = useState(0)
  // Live races wait for both players before counting down.
  const [countdown, setCountdown] = useState(live ? 99 : 3)
  // Set once the rival has taken too long to join, to offer calling the race off.
  const [slow, setSlow] = useState(false)
  const channel = useRef<ReturnType<typeof raceChannel>>(null)
  const [label, setLabel] = useState('')
  const labelTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [result, setResult] = useState<null | { won: boolean; myTime: number; theirTime: number; note?: string; counted?: boolean; stars?: number }>(null)
  // Wager match: the server pays the winner both stakes, or refunds both if the race doesn't count.
  const stake = live?.stake ?? 0
  // The result card waits a moment so both cars can be seen rolling through the finish,
  // and for a slow-motion finish to play out (never more than a few seconds).
  const [cardUp, setCardUp] = useState(false)
  useEffect(() => {
    if (!result) return
    const until = performance_now() + 5000
    let id = setTimeout(function wait() {
      if (finishView.busy && performance_now() < until) id = setTimeout(wait, 100)
      else setCardUp(true)
    }, 1400)
    return () => clearTimeout(id)
  }, [result])
  // Live races between signed-in players: 'yes' once the server is refereeing, 'no' to decide here.
  const refereed = useRef<'pending' | 'yes' | 'no'>(live ? 'pending' : 'no')
  const joined = useRef<Promise<boolean> | null>(null)
  const [checking, setChecking] = useState(false)
  const finishRace = useGame((s) => s.finishRace)
  const stats = useRef<RunStats>({ launch: '', perfect: 0, shifts: 0, top: 0 })
  const flash = (text: string, ms = 800) => {
    setLabel(text)
    clearTimeout(labelTimer.current)
    labelTimer.current = setTimeout(() => setLabel(''), ms)
  }
  // Off the line at GO, on the revs the driver is holding.
  const callLaunch = () => {
    const call = revLaunch(me.current, me.current.rpm)
    pedal.current = false
    stats.current.launch = call
    sfx.shift(call.startsWith('PERFECT'))
    flash(call, 1000)
  }
  // The rival's shift point in each gear: a clean driver shifts inside the perfect band, a sloppy
  // one (campaign rivals early on) too early.
  const cleanness = shownRival.shift ?? 1
  const skill = useMemo(() => Array.from({ length: TOP_GEAR }, (_, g) => {
    const b = shiftBand(g, theirGrip.lo, theirGrip.hi)
    return b.lo + (b.hi - b.lo) * (0.25 + 0.6 * Math.random()) - (1 - cleanness) * (0.06 + 0.1 * Math.random())
  }), [cleanness, theirGrip])
  // How long the AI rival takes to react to GO: clean drivers are quicker off the line.
  const theirReaction = useMemo(() => aiReaction(cleanness, Math.random()), [cleanness])
  const theirBoosting = useRef(false)
  const [theirBoost, setTheirBoost] = useState(false)
  // Engine, tyre and crowd sounds for this race. A live rival's revs aren't sent,
  // so a stand-in racer with their PI drives their engine sound.
  const sound = useRef<RaceAudio | null>(null)
  const ghost = useRef(fresh())
  useEffect(() => {
    sound.current = raceAudio({ model: car.model, mods: car.mods }, { model: CARS.find((c) => c.name === shownRival.carName)?.id, body: shownRival.body, mods: shownRival.mods })
    return () => sound.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => void (startLights.n = 99), [])
  const stageReady = useStageReady()
  useEffect(() => {
    startLights.n = countdown
    if (countdown === 99) return
    if (countdown >= 0 && countdown <= 3) {
      if (countdown === 3) sound.current?.screech()
      sfx.countdown(countdown === 0)
      sound.current?.countdown(countdown === 0)
      if (countdown === 0) sound.current?.launch(Math.min(1, myPi / 200), Math.min(1, rivalRef.current.pi / 200))
    }
  }, [countdown])
  useEffect(() => {
    if (countdown === 99 || countdown <= 0) return
    // The lights hold on 3 until the scene is drawing (its shaders compile in the background).
    if (countdown === 3 && !live && !stageReady) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 700)
    return () => clearTimeout(id)
  }, [countdown, stageReady])

  useEffect(() => {
    if (!live) return
    let started = false
    let answeredReady = false
    let disposed = false
    let ch: ReturnType<typeof raceChannel> = null
    let ping: ReturnType<typeof setInterval> | undefined
    const go = () => {
      if (started) return
      started = true
      if (live.stake) startWager(live.raceId)
      setCountdown(3)
    }
    const uid = live.opponent.uid
    // The race channel is private to the two racers on the server's copy of the race, so join that first.
    joined.current = joinRefereed(live.raceId, uid)
    joined.current.then((ok) => {
      if (disposed) return
      if (!ok) {
        refereed.current = 'no'
        useGame.getState().toast("Couldn't start the live race on the server. Try again in a moment.")
        onExit()
        return
      }
      ch = raceChannel(live.raceId, {
        onPos: (p) => {
          const last = samples.current[samples.current.length - 1]
          if (!last || p.t > last.t) samples.current.push(p)
        },
        onFinish: (ft) => {
          them.current.finished = ft
        },
        onGo: go,
        onLeave: () => {
          if (started) return
          useGame.getState().toast(`${live.opponent.town} called off the race`)
          onExit()
        },
        onReady: () => {
          if (live.host) {
            ch?.send({ type: 'broadcast', event: 'go', payload: {} })
            go()
          } else if (!answeredReady) {
            answeredReady = true
            ch?.send({ type: 'broadcast', event: 'ready', payload: {} })
          }
        },
      })
      channel.current = ch
      // Keep pinging until the race starts in case the first message was missed.
      ping = setInterval(() => {
        if (!started) ch?.send({ type: 'broadcast', event: 'ready', payload: {} })
      }, 1000)
    })
    if (uid) serverPi(uid).then((p) => p !== null && setServerRivalPi(p)).catch(() => {})
    return () => {
      disposed = true
      clearInterval(ping)
      // Leaving before the start tells the other player instead of leaving them waiting.
      if (!started) ch?.send({ type: 'broadcast', event: 'leave', payload: {} })
      // A bet on a race that never started is called off, so both stakes come straight back.
      if (!started && live.stake) void voidWager(live.raceId)
      if (ch && supabase) supabase.removeChannel(ch)
    }
  }, [live])

  // Nobody has joined after a while: ask whether to keep waiting.
  useEffect(() => {
    if (countdown !== 99 || slow) return
    const id = setTimeout(() => setSlow(true), JOIN_PATIENCE_MS)
    return () => clearTimeout(id)
  }, [countdown, slow])

  useEffect(() => {
    if (countdown > 0 || result) return
    let raf = 0
    let last = performance_now()
    let lastSent = 0
    let myFinishSentAt: number | null = null
    const signal = { cancelled: false }
    const applyVerdict = (v: Verdict | null, myTime: number) => {
      if (live?.stake) void settleWager(live.raceId)
      if (!v || v.void) {
        sfx.lose()
        setResult({
          won: false, myTime, theirTime: Infinity, counted: false,
          note: v ? `${rivalRef.current.town} never joined the race on the server, so it didn't count.` : "Couldn't reach the race server, so this race didn't count. Check your connection.",
        })
        return
      }
      if (Number.isFinite(v.theirTime)) them.current.finished = v.theirTime
      if (v.won) sfx.win()
      else sfx.lose()
      sound.current?.finish(v.won)
      const note = v.forfeit
        ? v.won
          ? `${rivalRef.current.town} dropped out before finishing.`
          : 'Your connection dropped before your time reached the server, so this one went to your rival.'
        : undefined
      setResult({ won: v.won, myTime: Number.isFinite(v.myTime) ? v.myTime : myTime, theirTime: v.theirTime, note })
      finishRace(v.won, reward(rivalRef.current))
    }
    // Live: the server's verdict replaces the local call when both players are signed in.
    const settle = async (myTime: number) => {
      if (!(await joined.current)) {
        refereed.current = 'no'
        return
      }
      refereed.current = 'yes'
      setChecking(true)
      // Like kart races, the server's call still pays (and settles a wager) if the
      // player leaves while it's checking; only the result screen needs them here.
      const v = await reportFinish(live!.raceId, myTime, { cancelled: false })
      if (signal.cancelled) {
        if (live?.stake) void settleWager(live.raceId)
        if (v && !v.void) finishRace(v.won, reward(rivalRef.current))
        return
      }
      setChecking(false)
      cancelAnimationFrame(raf)
      applyVerdict(v, myTime)
    }
    // The race runs on a fixed clock (RACE_DT steps), so a 30 fps phone and a 120 Hz screen race the same car.
    let acc = 0
    const tick = (dt: number) => {
      t.current += dt
      const sk = def.skill
      const th0 = them.current
      // In a live race the rival runs on their own device, so slow-downs boost us instead.
      const mine = live ? liveSkillBoost(sk, me.current, th0, t.current) : skillBoost(sk, me.current, th0) * skillDrag(sk, th0, t.current)
      const skillOn = mine !== 1
      if (skillOn !== skillActive.current) { skillActive.current = skillOn; setSkillShown(skillOn) }
      // What the AI rival's skill does to its car and to ours this frame.
      const theirBoost = skillBoost(theirSkill, th0, me.current)
      const theirDrag = skillDrag(theirSkill, me.current, t.current)
      const theirOn = theirBoost !== 1 || theirDrag !== 1
      if (theirOn !== theirActive.current) { theirActive.current = theirOn; setTheirShown(theirOn) }
      const myMul = (live ? mine : skillBoost(sk, me.current, th0)) * theirDrag * gripMul(grip, me.current.gear, me.current.rpm, t.current)
      step(me.current, myPi, dt, t.current, build === null ? myMul : myMul * characterMul(build, me.current.gear, me.current.dist), track)
      stats.current.top = Math.max(stats.current.top, me.current.speed)
      const spinNow = me.current.launched && me.current.finished === null && (spinning(grip, me.current.gear, me.current.rpm, t.current) || (me.current.gear === 0 && me.current.quality < 0.84))
      if (spinNow !== spinShown.current) { spinShown.current = spinNow; setSpin(spinNow) }
      const th = them.current
      if (live) {
        th.dist = sampleAt(samples.current, t.current, Number.isFinite(th.finished) ? th.finished : null)
        const g = ghost.current
        if (g.gear < TOP_GEAR && g.rpm >= 0.9) {
          shiftRacer(g, 1.08)
          sound.current?.shift('them', g.gear, Math.min(1, rivalRef.current.pi / 200))
        }
        step(g, rivalRef.current.pi, dt, t.current)
      } else if (trial) {
        th.dist = ghostDist(t.current, trial.target)
        if (th.finished === null && t.current >= trial.target) th.finished = trial.target
      } else {
        if (!th.launched && t.current >= theirReaction) launchRacer(th, theirReaction)
        if (th.launched && th.gear < TOP_GEAR && th.rpm >= skill[th.gear]) {
          const band = shiftBand(th.gear, theirGrip.lo, theirGrip.hi)
          const q = shiftQuality(th.rpm, band.lo, band.hi)
          shiftRacer(th, smoothShift(theirSkill) && q.label === 'Good' ? 1.08 : q.q)
          sound.current?.shift('them', th.gear, Math.min(1, rivalRef.current.pi / 200))
        }
        if (th.gear >= AI_BOOST_GEAR) fireBoost(th)
        step(th, rivalRef.current.pi, dt, t.current, theirBoost * skillDrag(sk, th, t.current) * gripMul(theirGrip, th.gear, th.rpm, t.current), track)
      }
    }
    const loop = () => {
      const now = performance_now()
      acc += Math.min(0.1, (now - last) / 1000)
      last = now
      const wasDone = me.current.finished !== null
      // Off the line at GO, on whatever revs the driver is holding.
      if (!me.current.launched) callLaunch()
      for (; acc >= RACE_DT; acc -= RACE_DT) tick(RACE_DT)
      const th = them.current
      if (live) {
        if (now - lastSent > 100) {
          lastSent = now
          channel.current?.send({ type: 'broadcast', event: 'pos', payload: { dist: me.current.dist, t: t.current, speed: me.current.speed } })
        }
        if (!wasDone && me.current.finished !== null) {
          myFinishSentAt = now
          channel.current?.send({ type: 'broadcast', event: 'finish', payload: { t: me.current.finished } })
        }
        // Opponent vanished: the race is yours after a grace period.
        if (myFinishSentAt !== null && th.finished === null && now - myFinishSentAt > 15000) th.finished = Infinity
      } else if (th.burning !== theirBoosting.current) { theirBoosting.current = th.burning; setTheirBoost(th.burning) }
      force((n) => n + 1)
      const g = ghost.current
      sound.current?.frame(me.current, live ? { rpm: g.rpm, gear: g.gear, dist: th.dist, finished: th.finished } : th)
      if (live && !wasDone && me.current.finished !== null) settle(me.current.finished)
      if (refereed.current === 'no' && me.current.finished !== null && (th.finished !== null || trial)) {
        const theirTime = trial ? trial.target : th.finished!
        const won = me.current.finished < theirTime || (me.current.finished === theirTime && (!live || live.host))
        if (won) sfx.win()
        else sfx.lose()
        sound.current?.finish(won)
        const stars = finishCb.current ? finishCb.current(won, me.current.finished, theirTime) : finishRace(won, reward(rivalRef.current))
        setResult({ won, myTime: me.current.finished, theirTime, stars: typeof stars === 'number' ? stars : undefined })
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      signal.cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [countdown, result, myPi, skill, finishRace, live, def, theirSkill, trial, theirReaction, grip, theirGrip, build, track])

  // Revving on the line: the needle climbs while the pedal is held and falls when it's let go.
  useEffect(() => {
    if (countdown === 99 || countdown < 0 || result) return
    let raf = 0
    let last = performance_now()
    const rev = () => {
      const now = performance_now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const r = me.current
      if (r.launched) return
      r.rpm = Math.max(IDLE, Math.min(1.02, r.rpm + (pedal.current ? REV_UP : -REV_DOWN) * dt))
      sound.current?.rev(r.rpm)
      force((n) => n + 1)
      raf = requestAnimationFrame(rev)
    }
    raf = requestAnimationFrame(rev)
    return () => cancelAnimationFrame(raf)
  }, [countdown, result])
  const release = () => void (pedal.current = false)

  // The big button: hold it to rev on the line, then tap it to shift up.
  const press = () => {
    const r = me.current
    if (countdown === 99 || result || r.finished !== null) return
    if (!r.launched) {
      pedal.current = true
      return
    }
    if (r.gear >= TOP_GEAR) return
    const band = shiftBand(r.gear, grip.lo, grip.hi)
    let s = shiftQuality(r.rpm, band.lo, band.hi)
    if (smoothShift(def.skill) && s.label === 'Good') s = { q: 1.08, label: 'SMOOTH!' }
    sfx.shift(s.q >= 1)
    shiftRacer(r, s.q)
    stats.current.shifts++
    if (s.q >= 1) stats.current.perfect++
    sound.current?.shift('me', r.gear, Math.min(1, myPi / 200))
    flash(r.streak >= 2 ? `${s.label.replace('!', '')} x${r.streak}!` : s.label)
  }
  const boost = () => {
    if (countdown > 0 || result || !fireBoost(me.current)) return
    sfx.boost()
    flash('BOOST!')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Holding a key down mustn't fire a string of shifts.
      if (e.repeat && (e.code === 'Space' || e.code === 'KeyB' || e.code === 'ArrowUp')) return e.preventDefault()
      if (e.code === 'Space') {
        e.preventDefault()
        press()
      } else if (e.code === 'KeyB' || e.code === 'ArrowUp') {
        e.preventDefault()
        boost()
      }
    }
    const onUp = (e: KeyboardEvent) => e.code === 'Space' && release()
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
  })

  // The race screen redraws every frame (dials, lanes); the 3D scene only changes with
  // its inputs, so it's built once rather than re-rendered sixty times a second.
  const mineLook = useMemo(() => ({ body: def.body, model: car.model, color: car.color, finish: car.finish, skin: car.skin, modSkin: car.modSkin, panels: car.panels, mods: car.mods }), [def.body, car.model, car.color, car.finish, car.skin, car.modSkin, car.panels, car.mods])
  const theirModel = rival.model ?? CARS.find((c) => c.name === rival.carName)?.id
  const theirLook = useMemo(() => ({ body: rival.body, model: theirModel, color: rival.color, mods: rival.mods }), [rival.body, theirModel, rival.color, rival.mods])
  const photo = useRef(() => flash('PHOTO FINISH!', 2200))
  const scene = useMemo(
    () => <RaceScene track={track} me={me} them={them} mine={mineLook} theirs={theirLook} venue={venue} weather={weather} night={night} onPhoto={() => photo.current()} />,
    [mineLook, theirLook, venue, weather, night, track],
  )

  const rpmAngle = -210 + Math.min(1.05, me.current.rpm) * 240
  // The shift light: green while the needle is in the perfect band, red once it's past.
  const rpm = me.current.rpm
  // On the line it shows the launch band instead, and lights green while the revs sit in it.
  const onLine = !me.current.launched
  const band = onLine ? LAUNCH_BAND : shiftBand(me.current.gear, grip.lo, grip.hi)
  const light = me.current.finished !== null || (!onLine && me.current.gear >= TOP_GEAR) || (onLine && countdown === 99) ? '' : rpm >= band.lo && rpm <= band.hi ? ' now' : rpm > band.hi ? ' late' : rpm >= band.lo - 0.12 && !onLine ? ' soon' : ''
  const close = live ? onExit : () => useGame.getState().openPanel(null)
  // One full-screen view: the street fills the screen and the controls float over it.
  return (
    <div className="race-full">
      <StageSlot cam={RACE_CAM}>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label={`Heading to ${venue.name}`} onClose={close} />
      <div className="rf-top">
        <h2>{title ?? `Drag Race vs ${rival.town}`}</h2>
        <button className="close" onClick={close} aria-label="Leave race">✕</button>
      </div>
      {countdown <= 0 && t.current > 0.8 && <div className="rf-lanes">
        {[
          { name: `You · ${def.name}`, color: car.color, r: me.current },
          { name: `${rival.town} · ${rival.carName}`, color: rival.color, r: them.current },
        ].map((lane) => (
          <div key={lane.name} className="rf-lane">
            <span className="lane-name">{lane.name}</span>
            <div className="lane-car" style={{ left: `${Math.min(1, lane.r.dist / track) * 90}%`, background: lane.color }} />
            <div className="finish" />
          </div>
        ))}
      </div>}
      {countdown > 0 && !result && <div className={`rf-venue v-${venue.id}`}><span className="rf-venue-ico">{venue.icon}</span><span className="rf-venue-txt"><small>{gripNote ?? (dist ? `${DIST[dist].label} race` : 'Race venue')}</small><b>{venue.name}</b></span></div>}
      {spin && !label && !result && <div className="rf-spin">💨 Wheelspin</div>}
      {countdown > 0 && countdown !== 99 && <div className="countdown big" key={countdown}>{countdown}</div>}
      {countdown === 0 && t.current < 0.5 && !label && !result && <div className="countdown big go">GO!</div>}
      {onLine && countdown > 0 && countdown !== 99 && !result && <div className="rf-hold">{pedal.current ? (light === ' now' ? 'Hold it there!' : light === ' late' ? 'Too many revs!' : 'Revving...') : 'Hold the pedal: revs in the green'}</div>}
      {me.current.burning && !result && <div className="rf-boost-fx" />}
      {stake > 0 && !result && <div className="rf-pot" title="Winner takes both stakes">🪙 {shortCoins(stake * 2)}</div>}
      {countdown === 99 && (
        <div className="rf-wait">
          {slow ? `No answer from ${rival.town} yet. Cancel the race?` : `Waiting for ${rival.town} to join...`}
          <div className="rf-wait-actions">
            {slow && <button className="buy small alt" onClick={() => setSlow(false)}>Keep waiting</button>}
            <button className="buy small" onClick={onExit}>Cancel race</button>
          </div>
        </div>
      )}
      {checking && !result && <div className="rf-wait">Checking the result with the race server...</div>}
      {label && <div className="shift-label big">{label}</div>}
      {def.skill && skillShown && !result && <div className="skill-flash">{SKILLS[def.skill].icon} {SKILLS[def.skill].name}!</div>}
      {theirSkill && theirShown && !result && <div className="skill-flash theirs">{rival.town}: {SKILLS[theirSkill].icon} {SKILLS[theirSkill].name}!</div>}
      {theirBoost && !theirShown && !result && <div className="skill-flash theirs">{rival.town}: 🔥 Boost!</div>}
      {result && !cardUp ? null : result && resultView ? resultView(result) : result ? (
        <RaceResult won={result.won} myTime={result.myTime} theirTime={result.theirTime} cash={result.counted === false ? 0 : result.won ? payout : Math.round(payout * 0.1)} xp={result.counted === false ? 0 : result.won ? 30 : 8} rival={rival.town} note={result.note} noContest={result.counted === false} stars={result.stars} stats={stats.current} next={next ?? undefined} onExit={onExit} bet={stake ? (result.counted === false ? 0 : result.won ? stake : -stake) : undefined} />
      ) : (
        <div className="rf-bottom">
          <svg viewBox="0 0 120 120" className={`tach${light}`}>
            <circle cx="60" cy="60" r="56" fill="#1b1f24" fillOpacity="0.85" stroke="#cfd8dc" strokeWidth="3" />
            <path d={arcPath(60, 60, 46, -210 + band.lo * 240, -210 + band.hi * 240)} stroke={onLine ? '#ffd54f' : '#76ff03'} strokeWidth="10" fill="none" />
            <path d={arcPath(60, 60, 46, -210 + 0.95 * 240, 30)} stroke="#ff1744" strokeWidth="10" fill="none" />
            <line x1="60" y1="60" x2={60 + 44 * Math.cos((rpmAngle * Math.PI) / 180)} y2={60 + 44 * Math.sin((rpmAngle * Math.PI) / 180)} stroke="#ff9100" strokeWidth="4" strokeLinecap="round" />
            <circle cx="60" cy="60" r="6" fill="#eceff1" />
            <text x="60" y="92" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">GEAR {me.current.gear + 1}</text>
          </svg>
          <div className="rf-side">
            <div className="rf-speed">{Math.round(me.current.speed * 3.6)}<small> km/h</small></div>
            <div className="rf-buttons">
              <BoostButton r={me.current} onFire={boost} ready={countdown === 0} />
              <button className={me.current.launched ? `big-btn shift-btn${light}` : `big-btn shift-btn launch${light}`} onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} onContextMenu={(e) => e.preventDefault()} disabled={countdown === 99 || (me.current.launched && me.current.gear >= TOP_GEAR)}>
                {me.current.launched ? 'SHIFT ▲' : 'HOLD ▶'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// The boost tank as a ring that fills with clean driving; tap it once to fire.
function BoostButton({ r, onFire, ready }: { r: { boost: number; burning: boolean; boostUsed: boolean; launched: boolean }; onFire: () => void; ready: boolean }) {
  const spent = r.boostUsed && !r.burning
  const fill = Math.round(r.boost * 100)
  return (
    <button
      className={`boost-btn${r.burning ? ' burning' : ''}${!spent && fill >= 99 ? ' full' : ''}`}
      style={{ ['--fill' as string]: `${fill}%` }}
      onPointerDown={onFire}
      disabled={!ready || spent || !r.launched || r.boost <= 0}
      aria-label={`Boost, ${fill}% full`}
    >
      <span>🔥</span>
      <small>{spent ? 'USED' : 'BOOST'}</small>
    </button>
  )
}

// Counts a number up from zero once it appears.
function useCountUp(target: number, delay: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance_now() + delay
    const tick = () => {
      const k = Math.min(1, Math.max(0, (performance_now() - t0) / ms))
      setV(Math.round(target * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, ms])
  return v
}

const CONFETTI = ['#ffd54f', '#ef5350', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#ffffff']

// bet: a wager match's coin change (+stake won, -stake lost, 0 refunded).
export function RaceResult({ won, myTime, theirTime, cash, xp, rival, note, noContest, stars, stats, next, onExit, bet }: { won: boolean; myTime: number; theirTime: number; cash: number; xp: number; rival: string; note?: string; noContest?: boolean; stars?: number; stats?: RunStats; next?: NextRace; onExit: () => void; bet?: number }) {
  const money = useCountUp(cash, 700)
  const exp = useCountUp(xp, 900)
  const margin = Number.isFinite(theirTime) ? Math.abs(theirTime - myTime) : null
  const pieces = useMemo(() => Array.from({ length: won ? 60 : 0 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 53) % 100) / 60,
    dur: 2.4 + ((i * 29) % 10) / 6,
    color: CONFETTI[i % CONFETTI.length],
    drift: ((i * 71) % 60) - 30,
    round: i % 3 === 0,
  })), [won])
  return (
    <div className={won ? 'rr win' : 'rr lose'}>
      {won && <div className="rr-rays" />}
      {pieces.map((c, i) => (
        <i key={i} className={c.round ? 'rr-bit round' : 'rr-bit'} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ['--drift' as string]: `${c.drift}vw` }} />
      ))}
      <div className="rr-card">
        <div className="rr-icon">{won ? '🏆' : '🏁'}</div>
        <h3 className="rr-title">{noContest ? 'NO RESULT' : won ? 'YOU WIN!' : margin !== null && margin < 0.3 ? 'SO CLOSE!' : 'OUTRUN!'}</h3>
        {!noContest && (
          <p className="rr-sub">
            {won ? `You beat ${rival}` : `${rival} took it`}
            {margin !== null ? ` by ${margin.toFixed(2)}s` : ''}
          </p>
        )}
        {won && stars !== undefined && <Stars n={stars} big />}
        {note && <p className="rr-note">{note}</p>}
        <div className="rr-times">
          <span className={won ? 'best' : ''}><small>You</small>{myTime.toFixed(2)}s</span>
          <span className={won ? '' : 'best'}><small>{rival}</small>{Number.isFinite(theirTime) ? `${theirTime.toFixed(2)}s` : 'DNF'}</span>
        </div>
        {stats && !noContest && (
          <div className="rr-stats">
            <span className={stats.launch.startsWith('PERFECT') ? 'good' : stats.launch.startsWith('Good') ? '' : 'bad'}><small>Launch</small>{stats.launch.startsWith('PERFECT') ? 'Perfect' : stats.launch.startsWith('Good') ? 'Good' : stats.launch.startsWith('WHEEL') ? 'Spin' : 'Bogged'}</span>
            <span className={stats.shifts > 0 && stats.perfect === stats.shifts ? 'good' : ''}><small>Perfect</small>{stats.perfect}/{Math.max(stats.shifts, 1)}</span>
            <span><small>Top speed</small>{Math.round(stats.top * 3.6)}<i> km/h</i></span>
          </div>
        )}
        <div className="rr-loot">
          {bet !== undefined && <span className={`rr-bet ${bet > 0 ? 'up' : bet < 0 ? 'down' : ''}`} style={{ animationDelay: '.4s' }}>🪙 {bet > 0 ? '+' : bet < 0 ? '−' : '±'}{Math.abs(bet).toLocaleString()}</span>}
          <span style={{ animationDelay: '.6s' }}>💵 +${money.toLocaleString()}</span>
          {won && <span style={{ animationDelay: '.8s' }}>🏆 +1</span>}
          <span style={{ animationDelay: won ? '1s' : '.8s' }}>⭐ +{exp} XP</span>
        </div>
        {next ? (
          <div className="rr-row">
            <button className="buy alt rr-back" onClick={onExit}>Back</button>
            <button className="buy rr-go" onClick={next.go}>{next.label}</button>
          </div>
        ) : <button className="buy rr-go" onClick={onExit}>{won ? 'Collect' : 'Back'}</button>}
      </div>
    </div>
  )
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

// A live race started from a challenge, shown wherever the player is.
export function LiveRaceOverlay() {
  const race = useLive((l) => l.race)
  const raceId = race?.raceId
  // Picked as the race starts, so switching cars mid-race doesn't swap the car under you.
  const car = useMemo(() => (raceId ? raceCarOf(useGame.getState().cars, useGame.getState().raceCar) : undefined), [raceId])
  if (!race || !car) return null
  if (race.mode === 'kart' && race.party) return <LiveKartParty key={race.raceId} live={race} car={car} onExit={endLiveRace} />
  if (race.mode === 'kart') return <LiveKart key={race.raceId} live={race} car={car} onExit={endLiveRace} />
  const o = race.opponent
  const rival: Rival = { id: `live:${o.id}`, town: playerName(o.uid, o.town), level: o.level, carName: o.carName, color: o.color, pi: o.pi, online: true, body: o.body, mods: o.mods }
  return <DragRace key={race.raceId} car={car} rival={rival} live={race} onExit={endLiveRace} />
}

// Challenges land in an inbox instead of popping up over the game.
export function ChallengeBell() {
  const count = useLive((l) => l.invites.length)
  const openPanel = useGame((s) => s.openPanel)
  const visiting = useGame((s) => !!s.visiting)
  useEffect(() => {
    const id = setInterval(pruneInvites, 1000)
    return () => clearInterval(id)
  }, [])
  // Only shows while a challenge is waiting; the on/off switch lives in Menu > Account.
  if (!supabase || visiting || !count) return null
  return (
    <button className="challenge-bell has" onClick={() => openPanel('invites')} title="Race challenges">
      <Icon name="flag" />
      <span className="bell-count">{count}</span>
    </button>
  )
}

export function InvitesPanel() {
  const invites = useLive((l) => l.invites)
  const openPanel = useGame((s) => s.openPanel)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const cars = useGame((s) => s.cars)
  const car = raceCarOf(cars, useGame((s) => s.raceCar))
  const setRaceCar = useGame((s) => s.setRaceCar)
  const coins = useGame((s) => s.coins)
  const accept = (raceId: string) => {
    void answer(raceId, true)
    openPanel(null)
  }
  return (
    <Panel title="Race challenges">
      {invites.length === 0 ? (
        <p className="hint">No challenges right now.</p>
      ) : (
        <>
          <div className="invites-car"><RaceBar cars={cars} car={car} onPick={setRaceCar} /></div>
          <div className="rivals">
            {invites.map((i) => (
              <div key={i.raceId} className="rival invite">
                <i style={{ background: i.from.color }} />
                <div>
                  <b><PlayerName id={i.from.uid} town={i.from.town} /></b> <span className="tag live">{i.party ? '🏎️ PARTY' : i.mode === 'kart' ? '🏎️ KART' : 'LIVE'}</span>
                  {i.stake && <span className="tag bet" title={`Winner takes ${(i.stake * 2).toLocaleString()} coins`}>🪙 {shortCoins(i.stake)}</span>}
                  <div className="card-stat">Lvl {i.from.level} · {i.from.carName} · PI {i.from.pi} · {Math.max(0, Math.ceil((INVITE_MS - (Date.now() - i.at)) / 1000))}s left</div>
                </div>
                <div className="invite-actions">
                  <button className="buy small" disabled={!!i.stake && coins < i.stake} onClick={() => accept(i.raceId)}>{i.stake ? (coins < i.stake ? `🔒 🪙${shortCoins(i.stake)}` : `Bet 🪙${shortCoins(i.stake)}`) : 'Race!'}</button>
                  <button className="sell" onClick={() => void answer(i.raceId, false)}>Decline</button>
                  <button className="mute-btn" onClick={() => mute(i.from)} title="Ignore all challenges from this player">🔇 Mute</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
