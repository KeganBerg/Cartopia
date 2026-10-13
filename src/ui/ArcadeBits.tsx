import { useEffect, useState } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { carDef, performance } from '../game/data'
import { ARCADE_FUEL } from '../game/arcade'
import type { ChaseCar } from '../scene/ChaseScene'
import { sfx } from '../lib/sound'

// Pieces every arcade game screen shares: fuel, the 3-2-1, and the result card.

export const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)
export const look = (c: OwnedCar): ChaseCar => ({ body: carDef(c.model).body, model: c.model, color: c.color, finish: c.finish, skin: c.skin, modSkin: c.modSkin, panels: c.panels, mods: c.mods, trim: c.trim, hat: c.hat })

// Every run costs a little fuel, like a race.
export function payFuel(what: string) {
  if (spendFuel(ARCADE_FUEL)) return true
  const s = useGame.getState()
  s.showNeed('fuel', ARCADE_FUEL - s.fuel, what)
  return false
}

export function Countdown({ onGo }: { onGo: () => void }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    sfx.countdown(n === 0)
    if (n === 0) {
      onGo()
      const id = setTimeout(() => setN(-1), 600)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => setN(n - 1), 650)
    return () => clearTimeout(id)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  if (n < 0) return null
  return <div key={n} className="arc-count">{n === 0 ? 'GO!' : n}</div>
}

export function Result({ win, title, children, actions }: { win: boolean; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className={win ? 'rr win' : 'rr lose'}>
      <div className="arc-result">
        <h2>{title}</h2>
        {children}
        <div className="arc-actions">{actions}</div>
      </div>
    </div>
  )
}
