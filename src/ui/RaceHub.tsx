import { useMemo, useState } from 'react'
import { SkillIcon } from './TapTip'
import { useGame, gateLevel, type OwnedCar } from '../game/store'
import { type CarDef, CAMPAIGN, CAMPAIGN_RACES, GP_ROUNDS, GP_SERIES, RACE_FUEL, SKILLS, campaignCleared, campaignOpen, campaignRaceId, gpOpen, carDef, msToNextWeek, performance, skinDef } from '../game/data'
import { BUILDS, buildOf, raceCharacter, fit, type RaceDist } from '../game/distance'
import { EVENT_RACES, eventFor, eventPrize, eventProgress } from '../game/events'
import { TOUR_RACES, tourLeg, tourLegOf, tourRivalName } from '../game/tour'
import { campaignPayNow, tourPayNow } from '../game/fairRace'
import { shortLeft, trialVenue, trialWeek } from '../game/trial'
import { localBest } from '../lib/trialServer'
import { useLive } from '../lib/live'
import { GHOST_FUEL, racePlayerGhost } from '../lib/ghosts'
import { supabase } from '../lib/supabase'
import { venue as venueById } from '../scene/venues'
import { raceWeather } from '../game/weather'
import { CarThumb } from '../scene/BuildingPreview'
import { RivalTile, type RivalMatch } from './Rivals'
import { artStyle } from './venueArt'
import { TileClip } from './TileClip'
import { MasteryMedal, cupChip } from './ClassCups'
import { roadReady } from './TrophyRoad'
import { flairChip, flairNew } from './Flair'
import { dailyBest } from './DailyRun'
import { dailyDay } from '../game/daily'
import { worldChip } from './WorldTour'
import { MODE_LEVEL, MODE_NAME, nextRace, type HubMode } from '../game/hubModes'

// The Race menu's front page: the next race big at the top with the screen's one button,
// then three lanes (Story, Events, Free play) whose tiles open their modes.

export type HubTab = 'quick' | 'campaign' | 'tour' | 'gp' | 'trial' | 'event' | 'rivals' | 'tuner' | 'cups' | 'road' | 'flair' | 'daily' | 'world'

const money = (n: number) => (n >= 10000 ? `$${Math.round(n / 1000)}k` : `$${n.toLocaleString()}`)

// The chapter the campaign should open on (the first open, uncleared one) and its next race (-1: none left).
export function campaignFocus(done: Record<string, number>, level: number) {
  const opened = (ci: number) => campaignOpen(done, ci, level)
  const first = CAMPAIGN.findIndex((ch, ci) => opened(ci) && !campaignCleared(done, ch))
  const ci = first === -1 ? CAMPAIGN.reduce((n, _, i) => (opened(i) ? i : n), 0) : first
  const next = first === -1 ? -1 : Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(CAMPAIGN[ci], i)] ?? 0).findIndex((n) => n === 0)
  return { ci, next, opened }
}

export function Pips({ n, of, dark }: { n: number; of: number; dark?: boolean }) {
  return <span className={dark ? 'rm-pips dark' : 'rm-pips'} aria-label={`${n} of ${of}`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
}

export function RaceHub({ onOpen, onCampaign, onTour, onEvent, onRival, onBlast, onCustom }: { onOpen: (t: HubTab) => void; onCampaign: (ci: number, race: number) => void; onTour: () => void; onEvent: () => void; onRival: (m: RivalMatch) => void; onBlast: () => void; onCustom: () => void }) {
  const level = useGame(gateLevel)
  const done = useGame((s) => s.campaign)
  const won = useGame((s) => s.tour ?? 0)
  const gp = useGame((s) => s.gp)
  const carCount = useGame((s) => s.cars.length)
  const openPanel = useGame((s) => s.openPanel)
  const live = useLive((l) => l.players.length)
  const cups = useGame((s) => s.cups)
  const trophies = useGame((s) => s.trophies)
  const roadDue = roadReady(trophies, useGame((s) => s.road))
  const daily = useGame((s) => s.daily)
  const dailyDue = daily?.day !== dailyDay()
  const worldTour = useGame((s) => s.worldTour)
  const flairSave = { trophies, cups, stats: useGame((s) => s.stats), mastery: useGame((s) => s.mastery) }
  const flairDue = flairNew({ ...flairSave, flairSeen: useGame((s) => s.flairSeen) })
  const signedIn = useLive((l) => l.signedIn)

  const { ci, next } = campaignFocus(done, level)
  const ch = CAMPAIGN[ci]
  const stars = Object.values(done).reduce((a, n) => a + n, 0)
  const maxStars = CAMPAIGN.length * CAMPAIGN_RACES * 3

  const tourOpen = campaignCleared(done, CAMPAIGN[0])
  const leg = tourLeg(tourLegOf(won))
  const tv = venueById(leg.venue)
  // The next leg's sky, rolled from its number as the race itself rolls it, so the clip shows it.
  const tourSky = useMemo(() => raceWeather(leg.venue, `tour-${won}`).kind, [leg.venue, won])

  // The Grand Prix series most worth showing: one under way, else the newest open one not yet won, else the newest open.
  const series = GP_SERIES.find((s, si) => (gp[s.id]?.round ?? 0) > 0 && gpOpen(gp, si, level))
    ?? [...GP_SERIES].reverse().find((s) => gpOpen(gp, GP_SERIES.indexOf(s), level) && carCount >= s.minCars && !(gp[s.id]?.clears))
    ?? [...GP_SERIES].reverse().find((s) => gpOpen(gp, GP_SERIES.indexOf(s), level)) ?? GP_SERIES[0]
  const round = gp[series.id]?.round ?? 0

  const cars = useGame((s) => s.cars)
  const evp = eventProgress(useGame((s) => s.event))
  const ev = eventFor()
  const evWon = evp?.won ?? 0
  const evBase = evp?.pi ?? cars.reduce((m, c) => Math.max(m, performance(carDef(c.model), c.upgrades, c.mods)), 0)
  const evSkin = skinDef(ev.skin)!
  const evHas = useGame((s) => (s.skins ?? []).includes(ev.skin))

  const week = trialWeek()
  const trial = trialVenue(week)
  const best = localBest(week)

  // A tile opens its mode; its button (where it has one) starts the next race straight away.
  const tile = (tab: HubTab) => ({ role: 'button', tabIndex: 0, onClick: () => onOpen(tab), onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onOpen(tab) })
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

  // The one race the menu leads with: the next campaign race, else this week's event, else the
  // next Pro Tour leg, else a quick race. Its button is the screen's one big button.
  const pick = nextRace(next, evWon < EVENT_RACES, tourOpen)
  const hero = pick === 'campaign'
    ? { tag: 'CAMPAIGN', title: ch.rivals[next], meta: `${ch.name} · ${next + 1}/${CAMPAIGN_RACES}`, art: artStyle('camp', ch.venue), clip: <TileClip mode="camp" venue={ch.venue} />, prize: campaignPayNow(ci, next, true), go: () => onCampaign(ci, next), open: 'campaign' as HubTab }
    : pick === 'event'
      ? { tag: 'WEEKLY EVENT', title: ev.name, meta: `${evWon + 1}/${EVENT_RACES} · ⏳ ${shortLeft(msToNextWeek())}`, art: { ...artStyle('tour', ev.venue, ev.night), '--ev': ev.color }, clip: <TileClip mode="tour" venue={ev.venue} night={ev.night} sky={ev.sky} event={ev.id} />, prize: eventPrize(evBase, evWon), go: onEvent, open: 'event' as HubTab }
      : pick === 'tour'
        ? { tag: 'PRO TOUR', title: tourRivalName(won), meta: leg.night ? `${tv.name} at Midnight` : `${tv.name} ${leg.name}`, art: artStyle('tour', leg.venue, leg.night), clip: <TileClip mode="tour" venue={leg.venue} night={leg.night} sky={tourSky} />, prize: tourPayNow(won), go: onTour, open: 'tour' as HubTab }
        : { tag: 'QUICK RACE', title: 'Pick a rival', meta: '🏁', art: artStyle('camp', 'main'), clip: <TileClip mode="camp" venue="main" />, prize: null, go: () => onOpen('quick'), open: 'quick' as HubTab }

  // Modes arrive with levels, so a new player starts with a short menu. Each lane ends on the next one coming.
  const has = (m: HubMode) => level >= MODE_LEVEL[m]
  const soon = (ms: HubMode[]) => {
    const m = ms.filter((x) => !has(x)).sort((x, y) => MODE_LEVEL[x] - MODE_LEVEL[y])[0]
    return m && <span className="rm-mini rm-soon" title={`${MODE_NAME[m]} opens at level ${MODE_LEVEL[m]}`}><span className="rm-dot rm-lv">Lv {MODE_LEVEL[m]}</span><span className="rm-mi">🔒</span><span><b>{MODE_NAME[m]}</b></span></span>
  }

  return (
    <div className="rm-hub rm-lanes">
      <div className="rm-tile rm-photo rm-lead" style={hero.art as React.CSSProperties} {...tile(hero.open)}>
        {hero.clip}
        <span className="rm-tag">▶ NEXT RACE</span>
        <span className="rm-lead-mode">{hero.tag}</span>
        <b className="rm-ttl">{hero.title}</b>
        <span className="rm-meta">{hero.meta}</span>
        <button className="buy rm-lead-go" onClick={stop(hero.go)}>🏁 {hero.prize !== null ? money(hero.prize) : 'Go'}{hero.prize !== null && <small>⛽{RACE_FUEL}</small>}</button>
      </div>

      <section className="rm-lane rm-story" aria-label="Story">
        <h4 className="rm-lane-h">📖 Story</h4>
        <div className="rm-lane-photos">
          <div className="rm-tile rm-camp rm-photo" style={artStyle('camp', ch.venue)} {...tile('campaign')}>
            <TileClip mode="camp" venue={ch.venue} />
            <span className="rm-tag">CAMPAIGN</span>
            <b className="rm-ttl">{ch.name}</b>
            <span className="rm-meta">{ci + 1}/{CAMPAIGN.length} · ⭐ {stars}/{maxStars}</span>
            <span className="rm-progress"><i style={{ width: `${(stars / maxStars) * 100}%` }} /></span>
          </div>
          <div className={`rm-tile rm-tour rm-photo${tourOpen ? '' : ' rm-locked'}`} style={artStyle('tour', leg.venue, leg.night)} {...tile('tour')}>
            <TileClip mode="tour" venue={leg.venue} night={leg.night} sky={tourSky} />
            <span className="rm-tag">PRO TOUR</span>
            <b className="rm-ttl">{leg.night ? `${tv.name} at Midnight` : `${tv.name} ${leg.name}`}</b>
            {tourOpen
              ? <span className="rm-meta">Leg {leg.index + 1}{leg.night ? ' · 🌙' : ''} <Pips n={won % TOUR_RACES} of={TOUR_RACES} /></span>
              : <span className="rm-meta" title="Clear Back Streets to open">🔒 {CAMPAIGN[0].name}</span>}
          </div>
          <div className={`rm-tile rm-gp rm-photo${gpOpen(gp, GP_SERIES.indexOf(series), level) ? '' : ' rm-locked'}`} style={artStyle('gp')} {...tile('gp')}>
            <TileClip mode="gp" />
            <span className="rm-tag">GRAND PRIX</span>
            <b className="rm-ttl">{series.name}</b>
            <span className="rm-meta"><Rounds round={round} /></span>
          </div>
        </div>
        <RivalTile onRace={onRival} onOpen={() => onOpen('rivals')} />
      </section>

      <section className="rm-lane rm-events" aria-label="Events">
        <h4 className="rm-lane-h">📅 Events</h4>
        <div className="rm-lane-photos">
          <div className="rm-tile rm-ev rm-photo" style={{ ...artStyle('tour', ev.venue, ev.night), '--ev': ev.color } as React.CSSProperties} {...tile('event')}>
            <TileClip mode="tour" venue={ev.venue} night={ev.night} sky={ev.sky} event={ev.id} />
            <span className="rm-tag">WEEKLY EVENT</span>
            <b className="rm-ttl">{ev.name}</b>
            <span className="rm-meta"><Pips n={evWon} of={EVENT_RACES} /> <i className="rm-ev-swatch" style={{ background: evSkin.swatch }} title={`${evSkin.name} skin${evHas ? ' (yours)' : ''}`} /></span>
          </div>
          <div className="rm-tile rm-trial rm-photo" style={artStyle('trial', trial.id)} {...tile('trial')}>
            <TileClip mode="trial" venue={trial.id} />
            <span className="rm-tag">TIME TRIAL</span>
            <b className="rm-ttl">{trial.name}</b>
            <span className="rm-meta">⏱️ {best !== null ? `${best.toFixed(3)}s` : '--'} · ⏳ {shortLeft(msToNextWeek())}</span>
          </div>
        </div>
        <div className="rm-minis">
          <button className="rm-mini m-daily" onClick={() => onOpen('daily')}>
            {dailyDue && <span className="rm-dot">!</span>}
            <span className="rm-mi">📅</span><span><b>Daily Run</b><small>{dailyBest(daily, dailyDay())?.toFixed(2) ?? 'New today'}</small></span>
          </button>
          {has('road') && (
            <button className="rm-mini m-road" onClick={() => onOpen('road')}>
              {roadDue > 0 && <span className="rm-dot">{roadDue}</span>}
              <span className="rm-mi">🛣️</span><span><b>Trophy Road</b><small>🏆 {trophies.toLocaleString()}</small></span>
            </button>
          )}
          {has('cups') && <button className="rm-mini m-cups" onClick={() => onOpen('cups')}><span className="rm-mi">🏆</span><span><b>Class Cups</b><small>{cupChip(cups)}</small></span></button>}
          {has('world') && (
            <button className="rm-mini m-world" onClick={() => onOpen('world')}>
              <span className="rm-mi">🌍</span><span><b>World Tour</b><small>{worldChip(worldTour)}</small></span>
            </button>
          )}
          {soon(['road', 'cups', 'world'])}
        </div>
      </section>

      <section className="rm-lane rm-free" aria-label="Free play">
        <h4 className="rm-lane-h">🎮 Free play</h4>
        <div className="rm-minis">
          <button className="rm-mini m-quick" onClick={() => onOpen('quick')}><span className="rm-mi">🏁</span><span><b>Quick race</b><small>Pick a rival</small></span></button>
          {supabase && (signedIn && live === 0 ? (
            <button className="rm-mini m-live m-ghostlive" onClick={() => void ghostNow()} title={`Nobody live: race a real player's best run · ⛽${GHOST_FUEL}`}>
              <span className="rm-mi">👻</span><span><b>Live</b><small>Race a ghost</small></span>
            </button>
          ) : (
            <button className="rm-mini m-live" onClick={() => onOpen('quick')}>
              {live > 0 && <span className="rm-dot">{live}</span>}
              <span className="rm-mi">🟢</span><span><b>Live</b><small>{!signedIn ? 'Sign in' : `${live} online`}</small></span>
            </button>
          ))}
          {has('ghosts') && <button className="rm-mini m-ghost" onClick={() => openPanel('friends')}><span className="rm-mi">👻</span><span><b>Ghosts</b><small>Friends</small></span></button>}
          {has('blast') && <button className="rm-mini m-blast" onClick={onBlast} title="Every kart the same, bumps hit hard, the road full of obstacles"><span className="rm-mi">💥</span><span><b>Bumper Blast</b><small>Chaos karts</small></span></button>}
          {has('custom') && <button className="rm-mini m-custom" onClick={onCustom}><span className="rm-mi">🛠️</span><span><b>Custom race</b><small>Mix the rules</small></span></button>}
          {has('tuner') && <button className="rm-mini m-tuner" onClick={() => onOpen('tuner')}><span className="rm-mi">🔧</span><span><b>Tuner Trials</b><small>Built cars only</small></span></button>}
          {has('flair') && (
            <button className="rm-mini m-flair" onClick={() => onOpen('flair')}>
              {flairDue > 0 && <span className="rm-dot">{flairDue}</span>}
              <span className="rm-mi">🎆</span><span><b>Flair</b><small>{flairChip(flairSave)}</small></span>
            </button>
          )}
          {soon(['ghosts', 'blast', 'custom', 'tuner', 'flair'])}
        </div>
      </section>
    </div>
  )
}

// The ghost of a real player, for when nobody is live.
export async function ghostNow() {
  if (!(await racePlayerGhost())) useGame.getState().toast('No ghosts to race yet')
}

export function Rounds({ round }: { round: number }) {
  return (
    <span className="rm-rounds" aria-label={`Race ${round + 1} of ${GP_ROUNDS}`}>
      {Array.from({ length: GP_ROUNDS }, (_, i) => <i key={i} className={i < round ? 'won' : i === round ? 'next' : ''}>{i < round ? '✔' : i + 1}</i>)}
    </span>
  )
}

// The bar along the bottom of every Race menu screen: the car you race with
// (tap to swap) and, where the screen has one, the button for its next race.
// dist: the next race's distance, to show how each car's build suits it; null on a screen
// whose races vary (builds shown without a verdict); left out where builds don't count.
// loaner: the car everyone races on this screen (the Daily Run), shown in place of yours.
export function RaceBar({ cars, car, onPick, go, note, dist, loaner }: { cars: OwnedCar[]; car: OwnedCar | undefined; onPick: (uid: string) => void; go?: { label: string; onClick: () => void; fix?: boolean } | null; note?: string; dist?: RaceDist | null; loaner?: { car: CarDef; color: string; pi: number } }) {
  const [open, setOpen] = useState(false)
  const goBtn = go?.fix ? <button className="buy rm-race alt" onClick={go.onClick}>{go.label}</button>
    : go ? <button className="buy rm-race" onClick={go.onClick}>🏁 {go.label}<small>⛽{RACE_FUEL}</small></button>
    : note ? <span className="rm-note">{note}</span> : null
  if (loaner) return (
    <div className={go ? 'rm-bar has-go' : 'rm-bar'}>
      <div className="rm-car">
        <CarThumb size="xs" color={loaner.color} body={loaner.car.body} model={loaner.car.id} />
        <span className="rm-car-txt">
          <small className="rm-car-lbl">🔑 Loaner</small>
          <b>{loaner.car.name}</b>
          <small><span className="rm-pi">PI {loaner.pi}</span></small>
        </span>
      </div>
      {goBtn}
    </div>
  )
  if (!car) return null
  const d = carDef(car.model)
  const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)
  // The build tag, with a tick or a cross for how it suits the next race's distance.
  const tag = (c: OwnedCar) => {
    if (dist === undefined) return null
    const b = buildOf(raceCharacter(carDef(c.model)))
    const f = dist ? fit(b, dist) : null
    return <span className={`rm-build${f ? ` ${f}` : ''}`} data-tap-tip title={`${BUILDS[b].name}: ${BUILDS[b].text}`}>{BUILDS[b].icon}{f === 'good' ? '✓' : f === 'bad' ? '✗' : ''}</span>
  }
  return (
    <div className={go ? 'rm-bar has-go' : 'rm-bar'}>
      {open && (
        <div className="rm-picker" role="listbox" aria-label="Pick the car you race with">
          {[...cars].sort((a, b) => pi(b) - pi(a)).map((c) => (
            <button key={c.uid} role="option" aria-selected={c.uid === car.uid} className={c.uid === car.uid ? 'chip sel' : 'chip'} onClick={() => { onPick(c.uid); setOpen(false) }}>
              <CarThumb size="xs" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} hat={c.hat} body={carDef(c.model).body} model={c.model} stripe={c.stripe} mods={c.mods} />
              <span>{carDef(c.model).name}</span><span className="rm-pi">PI {pi(c)}</span>{carDef(c.model).skill ? ` ${SKILLS[carDef(c.model).skill!].icon}` : ''}{tag(c)}
            </button>
          ))}
        </div>
      )}
      <button className="rm-car" onClick={() => setOpen((o) => !o)} disabled={cars.length < 2} aria-expanded={open}>
        <CarThumb size="xs" color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} hat={car.hat} body={d.body} model={car.model} stripe={car.stripe} mods={car.mods} />
        <span className="rm-car-txt">
          <small className="rm-car-lbl">🏁 Racing with</small>
          <b>{d.name} <MasteryMedal model={car.model} /></b>
          <small><span className="rm-pi">PI {pi(car)}</span>{d.skill && <> <SkillIcon sk={d.skill} className="" named /></>}{tag(car)}</small>
        </span>
        {cars.length > 1 && <span className="rm-swap" aria-hidden>{open ? 'Done' : 'Change'}</span>}
      </button>
      {goBtn}
    </div>
  )
}
