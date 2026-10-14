import { HalfFloatType, WebGLRenderTarget, type Camera, type Object3D, type WebGLRenderer } from 'three'

// The live game skips three's check after each shader compile: it asks the driver for the
// compile logs, which makes the page wait for that compile to finish there and then. Our
// shaders don't change at runtime, so dev builds (and tests) keep the check to catch errors.
export function quietShaders(gl: WebGLRenderer) {
  if (import.meta.env.PROD) gl.debug.checkShaderErrors = false
}

// Compile every shader a scene will need, in the background where the browser allows it
// (KHR_parallel_shader_compile), so nothing freezes when it first draws. Parts that start
// hidden (launch smoke, exhaust flames, rain) are included: otherwise their shaders would
// compile the moment they appear, mid-race. Meant for small scenes (a race): in the big
// town the hidden pieces add up to a lot of memory for little gain. `offscreen`: the
// scene is drawn into a post effects buffer, which changes its shaders (no tone
// mapping), so compile for that.
export function warmShaders(gl: WebGLRenderer, scene: Object3D, camera: Camera, offscreen: boolean): Promise<unknown> {
  const hidden: Object3D[] = []
  scene.traverse((o) => {
    // Pieces Batch has merged stay hidden: the merged mesh is what draws.
    if (!o.visible && !o.userData.batched) {
      hidden.push(o)
      o.visible = true
    }
  })
  const target = offscreen ? new WebGLRenderTarget(1, 1, { type: HalfFloatType }) : null
  const before = gl.getRenderTarget()
  gl.setRenderTarget(target)
  let done: Promise<unknown>
  try {
    done = gl.compileAsync(scene, camera)
  } finally {
    gl.setRenderTarget(before)
    target?.dispose()
    for (const o of hidden) o.visible = false
  }
  return done
}
