import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { carDef } from '../game/data'
import { CarPreview } from './CarPreview'
import { CarThumb } from './BuildingPreview'
import { Preview } from './Stage'

// The first menu with a car in it paid for the 3D behind it on the tap that opened it: the Cars
// page's turntable canvas and the thumbnail canvas were each made then, and the car's shaders
// compiled, the longest freezes in switching menus. A while after the town loads, with no menu
// open, the player's car goes on both out of sight, draws once, and goes; the canvases and their
// shaders are kept for the real menus.
export const WARM_AFTER = 7000

export function WarmPreview() {
  const [on, setOn] = useState(false)
  const [done, setDone] = useState(false)
  const ready = Preview.useStageReady()
  useEffect(() => {
    let idle = 0
    const t = setTimeout(() => {
      const go = () => setOn(true)
      if ('requestIdleCallback' in window) idle = requestIdleCallback(go, { timeout: 3000 })
      else go()
    }, WARM_AFTER)
    return () => {
      clearTimeout(t)
      if (idle) cancelIdleCallback(idle)
    }
  }, [])
  useEffect(() => {
    if (!on || !ready) return
    // Two frames: one to draw, one for the thumbnail copy.
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setDone(true))))
    return () => cancelAnimationFrame(id)
  }, [on, ready])
  const car = useGame((s) => s.cars.find((c) => c.uid === s.selectedCar) ?? s.cars[0])
  const panel = useGame((s) => s.panel)
  if (!on || done || !car || panel) return null
  const d = carDef(car.model)
  const look = { body: d.body, model: d.id, color: car.color, finish: car.finish ?? 'gloss', stripe: car.stripe ?? null, skin: car.skin, modSkin: car.modSkin, panels: car.panels, trim: car.trim, mods: car.mods, hat: car.hat }
  return (
    <div className="warm-preview" aria-hidden="true" style={{ position: 'fixed', left: 0, top: 0, width: 8, height: 8, opacity: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: -1 }}>
      <CarThumb size="xs" {...look} />
      <CarPreview {...look} />
    </div>
  )
}
