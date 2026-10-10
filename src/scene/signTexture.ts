import { CanvasTexture, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

// Text rendered to a canvas so signs need no font download.
export function signTexture(text: string, bg = '#ffffff', fg = '#c62828') {
  const k = `${text}|${bg}|${fg}`
  const hit = cache.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = fg
  g.font = '900 78px "Arial Black", Impact, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 78
  while (g.measureText(text).width > 480 && size > 20) {
    size -= 4
    g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`
  }
  g.fillText(text, 256, 68)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  cache.set(k, t)
  return t
}
