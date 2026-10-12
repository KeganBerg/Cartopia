import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import { applyNight, dayPhase, glowMats, nightAmount } from './dayNight'
import { clubLedColor } from './clubLeds'
import { technoBeat, technoOn } from '../game/techno'
import { calmFlashing } from '../game/flashing'
import { weatherNow } from '../game/weather'
import { gloomOf } from './weatherLook'

// Techno Night in the town: every street lamp, the pools of light under them,
// the neon and the dance floor flash the club's colour on every kick (the club
// windows and the Vanguard Tower's penthouse already follow it through
// clubLeds.ts). Afterwards the lamps go back to their warm white.
const BULB = glowMats.bulb.emissive.clone()
const POOL = glowMats.pool.color.clone()
const tint = new Color()

export function TechnoLights() {
  const was = useRef(false)
  useFrame(() => {
    const on = technoOn()
    if (!on) {
      if (was.current) {
        was.current = false
        glowMats.bulb.emissive.copy(BULB)
        glowMats.pool.color.copy(POOL)
        applyNight(nightAmount(dayPhase()), gloomOf(weatherNow()))
      }
      return
    }
    was.current = true
    const b = technoBeat()
    const n = nightAmount(dayPhase())
    // Reduce flashing holds the lamps at a steady glow instead of hitting on the kick.
    const hit = calmFlashing() ? 0.25 : Math.max(b.kick, b.drop)
    clubLedColor(tint)
    glowMats.bulb.emissive.copy(tint).lerp(BULB, 0.15)
    glowMats.bulb.emissiveIntensity = 0.2 + n * (1.2 + 2.4 * hit)
    glowMats.pool.color.copy(tint)
    glowMats.pool.opacity = n * (0.35 + 0.6 * hit)
    glowMats.pool.visible = glowMats.pool.opacity > 0.01
    for (const m of [glowMats.neonPink, glowMats.neonCyan, glowMats.neonViolet]) m.emissiveIntensity = 0.05 + n * (1 + 1.8 * hit)
    glowMats.danceFloor.emissiveIntensity = n * (0.8 + 1.6 * hit)
  })
  return null
}
