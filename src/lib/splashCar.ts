import { useGame } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { runSkinPaint } from './skinPaint'

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
    const v = c ? JSON.stringify({ model: c.model, color: c.color, ...(c.skin ? { skin: c.skin } : {}) }) : ''
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

// The splash in index.html paints the car before any code arrives, so it can only
// tint it. Once the game's code is here, this puts the car's animated skin on it
// for the rest of the splash, and drops it when the splash goes.
export function skinSplashCar() {
  let c: { color?: string; skin?: string } = {}
  try {
    c = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    return
  }
  const paint = document.querySelector<HTMLElement>('#splash .car .paint')
  if (!c.skin || !paint || paint.parentElement?.querySelector('canvas')) return
  const canvas = document.createElement('canvas')
  canvas.className = 'paint skin'
  canvas.dataset.skin = c.skin
  const mask = paint.style.maskImage || paint.style.webkitMaskImage
  Object.assign(canvas.style, { width: '100%', height: '100%', maskImage: mask, webkitMaskImage: mask })
  paint.after(canvas)
  const stop = runSkinPaint(canvas, c.skin, c.color ?? '#d32f2f')
  if (!stop) return canvas.remove()
  paint.style.opacity = '0'
  const gone = setInterval(() => {
    if (canvas.isConnected) return
    clearInterval(gone)
    stop()
  }, 500)
}
