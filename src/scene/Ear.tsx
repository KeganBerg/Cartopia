import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { setEar } from '../lib/ambience'

// Tells the town sounds where things are on screen, so a honk from a car on
// the left comes from the left, and a spot scrolled off screen sounds further away.
const v = new Vector3()
export function Ear() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    // A spot behind the free camera projects mirrored, so it counts as off to the side.
    const behind = (x: number, z: number) => v.set(x, 0, z).applyMatrix4(camera.matrixWorldInverse).z > 0
    setEar(
      (x, z) => {
        if (behind(x, z)) return Math.sign(v.x) * 0.8
        return Math.max(-1, Math.min(1, v.set(x, 0, z).project(camera).x))
      },
      (x, z) => {
        if (behind(x, z)) return 0.4
        v.set(x, 0, z).project(camera)
        const off = Math.max(Math.abs(v.x), Math.abs(v.y))
        return off <= 1 ? 1 : Math.max(0.3, 1 - (off - 1) * 0.5)
      },
    )
  }, [camera])
  return null
}
