import { CanvasTexture, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

// Text rendered to a canvas so signs need no font download. `aspect` is the
// width:height of the board it goes on (4:1 unless given), so the lettering
// isn't squashed onto a square plate or a tall panel.
export function signTexture(text: string, bg = '#ffffff', fg = '#c62828', aspect = 4) {
  const k = `${text}|${bg}|${fg}|${aspect}`
  const hit = cache.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  const h = aspect >= 1 ? 128 : Math.round(128 / aspect)
  c.width = Math.round(h * aspect)
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = fg
  let size = Math.min(78, Math.round(c.width * 0.6))
  g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  while (g.measureText(text).width > c.width - 32 && size > 20) {
    size -= 4
    g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`
  }
  g.fillText(text, c.width / 2, c.height / 2 + 4)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  // Lettering: mergeShape.test checks it never stretches.
  t.userData.text = true
  t.userData.label = text
  t.userData.aspect = aspect
  cache.set(k, t)
  return t
}
