import { forwardRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MapControls as Controls } from 'three-stdlib'
import type { TOUCH } from 'three'

// drei's MapControls, minus one thing: it asked for a new frame on every camera nudge, and
// with damping a pan or scroll nudges the camera every screen refresh, so a 240 Hz monitor
// drew the whole town 240 times a second while it glided. The town's FrameCap already draws
// a steady frame rate, and these controls update at the start of each of those frames.
type Props = {
  enabled: boolean
  enableRotate: boolean
  minZoom: number
  maxZoom: number
  screenSpacePanning: boolean
  touches: { ONE: TOUCH; TWO: TOUCH }
}

export const TownControls = forwardRef<Controls, Props>(function TownControls(props, ref) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const events = useThree((s) => s.events)
  const set = useThree((s) => s.set)
  const get = useThree((s) => s.get)
  const dom = (events.connected as HTMLElement | undefined) || gl.domElement
  const controls = useMemo(() => new Controls(camera), [camera])
  useEffect(() => {
    controls.connect(dom)
    return () => controls.dispose()
  }, [controls, dom])
  useEffect(() => {
    const old = get().controls
    set({ controls })
    return () => set({ controls: old })
  }, [controls, get, set])
  useFrame(() => controls.update(), -1)
  return <primitive ref={ref} object={controls} enableDamping {...props} />
})
