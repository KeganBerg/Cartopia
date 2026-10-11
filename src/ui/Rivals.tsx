import { useGame } from '../game/store'
import { CARS, RACE_FUEL, carDef, performance } from '../game/data'
import { RIVALS, RIVAL_VISITS, currentRival, rivalPi, rivalPrize, rivalShift, type RivalDef } from '../game/rivals'
import { CarThumb } from '../scene/BuildingPreview'
import { useNow } from '../scene/useNow'

const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const NONE = {}
const money = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`)

export type RivalMatch = { def: RivalDef; visit: number; prize: number; rival: { id: string; town: string; level: number; carName: string; color: string; pi: number; online: false; body: ReturnType<typeof carDef>['body']; skill?: ReturnType<typeof carDef>['skill']; shift: number; boss: boolean } }

// The race against this rival on this visit.
export function rivalMatch(def: RivalDef, visit: number, level: number): RivalMatch {
  const pi = rivalPi(def, visit)
  const car = [...CARS].sort((a, b) => Math.abs(performance(a, zero) - pi) - Math.abs(performance(b, zero) - pi))[0]
  const idx = RIVALS.indexOf(def)
  return {
    def, visit, prize: rivalPrize(pi),
    rival: {
      id: `rival-${def.id}`, town: `${def.icon} ${def.name}`, level: Math.max(level, def.unlockLevel), carName: car.name, color: def.color, pi,
      online: false, body: car.body, skill: idx >= 2 || visit === RIVAL_VISITS - 1 ? car.skill : undefined, shift: rivalShift(def, visit), boss: visit === RIVAL_VISITS - 1,
    },
  }
}

// True when a rival is in town waiting for you (drives the dot on the Race button).
export function useRivalWaiting() {
  const now = useNow(15000)
  return useGame((s) => {
    const c = currentRival(s.level, s.rivals ?? NONE, now)
    return !!c && !c.locked && !c.away
  })
}

function Pips({ n }: { n: number }) {
  return <span className="rv-pips" aria-label={`Beaten ${n} of ${RIVAL_VISITS}`}>{Array.from({ length: RIVAL_VISITS }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
}

// The town rival card at the top of the Quick race tab.
export function RivalCard({ onRace }: { onRace: (m: RivalMatch) => void }) {
  const now = useNow(1000)
  const level = useGame((s) => s.level)
  const progress = useGame((s) => s.rivals ?? NONE)
  const showNeed = useGame((s) => s.showNeed)
  const cur = currentRival(level, progress, now)
  if (!cur) return <div className="rv-card rv-done">🏆 <b>Town champ!</b> <small>No rival dares race you.</small></div>
  const { def, visit, locked, away } = cur
  const m = rivalMatch(def, visit, level)
  const left = Math.max(0, Math.ceil((away - now) / 60000))
  const line = locked ? `Rolls into town at level ${def.unlockLevel}.` : away ? `Tuning up. Back in ${left}m.` : visit === 0 ? def.lines.intro : def.lines.back[visit - 1]
  return (
    <div className={`rv-card${locked || away ? ' rv-idle' : ''}`} style={{ ['--rv' as string]: def.color }}>
      <span className="rv-face" aria-hidden>{locked ? '❔' : def.icon}</span>
      <div className="rv-body">
        <div className="rv-head">
          <span className="tag rv-tag">RIVAL</span>
          <b>{locked ? '???' : def.name}</b>
          {!locked && <Pips n={visit} />}
          <span className="rv-bonus" title={`Beat them ${RIVAL_VISITS} times for a one-time bonus`}>🏁×{RIVAL_VISITS}: ${money(def.coins)} <span className="ico buck-ico">B</span>{def.bucks} 🏆{def.trophies}</span>
        </div>
        <div className="rv-bubble">{line}</div>
        {!locked && !away && (
          <small className="rv-car"><CarThumb size="xs" color={m.rival.color} body={m.rival.body} /> {m.rival.carName} · PI {m.rival.pi}</small>
        )}
      </div>
      {locked ? (
        <button className="buy small alt" onClick={() => showNeed('level', def.unlockLevel, def.name)}>🔒 Lv{def.unlockLevel}</button>
      ) : away ? (
        <button className="buy small alt" disabled>⏱ {left}m</button>
      ) : (
        <button className="buy small" onClick={() => onRace(m)}>🏁 ${m.prize.toLocaleString()}<small>⛽{RACE_FUEL}</small></button>
      )}
    </div>
  )
}

export type RivalBonus = { coins: number; bucks: number; trophies: number } | null

// Result card for a rival race or a double-or-nothing rematch.
export function RivalResult({ match, won, bet, bonus, myTime, theirTime, onBet, onRetry, onExit }: {
  match: RivalMatch; won: boolean; bet: boolean; bonus: RivalBonus; myTime: number; theirTime: number; onBet: () => void; onRetry: () => void; onExit: () => void
}) {
  const { def, prize } = match
  const quit = !!bonus
  const line = bet ? (won ? def.lines.betLost : def.lines.betWon) : won ? (quit ? def.lines.quit : def.lines.sore) : def.lines.gloat
  // A rematch is offered after a win, unless they just quit.
  const offer = won && !bet && !quit
  return (
    <div className={won ? 'rr win' : 'rr lose'}>
      {won && <div className="rr-rays" />}
      <div className="rr-card rv-result">
        <div className="rr-icon">{def.icon}</div>
        <h3 className="rr-title">{won ? (quit ? 'RIVAL BEATEN!' : 'YOU WIN!') : bet ? 'BUSTED!' : 'BEATEN!'}</h3>
        <div className="rv-bubble big">{line}</div>
        <p className="rr-note">{myTime.toFixed(2)}s vs {Number.isFinite(theirTime) ? `${theirTime.toFixed(2)}s` : 'DNF'}</p>
        <div className="rr-loot">
          {bet ? <span>{won ? `💵 +$${prize.toLocaleString()}` : `💸 −$${prize.toLocaleString()}`}</span>
            : <span>💵 +${(won ? prize : Math.round(prize * 0.1)).toLocaleString()}</span>}
          {bonus && <span style={{ animationDelay: '.3s' }}>💰 +${bonus.coins.toLocaleString()}</span>}
          {bonus && <span style={{ animationDelay: '.45s' }}><span className="ico buck-ico">B</span> +{bonus.bucks}</span>}
          {bonus && <span style={{ animationDelay: '.6s' }}>🏆 +{bonus.trophies + 1}</span>}
        </div>
        {offer ? (
          <>
            <div className="rv-bet-q">“{def.lines.bet}”</div>
            <div className="row rv-row">
              <button className="buy alt" onClick={onExit}>Keep ${prize.toLocaleString()}</button>
              <button className="buy rv-bet" onClick={onBet}>🎲 Double or nothing</button>
            </div>
          </>
        ) : !won && !bet ? (
          <div className="row rv-row">
            <button className="buy alt" onClick={onExit}>Back</button>
            <button className="buy" onClick={onRetry}>↻ Rematch · ⛽{RACE_FUEL}</button>
          </div>
        ) : (
          <button className="buy rr-go" onClick={onExit}>{won ? 'Collect' : 'Back'}</button>
        )}
      </div>
    </div>
  )
}
