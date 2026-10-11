import { useGame } from '../game/store'
import { raceCarOf } from '../game/raceCar'

// The loading screen shows the player's race car in their paint. It runs before
// the game's code loads, so the car is kept in its own small key it can read.
const KEY = 'cartopia-splash-car'

export function rememberSplashCar() {
  let last = ''
  let seen: unknown[] = []
  const save = () => {
    const s = useGame.getState()
    if (s.visiting || (seen[0] === s.cars && seen[1] === s.raceCar)) return
    seen = [s.cars, s.raceCar]
    const c = raceCarOf(s.cars, s.raceCar)
    const v = c ? JSON.stringify({ model: c.model, color: c.color }) : ''
    if (!v || v === last) return
    last = v
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // Private mode or full storage: the splash falls back to the Hot Shot.
    }
  }
  save()
  return useGame.subscribe(save)
}
