import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type DirectionalLight, type HemisphereLight } from 'three'
import { PAL } from './season'
import { setPageTint } from './pageTint'
import { applyNight, dayPhase, duskAmount, nightAmount } from './dayNight'
import { fxState, gradeColor, lightDir, lookFor, townLook } from './look'
import { weatherNow } from '../game/weather'
import { gloomOf, hazeColor, weatherLook } from './weatherLook'

const BG_DAY = new Color(PAL.ground)
const BG_NIGHT = new Color('#1b1d38')
const BG_DUSK = new Color('#7a6a52')
const page = new Color()
const haze = new Color()

// Sun, sky light and background that follow the shared day/night clock.
// Colours come from the shared look (look.ts), which also drives the grade.
export function DayNight({ small }: { small: boolean }) {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const last = useRef(-1)
  useFrame(({ scene }) => {
    const phase = dayPhase()
    const n = nightAmount(phase)
    const dusk = duskAmount(phase)
    const w = weatherNow()
    // Nothing visible changes between frames most of the time.
    const key = Math.round(phase * 2000) + (fxState.on ? 0 : 1e4) + Math.round(w.cloud * 200) * 1e5 + Math.round(w.haze * 200) * 1e8 + Math.round(w.flash * 100) * 1e11
    if (key === last.current) return
    last.current = key
    applyNight(n, gloomOf(w))
    const look = weatherLook(lookFor(n, dusk, townLook), w)
    scene.environmentIntensity = look.env
    if (sun.current) {
      sun.current.color.copy(look.sun)
      sun.current.intensity = look.sunIntensity
      lightDir(phase, n, sun.current.position).multiplyScalar(50)
    }
    if (hemi.current) {
      hemi.current.color.copy(look.sky)
      hemi.current.groundColor.copy(look.ground)
      hemi.current.intensity = look.hemiIntensity
    }
    if (scene.background instanceof Color) {
      scene.background.copy(BG_DAY).lerp(BG_NIGHT, n).lerp(BG_DUSK, dusk * 0.25)
      if (w.haze > 0) scene.background.lerp(hazeColor(haze, w, n), w.haze * 0.8)
      // The phone status bar sits at the top edge, so match the graded colour there.
      page.copy(scene.background)
      setPageTint(fxState.on ? gradeColor(page, look.grade) : page)
    }
  })
  return (
    <>
      <color attach="background" args={[PAL.ground]} />
      <hemisphereLight ref={hemi} args={['#cfe6ff', '#7a9a55', 0.75]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[25, 40, 15]}
        intensity={1.85}
        shadow-mapSize={small ? [1024, 1024] : [2048, 2048]}
        // A wider filter softens shadow edges for free (same number of taps).
        shadow-radius={small ? 2 : 3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
    </>
  )
}
