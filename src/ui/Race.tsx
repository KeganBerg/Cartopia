import { Icon } from './Icon'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { CARS, SKILLS, carDef, performance, RACE_FUEL, GP_SERIES, GP_ROUNDS, gpRivalPi, gpReward, CAMPAIGN, CAMPAIGN_RACES, campaignRaceId, campaignRivalPi, campaignShift, campaignRivalSkills, campaignReward, campaignCleared, type CampaignChapter, skillBoost, skillDrag, liveSkillBoost, smoothShift, type Body, type GpSeries, type SkillId } from '../game/data'
import { TRACK, freshRacer, stepRacer, shiftQuality, launchRacer, shiftRacer, fireBoost, aiReaction, AI_BOOST_GEAR, AUTO_LAUNCH, JUMP_START_DELAY } from '../game/race'
import { CarThumb } from '../scene/BuildingPreview'
import { supabase } from '../lib/supabase'
import { Panel, SheetTabs } from './Menus'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { RaceScene } from '../scene/RaceScene'
import { pickVenue, venue as venueById } from '../scene/venues'
import { sfx } from '../lib/sound'
import { raceAudio, type RaceAudio } from '../lib/engineAudio'
import { useLive, challenge, cancelChallenge, refreshPresence, raceChannel, endLiveRace, answer, pruneInvites, mute, unmute, setClosed, INVITE_MS, type LiveRace } from '../lib/live'
import { displayName } from '../lib/names'
import { joinRefereed, reportFinish, serverPi, type Verdict } from '../lib/referee'
import { ghostDist, TRIAL_FUEL } from '../game/trial'
import { TrialTab, TrialResult, beginTrialRun, type TrialRun } from './TimeTrial'

// skill: the rival car's race skill. AI rivals use it; live players use theirs on their own device.
// shift: how cleanly an AI rival shifts, 0 (sloppy) to 1 (always perfect, the default).
type Rival = { id: string; town: string; level: number; carName: string; color: string; pi: number; online: boolean; body: Body; mods?: string[]; skill?: SkillId; shift?: number; boss?: boolean }

const TOWNS = ['Transamsylvania', 'Gearville', 'Piston Peak', 'Nitro Bay', 'Chrome City', 'Rustbelt Row', 'Turbo Falls', 'Muffler Hills']
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)
const liveReward = (oppPi: number) => 300 + oppPi * 8
const reward = (r: Rival) => (r.id.startsWith('live:') ? liveReward(r.pi) : 150 + r.pi * 6)
const performance_now = () => window.performance.now()

function carNear(target: number) {
  return [...CARS].sort((a, b) => Math.abs(performance(a, zero) - target) - Math.abs(performance(b, zero) - target))[0]
}

function gpRival(series: GpSeries, round: number, clears: number): Rival {
  const target = gpRivalPi(series, round, clears)
  const car = carNear(target)
  return { id: `gp-${series.id}-${round}`, town: series.rivals[round], level: series.unlockLevel + round, carName: car.name, color: car.colors[round % car.colors.length], pi: target, online: false, body: car.body, skill: car.skill }
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
      mods: Array.isArray(r.best_car.mods) ? r.best_car.mods : undefined,
      skill: CARS.find((c) => c.name === r.best_car.name)?.skill,
    }))
}

// How long a live race waits for the other player before offering to call it off.
const JOIN_PATIENCE_MS = 30000

type RaceTab = 'quick' | 'campaign' | 'gp' | 'trial'
let nextRaceTab: RaceTab = 'quick'
// Opens the Race menu on a given tab (goals use it to send players to the campaign or Grand Prix).
export function openRaceTab(tab: RaceTab) {
  nextRaceTab = tab
  useGame.getState().openPanel('race')
}

export function RacePanel() {
  const cars = useGame((s) => s.cars)
  const level = useGame((s) => s.level)
  const best = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  const [carId, setCarId] = useState(best?.uid)
  const car = cars.find((c) => c.uid === carId) ?? best
  const [rivals] = useState(() => makeRivals(pi(best), level))
  const [online, setOnline] = useState<Rival[]>([])
  const [race, setRace] = useState<Rival | null>(null)
  const [gpRace, setGpRace] = useState<{ series: GpSeries; rival: Rival; prize: number } | null>(null)
  const [cRace, setCRace] = useState<{ chapter: CampaignChapter; race: number; rival: Rival; prize: number } | null>(null)
  const [tab, setTab] = useState<RaceTab>(() => {
    const t = nextRaceTab
    nextRaceTab = 'quick'
    return t
  })
  const [pickCar, setPickCar] = useState(false)
  const [trial, setTrial] = useState<(TrialRun & { n: number }) | null>(null)
  const gpResult = useGame((s) => s.gpResult)
  const campaignResult = useGame((s) => s.campaignResult)

  const livePlayers = useLive((l) => l.players)
  const liveSignedIn = useLive((l) => l.signedIn)
  const outgoing = useLive((l) => l.outgoing)
  const mutedIds = useLive((l) => l.muted)
  const cooldownTo = useLive((l) => l.cooldownTo)

  useEffect(() => {
    fetchOnlineRivals().then(setOnline)
    refreshPresence()
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

  if (race && car) return <DragRace car={car} rival={race} onExit={() => setRace(null)} />
  if (gpRace && car) {
    return (
      <DragRace
        car={car}
        rival={gpRace.rival}
        prize={gpRace.prize}
        title={`${gpRace.series.name} · Race ${Number(gpRace.rival.id.split('-').pop()) + 1} of ${GP_ROUNDS}`}
        onFinish={(won) => gpResult(gpRace.series.id, won)}
        onExit={() => { setGpRace(null); setTab('gp') }}
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
        rival={{ id: 'trial', town: `👻 ${trial.ghost}`, level: 0, carName: d.name, color: '#eceff1', pi: pi(car), online: false, body: d.body }}
        trial={{ target: trial.target }}
        venueId={trial.venue}
        title={`⏱️ Time trial · ${venueById(trial.venue).name}`}
        onFinish={() => {}}
        resultView={(r) => <TrialResult myTime={r.myTime} target={trial.target} ghost={trial.ghost} onAgain={() => again(r.myTime)} onExit={() => { setTrial(null); setTab('trial') }} />}
        onExit={() => { setTrial(null); setTab('trial') }}
      />
    )
  }

  if (cRace && car) {
    return (
      <DragRace
        car={car}
        rival={cRace.rival}
        prize={cRace.prize}
        venueId={cRace.chapter.venue}
        title={`${cRace.chapter.name} · ${cRace.race === CAMPAIGN_RACES - 1 ? 'Boss race' : `Race ${cRace.race + 1} of ${CAMPAIGN_RACES}`}`}
        onFinish={(_, myTime, theirTime) => campaignResult(cRace.chapter.id, cRace.race, myTime, theirTime)}
        onExit={() => { setCRace(null); setTab('campaign') }}
      />
    )
  }

  const start = (r: Rival) => {
    if (waiting()) return
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a race')
    setRace(r)
  }

  return (
    <Panel title="Drag Race" wide>
      <SheetTabs
        items={[{ id: 'quick', label: '🏁 Quick race' }, { id: 'campaign', label: '🗺️ Campaign' }, { id: 'gp', label: '🏆 Grand Prix' }, { id: 'trial', label: '⏱️ Time trial' }, { id: 'top', label: '🏅 Top racers' }] as const}
        value={tab}
        onChange={(t) => (t === 'top' ? useGame.getState().openPanel('leaders') : setTab(t))}
      />
      {car && (pickCar ? (
        <div className="race-cars">
          {cars.map((c) => (
            <button key={c.uid} className={c.uid === car.uid ? 'chip sel' : 'chip'} onClick={() => { setCarId(c.uid); setPickCar(false) }}>
              <CarThumb size="xs" color={c.color} finish={c.finish} body={carDef(c.model).body} model={c.model} stripe={c.stripe} mods={c.mods} /> {carDef(c.model).name} · PI {pi(c)}{carDef(c.model).skill ? ` ${SKILLS[carDef(c.model).skill!].icon}` : ''}
            </button>
          ))}
        </div>
      ) : (
        <button className="race-car-pick" onClick={() => setPickCar(true)} disabled={cars.length < 2}>
          <CarThumb size="sm" color={car.color} finish={car.finish} body={carDef(car.model).body} model={car.model} stripe={car.stripe} mods={car.mods} />
          <span>
            <small>Racing with</small>
            <b>{carDef(car.model).name} · PI {pi(car)}</b>
            {carDef(car.model).skill && <small>{SKILLS[carDef(car.model).skill!].icon} {SKILLS[carDef(car.model).skill!].name}: {SKILLS[carDef(car.model).skill!].text}</small>}
          </span>
          {cars.length > 1 && <span className="chev">Change ›</span>}
        </button>
      ))}
      {tab === 'campaign' ? (
        <Campaign onRace={(chapter, race, rival, prize) => {
          if (waiting()) return
          if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a campaign race')
          setCRace({ chapter, race, rival, prize })
        }} />
      ) : tab === 'trial' ? (
        car && <TrialTab myPi={pi(car)} onRun={startTrial} />
      ) : tab === 'gp' ? (
        <GrandPrix onRace={(series, rival, prize) => {
          if (waiting()) return
          if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a Grand Prix race')
          setGpRace({ series, rival, prize })
        }} />
      ) : <>
      {supabase && (
        <>
          <h3>Live now <small>(players online this minute, no fuel needed)</small></h3>
          {!liveSignedIn ? <p className="hint">Sign in from the Menu to race other players live.</p>
            : livePlayers.length === 0 && <p className="hint">Nobody else is online right now. Open Cartopia in another browser or ask a friend to join!</p>}
          <div className="rivals">
            {livePlayers.filter((p) => !mutedIds[p.id]).map((p) => (
              <div key={p.id} className="rival">
                <i style={{ background: p.color }} />
                <div>
                  <b>{p.town}</b> <span className="tag live">LIVE</span>
                  <div className="card-stat">Lvl {p.level} · {p.carName} · PI {p.pi}</div>
                </div>
                {outgoing?.to === p.id ? (
                  <button className="buy small alt" onClick={cancelChallenge} title="Waiting for an answer. Tap to call it off.">
                    Waiting... Cancel
                  </button>
                ) : (
                  <button className="buy small alt" disabled={!!outgoing || p.closed || (cooldownTo[p.id] ?? 0) > Date.now()} onClick={() => void challenge(p.id)}>
                    {p.closed ? 'Not taking races' : (cooldownTo[p.id] ?? 0) > Date.now() ? 'Try again soon' : `Challenge · win $${liveReward(p.pi)}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <h3>Pick a rival <small>(costs ⛽{RACE_FUEL})</small></h3>
      <div className="rivals">
        {[...online, ...rivals].map((r) => (
          <div key={r.id} className="rival">
            <i style={{ background: r.color }} />
            <div>
              <b>{r.town}</b> {r.online && <span className="tag">PLAYER</span>}
              <div className="card-stat">Lvl {r.level} · {r.carName} · PI {r.pi}{r.skill && <RivalSkill skill={r.skill} />}</div>
            </div>
            <button className="buy small" onClick={() => start(r)}>Race · win ${reward(r)}</button>
          </div>
        ))}
      </div>
      </>}
      <p className="hint">Shift when the needle hits the green zone. Space bar works too.</p>
    </Panel>
  )
}

function RivalSkill({ skill }: { skill: SkillId }) {
  return <span className="rival-skill" title={`${SKILLS[skill].name}: ${SKILLS[skill].text}`}> · {SKILLS[skill].icon} {SKILLS[skill].name}</span>
}

function GrandPrix({ onRace }: { onRace: (s: GpSeries, r: Rival, prize: number) => void }) {
  const level = useGame((s) => s.level)
  const carCount = useGame((s) => s.cars.length)
  const gp = useGame((s) => s.gp)
  const showNeed = useGame((s) => s.showNeed)
  const openPanel = useGame((s) => s.openPanel)
  return (
    <>
      <p className="hint">Win six races in a row to earn a mystery box car. Lose and you can retry that race. Every repeat of a series gets tougher.</p>
      <div className="gp-list">
        {GP_SERIES.map((s) => {
          const prog = gp[s.id] ?? { round: 0, clears: 0 }
          const locked = level < s.unlockLevel
          const short = carCount < s.minCars
          const rival = gpRival(s, prog.round, prog.clears)
          const prize = gpReward(s, prog.round)
          return (
            <div key={s.id} className={locked ? 'gp-card locked' : 'gp-card'}>
              <div className="gp-head">
                <b>{s.name}</b>
                {prog.clears > 0 && <span className="tag">Won ×{prog.clears}</span>}
                <span className="gp-box" title={`Mystery box: ${s.box.map((m) => carDef(m).name).join(', ')}`}>🎁</span>
              </div>
              <div className="gp-rounds">
                {Array.from({ length: GP_ROUNDS }, (_, i) => (
                  <i key={i} className={i < prog.round ? 'won' : i === prog.round ? 'next' : ''}>{i < prog.round ? '✔' : i + 1}</i>
                ))}
              </div>
              <div className="card-stat">Box could hold: {s.box.map((m) => carDef(m).name).join(', ')}</div>
              {locked ? (
                <button className="price locked-btn" onClick={() => showNeed('level', s.unlockLevel, s.name)}>🔒 Level {s.unlockLevel}</button>
              ) : short ? (
                <div className="gp-short">
                  <span>You need {s.minCars} cars to enter. You have {carCount}.</span>
                  <button className="buy small alt" onClick={() => openPanel('rescue')}>Get cars at Rusty's</button>
                </div>
              ) : (
                <div className="gp-next">
                  <span>Race {prog.round + 1}: <b>{rival.town}</b> · {rival.carName} · PI {rival.pi}{rival.skill && <RivalSkill skill={rival.skill} />}</span>
                  <button className="buy small" onClick={() => onRace(s, rival, prize)}>Race · win ${prize}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function campaignRival(ch: CampaignChapter, chIndex: number, i: number): Rival {
  const target = campaignRivalPi(ch, i)
  const car = carNear(target)
  return {
    id: `camp-${ch.id}-${i}`, town: ch.rivals[i], level: ch.unlockLevel + i * 2, carName: car.name, color: car.colors[(chIndex + i) % car.colors.length],
    pi: target, online: false, body: car.body, skill: campaignRivalSkills(chIndex, i) ? car.skill : undefined, shift: campaignShift(chIndex, i), boss: i === CAMPAIGN_RACES - 1,
  }
}

function Stars({ n, big }: { n: number; big?: boolean }) {
  return <span className={big ? 'stars big' : 'stars'} aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>
}

function Campaign({ onRace }: { onRace: (ch: CampaignChapter, race: number, r: Rival, prize: number) => void }) {
  const level = useGame((s) => s.level)
  const done = useGame((s) => s.campaign)
  const showNeed = useGame((s) => s.showNeed)
  const opened = (ci: number) => level >= CAMPAIGN[ci].unlockLevel && (ci === 0 || campaignCleared(done, CAMPAIGN[ci - 1]))
  const firstOpen = CAMPAIGN.findIndex((ch, ci) => opened(ci) && !campaignCleared(done, ch))
  const [sel, setSel] = useState(firstOpen === -1 ? CAMPAIGN.reduce((n, _, ci) => (opened(ci) ? ci : n), 0) : firstOpen)
  const total = Object.values(done).reduce((a, n) => a + n, 0)
  const max = CAMPAIGN.length * CAMPAIGN_RACES * 3
  const starsOf = (ch: CampaignChapter) => Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(ch, i)] ?? 0)
  const ch = CAMPAIGN[sel]
  const stars = starsOf(ch)
  const v = venueById(ch.venue)
  const cleared = campaignCleared(done, ch)
  const perfect = stars.every((n) => n >= 3)
  return (
    <div className="camp">
      <div className="camp-progress" title="Campaign stars">
        <span>⭐ {total}/{max}</span>
        <i style={{ width: `${(total / max) * 100}%` }} />
      </div>
      <div className="camp-map" role="tablist">
        {CAMPAIGN.map((c, ci) => {
          const open = opened(ci)
          const n = starsOf(c).reduce((a, x) => a + x, 0)
          return (
            <button key={c.id} role="tab" aria-selected={ci === sel} aria-label={c.name}
              className={`camp-node${ci === sel ? ' sel' : ''}${open ? '' : ' locked'}${campaignCleared(done, c) ? ' done' : ''}`}
              onClick={() => setSel(ci)}>
              <span className="camp-node-ico">{open ? venueById(c.venue).icon : '🔒'}</span>
              <b>{ci + 1}</b>
              <small>{open ? `★${n}` : `Lv${c.unlockLevel}`}</small>
            </button>
          )
        })}
      </div>
      <div className={`camp-chapter venue-${ch.venue}`}>
        <div className="camp-banner">
          <span className="camp-banner-ico">{v.icon}</span>
          <div>
            <b>{ch.name}</b>
            <small>{v.name}</small>
          </div>
          <div className="camp-rewards">
            <span className={cleared ? 'got' : ''} title="Clear bonus (once)">{cleared ? '✔' : '🏁'} ${ch.coins >= 1000 ? `${ch.coins / 1000}k` : ch.coins} <span className="ico buck-ico">B</span>{ch.bucks} 🏆{ch.trophies}</span>
            <span className={perfect ? 'got' : ''} title="Three stars on every race (once)">{perfect ? '✔' : '★★★'} <span className="ico buck-ico">B</span>{ch.starBucks}</span>
          </div>
        </div>
        {!opened(sel) ? (
          <div className="camp-locked">
            {level < ch.unlockLevel
              ? <button className="buy small alt" onClick={() => showNeed('level', ch.unlockLevel, ch.name)}>🔒 Opens at level {ch.unlockLevel}</button>
              : <span>🔒 Beat {CAMPAIGN[sel - 1].rivals[CAMPAIGN_RACES - 1]} to open</span>}
          </div>
        ) : (
          <div className="camp-races">
            {stars.map((n, i) => {
              const r = campaignRival(ch, sel, i)
              const prize = campaignReward(ch, i, n === 0)
              const can = i === 0 || stars[i - 1] > 0
              const next = can && n === 0
              return (
                <div key={i} className={`camp-race${r.boss ? ' boss' : ''}${can ? '' : ' locked'}${next ? ' next' : ''}`}>
                  <span className="camp-step">{r.boss ? '👑' : i + 1}</span>
                  <CarThumb size="xs" color={r.color} body={r.body} />
                  <div className="camp-who">
                    <b>{r.town}</b>
                    <small>{n > 0 && <Stars n={n} />} PI {r.pi}{r.skill && <span className="rival-skill" title={`${SKILLS[r.skill].name}: ${SKILLS[r.skill].text}`}> {SKILLS[r.skill].icon}</span>}</small>
                  </div>
                  <button className={`buy small${n > 0 ? ' alt' : ''}`} disabled={!can} onClick={() => onRace(ch, i, r, prize)}>
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
          {prize.bucks > 0 && <span><span className="ico buck-ico">B</span> +{prize.bucks}</span>}
          {prize.trophies > 0 && <span>🏆 +{prize.trophies}</span>}
        </p>
        {prize.cleared && prize.perfect && <p>Plus the three-star bonus. Flawless!</p>}
        {prize.cleared && <p>{next ? `Next up: ${next.name}${next.unlockLevel > useGame.getState().level ? ` (opens at level ${next.unlockLevel})` : ''}.` : "You've beaten the whole campaign. Go back for three stars everywhere!"}</p>}
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
            <button className="mystery-box" onClick={() => { sfx.win(); setOpen(true) }}>🎁</button>
            <p>Tap the mystery box to open it</p>
          </>
        ) : (
          <>
            <CarThumb size="lg" color={prize.color} body={def.body} model={def.id} />
            <h3>{def.name}</h3>
            <p>PI {performance(def, zero)} · +5 🏆. It's in your garage now.</p>
            <div className="row">
              <button className="buy" onClick={() => { close(); setOpen(false); openPanel('garage') }}>See it</button>
              <button className="buy alt" onClick={() => { close(); setOpen(false) }}>Nice!</button>
            </div>
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
export function DragRace({ car, rival: shownRival, onExit, live, prize, onFinish, title, venueId, trial, resultView }: { car: OwnedCar; rival: Rival; onExit: () => void; live?: LiveRace; prize?: number; onFinish?: (won: boolean, myTime: number, theirTime: number) => number | void; title?: string; venueId?: string; trial?: { target: number }; resultView?: (r: Result) => ReactNode }) {
  // A signed-in live rival's PI comes from the server, not from their browser.
  const [serverRivalPi, setServerRivalPi] = useState<number | null>(null)
  const rival = useMemo(() => (serverRivalPi === null ? shownRival : { ...shownRival, pi: serverRivalPi }), [shownRival, serverRivalPi])
  const payout = prize ?? reward(rival)
  const rivalRef = useRef(rival)
  rivalRef.current = rival
  const finishCb = useRef(onFinish)
  finishCb.current = onFinish
  const myPi = pi(car)
  // Both cars wait on the line for their driver; the player launches on GO with the big button.
  const me = useRef(fresh(false))
  const them = useRef(fresh(!!(live || trial)))
  // Pressed before GO: launched at GO with wheelspin.
  const jumped = useRef(false)
  const samples = useRef<Sample[]>([])
  const def = carDef(car.model)
  const skillActive = useRef(false)
  const [skillShown, setSkillShown] = useState(false)
  // The AI rival's skill, flashed while it is working (live rivals use theirs on their own device).
  const theirSkill = live || trial ? undefined : rival.skill
  // Somewhere different each race; both sides of a live race get the same place.
  const [venue] = useState(() => (venueId ? venueById(venueId) : pickVenue(live?.raceId)))
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
  // Live races between signed-in players: 'yes' once the server is refereeing, 'no' to decide here.
  const refereed = useRef<'pending' | 'yes' | 'no'>(live ? 'pending' : 'no')
  const joined = useRef<Promise<boolean> | null>(null)
  const [checking, setChecking] = useState(false)
  const finishRace = useGame((s) => s.finishRace)
  const flash = (text: string) => {
    setLabel(text)
    clearTimeout(labelTimer.current)
    labelTimer.current = setTimeout(() => setLabel(''), 800)
  }
  // Off the line: reaction is seconds after GO, or negative for a jump start.
  const callLaunch = (reaction: number) => {
    const call = launchRacer(me.current, reaction)
    sfx.shift(reaction >= 0 && reaction <= 0.25)
    if (reaction >= 0) flash(call)
  }
  // The rival's shifting skill for each gear.
  // Campaign rivals shift sloppier early on: from 0.64-0.78 (good, sometimes early) up to 0.8-0.92 (perfect).
  const cleanness = shownRival.shift ?? 1
  const skill = useMemo(() => Array.from({ length: 4 }, () => 0.64 + 0.16 * cleanness + Math.random() * (0.14 - 0.02 * cleanness)), [cleanness])
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

  useEffect(() => {
    if (countdown === 99) return
    if (countdown >= 0 && countdown <= 3) {
      if (countdown === 3) sound.current?.screech()
      sfx.countdown(countdown === 0)
      sound.current?.countdown(countdown === 0)
      if (countdown === 0) sound.current?.launch(Math.min(1, myPi / 200), Math.min(1, rivalRef.current.pi / 200))
    }
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 700)
    return () => clearTimeout(id)
  }, [countdown])

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
      const v = await reportFinish(live!.raceId, myTime, signal)
      if (signal.cancelled) return
      setChecking(false)
      cancelAnimationFrame(raf)
      applyVerdict(v, myTime)
    }
    const loop = () => {
      const now = performance_now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t.current += dt
      const wasDone = me.current.finished !== null
      if (!me.current.launched && t.current >= (jumped.current ? JUMP_START_DELAY : AUTO_LAUNCH)) callLaunch(jumped.current ? -1 : t.current)
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
      const myMul = (live ? mine : skillBoost(sk, me.current, th0)) * theirDrag
      step(me.current, myPi, dt, t.current, myMul)
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
        th.dist = sampleAt(samples.current, t.current, Number.isFinite(th.finished) ? th.finished : null)
        // Opponent vanished: the race is yours after a grace period.
        if (myFinishSentAt !== null && th.finished === null && now - myFinishSentAt > 15000) th.finished = Infinity
      } else if (trial) {
        th.dist = ghostDist(t.current, trial.target)
        if (th.finished === null && t.current >= trial.target) th.finished = trial.target
      } else {
        if (!th.launched && t.current >= theirReaction) launchRacer(th, theirReaction)
        if (th.launched && th.gear < 3 && th.rpm >= skill[th.gear]) {
          const q = shiftQuality(th.rpm)
          shiftRacer(th, smoothShift(theirSkill) && q.label === 'Good' ? 1.08 : q.q)
          sound.current?.shift('them', th.gear, Math.min(1, rivalRef.current.pi / 200))
        }
        if (th.gear >= AI_BOOST_GEAR) fireBoost(th)
        if (th.burning !== theirBoosting.current) { theirBoosting.current = th.burning; setTheirBoost(th.burning) }
        step(th, rivalRef.current.pi, dt, t.current, theirBoost * skillDrag(sk, th, t.current))
      }
      force((n) => n + 1)
      if (live) {
        const g = ghost.current
        if (g.gear < 3 && g.rpm >= 0.85) {
          g.gear++
          g.rpm = 0.35
          sound.current?.shift('them', g.gear, Math.min(1, rivalRef.current.pi / 200))
        }
        step(g, rivalRef.current.pi, dt, t.current)
        sound.current?.frame(me.current, { rpm: g.rpm, gear: g.gear, dist: th.dist, finished: th.finished })
      } else sound.current?.frame(me.current, th)
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
  }, [countdown, result, myPi, skill, finishRace, live, def, theirSkill, trial, theirReaction])

  // The big button: launch on GO, then shift up.
  const press = () => {
    const r = me.current
    if (countdown === 99 || result || r.finished !== null) return
    if (!r.launched) {
      if (countdown > 0) {
        if (!jumped.current) flash('JUMP START!')
        jumped.current = true
      } else if (!jumped.current) callLaunch(t.current)
      return
    }
    if (r.gear >= 3) return
    let s = shiftQuality(r.rpm)
    if (smoothShift(def.skill) && s.label === 'Good') s = { q: 1.08, label: 'SMOOTH!' }
    sfx.shift(s.q >= 1)
    shiftRacer(r, s.q)
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
      if (e.code === 'Space') {
        e.preventDefault()
        press()
      } else if (e.code === 'KeyB' || e.code === 'ArrowUp') {
        e.preventDefault()
        boost()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rpmAngle = -210 + Math.min(1.05, me.current.rpm) * 240
  const close = live ? onExit : () => useGame.getState().openPanel(null)
  // One full-screen view: the street fills the screen and the controls float over it.
  return (
    <div className="race-full">
      <Canvas className="rf-canvas" camera={{ position: [0.4, 2.2, -4], fov: 55, near: 0.3, far: 150 }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <RaceScene track={TRACK} me={me} them={them} mine={{ body: def.body, model: car.model, color: car.color, finish: car.finish, mods: car.mods }} theirs={{ body: rival.body, color: rival.color, mods: rival.mods }} venue={venue} weatherSeed={live?.raceId} />
      </Canvas>
      <div className="rf-top">
        <h2>{title ?? `Drag Race vs ${rival.town}`}</h2>
        <button className="close" onClick={close} aria-label="Leave race">✕</button>
      </div>
      <div className="rf-lanes">
        {[
          { name: `You · ${def.name}`, color: car.color, r: me.current },
          { name: `${rival.town} · ${rival.carName}`, color: rival.color, r: them.current },
        ].map((lane) => (
          <div key={lane.name} className="rf-lane">
            <span className="lane-name">{lane.name}</span>
            <div className="lane-car" style={{ left: `${Math.min(1, lane.r.dist / TRACK) * 90}%`, background: lane.color }} />
            <div className="finish" />
          </div>
        ))}
      </div>
      {countdown > 0 && !result && <div className="rf-venue">{venue.icon} {venue.name}</div>}
      {countdown > 0 && countdown !== 99 && <div className="countdown big">{countdown}</div>}
      {countdown === 0 && !me.current.launched && !result && <div className="countdown big go">GO!</div>}
      {me.current.burning && !result && <div className="rf-boost-fx" />}
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
      {result && resultView ? resultView(result) : result ? (
        <RaceResult won={result.won} myTime={result.myTime} theirTime={result.theirTime} cash={result.counted === false ? 0 : result.won ? payout : Math.round(payout * 0.1)} xp={result.counted === false ? 0 : result.won ? 30 : 8} rival={rival.town} note={result.note} noContest={result.counted === false} stars={result.stars} onExit={onExit} />
      ) : (
        <div className="rf-bottom">
          <svg viewBox="0 0 120 120" className="tach">
            <circle cx="60" cy="60" r="56" fill="#1b1f24" fillOpacity="0.85" stroke="#cfd8dc" strokeWidth="3" />
            <path d={arcPath(60, 60, 46, -210 + 0.78 * 240, -210 + 0.93 * 240)} stroke="#76ff03" strokeWidth="10" fill="none" />
            <path d={arcPath(60, 60, 46, -210 + 0.95 * 240, 30)} stroke="#ff1744" strokeWidth="10" fill="none" />
            <line x1="60" y1="60" x2={60 + 44 * Math.cos((rpmAngle * Math.PI) / 180)} y2={60 + 44 * Math.sin((rpmAngle * Math.PI) / 180)} stroke="#ff9100" strokeWidth="4" strokeLinecap="round" />
            <circle cx="60" cy="60" r="6" fill="#eceff1" />
            <text x="60" y="92" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">GEAR {me.current.gear + 1}</text>
          </svg>
          <div className="rf-side">
            <div className="rf-speed">{Math.round(me.current.speed * 0.9)}<small> km/h</small></div>
            <div className="rf-buttons">
              <BoostButton r={me.current} onFire={boost} ready={countdown === 0} />
              <button className={me.current.launched ? 'big-btn shift-btn' : 'big-btn shift-btn launch'} onPointerDown={press} disabled={countdown === 99 || (me.current.launched && me.current.gear >= 3)}>
                {me.current.launched ? 'SHIFT ▲' : 'GO ▶'}
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

function RaceResult({ won, myTime, theirTime, cash, xp, rival, note, noContest, stars, onExit }: { won: boolean; myTime: number; theirTime: number; cash: number; xp: number; rival: string; note?: string; noContest?: boolean; stars?: number; onExit: () => void }) {
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
        <h3 className="rr-title">{noContest ? 'NO RESULT' : won ? 'YOU WIN!' : 'SO CLOSE!'}</h3>
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
        <div className="rr-loot">
          <span style={{ animationDelay: '.6s' }}>💵 +${money.toLocaleString()}</span>
          {won && <span style={{ animationDelay: '.8s' }}>🏆 +1</span>}
          <span style={{ animationDelay: won ? '1s' : '.8s' }}>⭐ +{exp} XP</span>
        </div>
        <button className="buy rr-go" onClick={onExit}>{won ? 'Collect' : 'Back'}</button>
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
  const cars = useGame((s) => s.cars)
  const best = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  if (!race || !best) return null
  const o = race.opponent
  const rival: Rival = { id: `live:${o.id}`, town: displayName(o.town, o.id), level: o.level, carName: o.carName, color: o.color, pi: o.pi, online: true, body: o.body, mods: o.mods }
  return <DragRace key={race.raceId} car={best} rival={rival} live={race} onExit={endLiveRace} />
}

// Challenges land in an inbox instead of popping up over the game.
export function ChallengeBell() {
  const count = useLive((l) => l.invites.length)
  const closed = useLive((l) => l.closed)
  const openPanel = useGame((s) => s.openPanel)
  const visiting = useGame((s) => !!s.visiting)
  useEffect(() => {
    const id = setInterval(pruneInvites, 1000)
    return () => clearInterval(id)
  }, [])
  if (!supabase || visiting) return null
  return (
    <button className={`challenge-bell${count ? ' has' : ''}`} onClick={() => openPanel('invites')} title="Race challenges">
      <Icon name="flag" />{closed && <span className="bell-off">✕</span>}
      {count > 0 && <span className="bell-count">{count}</span>}
    </button>
  )
}

export function InvitesPanel() {
  const invites = useLive((l) => l.invites)
  const muted = useLive((l) => l.muted)
  const closed = useLive((l) => l.closed)
  const openPanel = useGame((s) => s.openPanel)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const accept = (raceId: string) => {
    answer(raceId, true)
    openPanel(null)
  }
  return (
    <Panel title="Race challenges">
      <label className="toggle-row">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
        <span>Don't accept challenges <small>Other players will see you're not taking races.</small></span>
      </label>
      {invites.length === 0 ? (
        <p className="hint">{closed ? 'Challenges are off.' : 'No challenges right now. When someone challenges you, it shows up here.'}</p>
      ) : (
        <div className="rivals">
          {invites.map((i) => (
            <div key={i.raceId} className="rival invite">
              <i style={{ background: i.from.color }} />
              <div>
                <b>{i.from.town}</b> <span className="tag live">LIVE</span>
                <div className="card-stat">Lvl {i.from.level} · {i.from.carName} · PI {i.from.pi} · {Math.max(0, Math.ceil((INVITE_MS - (Date.now() - i.at)) / 1000))}s left</div>
              </div>
              <div className="invite-actions">
                <button className="buy small" onClick={() => accept(i.raceId)}>Race!</button>
                <button className="sell" onClick={() => answer(i.raceId, false)}>Decline</button>
                <button className="mute-btn" onClick={() => mute(i.from)} title="Ignore all challenges from this player">🔇 Mute</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {Object.keys(muted).length > 0 && (
        <>
          <h3>Muted players</h3>
          <div className="rivals">
            {Object.entries(muted).map(([id, town]) => (
              <div key={id} className="rival muted-row">
                <span>🔇 {town}</span>
                <button className="buy small alt" onClick={() => unmute(id)}>Unmute</button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="hint">Each player can only send you one challenge at a time, and after you decline they have to wait a minute before asking again.</p>
    </Panel>
  )
}
