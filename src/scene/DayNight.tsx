import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type DirectionalLight, type HemisphereLight } from 'three'
import { PAL } from './season'
import { applyNight, dayPhase, duskAmount, nightAmount } from './dayNight'

const SUN = new Color(PAL.sun)
const DUSK = new Color('#ffa463')
const MOON = new Color('#9fb4ff')
const SKY_DAY = new Color('#ffffff')
const SKY_NIGHT = new Color('#6274b8')
const GROUND_DAY = new Color('#6b8e4e')
const GROUND_NIGHT = new Color('#1f2a44')
const BG_DAY = new Color(PAL.ground)
const BG_NIGHT = new Color('#1b2f2a')

// Sun, sky light and background that follow the shared day/night clock.
export function DayNight({ small }: { small: boolean }) {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const last = useRef(-1)
  useFrame(({ scene }) => {
    const phase = dayPhase()
    const n = nightAmount(phase)
    const dusk = duskAmount(phase)
    // Nothing visible changes between frames most of the time.
    const key = Math.round(n * 400) + Math.round(dusk * 400) * 1000
    if (key === last.current) return
    last.current = key
    applyNight(n)
    if (sun.current) {
      sun.current.color.copy(SUN).lerp(MOON, n).lerp(DUSK, dusk * 0.8)
      sun.current.intensity = 1.6 - n * 1.15
    }
    if (hemi.current) {
      hemi.current.color.copy(SKY_DAY).lerp(SKY_NIGHT, n).lerp(DUSK, dusk * 0.3)
      hemi.current.groundColor.copy(GROUND_DAY).lerp(GROUND_NIGHT, n)
      hemi.current.intensity = 0.7 - n * 0.15
    }
    if (scene.background instanceof Color) scene.background.copy(BG_DAY).lerp(BG_NIGHT, n)
  })
  return (
    <>
      <color attach="background" args={[PAL.ground]} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#6b8e4e', 0.7]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[25, 40, 15]}
        intensity={1.6}
        shadow-mapSize={small ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
    </>
  )
}
