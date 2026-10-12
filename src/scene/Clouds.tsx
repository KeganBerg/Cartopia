import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, MeshLambertMaterial, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { dayPhase, nightAmount } from './dayNight'
import { weatherNow } from '../game/weather'

const cloudMat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dfefff', emissiveIntensity: 0.35, transparent: true, opacity: 0.6, depthWrite: false, flatShading: true })

// A few puffy clouds drifting high over the town. They never cast shadows
// (Atmosphere.tsx drifts broad cloud shadows over the town instead) or catch
// taps, and wrap around once they leave the map.
const SPAN = 70
const PUFFS = [
  [0, 0, 0, 1.6], [1.5, -0.2, 0.3, 1.2], [-1.4, -0.3, -0.2, 1.1], [0.6, 0.5, -0.6, 1.0], [-0.5, 0.4, 0.7, 0.9],
] as const

// Each cloud's puffs merged into one mesh: one draw per cloud.
let puffGeo: IcosahedronGeometry | null = null
function cloudGeo() {
  if (puffGeo) return puffGeo
  const parts = PUFFS.map(([x, y, z, r]) => new IcosahedronGeometry(r, 1).translate(x, y, z))
  puffGeo = mergeGeometries(parts) as IcosahedronGeometry
  parts.forEach((p) => p.dispose())
  return puffGeo
}

const WHITE = new Color('#ffffff')
const STORM = new Color('#8a939e')

export function Clouds() {
  const clouds = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({
      x: -SPAN / 2 + (i * SPAN) / 6 + (i % 2) * 4,
      z: ((i * 37) % 50) - 25,
      y: 18 + (i % 3) * 2,
      s: 0.5 + ((i * 13) % 5) / 12,
      v: 0.5 + (i % 3) * 0.25,
    })),
    [],
  )
  const refs = useRef<(Group | null)[]>([])
  useFrame((_, dt) => {
    const n = nightAmount(dayPhase())
    const w = weatherNow()
    // Rain clouds thicken and darken; wind hurries them along.
    cloudMat.color.copy(WHITE).lerp(STORM, w.cloud * (w.snow > 0 ? 0.4 : 1))
    cloudMat.opacity = 0.6 - n * 0.4 + w.cloud * 0.1
    cloudMat.emissiveIntensity = (0.35 - n * 0.3) * (1 - w.cloud * 0.8)
    const speed = 1 + w.wind * 3
    refs.current.forEach((g, i) => {
      if (!g) return
      g.position.x += clouds[i].v * speed * Math.min(dt, 0.1)
      if (g.position.x > SPAN / 2) g.position.x -= SPAN
    })
  })
  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh geometry={cloudGeo()} material={cloudMat} raycast={() => null} dispose={null} />
        </group>
      ))}
    </>
  )
}
