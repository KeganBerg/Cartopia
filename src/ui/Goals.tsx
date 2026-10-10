import { useGame, activeGoals, goalDone, today } from '../game/store'
import { DAILY_BONUS, carDef, flatFixCost } from '../game/data'
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

export function GoalsPanel() {
  const s = useGame()
  const goals = activeGoals(s)
  return (
    <Panel title="Goals">
      {goals.length === 0 && <p className="hint">You've finished every goal. More coming soon!</p>}
      <div className="goals">
        {goals.map((g) => {
          const have = Math.min(g.target, s.stats[g.stat] ?? 0)
          const done = goalDone(s, g)
          return (
            <div key={g.id} className={done ? 'goal done' : 'goal'}>
              <div className="goal-main">
                <b>{g.text}</b>
                <div className="bar wide"><span style={{ width: `${(have / g.target) * 100}%` }} /></div>
                <small>{have.toLocaleString()} / {g.target.toLocaleString()} · Reward ${g.coins}{g.bucks ? ` + B${g.bucks}` : ''} + {g.xp} XP</small>
              </div>
              <button className="buy small" disabled={!done} onClick={() => s.claimGoal(g.id)}>{done ? 'Collect' : '...'}</button>
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
  if (last === today()) return null
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
  const car = s.cars.find((c) => c.uid === s.selectedCar && c.flat)
  if (!car) return null
  const d = carDef(car.model)
  const hasRusty = s.buildings.some((b) => b.def === 'rescue')
  return (
    <Panel title="Flat Tire!">
      <p>Your <b>{d.name}</b> is stuck on the side of the road.</p>
      <div className="row">
        <button className="buy" onClick={() => s.fixFlat(car.uid, false)}>Fix it · ${flatFixCost(s.level)}</button>
        <button className="buy alt" onClick={() => s.fixFlat(car.uid, true)} disabled={!hasRusty}>Call Rusty's tow · free</button>
      </div>
      {!hasRusty && <p className="hint">Build Rusty's Rescue (level 8) to tow cars for free and earn XP.</p>}
    </Panel>
  )
}
