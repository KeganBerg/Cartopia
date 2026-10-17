import { useState } from 'react'
import { flyFrom, openChestFx, type Amounts } from './Fly'
import {
  useGame, activeGoals, eventGoals, goalOpen, goalDone, statValue, claimable, taskDef, taskText, taskProgress, periodSlots, periodDone, chestOpened,
  activeEndless, endlessReady, endlessTown,
  type Period, type GameState,
} from '../game/store'
import { ENDLESS_PAY, KINDS, endlessCapped, endlessHave, endlessPay, endlessXp, endlessText, type EndlessGoal, type EndlessKind } from '../game/endless'
import {
  GOALS, QUEST_PAY, TASKS_PER_PERIOD, payAt, msToNextDay, msToNextWeek, buildingDef, buildingLevel, upgradable, maxLevel,
  carDef, takesDriver, SEASON_STARS, activeEvent, eventEndsAt, plotPrice, START_LAND, type StatKey, type GoalDef, flatFixCost, servicePay, serviceXp, xpGain, chestXp, gasCanCost,
} from '../game/data'
import { Panel, SheetTabs, openGarageTab } from './Menus'
import { openRaceTab, type RaceTab } from './raceNav'
import { useNow } from '../scene/useNow'
import { Icon } from './Icon'
import { CrewGoalMini } from './CrewGoal'
import { useTipTarget } from './Tips'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'

// Sits in its own dock above Collect All, next to the Race button, so it's always in thumb reach.
export function GoalsButton() {
  const ready = useGame(claimable)
  const lit = useTipTarget() === 'goals'
  return (
    <button className={lit ? 'goals-btn goals-dock tut-pulse' : 'goals-btn goals-dock'} onClick={() => useGame.getState().openPanel('goals')} title="Goals">
      <Icon name="goals" />{ready > 0 && <span className="goal-badge">{ready}</span>}
    </button>
  )
}

const jobDefsOf = (s: GameState) => [...new Set(s.buildings.filter((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle').map((b) => b.def))]

// Take the player to where a goal or task gets done.
function goTo(stat: StatKey, def?: string): void {
  const s = useGame.getState()
  const jobs = () => s.showMe(jobDefsOf(s), 'Tap the flashing bubbles to run jobs and collect coins.')
  switch (stat) {
    case 'rusty': {
      if (s.buildings.some((b) => b.def === 'rescue')) return s.openPanel('rescue')
      const price = buildingDef('rescue').price
      if (s.coins < price) return s.showNeed('coins', price - s.coins, "Rusty's Rescue")
      return s.openShop('rescue')
    }
    case 'spooky':
      return s.openShop('pumpkins')
    case 'owns': {
      const d = buildingDef(def ?? '')
      if (s.coins < d.price) return s.showNeed('coins', d.price - s.coins, d.name)
      return s.openShop(d.id)
    }
    case 'cratesOpened':
      return s.openPanel('crates')
    case 'arcadePlays': {
      const b = s.buildings.find((o) => o.def === 'arcade')
      return b ? s.openUpgrade(b.uid) : s.openShop('arcade')
    }
    case 'dailyRuns':
      return openRaceTab('daily')
    case 'searches':
    case 'rescued':
      return s.buildings.some((b) => b.def === 'rescue') ? s.openPanel('rescue') : goTo('rusty')
    case 'jobs':
    case 'coinsEarned':
    case 'level':
      return jobs()
    case 'roads':
      s.setMode('road')
      return s.toast('Drag on empty grass to lay road')
    case 'carsBought':
    case 'carsOwned':
      return s.openPanel('showroom')
    case 'racesWon':
    case 'races':
      return openRaceTab('quick')
    case 'campaignWins':
    case 'stars':
    case 'chapters':
      return openRaceTab('campaign')
    case 'gpWins':
      return openRaceTab('gp')
    case 'painted':
      return openGarageTab('paint')
    case 'modsBought':
      return openGarageTab('mods')
    case 'power':
      return openGarageTab('tune')
    case 'drivers': {
      // Open the first business that could use a driver.
      const b = s.buildings.find((o) => takesDriver(buildingDef(o.def)) && !(o.car && s.cars.some((c) => c.uid === o.car)))
      if (b) return s.openUpgrade(b.uid)
      return s.openPanel('shop')
    }
    case 'plots': {
      const price = plotPrice(s.land.length - START_LAND.length)
      if (s.coins < price) return s.showNeed('coins', price - s.coins, 'more land')
      s.setMode('expand')
      return s.toast('Tap a plot next to your town to buy it')
    }
    case 'upgrades':
    case 'bldgLevel':
      // Building upgrades count too; the Shop lists them when there's one to do.
      return s.buildings.some((b) => upgradable(buildingDef(b.def)) && buildingLevel(b) < maxLevel(buildingDef(b.def))) ? s.openShop('upgrades') : s.openPanel('garage')
    case 'built':
      return s.openPanel('shop')
    case 'serviced':
    case 'flatsFixed': {
      const stuck = s.cars.find((c) => c.flat || c.lowFuel)
      if (stuck) {
        s.selectCar(stuck.uid)
        return s.openPanel('flat')
      }
      return s.showMe(jobDefsOf(s), 'Cars sometimes get flats or run dry on jobs. Run a few and watch for the 🛞 and ⛽ bubbles.')
    }
  }
}

// Where each kind of endless goal gets done: the story-goal stat that goes the same place.
const ENDLESS_GO: Partial<Record<EndlessKind, StatKey>> = {
  jobs: 'jobs', coins: 'coinsEarned', races: 'races', wins: 'racesWon', campaign: 'campaignWins', search: 'searches', service: 'serviced',
  upgrades: 'upgrades', mods: 'modsBought', paint: 'painted', gp: 'gpWins', stars: 'stars', build: 'owns', cars: 'carsOwned', land: 'plots',
  drivers: 'drivers', level: 'level', restore: 'rescued', flats: 'flatsFixed', power: 'power',
}
// Kinds played from a Race menu tab.
const ENDLESS_TAB: Partial<Record<EndlessKind, RaceTab>> = { dailyRun: 'daily', trophies: 'road', proTour: 'tour', worldTour: 'world', cups: 'cups', paintRival: 'rivals', tuner: 'tuner' }
function goToEndless(g: EndlessGoal) {
  const s = useGame.getState()
  if (g.kind === 'bldgUp') {
    // The lowest-level one of that building, so the upgrade counts.
    const b = s.buildings.filter((o) => o.def === g.def).sort((a, c) => buildingLevel(a) - buildingLevel(c))[0]
    return b ? s.openUpgrade(b.uid) : s.openShop(g.def)
  }
  if (g.kind === 'carUp') {
    if (g.def) s.selectCar(g.def)
    return openGarageTab('tune')
  }
  const tab = ENDLESS_TAB[g.kind]
  if (tab) return openRaceTab(tab)
  if (g.kind === 'crates') return s.openPanel('crates')
  if (g.kind === 'arcade') {
    const b = s.buildings.find((o) => o.def === 'arcade')
    return b ? s.openUpgrade(b.uid) : s.openShop('arcade')
  }
  const stat = ENDLESS_GO[g.kind]
  if (stat) goTo(stat, g.def)
}
// A building or car goal shows the real thing; the rest show their icon.
function EndlessIcon({ g }: { g: EndlessGoal }) {
  const car = useGame((s) => (g.kind === 'carUp' ? s.cars.find((c) => c.uid === g.def) : undefined))
  if ((g.kind === 'build' || g.kind === 'bldgUp') && g.def) return <BuildingThumb def={buildingDef(g.def)} level={g.kind === 'bldgUp' ? g.n : undefined} />
  if (car) {
    const d = carDef(car.model)
    return <CarThumb size="sm" color={car.color} finish={car.finish} skin={car.skin} body={d.body} model={d.id} stripe={car.stripe} />
  }
  return <>{KINDS[g.kind]?.icon ?? '♾'}</>
}

const n = (v: number) => v.toLocaleString()
const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000))
  return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
// xp is base XP (shown with the level boost); exactXp is already final (chests).
function Reward({ coins, xp, exactXp, bucks, parts, stars }: { coins: number; xp?: number; exactXp?: number; bucks?: number; parts?: number; stars?: number }) {
  const level = useGame((s) => s.level)
  const shownXp = exactXp ?? (xp ? xpGain(level, xp) : 0)
  return (
    <span className="goal-pay">
      <i className="coin-ico ico">$</i>{n(coins)}
      {!!bucks && <><i className="buck-ico ico">💎</i>{bucks}</>}
      {!!parts && <><i className="parts-ico ico">⚙</i>{parts}</>}
      {!!shownXp && <b>+{n(shownXp)} XP</b>}
      {!!stars && <b className="star-pay">+{stars} ⭐</b>}
    </span>
  )
}

function Row({ icon, text, have, target, done, claimed, wait, onGo, onClaim, pay, exactXp, children }: {
  icon: React.ReactNode; text: string; have: number; target: number; done: boolean; claimed?: boolean; wait?: string; onGo: () => void; onClaim: () => void; pay?: Amounts; exactXp?: boolean; children: React.ReactNode
}) {
  const level = useGame((s) => s.level)
  return (
    <div className={claimed ? 'goal claimed' : done ? 'goal done' : 'goal'}>
      <span className={typeof icon === 'string' ? 'goal-icon' : 'goal-icon goal-thumb'}>{icon}</span>
      <div className="goal-main" role="button" onClick={() => !done && onGo()}>
        <b>{text}</b>
        <div className="goal-line">
          <div className="bar"><span style={{ width: `${Math.min(1, have / target) * 100}%` }} /></div>
          <small>{n(Math.min(have, target))}/{n(target)}</small>
        </div>
        {children}
      </div>
      {claimed
        ? <span className="goal-check">✔</span>
        : done && wait
          ? <button className="buy small" disabled title="Endless goals: back tomorrow (UTC)">🔒 {wait}</button>
          : done
          ? <button className="buy small" onClick={(e) => { if (pay) flyFrom(e.currentTarget, pay.xp && !exactXp ? { ...pay, xp: xpGain(level, pay.xp) } : pay); onClaim() }}>Collect</button>
          : <button className="buy small alt" onClick={onGo}>Go ›</button>}
    </div>
  )
}

function StoryGoals() {
  const s = useGame()
  const goals = activeGoals(s)
  // Event goals have their own tab, so they don't count toward the story.
  const story = GOALS.filter((g) => !g.event)
  const total = story.length
  const claimed = s.claimedGoals.filter((id) => story.some((g) => g.id === id)).length
  const endless = activeEndless(s)
  // Once the story is done its full bar says nothing new: a small ✔ chip joins the endless
  // header instead, so the tab opens on one progress line, the one still moving.
  const storyDone = claimed >= total
  return (
    <>
      {storyDone
        ? <EndlessHead story={total} />
        : (
          <div className="goal-head">
            <span>Story {claimed}/{total}</span>
            <div className="bar"><span style={{ width: `${(claimed / total) * 100}%` }} /></div>
          </div>
        )}
      <div className="goals">
        {goals.map((g: GoalDef) => (
          <Row key={g.id} icon={g.icon} text={g.text} have={statValue(s, g.stat, g.def)} target={g.target} done={goalDone(s, g)}
            onGo={() => goTo(g.stat, g.def)} onClaim={() => s.claimGoal(g.id)} pay={{ coins: g.coins, xp: g.xp, bucks: g.bucks }}>
            <Reward coins={g.coins} xp={g.xp} bucks={g.bucks} />
          </Row>
        ))}
        {!storyDone && endless.length > 0 && <EndlessHead />}
        {endless.map((g) => <EndlessRow key={g.k} g={g} />)}
      </div>
    </>
  )
}

// Endless goals so far, and the pips toward the next parts (5th) and gems (10th) bonus.
function EndlessHead({ story }: { story?: number }) {
  const done = useGame((s) => s.endless?.n ?? 0)
  const at = done % ENDLESS_PAY.bucksEvery
  return (
    <div className={story ? 'endless-head top' : 'endless-head'} title={`Endless goals: ${n(done)} done · every ${ENDLESS_PAY.partsEvery}th +${ENDLESS_PAY.parts} parts · every ${ENDLESS_PAY.bucksEvery}th +${ENDLESS_PAY.bucks} gems`}>
      {!!story && <span className="story-done" title={`Story ${story}/${story}`}>📖 ✔</span>}
      <b>♾ {n(done)}</b>
      <span className="endless-pips">
        {Array.from({ length: ENDLESS_PAY.bucksEvery }, (_, i) => {
          const k = i + 1
          const mark = k % ENDLESS_PAY.bucksEvery === 0 ? '💎' : k % ENDLESS_PAY.partsEvery === 0 ? '⚙' : null
          return <i key={i} className={(i < at ? 'on' : '') + (mark ? ' mark' : '')}>{mark}</i>
        })}
      </span>
    </div>
  )
}

function EndlessRow({ g }: { g: EndlessGoal }) {
  const s = useGame()
  const now = useNow()
  const have = endlessHave(endlessTown(s), g)
  const done = endlessReady(s, g)
  const pay = endlessPay((s.endless?.n ?? 0) + 1, s.level)
  const xp = endlessXp(s.level)
  return (
    <Row icon={<EndlessIcon g={g} />} text={endlessText(g, s.cars)} have={have} target={g.n} done={done}
      wait={endlessCapped(s.endless, now) ? left(msToNextDay(now)) : undefined}
      onGo={() => goToEndless(g)} onClaim={() => s.claimEndless(g.k)} pay={{ coins: pay.coins, xp, parts: pay.parts, bucks: pay.bucks }} exactXp>
      <Reward coins={pay.coins} exactXp={xp} parts={pay.parts} bucks={pay.bucks} />
    </Row>
  )
}

function Tasks({ period }: { period: Period }) {
  const s = useGame()
  const now = useNow()
  const slots = periodSlots(s.quests, period)
  const done = periodDone(s.quests, period)
  const pay = payAt(QUEST_PAY[period].task, s.level)
  const chest = QUEST_PAY[period].chest
  const chestPay = payAt(chest, s.level)
  const opened = chestOpened(s.quests, period)
  const ready = done.length >= TASKS_PER_PERIOD && !opened
  return (
    <>
      <div className="goal-head">
        <span>{period === 'daily' ? 'New tasks' : 'New week'} in {left(period === 'daily' ? msToNextDay(now) : msToNextWeek(now))}</span>
      </div>
      <div className="goals">
        {slots.map((t) => {
          const d = taskDef(period, t.id)
          if (!d) return null
          return (
            <Row key={t.id} icon={d.icon} text={taskText(period, t)} have={taskProgress(s, period, t)} target={t.n}
              done={taskProgress(s, period, t) >= t.n} claimed={done.includes(t.id)}
              onGo={() => goTo(d.stat)} onClaim={() => s.claimTask(period, t.id)} pay={{ coins: pay.coins, xp: pay.xp }}>
              <Reward coins={pay.coins} xp={pay.xp} stars={period === 'daily' ? SEASON_STARS.dailyTask : SEASON_STARS.weeklyTask} />
            </Row>
          )
        })}
      </div>
      <div className={`chest${ready ? ' ready' : ''}${opened ? ' opened' : ''}`}>
        <span className="chest-icon">{opened ? '📭' : period === 'daily' ? '🎁' : '💎'}</span>
        <div className="chest-main">
          <b>{period === 'daily' ? 'Daily chest' : 'Weekly chest'}</b>
          <div className="chest-pips">{Array.from({ length: TASKS_PER_PERIOD }, (_, i) => <i key={i} className={i < done.length ? 'on' : ''} />)}</div>
          <Reward coins={chestPay.coins} exactXp={chestXp(period, s.level)} bucks={chest.bucks} parts={chest.parts} stars={period === 'daily' ? SEASON_STARS.dailyChest : SEASON_STARS.weeklyChest} />
        </div>
        {opened ? <span className="goal-check">✔</span> : <button className="buy small" disabled={!ready} onClick={(e) => { openChestFx(e.currentTarget, { coins: chestPay.coins, parts: chest.parts, bucks: chest.bucks, xp: chestXp(period, s.level) }); s.claimChest(period) }}>{ready ? 'Open' : '🔒'}</button>}
      </div>
      {period === 'weekly' && <CrewGoalMini />}
    </>
  )
}

// Limited-time goals for the running event, with a countdown to its end.
function EventGoals() {
  const s = useGame()
  const now = useNow()
  const e = activeEvent(now)
  if (!e) return <p className="hint">No event is running right now.</p>
  const goals = eventGoals(now)
  return (
    <>
      <div className="goal-head event">
        <span>{e.icon} {e.name} ends in {left(eventEndsAt(e, now) - now)}</span>
      </div>
      <div className="goals">
        {goals.map((g: GoalDef) => {
          const claimed = s.claimedGoals.includes(g.id)
          const locked = s.level < (g.level ?? 1)
          return (
            <Row key={g.id} icon={g.icon} text={locked ? `${g.text} (level ${g.level})` : g.text} have={statValue(s, g.stat, g.def)} target={g.target}
              done={!locked && goalDone(s, g)} claimed={claimed}
              onGo={() => goTo(g.stat, g.def)} onClaim={() => s.claimGoal(g.id)} pay={{ coins: g.coins, xp: g.xp, bucks: g.bucks }}>
              <Reward coins={g.coins} xp={g.xp} bucks={g.bucks} />
            </Row>
          )
        })}
      </div>
    </>
  )
}

type GoalsTab = 'story' | 'event' | Period
let lastGoalsTab: GoalsTab | null = null

export function GoalsPanel() {
  const s = useGame()
  // Opens on the first tab with something to collect, else where it was left.
  const ev = activeEvent()
  const eventDot = eventGoals().filter((g) => goalOpen(s, g) && goalDone(s, g)).length
  const [tab, setTabState] = useState<GoalsTab>(() => {
    const has = (p: Period) => periodSlots(s.quests, p).some((t) => !periodDone(s.quests, p).includes(t.id) && taskProgress(s, p, t) >= t.n)
      || (periodDone(s.quests, p).length >= TASKS_PER_PERIOD && !chestOpened(s.quests, p))
    if (activeGoals(s).some((g) => goalDone(s, g)) || (!endlessCapped(s.endless) && activeEndless(s).some((g) => endlessReady(s, g)))) return 'story'
    if (eventDot) return 'event'
    if (has('daily')) return 'daily'
    if (has('weekly')) return 'weekly'
    return lastGoalsTab === 'event' && !ev ? 'story' : lastGoalsTab ?? 'story'
  })
  const setTab = (t: GoalsTab) => { lastGoalsTab = t; setTabState(t) }
  const dot = (p: Period) => {
    const done = periodDone(s.quests, p)
    const c = periodSlots(s.quests, p).filter((t) => !done.includes(t.id) && taskProgress(s, p, t) >= t.n).length + (done.length >= TASKS_PER_PERIOD && !chestOpened(s.quests, p) ? 1 : 0)
    return c ? <span className="tab-dot">{c}</span> : null
  }
  const storyDot = activeGoals(s).filter((g) => goalDone(s, g)).length + (endlessCapped(s.endless) ? 0 : activeEndless(s).filter((g) => endlessReady(s, g)).length)
  return (
    <Panel title="Goals">
      <SheetTabs value={tab} onChange={setTab} items={[
        { id: 'story', label: <>📋 Goals{storyDot ? <span className="tab-dot">{storyDot}</span> : null}</> },
        { id: 'daily', label: <>☀️ Daily{dot('daily')}</> },
        { id: 'weekly', label: <>📅 Weekly{dot('weekly')}</> },
        ...(ev ? [{ id: 'event' as const, label: <>{ev.icon} Event{eventDot ? <span className="tab-dot">{eventDot}</span> : null}</> }] : []),
      ]} />
      {tab === 'story' ? <StoryGoals /> : tab === 'event' ? <EventGoals /> : <Tasks key={tab} period={tab} />}
    </Panel>
  )
}

// The next story goal, pinned under the HUD so there's always a clear next step.
export function GoalTracker() {
  const s = useGame()
  // A finished goal shows first, so the tracker turns green when there's something to collect.
  // Endless goals count too, so the tracker never runs out once the story does.
  const capped = endlessCapped(s.endless)
  const rows = [
    ...activeGoals(s).map((g) => ({ icon: g.icon, text: g.text, have: statValue(s, g.stat, g.def), target: g.target, go: () => goTo(g.stat, g.def), ready: true })),
    ...activeEndless(s).map((g) => ({ icon: KINDS[g.kind]?.icon ?? '♾', text: endlessText(g, s.cars), have: endlessHave(endlessTown(s), g), target: g.n, go: () => goToEndless(g), ready: !capped })),
  ]
  const g = rows.find((o) => o.ready && o.have >= o.target) ?? rows.find((o) => o.have < o.target) ?? rows[0]
  if (!g || s.visiting || s.mode !== 'play' || s.tutorial < 99) return null
  const have = Math.min(g.target, g.have)
  const done = have >= g.target
  return (
    <button className={done ? 'goal-tracker done' : 'goal-tracker'} onClick={() => (done ? s.openPanel('goals') : g.go())}>
      <span className="gt-icon">{done ? '✔' : g.icon}</span>
      <span className="gt-text">{g.text}</span>
      <span className="gt-bar"><i style={{ width: `${(have / g.target) * 100}%` }} /></span>
    </button>
  )
}

export function FlatPanel() {
  const s = useGame()
  const car = s.cars.find((c) => c.uid === s.selectedCar && (c.flat || c.lowFuel))
  if (!car) return null
  const d = carDef(car.model)
  const owns = (def: string) => s.buildings.some((b) => b.def === def)
  const hasRusty = owns('rescue')
  if (!car.flat) {
    return (
      <Panel title="Out of Gas!">
        <div className="need-car"><CarThumb size="sm" color={car.color} finish={car.finish} skin={car.skin} body={d.body} model={d.id} stripe={car.stripe} /><b>{d.name}</b></div>
        <div className="sources">
          <div className="source">
            <span className="source-icon">⛽</span>
            <div><b>Fill up at your Gas Station</b><div className="card-stat">{owns('gas') ? `+$${servicePay(s.level, 'gas')} · ⭐ ${xpGain(s.level, serviceXp('gas', s.level))} XP` : 'Earns on every fill-up'}</div></div>
            {owns('gas') ? <button className="buy small" onClick={() => s.serviceCar(car.uid, 'gas')}>Fill up · +${servicePay(s.level, 'gas')}</button> : <button className="buy small" onClick={() => s.openShop('gas')}>Build</button>}
          </div>
          <div className="source">
            <span className="source-icon">🛢</span>
            <div><b>Bring a gas can</b><div className="card-stat">Quick, but it costs you.</div></div>
            <button className="buy small alt" onClick={() => s.serviceCar(car.uid, 'can')}>Gas can · ${gasCanCost(s.level)}</button>
          </div>
        </div>
      </Panel>
    )
  }
  return (
    <Panel title="Flat Tire!">
      <div className="need-car"><CarThumb size="sm" color={car.color} finish={car.finish} skin={car.skin} body={d.body} model={d.id} stripe={car.stripe} /><b>{d.name}</b></div>
      <div className="sources">
        <div className="source">
          <span className="source-icon">🛞</span>
          <div><b>Send it to your Tire Shop</b><div className="card-stat">{owns('tires') ? `+$${servicePay(s.level, 'tires')} · ⭐ ${xpGain(s.level, serviceXp('tires', s.level))} XP` : s.level < 2 ? '🔒 Level 2' : 'Earns on every flat'}</div></div>
          {owns('tires') ? <button className="buy small" onClick={() => s.serviceCar(car.uid, 'tires')}>Fix · +${servicePay(s.level, 'tires')}</button> : s.level >= 2 ? <button className="buy small" onClick={() => s.openShop('tires')}>Build</button> : null}
        </div>
        <div className="source">
          <span className="source-icon">🔧</span>
          <div><b>Call Rusty's tow</b><div className="card-stat">{hasRusty ? `Free · ⭐ ${xpGain(s.level, serviceXp('tow', s.level))} XP` : "🔒 Needs Rusty's Rescue"}</div></div>
          <button className="buy small alt" onClick={() => s.fixFlat(car.uid, true)} disabled={!hasRusty}>Tow · free</button>
        </div>
        <div className="source">
          <span className="source-icon">💵</span>
          <div><b>Pay a mechanic</b><div className="card-stat">Fixed on the spot.</div></div>
          <button className="buy small alt" onClick={() => s.fixFlat(car.uid, false)}>Fix · ${flatFixCost(s.level)}</button>
        </div>
      </div>
    </Panel>
  )
}
