import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { warmShaders } from './warm'

// Opening the game used to build every one of the town's ~60 shaders on its first frame, one
// after another, while the browser's graphics process waited on each. That process also draws
// the page itself, so the loading screen froze and the whole browser (worse on Windows) hung
// for seconds. Where the browser can build shaders in the background (KHR_parallel_shader_compile,
// most desktops and phones), the town now sends them all off first and only draws once they
// are built; the loading screen keeps moving meanwhile. Where it can't, it draws straight
// away as before. `WARM_LIMIT`: drawn anyway after this long, so a slow driver never keeps the
// loading screen up.
export const WARM_LIMIT = 10000

// Mounted inside the town canvas after the world, so the whole town (merged by Batch in its
// layout effects) is in the scene when this runs. `onReady` (kept the same between renders)
// lets the canvas start drawing.
export function TownWarm({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const get = useThree((s) => s.get)
  useEffect(() => {
    let live = true
    const done = () => {
      if (live) onReady()
    }
    if (!gl.extensions.has('KHR_parallel_shader_compile')) {
      done()
      return
    }
    const limit = setTimeout(done, WARM_LIMIT)
    // Post effects take over drawing (a priority frame callback) and draw the town into their
    // own buffer, which builds slightly different shaders: compile those.
    warmShaders(gl, scene, camera, get().internal.priority > 0, false).then(done, done)
    return () => {
      live = false
      clearTimeout(limit)
    }
  }, [gl, scene, camera, get, onReady])
  return null
}
