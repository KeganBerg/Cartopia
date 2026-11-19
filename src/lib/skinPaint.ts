import { skinNumber } from '../game/data'
import { SKIN_GLSL } from '../scene/skins'

// A car skin on a flat car render (the loading screens' pictures, public/splash/):
// the game's own skin shader, run on one small canvas laid over the render's paint
// mask and multiplied into it, so the paint moves just like it does on the 3D car.
// One quad, one pass, its own tiny WebGL context that goes away with the picture.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

// The picture is a three-quarter view, so the paint is laid out as if seen side
// on (car length about one unit across the picture) and the view swings slowly,
// which slides the skin's deep layers against each other as turning the car does.
const frag = (id: number) => `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform float uT;
uniform float uAspect;
uniform vec3 uBase;
${SKIN_GLSL}
void main() {
  vec3 p = vec3(0.0, (vUv.y - 0.5) / uAspect, vUv.x - 0.5);
  vec3 n = vec3(1.0, 0.0, 0.0);
  vec3 v = normalize(vec3(-1.0, -0.25 + 0.08 * sin(uT * 0.31), 0.35 * sin(uT * 0.23)));
  vec3 col = uBase, glow = vec3(0.0);
  float rough = 0.5;
  skinShade(${id}, p, n, v, uT, col, glow, rough);
  vec3 c = clamp(col + glow, 0.0, 1.0);
  outColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`

const toLinear = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2))
}

// Draws skin `skin` on `canvas` in paint `color` until the returned stop is called.
// Returns null when there's nothing to draw (no such skin, or no WebGL2), so the
// caller keeps its flat paint.
export function runSkinPaint(canvas: HTMLCanvasElement, skin: string, color: string): (() => void) | null {
  const id = skinNumber(skin)
  if (!id) return null
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' })
  if (!gl) return null
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag(id)))
  gl.bindAttribLocation(prog, 0, 'aPos')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const uT = gl.getUniformLocation(prog, 'uT')
  const uAspect = gl.getUniformLocation(prog, 'uAspect')
  gl.uniform3fv(gl.getUniformLocation(prog, 'uBase'), toLinear(/^#[0-9a-f]{6}$/i.test(color) ? color : '#d32f2f'))

  let raf = 0
  let last = 0
  const draw = (now: number) => {
    raf = requestAnimationFrame(draw)
    // 30 frames a second is plenty for a loading picture and spares the phone.
    if (now - last < 32) return
    last = now
    const r = Math.min(devicePixelRatio || 1, 1.5)
    const w = Math.max(1, Math.round(canvas.clientWidth * r))
    const h = Math.max(1, Math.round(canvas.clientHeight * r))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
    gl.uniform1f(uT, (now / 1000) % 3600)
    gl.uniform1f(uAspect, w / h)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  raf = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(raf)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
