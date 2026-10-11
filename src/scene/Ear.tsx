import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { setEar } from '../lib/ambience'

// Tells the town sounds where things are on screen, so a honk from a car on
// the left comes from the left.
const v = new Vector3()
export function Ear() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    setEar((x, z) => Math.max(-1, Math.min(1, v.set(x, 0, z).project(camera).x)))
  }, [camera])
  return null
}
