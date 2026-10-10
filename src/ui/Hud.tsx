import { useGame, fuelCap } from '../game/store'
import { xpToNext, FUEL_REGEN_SECONDS } from '../game/data'
import { useNow } from '../scene/useNow'

const n = (v: number) => v.toLocaleString()

function Speedometer({ level, xp }: { level: number; xp: number }) {
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
    <div className="speedo" title={`${n(xp)} / ${n(need)} XP to level ${level + 1}`}>
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
        <circle cx="44" cy="44" r="5" fill="#eceff1" />
      </svg>
      <div className="speedo-level">{level}</div>
      <div className="speedo-xp">{n(xp)} XP</div>
    </div>
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
        <Speedometer level={s.level} xp={s.xp} />
        <div className="pills">
          <div className="pill"><span className="ico coin-ico">$</span>{n(s.coins)}</div>
          <div className="pill"><span className="ico buck-ico">B</span>{n(s.bucks)}</div>
          <div className="pill"><span className="ico parts-ico">⚙</span>{n(s.parts)}</div>
        </div>
      </div>
      <div className="hud-center">
        <div className="town-name">{s.townName}</div>
        <button className="my-cars" onClick={() => s.openPanel('garage')}>🚗 MY CARS: {s.cars.length}</button>
      </div>
      <div className="hud-right">
        <div className="fuel">
          <div className="fuel-bar">
            <div style={{ width: `${Math.min(100, (s.fuel / cap) * 100)}%` }} />
            <span>{s.fuel}/{cap}</span>
          </div>
          <span className="ico fuel-ico">⛽</span>
        </div>
        <div className="fuel-sub">{nextIn === null ? 'Fuel full' : `+1 fuel in ${nextIn}s`}</div>
        <div className="pill trophies">🏆 {s.trophies}</div>
      </div>
    </>
  )
}
