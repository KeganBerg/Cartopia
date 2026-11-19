import { HalfFloatType, PCFShadowMap, PCFSoftShadowMap, WebGLRenderTarget, type Camera, type Object3D, type WebGLRenderer } from 'three'

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
  // three swaps PCFSoft (r3f's default with shadows on) for PCF at the first shadow draw, which
  // would throw away everything compiled here; compile for what it will draw with.
  if (gl.shadowMap.type === PCFSoftShadowMap) gl.shadowMap.type = PCFShadowMap
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
  // Without background compiling, a phone finishes a shader only when it's first used, so one
  // compiled here but first drawn later (the crate depot's walk back out) froze the view then.
  // Using each one now finishes them all while the view is still getting ready.
  return done.then(() => {
    for (const p of (gl.info.programs ?? []) as unknown as { getUniforms(): unknown }[]) p.getUniforms()
  })
}

// Three frees a shader program once no material uses it, so a scene that remounts (each
// race, each crate opening) would compile its shaders all over again: a freeze every time.
// Holding one extra use of each program keeps it for the canvas's lifetime (a few dozen,
// one per look).
export function pinPrograms(gl: WebGLRenderer | null) {
  for (const p of (gl?.info.programs ?? []) as unknown as { usedTimes: number; pinned?: boolean }[]) {
    if (p.pinned) continue
    p.pinned = true
    p.usedTimes++
  }
}
