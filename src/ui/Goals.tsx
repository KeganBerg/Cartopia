import { useEffect, useState } from 'react'
import {
  useGame, activeGoals, eventGoals, goalOpen, goalDone, statValue, today, claimable, taskDef, taskText, taskProgress, periodSlots, periodDone, chestOpened,
  type Period, type GameState,
} from '../game/store'
import {
  DAILY_BONUS, GOALS, QUEST_PAY, TASKS_PER_PERIOD, payAt, msToNextDay, msToNextWeek, buildingDef, buildingLevel, upgradable, MAX_BUILDING_LEVEL,
  carDef, takesDriver, SEASON_STARS, activeEvent, eventEndsAt, plotPrice, START_LAND, type StatKey, type GoalDef, flatFixCost, servicePay, gasCanCost,
} from '../game/data'
import { Panel, SheetTabs, openGarageTab } from './Menus'
import { openRaceTab } from './Race'
import { useNow } from '../scene/useNow'
import { Icon } from './Icon'
import { CrewGoalMini } from './CrewGoal'

export function GoalsButton() {
  const ready = useGame(claimable)
  return (
    <button className="goals-btn" onClick={() => useGame.getState().openPanel('goals')} title="Goals">
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
      return s.buildings.some((b) => upgradable(buildingDef(b.def)) && buildingLevel(b) < MAX_BUILDING_LEVEL) ? s.openShop('upgrades') : s.openPanel('garage')
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

const n = (v: number) => v.toLocaleString()
const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000))
  return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
function Reward({ coins, xp, bucks, parts, stars }: { coins: number; xp?: number; bucks?: number; parts?: number; stars?: number }) {
  return (
    <span className="goal-pay">
      <i className="coin-ico ico">$</i>{n(coins)}
      {!!bucks && <><i className="buck-ico ico">B</i>{bucks}</>}
      {!!parts && <><i className="parts-ico ico">⚙</i>{parts}</>}
      {!!xp && <b>+{n(xp)} XP</b>}
      {!!stars && <b className="star-pay">+{stars} ⭐</b>}
    </span>
  )
}

function Row({ icon, text, have, target, done, claimed, onGo, onClaim, children }: {
  icon: string; text: string; have: number; target: number; done: boolean; claimed?: boolean; onGo: () => void; onClaim: () => void; children: React.ReactNode
}) {
  return (
    <div className={claimed ? 'goal claimed' : done ? 'goal done' : 'goal'}>
      <span className="goal-icon">{icon}</span>
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
        : done
          ? <button className="buy small" onClick={onClaim}>Collect</button>
          : <button className="buy small alt" onClick={onGo}>Go ›</button>}
    </div>
  )
}

function StoryGoals() {
  const s = useGame()
  const goals = activeGoals(s)
  const total = GOALS.length
  const claimed = s.claimedGoals.filter((id) => GOALS.some((g) => g.id === id)).length
  const next = GOALS.find((g) => !s.claimedGoals.includes(g.id) && s.level < (g.level ?? 1))
  return (
    <>
      <div className="goal-head">
        <span>Story {claimed}/{total}</span>
        <div className="bar"><span style={{ width: `${(claimed / total) * 100}%` }} /></div>
      </div>
      {goals.length === 0 && <p className="hint">{next ? `More goals unlock at level ${next.level}.` : "You've finished every story goal. Daily and weekly tasks keep coming!"}</p>}
      <div className="goals">
        {goals.map((g: GoalDef) => (
          <Row key={g.id} icon={g.icon} text={g.text} have={statValue(s, g.stat, g.def)} target={g.target} done={goalDone(s, g)}
            onGo={() => goTo(g.stat, g.def)} onClaim={() => s.claimGoal(g.id)}>
            <Reward coins={g.coins} xp={g.xp} bucks={g.bucks} />
          </Row>
        ))}
      </div>
    </>
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
              onGo={() => goTo(d.stat)} onClaim={() => s.claimTask(period, t.id)}>
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
          <Reward coins={chestPay.coins} bucks={chest.bucks} parts={chest.parts} stars={period === 'daily' ? SEASON_STARS.dailyChest : SEASON_STARS.weeklyChest} />
        </div>
        {opened ? <span className="goal-check">✔</span> : <button className="buy small" disabled={!ready} onClick={() => s.claimChest(period)}>{ready ? 'Open' : '🔒'}</button>}
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
              onGo={() => goTo(g.stat, g.def)} onClaim={() => s.claimGoal(g.id)}>
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
    if (activeGoals(s).some((g) => goalDone(s, g))) return 'story'
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
  const storyDot = activeGoals(s).filter((g) => goalDone(s, g)).length
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
  const goals = activeGoals(s)
  const g = goals.find((o) => goalDone(s, o)) ?? goals[0]
  if (!g || s.visiting || s.mode !== 'play' || s.tutorial < 99) return null
  const have = Math.min(g.target, statValue(s, g.stat, g.def))
  const done = have >= g.target
  return (
    <button className={done ? 'goal-tracker done' : 'goal-tracker'} onClick={() => (done ? s.openPanel('goals') : goTo(g.stat, g.def))}>
      <span className="gt-icon">{done ? '✔' : g.icon}</span>
      <span className="gt-text">{g.text}</span>
      <span className="gt-bar"><i style={{ width: `${(have / g.target) * 100}%` }} /></span>
    </button>
  )
}

export function DailyPanel() {
  const streak = useGame((s) => s.dailyStreak)
  const last = useGame((s) => s.lastDaily)
  const claim = useGame((s) => s.claimDaily)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const day = last === yesterday ? streak + 1 : 1
  const claimed = last === today()
  // A cloud save can arrive already claimed for today: close instead of leaving an invisible panel.
  useEffect(() => { if (claimed) useGame.getState().openPanel(null) }, [claimed])
  if (claimed) return null
  return (
    <Panel title="Daily Bonus">
      <p className="hint">Come back every day for bigger rewards.</p>
      <div className="daily">
        {DAILY_BONUS.map((r, i) => (
          <div key={i} className={i + 1 === Math.min(day, DAILY_BONUS.length) ? 'day today' : i + 1 < day ? 'day past' : 'day'}>
            <small>Day {i + 1}</small>
            <b>${r.coins}</b>
            {r.fuel && <small>+{r.fuel} ⛽</small>}
            {r.parts && <small>+{r.parts} ⚙</small>}
            {r.bucks && <small>+B{r.bucks}</small>}
          </div>
        ))}
      </div>
      <button className="buy" onClick={claim}>Collect day {day}</button>
    </Panel>
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
        <p>Your <b>{d.name}</b> ran out of gas.</p>
        <div className="sources">
          <div className="source">
            <span className="source-icon">⛽</span>
            <div><b>Fill up at your Gas Station</b><div className="card-stat">{owns('gas') ? `Your station earns $${servicePay(s.level, 'gas')} and 8 XP.` : 'Build a Gas Station to earn money from every fill-up.'}</div></div>
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
      <p>Your <b>{d.name}</b> is stuck on the side of the road.</p>
      <div className="sources">
        <div className="source">
          <span className="source-icon">🛞</span>
          <div><b>Send it to your Tire Shop</b><div className="card-stat">{owns('tires') ? `Your shop earns $${servicePay(s.level, 'tires')} and 12 XP.` : s.level < 2 ? 'Tire Shops unlock at level 2 and earn money from every flat.' : 'Build a Tire Shop to earn money from every flat.'}</div></div>
          {owns('tires') ? <button className="buy small" onClick={() => s.serviceCar(car.uid, 'tires')}>Fix · +${servicePay(s.level, 'tires')}</button> : s.level >= 2 ? <button className="buy small" onClick={() => s.openShop('tires')}>Build</button> : null}
        </div>
        <div className="source">
          <span className="source-icon">🔧</span>
          <div><b>Call Rusty's tow</b><div className="card-stat">{hasRusty ? 'Free, plus 15 XP.' : "Build Rusty's Rescue to tow cars for free."}</div></div>
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
