import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// Draws a 'demand' canvas at most about `fps` times a second (Infinity: every screen refresh).
// Left to the screen, a 120, 144 or 240 Hz monitor drew the town that many times a second
// for no visible gain, and kept its CPU and GPU busy.
export function FrameCap({ fps, paused }: { fps: number; paused: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (paused) return
    const due = frameGate(fps)
    let id = requestAnimationFrame(function step(t) {
      id = requestAnimationFrame(step)
      if (due(t)) invalidate()
    })
    return () => cancelAnimationFrame(id)
  }, [invalidate, fps, paused])
  return null
}

// Whether the screen refresh at time `t` (ms) should draw. A little under the gap, so a
// 60 Hz screen still gets every frame, 144 Hz every other and 240 Hz every fourth.
export function frameGate(fps: number) {
  const gap = 800 / fps
  let last = -Infinity
  return (t: number) => {
    if (t - last < gap) return false
    last = t
    return true
  }
}

// A mouse and a big screen: a desktop, where a fast monitor is worth feeding while the view moves.
export const isDesktop = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches

// The town's frame rate: battery saver 30, auto follows its pace, otherwise 60. Flying the
// free camera on a desktop at full or auto-best quality runs at the monitor's own rate.
export function townFps(graphics: 'auto' | 'high' | 'saver', paceFps: number, best: boolean, free: boolean, desktop: boolean) {
  if (graphics === 'saver') return 30
  if (free && desktop && (graphics === 'high' || best)) return Infinity
  return graphics === 'auto' ? paceFps : 60
}
