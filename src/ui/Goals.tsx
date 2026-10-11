import { useEffect } from 'react'
import { useGame, activeGoals, goalDone, statValue, today } from '../game/store'
import { DAILY_BONUS, buildingDef, buildingLevel, upgradable, MAX_BUILDING_LEVEL, carDef, type StatKey, flatFixCost, servicePay, gasCanCost } from '../game/data'
import { Panel } from './Menus'

export function GoalsButton() {
  const s = useGame()
  const goals = activeGoals(s)
  const done = goals.filter((g) => goalDone(s, g)).length
  return (
    <button className="goals-btn" onClick={() => s.openPanel('goals')} title="Goals">
      📋{done > 0 && <span className="goal-badge">✔</span>}
    </button>
  )
}

// Take the player to where a goal gets done.
function goTo(stat: StatKey): void {
  const s = useGame.getState()
  const jobDefs = [...new Set(s.buildings.filter((b) => buildingDef(b.def).jobSeconds && buildingDef(b.def).kind !== 'obstacle').map((b) => b.def))]
  const jobs = () => s.showMe(jobDefs, 'Tap the flashing bubbles to run jobs and collect coins.')
  switch (stat) {
    case 'rusty': {
      if (s.buildings.some((b) => b.def === 'rescue')) return s.openPanel('rescue')
      const price = buildingDef('rescue').price
      if (s.coins < price) return s.showNeed('coins', price - s.coins, "Rusty's Rescue")
      return s.openShop('rescue')
    }
    case 'searches':
    case 'rescued':
      return s.buildings.some((b) => b.def === 'rescue') ? s.openPanel('rescue') : goTo('rusty')
    case 'jobs':
    case 'coinsEarned':
      return jobs()
    case 'roads':
      s.setMode('road')
      return s.toast('Drag on empty grass to lay road')
    case 'carsBought':
      return s.openPanel('showroom')
    case 'racesWon':
    case 'gpWins':
      return s.openPanel('race')
    case 'upgrades':
      // Building upgrades count too; the Shop lists them when there's one to do.
      return s.openPanel(s.buildings.some((b) => upgradable(buildingDef(b.def)) && buildingLevel(b) < MAX_BUILDING_LEVEL) ? 'shop' : 'garage')
    case 'built':
      return s.openPanel('shop')
    case 'flatsFixed': {
      const flat = s.cars.find((c) => c.flat)
      if (flat) {
        s.selectCar(flat.uid)
        return s.openPanel('flat')
      }
      return s.showMe(jobDefs, 'Cars sometimes get flats on jobs. Run a few and watch for the 🛞 bubble.')
    }
  }
}

export function GoalsPanel() {
  const s = useGame()
  const goals = activeGoals(s)
  return (
    <Panel title="Goals">
      {goals.length === 0 && <p className="hint">You've finished every goal. More coming soon!</p>}
      <div className="goals">
        {goals.map((g) => {
          const have = Math.min(g.target, statValue(s, g.stat))
          const done = goalDone(s, g)
          return (
            <div key={g.id} className={done ? 'goal done' : 'goal'}>
              <div className="goal-main" role="button" onClick={() => !done && goTo(g.stat)}>
                <b>{g.text}</b>
                <div className="bar wide"><span style={{ width: `${(have / g.target) * 100}%` }} /></div>
                <small>{have.toLocaleString()} / {g.target.toLocaleString()} · Reward ${g.coins}{g.bucks ? ` + B${g.bucks}` : ''} + {g.xp} XP</small>
              </div>
              {done
                ? <button className="buy small" onClick={() => s.claimGoal(g.id)}>Collect</button>
                : <button className="buy small alt" onClick={() => goTo(g.stat)}>Go ›</button>}
            </div>
          )
        })}
      </div>
    </Panel>
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
