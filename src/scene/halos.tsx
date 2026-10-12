import { useEffect, useRef } from 'react'
import type { Object3D } from 'three'

// Lamp heads that glow through mist and fog at night. Each lamp drops a marker
// at its bulb; Atmosphere.tsx draws every marker in its own scene as one batch of
// soft halos. Markers in other canvases (building previews) are skipped there.
export const haloSpots = new Set<Object3D>()
export const haloVersion = { n: 0 }

export function HaloSpot({ at, size = 1 }: { at: [number, number, number]; size?: number }) {
  const ref = useRef<Object3D>(null)
  useEffect(() => {
    const o = ref.current
    if (!o) return
    o.userData.halo = size
    haloSpots.add(o)
    haloVersion.n++
    return () => {
      haloSpots.delete(o)
      haloVersion.n++
    }
  }, [size])
  return <object3D ref={ref} position={at} />
}
