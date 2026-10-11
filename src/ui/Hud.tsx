import { useGame, fuelCap } from '../game/store'
import { xpToNext, FUEL_REGEN_SECONDS } from '../game/data'
import { useNow } from '../scene/useNow'
import { GoalsButton, GoalTracker } from './Goals'
import { MuteButton } from './MuteButton'
import { ChallengeBell } from './Race'

const n = (v: number) => v.toLocaleString()

// The level gauge doubles as the Menu button.
function Speedometer({ level, xp, onClick }: { level: number; xp: number; onClick: () => void }) {
  const need = xpToNext(level)
  const pct = Math.min(1, xp / need)
  // Needle sweeps 240 degrees, from -210 to 30.
  const angle = -210 + pct * 240
  const r = 34
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [44 + r * Math.cos((a * Math.PI) / 180), 44 + r * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
  }
  return (
    <button className="speedo" onClick={onClick} aria-label="Menu" title={`Menu · ${n(xp)} / ${n(need)} XP to level ${level + 1}`}>
      <svg viewBox="0 0 88 88" width="88" height="88">
        <circle cx="44" cy="44" r="42" fill="#1b1f24" stroke="#cfd8dc" strokeWidth="3" />
        <path d={arc(-210, 30)} stroke="#37474f" strokeWidth="7" fill="none" strokeLinecap="round" />
        {pct > 0.01 && <path d={arc(-210, angle)} stroke="#76ff03" strokeWidth="7" fill="none" strokeLinecap="round" />}
        <line
          x1="44" y1="44"
          x2={44 + 28 * Math.cos((angle * Math.PI) / 180)}
          y2={44 + 28 * Math.sin((angle * Math.PI) / 180)}
          stroke="#ff1744" strokeWidth="3" strokeLinecap="round"
        />
        <circle cx="44" cy="44" r="4" fill="#eceff1" />
      </svg>
      <div className="speedo-level">{level}</div>
      <div className="speedo-xp">{n(xp)} XP</div>
      <span className="speedo-menu" aria-hidden>☰</span>
    </button>
  )
}

export function Hud() {
  const s = useGame()
  const now = useNow()
  const cap = fuelCap(s)
  const nextIn = s.fuel >= cap ? null : Math.max(0, FUEL_REGEN_SECONDS - Math.floor((now - s.fuelUpdatedAt) / 1000))
  return (
    <>
      <div className="hud-left">
        <Speedometer level={s.level} xp={s.xp} onClick={() => s.openPanel('account')} />
        <div className="pills">
          <button className="pill" onClick={() => s.showNeed('coins', 0)}><span className="ico coin-ico">$</span>{n(s.coins)}<span className="plus">+</span></button>
          <button className="pill" onClick={() => s.openPanel('bank')}><span className="ico buck-ico">B</span>{n(s.bucks)}<span className="plus">+</span></button>
          <button className="pill" onClick={() => s.showNeed('parts', 0)}><span className="ico parts-ico">⚙</span>{n(s.parts)}<span className="plus">+</span></button>
        </div>
      </div>
      <div className="hud-center">
        <div className="town-name">{s.visiting?.townName ?? s.townName}</div>
        {!s.visiting && <button className="my-cars" onClick={() => s.openPanel('garage')}>🚗 <span className="my-cars-label">MY CARS:</span> {s.cars.length}</button>}
        <GoalTracker />
      </div>
      <div className="hud-right">
        <button className="fuel" onClick={() => s.showNeed('fuel', 0)}>
          <div className="fuel-bar">
            <div style={{ width: `${Math.min(100, (s.fuel / cap) * 100)}%` }} />
            <span>{s.fuel}/{cap}</span>
          </div>
          <span className="ico fuel-ico">⛽</span>
        </button>
        <div className="fuel-sub">{nextIn === null ? 'Fuel full' : `+1 fuel in ${nextIn}s`}</div>
        <div className="hud-right-row">
          <button className="pill trophies" title="Leaderboards" onClick={() => s.openPanel('leaders')}>🏆 {s.trophies}</button>
          <GoalsButton />
          <MuteButton />
        </div>
        <ChallengeBell />
      </div>
      {/* Phones: one compact strip across the top, town label under it. */}
      <div className="hud-mobile">
        <div className="hud-strip">
          <Speedometer level={s.level} xp={s.xp} onClick={() => s.openPanel('account')} />
          <div className="hud-chips">
            <button className="chip-stat" onClick={() => s.showNeed('coins', 0)}><span className="ico coin-ico">$</span>{n(s.coins)}</button>
            <button className="chip-stat" onClick={() => s.openPanel('bank')}><span className="ico buck-ico">B</span>{n(s.bucks)}</button>
            <button className="chip-stat" onClick={() => s.showNeed('parts', 0)}><span className="ico parts-ico">⚙</span>{n(s.parts)}</button>
            <button className="chip-stat chip-fuel" onClick={() => s.showNeed('fuel', 0)}>
              <span className="ico fuel-ico">⛽</span>
              <span className="chip-fuel-bar"><i style={{ width: `${Math.min(100, (s.fuel / cap) * 100)}%` }} /><b>{s.fuel}/{cap}</b></span>
            </button>
          </div>
          <div className="hud-actions">
            <GoalsButton />
            <ChallengeBell />
          </div>
        </div>
        <div className="hud-town">
          <span className="hud-town-name">{s.visiting?.townName ?? s.townName}</span>
          {!s.visiting && <button onClick={() => s.openPanel('garage')}>🚗 {s.cars.length}</button>}
          <button onClick={() => s.openPanel('leaders')}>🏆 {s.trophies}</button>
        </div>
        <GoalTracker />
      </div>
    </>
  )
}
