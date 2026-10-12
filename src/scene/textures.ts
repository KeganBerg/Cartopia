import { PAL, SEASON } from './season'
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

// Hand-drawn canvas textures, generated once and shared. Small sizes keep
// them cheap on phones; repeat settings tile them across bigger surfaces.

const base = new Map<string, CanvasTexture>()
const tiled = new Map<string, Texture>()

// Deterministic noise so textures look the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function make(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number, r: () => number) => void) {
  const hit = base.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  draw(g, size, rng(key.length * 7919 + size))
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  base.set(key, t)
  return t
}

// The same image tiled `rx` by `ry` times; repeats are per-texture in three.js.
function rep(t: CanvasTexture, key: string, rx: number, ry: number) {
  const k = `${key}|${rx}|${ry}`
  const hit = tiled.get(k)
  if (hit) return hit
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.needsUpdate = true
  tiled.set(k, c)
  return c
}

function speckle(g: CanvasRenderingContext2D, s: number, r: () => number, colors: string[], n: number, size: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)]
    g.fillRect(r() * s, r() * s, size * (0.5 + r()), size * (0.5 + r()))
  }
}

// Grass: soft light and dark patches so the lawn isn't one flat colour, short
// blades, the odd clover clump, then the season's flowers, leaves or sparkle.
// One image spans four tiles; blobs wrap round the edges so the seams vanish.
export const grassTex = (rx = 1, ry = rx) =>
  rep(make(`grass2|${SEASON}`, 256, (g, s, r) => {
    g.fillStyle = PAL.grass
    g.fillRect(0, 0, s, s)
    const wrapped = (x: number, y: number, draw: (x: number, y: number) => void) => {
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) draw(x + ox, y + oy)
    }
    const shades = [-0.1, 0.08, -0.06, 0.1].map((l) => `#${new Color(PAL.grass).offsetHSL(0, 0, l).getHexString()}`)
    for (let i = 0; i < 18; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 40, squash = 0.6 + r() * 0.4, turn = r() * 3
      g.globalAlpha = 0.5
      g.fillStyle = shades[i % shades.length]
      wrapped(x, y, (cx, cy) => { g.beginPath(); g.ellipse(cx, cy, rad, rad * squash, turn, 0, Math.PI * 2); g.fill() })
    }
    g.globalAlpha = 1
    speckle(g, s, r, PAL.grassSpeckle, 2400, 3)
    // Blades: short slanted strokes, darker at the root side.
    g.lineWidth = 1
    for (let i = 0; i < 1600; i++) {
      const x = r() * s, y = r() * s, len = 3 + r() * 4, lean = (r() - 0.5) * 3
      g.strokeStyle = PAL.grassSpeckle[Math.floor(r() * PAL.grassSpeckle.length)]
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean, y - len); g.stroke()
    }
    if (SEASON !== 'winter') {
      g.fillStyle = PAL.grassSpeckle[2]
      for (let i = 0; i < 10; i++) {
        const x = r() * s, y = r() * s
        for (let k = 0; k < 5; k++) wrapped(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, (cx, cy) => { g.beginPath(); g.arc(cx, cy, 2.2, 0, Math.PI * 2); g.fill() })
      }
    }
    // Flowers in spring, fallen leaves in fall, sparkle on the snow.
    speckle(g, s, r, PAL.grassDots, PAL.dots * 4, 2)
  }), `grass2|${SEASON}`, rx, ry)

// Light concrete pavers for sidewalks and building lots.
export const paverTex = (rx = 1, ry = rx) =>
  rep(make('pavers', 128, (g, s, r) => {
    g.fillStyle = '#eadfc8'
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, ['#e2d5ba', '#f0e6d2', '#ddcfb2'], 500, 3)
    g.strokeStyle = '#cdbd9c'
    g.lineWidth = 3
    const n = 4
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(0, (i * s) / n); g.lineTo(s, (i * s) / n); g.stroke()
      g.beginPath(); g.moveTo((i * s) / n, 0); g.lineTo((i * s) / n, s); g.stroke()
    }
  }), 'pavers', rx, ry)

export const asphaltTex = () =>
  make('asphalt', 128, (g, s, r) => {
    g.fillStyle = '#9ba1a8'
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, ['#8f959c', '#a7adb4', '#949aa1', '#b0b5ba'], 1400, 2)
  })

// Neutral brick: tinted by the material colour, so every building gets its own shade.
export const brickTex = (rx = 1, ry = rx) =>
  rep(make('brick', 128, (g, s, r) => {
    g.fillStyle = '#d9d4cf'
    g.fillRect(0, 0, s, s)
    const rows = 8
    const bh = s / rows
    const bw = s / 4
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? bw / 2 : 0
      for (let x = -1; x < 5; x++) {
        const v = 0.86 + r() * 0.14
        const c = Math.round(255 * v)
        g.fillStyle = `rgb(${c},${c},${c})`
        g.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4)
      }
    }
  }), 'brick', rx, ry)

// Siding for houses: horizontal boards.
export const sidingTex = (rx = 1, ry = rx) =>
  rep(make('siding', 64, (g, s) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#e3e3e3'
    for (let y = 0; y < s; y += 8) g.fillRect(0, y + 6, s, 2)
  }), 'siding', rx, ry)

// Shingles for pitched roofs, tinted by the roof colour.
export const shingleTex = (rx = 1, ry = rx) =>
  rep(make('shingle', 64, (g, s, r) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 8) {
      const off = (y / 8) % 2 ? 4 : 0
      for (let x = -8; x < s; x += 8) {
        const c = Math.round(255 * (0.8 + r() * 0.2))
        g.fillStyle = `rgb(${c},${c},${c})`
        g.fillRect(x + off + 1, y + 1, 7, 6)
      }
    }
  }), 'shingle', rx, ry)

export const gravelTex = (rx = 1, ry = rx) =>
  rep(make('gravel', 64, (g, s, r) => {
    g.fillStyle = '#e4e6e8'
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, ['#cfd3d6', '#f2f3f4', '#c3c8cc'], 400, 2)
  }), 'gravel', rx, ry)

// Striped shop awning.
export const awningTex = (a: string, b = '#ffffff') =>
  make(`awning|${a}|${b}`, 64, (g, s) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? b : a
      g.fillRect((i * s) / 8, 0, s / 8, s)
    }
    g.fillStyle = 'rgba(0,0,0,.15)'
    g.fillRect(0, s - 8, s, 8)
  })

// Shop window: glass panes with frames and a hint of reflection.
export const windowTex = () =>
  make('window', 128, (g, s) => {
    g.fillStyle = '#eceff1'
    g.fillRect(0, 0, s, s)
    const panes = 3
    const pw = s / panes
    for (let i = 0; i < panes; i++) {
      const grd = g.createLinearGradient(i * pw, 0, i * pw + pw, s)
      grd.addColorStop(0, '#8fd3ff')
      grd.addColorStop(0.5, '#4f9fd6')
      grd.addColorStop(1, '#2c6fa3')
      g.fillStyle = grd
      g.fillRect(i * pw + 6, 6, pw - 12, s - 12)
      g.fillStyle = 'rgba(255,255,255,.35)'
      g.beginPath()
      g.moveTo(i * pw + 10, s - 20)
      g.lineTo(i * pw + 26, 10)
      g.lineTo(i * pw + 36, 10)
      g.lineTo(i * pw + 20, s - 20)
      g.fill()
    }
  })

// Car wheel atlas: the spoked rim on the left half (mapped onto the wheel's
// faces) and the tyre's tread on the right half (wrapped round its edge), so a
// whole wheel draws with one material.
let wheelAtlas: CanvasTexture | null = null
export function wheelTex() {
  if (wheelAtlas) return wheelAtlas
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  const s = 64
  const m = s / 2
  g.fillStyle = '#1b1b1b'
  g.fillRect(0, 0, 128, 64)
  // Sidewall ring, then the rim, its dish and five spokes.
  g.fillStyle = '#262626'
  g.beginPath(); g.arc(m, m, s * 0.48, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#e8eaed'
  g.beginPath(); g.arc(m, m, s * 0.4, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#80868b'
  g.beginPath(); g.arc(m, m, s * 0.34, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#f5f6f7'
  g.lineCap = 'round'
  g.lineWidth = 6
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a) * s * 0.35, m + Math.sin(a) * s * 0.35); g.stroke()
  }
  g.fillStyle = '#bdc1c6'
  g.beginPath(); g.arc(m, m, s * 0.12, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#5f6368'
  g.beginPath(); g.arc(m, m, s * 0.06, 0, Math.PI * 2); g.fill()
  // Chunky tread blocks round the tyre.
  g.fillStyle = '#2e2e2e'
  for (let x = 64; x < 128; x += 4) {
    g.fillRect(x, 6, 2, 22)
    g.fillRect(x + 2, 36, 2, 22)
  }
  wheelAtlas = new CanvasTexture(c)
  wheelAtlas.colorSpace = SRGBColorSpace
  wheelAtlas.anisotropy = 4
  return wheelAtlas
}

// Sky: blue gradient with soft cartoon clouds. Used as a dome in races and
// as the backdrop around the town.
export const skyTex = (rx = 1) =>
  rep(make('sky', 512, (g, s, r) => {
    const grd = g.createLinearGradient(0, 0, 0, s)
    grd.addColorStop(0, '#3d9bff')
    grd.addColorStop(0.72, '#8fd0ff')
    grd.addColorStop(1, '#d9f2ff')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 9; i++) {
      const cx = r() * s
      const cy = s * (0.45 + r() * 0.35)
      const w = s * (0.08 + r() * 0.08)
      g.fillStyle = 'rgba(255,255,255,0.85)'
      // Drawn three times so clouds crossing the edge wrap seamlessly.
      for (const dx of [-s, 0, s]) for (let k = 0; k < 5; k++) {
        g.beginPath()
        g.ellipse(dx + cx + (k - 2) * w * 0.45, cy - Math.sin((k / 4) * Math.PI) * w * 0.25, w * 0.4, w * 0.28, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
  }), 'sky', rx, 1)

// Chequered flag: black and white squares, two rows high.
export const checkerTex = (rx = 1) =>
  rep(make('checker', 64, (g, s) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#111111'
    const q = s / 4
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * q, y * q, q, q)
  }), 'checker', rx, 1)

// Roll-up garage door: ribbed slats with a handle bar.
export const shutterTex = () =>
  make('shutter', 64, (g, s) => {
    g.fillStyle = '#f2f4f5'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 8) {
      g.fillStyle = '#d5dadd'
      g.fillRect(0, y + 6, s, 2)
      g.fillStyle = '#ffffff'
      g.fillRect(0, y, s, 1)
    }
    g.fillStyle = '#90a4ae'
    g.fillRect(s * 0.4, s - 8, s * 0.2, 3)
  })

// Fuel pump face: price screen, logo stripe and hose holster.
export const pumpTex = (accent: string) =>
  make(`pump|${accent}`, 64, (g, s) => {
    g.fillStyle = '#fafafa'
    g.fillRect(0, 0, s, s)
    g.fillStyle = accent
    g.fillRect(0, 0, s, s * 0.22)
    g.fillStyle = '#263238'
    g.fillRect(s * 0.15, s * 0.3, s * 0.7, s * 0.22)
    g.fillStyle = '#76ff03'
    g.font = `bold ${s * 0.16}px monospace`
    g.textAlign = 'center'
    g.fillText('8.88', s / 2, s * 0.47)
    g.fillStyle = '#37474f'
    g.fillRect(s * 0.3, s * 0.62, s * 0.4, s * 0.26)
  })

// Night-time glow for windows: warm panes, dark frames, matching windowTex.
export const windowGlowTex = () =>
  make('windowGlow', 128, (g, s) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, s, s)
    const pw = s / 3
    for (let i = 0; i < 3; i++) {
      const grd = g.createLinearGradient(0, 6, 0, s - 6)
      grd.addColorStop(0, '#ffe7a3')
      grd.addColorStop(1, '#ffb74d')
      g.fillStyle = grd
      g.fillRect(i * pw + 6, 6, pw - 12, s - 12)
    }
  })

// The same panes in plain white, for windows lit in any colour (the club's LEDs).
export const ledPaneTex = () =>
  make('ledPane', 128, (g, s) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, s, s)
    const pw = s / 3
    for (let i = 0; i < 3; i++) {
      const grd = g.createLinearGradient(0, 6, 0, s - 6)
      grd.addColorStop(0, '#ffffff')
      grd.addColorStop(1, '#b0b0b0')
      g.fillStyle = grd
      g.fillRect(i * pw + 6, 6, pw - 12, s - 12)
    }
  })

// Soft round light pool, drawn additively under lamps and headlights.
export const glowTex = () =>
  make('glow', 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.4, 'rgba(255,255,255,0.45)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
  })

// Office tower facade: a grid of windows on a pale wall, tinted per building.
export const towerTex = () =>
  make('tower', 64, (g, s, r) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        const v = 120 + Math.floor(r() * 50)
        g.fillStyle = `rgb(${v},${v + 30},${v + 60})`
        g.fillRect(x * 16 + 3, y * 8 + 2, 10, 5)
      }
  })

// Matching night glow: about half the windows lit.
export const towerGlowTex = () =>
  make('towerGlow', 64, (g, s, r) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        if (r() < 0.5) continue
        g.fillStyle = r() < 0.7 ? '#ffd88a' : '#cfe8ff'
        g.fillRect(x * 16 + 3, y * 8 + 2, 10, 5)
      }
  })

// Cast-iron manhole cover: a pale rim round a diamond-tread lid with two
// lifting holes. Drawn to fill the square so a circleGeometry shows the lid.
export const manholeTex = () =>
  make('manhole', 64, (g, s) => {
    const m = s / 2
    g.fillStyle = '#6f777c'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#a7afb4'
    g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#7f888d'
    g.beginPath(); g.arc(m, m, m * 0.8, 0, Math.PI * 2); g.fill()
    g.save()
    g.beginPath(); g.arc(m, m, m * 0.8, 0, Math.PI * 2); g.clip()
    g.strokeStyle = '#9ba4a9'
    g.lineWidth = 2
    for (let i = -s; i < s * 2; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke()
      g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke()
    }
    g.restore()
    g.fillStyle = '#4b5257'
    for (const dx of [-0.42, 0.42]) {
      g.beginPath(); g.ellipse(m + dx * m, m, 3, 2, 0, 0, Math.PI * 2); g.fill()
    }
  })

// Gutter drain grate: a steel frame with slots running across it.
export const drainTex = () =>
  make('drain', 32, (g, s) => {
    g.fillStyle = '#9aa2a7'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#3d4348'
    for (let y = 4; y < s - 4; y += 6) g.fillRect(5, y, s - 10, 3)
  })

// Tactile paving at a curb ramp: yellow slab with rows of raised domes.
export const tactileTex = (rx = 1, ry = rx) =>
  rep(make('tactile', 64, (g, s) => {
    g.fillStyle = '#e8b730'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = (x + 0.5) * (s / 4), cy = (y + 0.5) * (s / 4)
      g.fillStyle = '#b8891c'
      g.beginPath(); g.arc(cx + 1, cy + 1.5, 4.5, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#f6d257'
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill()
    }
  }), 'tactile', rx, ry)

// Desert sand: warm base, wind ripples, darker grit and the odd pebble.
export const sandTex = (rx = 1, ry = rx) =>
  rep(make('sand', 256, (g, s, r) => {
    g.fillStyle = '#d9a46c'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 14; i++) {
      g.globalAlpha = 0.35
      g.fillStyle = i % 2 ? '#e3b47e' : '#c99258'
      g.beginPath()
      g.ellipse(r() * s, r() * s, 30 + r() * 50, 14 + r() * 24, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 0.4
    g.strokeStyle = '#c48b52'
    g.lineWidth = 2
    for (let y = 6; y < s; y += 11) {
      g.beginPath()
      for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3)
      g.stroke()
    }
    g.globalAlpha = 1
    speckle(g, s, r, ['#b97d45', '#e8bf8c', '#a86d3a', '#f0cc9c'], 2600, 2)
    speckle(g, s, r, ['#8d5a35', '#9e9e9e', '#7b4a2a'], 60, 4)
  }), 'sand', rx, ry)

// Ploughed soil between crop rows.
export const soilTex = (rx = 1, ry = rx) =>
  rep(make('soil', 128, (g, s, r) => {
    g.fillStyle = '#6d4c41'
    g.fillRect(0, 0, s, s)
    for (let x = 0; x < s; x += 16) {
      g.fillStyle = '#5a3d33'
      g.fillRect(x, 0, 6, s)
      g.fillStyle = '#7d5a4c'
      g.fillRect(x + 8, 0, 3, s)
    }
    speckle(g, s, r, ['#4e342e', '#8d6e63', '#5d4037'], 900, 2)
  }), 'soil', rx, ry)

// Nightclub dance floor: a grid of coloured tiles. `lit` is the glow (an
// emissive map); unlit is the same floor dimmed for daytime.
export const danceFloorTex = (lit: boolean, rx = 1, ry = rx) =>
  rep(make(`dance|${lit}`, 128, (g, s) => {
    const colors = ['#ff2bd6', '#00e5ff', '#ffea00', '#7c4dff', '#76ff03', '#ff6d00']
    const n = 4
    const t = s / n
    g.fillStyle = '#0d0618'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        g.globalAlpha = lit ? 1 : 0.32
        g.fillStyle = colors[(i * 3 + j * 2) % colors.length]
        g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4)
      }
    }
    g.globalAlpha = 1
  }), `dance|${lit}`, rx, ry)

// Pale beach sand with soft wind ripples.
export const beachSandTex = (rx = 1, ry = rx) =>
  rep(make('beachsand', 256, (g, s, r) => {
    g.fillStyle = '#f1dcae'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 12; i++) {
      g.globalAlpha = 0.3
      g.fillStyle = i % 2 ? '#f7e7c3' : '#e3c891'
      g.beginPath()
      g.ellipse(r() * s, r() * s, 30 + r() * 50, 14 + r() * 24, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 0.25
    g.strokeStyle = '#d9bd86'
    g.lineWidth = 2
    for (let y = 8; y < s; y += 14) {
      g.beginPath()
      for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin(x * 0.04 + y) * 3)
      g.stroke()
    }
    g.globalAlpha = 1
    speckle(g, s, r, ['#e0c58f', '#fbefd2', '#d4b67c', '#ffffff'], 2200, 2)
  }), 'beachsand', rx, ry)

// Packed snow: blue-grey drifts and sparkle.
export const snowTex = (rx = 1, ry = rx) =>
  rep(make('snowfield', 256, (g, s, r) => {
    g.fillStyle = '#f4f7fa'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 16; i++) {
      g.globalAlpha = 0.35
      g.fillStyle = i % 2 ? '#e3ebf2' : '#ffffff'
      g.beginPath()
      g.ellipse(r() * s, r() * s, 30 + r() * 60, 12 + r() * 26, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    speckle(g, s, r, ['#dde6ee', '#ffffff', '#cfdbe6'], 1800, 2)
    speckle(g, s, r, ['#b0c4d6'], 120, 1)
  }), 'snowfield', rx, ry)

// Dock concrete: slabs with joints, oil spots and tyre scuffs.
export const concreteTex = (rx = 1, ry = rx) =>
  rep(make('concrete', 256, (g, s, r) => {
    g.fillStyle = '#a3aaaf'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 0.94 + r() * 0.08
      g.fillStyle = `rgba(${Math.round(163 * v)},${Math.round(170 * v)},${Math.round(175 * v)},1)`
      g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62)
    }
    speckle(g, s, r, ['#979ea3', '#b0b6ba', '#8f969b'], 2200, 2)
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.25
      g.fillStyle = '#4a4f53'
      g.beginPath()
      g.ellipse(r() * s, r() * s, 6 + r() * 12, 4 + r() * 8, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    g.strokeStyle = '#7d8489'
    g.lineWidth = 2
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke()
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.stroke()
    }
  }), 'concrete', rx, ry)

// Open water: deep blue with lighter wave crests. Scroll its offset to animate.
export const waterTex = (key: string, rx = 1, ry = rx) =>
  rep(make('water', 256, (g, s, r) => {
    g.fillStyle = '#2b86c9'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 10; i++) {
      g.globalAlpha = 0.3
      g.fillStyle = i % 2 ? '#3a9bdc' : '#1f74b3'
      g.beginPath()
      g.ellipse(r() * s, r() * s, 40 + r() * 50, 18 + r() * 20, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 0.55
    g.strokeStyle = '#9fd4f5'
    g.lineWidth = 2
    for (let i = 0; i < 70; i++) {
      const x = r() * s, y = r() * s, w = 8 + r() * 18
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke()
    }
    g.globalAlpha = 1
  }), `water|${key}`, rx, ry)

// Corrugated steel for shipping containers, tinted by the material colour.
export const containerTex = () =>
  make('container', 64, (g, s) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    for (let x = 0; x < s; x += 6) {
      g.fillStyle = '#c9c9c9'
      g.fillRect(x, 0, 2, s)
      g.fillStyle = '#e6e6e6'
      g.fillRect(x + 2, 0, 1, s)
    }
    g.fillStyle = '#9e9e9e'
    g.fillRect(0, 0, s, 3)
    g.fillRect(0, s - 3, s, 3)
  })

// Corrugated sheet metal, tinted by the material colour: ribs run across the
// image (`across`) or down it, tiled `rx` by `ry`. Rust streaks bleed from the seams.
export const corrugatedTex = (rx = 1, ry = rx, across = false) =>
  rep(make(across ? 'corrugated-x' : 'corrugated', 64, (g, s, r) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, s, s)
    for (let k = 0; k < s; k += 8) {
      g.fillStyle = '#c4c4c4'
      if (across) g.fillRect(0, k, s, 3)
      else g.fillRect(k, 0, 3, s)
      g.fillStyle = '#ececec'
      if (across) g.fillRect(0, k + 3, s, 1)
      else g.fillRect(k + 3, 0, 1, s)
    }
    g.globalAlpha = 0.28
    g.fillStyle = '#6d3a1c'
    for (let i = 0; i < 5; i++) {
      const a = r() * s
      const len = 10 + r() * 26
      if (across) g.fillRect(r() * s, a, len, 2 + r() * 3)
      else g.fillRect(a, r() * s, 2 + r() * 3, len)
    }
    g.globalAlpha = 1
  }), across ? 'corrugated-x' : 'corrugated', rx, ry)

// Wild meadow for unbought land and the countryside: the season's rougher,
// darker grass with long tangled blades, clumps and bare earth showing through.
// One image spans eight tiles; blobs wrap so the seams vanish.
export const meadowTex = (rx = 1, ry = rx) =>
  rep(make(`meadow|${SEASON}`, 256, (g, s, r) => {
    g.fillStyle = PAL.ground
    g.fillRect(0, 0, s, s)
    const wrapped = (x: number, y: number, draw: (x: number, y: number) => void) => {
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) draw(x + ox, y + oy)
    }
    const shades = [-0.09, 0.07, -0.05, 0.09, -0.12].map((l) => `#${new Color(PAL.ground).offsetHSL(0.01 * (r() - 0.5), 0, l).getHexString()}`)
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, rad = 14 + r() * 46, squash = 0.5 + r() * 0.5, turn = r() * 3
      g.globalAlpha = 0.45
      g.fillStyle = shades[i % shades.length]
      wrapped(x, y, (cx, cy) => { g.beginPath(); g.ellipse(cx, cy, rad, rad * squash, turn, 0, Math.PI * 2); g.fill() })
    }
    // Bare earth (or ice under the snow) in a few worn spots.
    g.globalAlpha = 0.35
    g.fillStyle = SEASON === 'winter' ? '#c9d6e0' : '#8a7a52'
    for (let i = 0; i < 5; i++) {
      const x = r() * s, y = r() * s, rad = 5 + r() * 9
      wrapped(x, y, (cx, cy) => { g.beginPath(); g.ellipse(cx, cy, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); g.fill() })
    }
    g.globalAlpha = 1
    const blades = [...PAL.grassSpeckle, `#${new Color(PAL.ground).offsetHSL(0, 0, -0.14).getHexString()}`]
    speckle(g, s, r, blades, 1800, 3)
    g.lineWidth = 1.2
    for (let i = 0; i < 2600; i++) {
      const x = r() * s, y = r() * s, len = 4 + r() * 7, lean = (r() - 0.5) * 5
      g.strokeStyle = blades[Math.floor(r() * blades.length)]
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len); g.stroke()
    }
    speckle(g, s, r, PAL.grassDots, PAL.dots * 3, 2)
  }), `meadow|${SEASON}`, rx, ry)

// Road wear, four cells side by side, each drawn on transparent: hairline
// cracks, a darker tar patch with sealed seams, an oil stain, and grime that
// collects along the kerb. Lay them as decals over the asphalt.
export const roadWearTex = () =>
  make('roadwear', 256, (g, s, r) => {
    g.clearRect(0, 0, s, s)
    const c = s / 4
    // Cracks: branching dark lines.
    g.strokeStyle = 'rgba(45,48,52,0.85)'
    g.lineCap = 'round'
    const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
      let px = x, py = y
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 0.9
        const nx = px + Math.cos(a) * 4, ny = py + Math.sin(a) * 4
        g.lineWidth = w * (1 - i / len) + 0.5
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke()
        if (depth > 0 && r() < 0.18) crack(nx, ny, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.45, w * 0.6, depth - 1)
        px = Math.min(c - 4, Math.max(4, nx)); py = Math.min(s - 4, Math.max(4, ny))
      }
    }
    for (let k = 0; k < 3; k++) crack(c / 2 + (r() - 0.5) * 20, 10 + k * 80, Math.PI / 2 + (r() - 0.5) * 0.6, 18, 2.2, 2)
    // Patch: a darker, smoother rectangle with a black sealed edge.
    g.fillStyle = 'rgba(70,74,80,0.3)'
    g.fillRect(c + 10, 30, c - 20, s - 60)
    for (let i = 0; i < 300; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(60,63,68,0.35)' : 'rgba(120,124,130,0.3)'
      g.fillRect(c + 10 + r() * (c - 22), 30 + r() * (s - 62), 2, 2)
    }
    g.strokeStyle = 'rgba(30,32,35,0.55)'
    g.lineWidth = 2
    g.strokeRect(c + 10, 30, c - 20, s - 60)
    // Oil stain: soft dark blob with a faint rainbow-free sheen ring.
    const grad = g.createRadialGradient(c * 2.5, s / 2, 2, c * 2.5, s / 2, c * 0.45)
    grad.addColorStop(0, 'rgba(25,25,28,0.7)')
    grad.addColorStop(0.6, 'rgba(35,35,40,0.35)')
    grad.addColorStop(1, 'rgba(40,40,45,0)')
    g.fillStyle = grad
    g.beginPath(); g.ellipse(c * 2.5, s / 2, c * 0.45, c * 0.8, 0, 0, Math.PI * 2); g.fill()
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(25,25,28,0.45)'
      g.beginPath(); g.arc(c * 2.5 + (r() - 0.5) * c * 0.7, s / 2 + (r() - 0.5) * c * 1.4, 2 + r() * 5, 0, Math.PI * 2); g.fill()
    }
    // Kerb grime: dark at the kerb (left edge of the cell), fading towards the lane.
    const k = g.createLinearGradient(c * 3, 0, c * 4, 0)
    k.addColorStop(0, 'rgba(60,58,52,0.75)')
    k.addColorStop(0.35, 'rgba(70,68,62,0.3)')
    k.addColorStop(1, 'rgba(80,80,80,0)')
    g.fillStyle = k
    g.fillRect(c * 3, 0, c, s)
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '90,80,60' : '50,50,50'},${0.3 + r() * 0.4})`
      g.fillRect(c * 3 + r() * r() * c * 0.6, r() * s, 1.5 + r() * 2, 1.5 + r() * 2)
    }
  })

// Curtain wall for office towers: tall glass panels between thin mullions, a
// band of spandrel at each floor and a soft sky reflection running across.
// Neutral, so the material colour tints the glass per building.
export const curtainTex = (rx = 1, ry = rx) =>
  rep(make('curtain', 128, (g, s, r) => {
    const grd = g.createLinearGradient(0, 0, s, s)
    grd.addColorStop(0, '#f2f7fa')
    grd.addColorStop(0.45, '#b9c7d0')
    grd.addColorStop(0.55, '#d8e2e8')
    grd.addColorStop(1, '#8c9ba5')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
    // Each pane a touch lighter or darker, like tinted glass catching the sky.
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,60,80'},${0.05 + r() * 0.12})`
      g.fillRect(x * 32 + 2, y * 32 + 2, 28, 22)
    }
    g.fillStyle = '#a3afb7'
    for (let y = 0; y < 4; y++) g.fillRect(0, y * 32 + 24, s, 8)
    g.fillStyle = '#7d8a93'
    for (let x = 0; x < 4; x++) g.fillRect(x * 32, 0, 2, s)
    g.fillStyle = 'rgba(255,255,255,.35)'
    for (let y = 0; y < 4; y++) g.fillRect(0, y * 32 + 24, s, 1)
  }), 'curtain', rx, ry)

// Matching night glow: about half the offices lit, warm or cool white.
export const curtainGlowTex = (rx = 1, ry = rx) =>
  rep(make('curtainGlow', 128, (g, s, r) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, s, s)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if (r() < 0.5) continue
      g.fillStyle = r() < 0.55 ? '#ffd892' : '#c4e0f7'
      g.fillRect(x * 32 + 3, y * 32 + 3, 26, 20)
    }
  }), 'curtainGlow', rx, ry)

// Landing pad: a painted circle with a big H on dark concrete. `ring` is the
// circle's colour, `mark` the letter's (a hospital pad's H sits in a red cross).
export const helipadTex = (ring: string, mark: string, cross = false) =>
  make(`helipad|${ring}|${mark}|${cross}`, 256, (g, s, r) => {
    g.fillStyle = '#6d7377'
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, ['#646a6e', '#757b7f', '#5e6468'], 900, 2)
    g.strokeStyle = ring
    g.lineWidth = 14
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2)
    g.stroke()
    // Touchdown marks round the ring.
    g.fillStyle = '#fafafa'
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      g.save()
      g.translate(s / 2 + Math.cos(a) * s * 0.47, s / 2 + Math.sin(a) * s * 0.47)
      g.rotate(a)
      g.fillRect(-4, -10, 8, 20)
      g.restore()
    }
    if (cross) {
      g.fillStyle = '#d32f2f'
      g.fillRect(s * 0.38, s * 0.2, s * 0.24, s * 0.6)
      g.fillRect(s * 0.2, s * 0.38, s * 0.6, s * 0.24)
    }
    g.fillStyle = mark
    const u = s / 256
    g.fillRect(88 * u, 76 * u, 22 * u, 104 * u)
    g.fillRect(146 * u, 76 * u, 22 * u, 104 * u)
    g.fillRect(88 * u, 117 * u, 80 * u, 22 * u)
  })

// Packed yard dirt, tinted by the material colour: a pale neutral base with
// darker patches, pebbles and the odd oil spot. Rusty's search lots use it in
// brown, sand or grey.
export const dirtTex = (rx = 1, ry = rx) =>
  rep(make('dirt', 256, (g, s, r) => {
    g.fillStyle = '#e6e1d9'
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 26; i++) {
      g.globalAlpha = 0.22
      g.fillStyle = i % 3 ? '#cfc7bb' : '#f4f0ea'
      const x = r() * s
      const y = r() * s
      const rx2 = 18 + r() * 46
      const ry2 = 10 + r() * 30
      const a = r() * 3
      // Wrap blobs round the edges so the tiles join without seams.
      for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
        g.beginPath()
        g.ellipse(x + dx, y + dy, rx2, ry2, a, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.globalAlpha = 1
    speckle(g, s, r, ['#d6cfc4', '#efebe5', '#c9c1b4', '#bdb4a6'], 2600, 2)
    speckle(g, s, r, ['#a1978a', '#8f8679', '#b3ab9f'], 160, 4)
    g.globalAlpha = 0.18
    g.fillStyle = '#3a3633'
    for (let i = 0; i < 3; i++) {
      g.beginPath()
      g.ellipse(r() * s, r() * s, 8 + r() * 10, 5 + r() * 6, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }), 'dirt', rx, ry)

// A worn track lying along u: two darker tyre ruts with tread marks, a paler
// crown between them and loose gravel at the edges. Neutral, so the material
// colour picks dirt, sand or asphalt.
export const trackTex = () =>
  make('track', 128, (g, s, r) => {
    g.fillStyle = '#e8e3dc'
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, ['#d9d3ca', '#f1ede8', '#cdc6bc'], 1400, 2)
    for (const c of [0.3, 0.7]) {
      const y = c * s
      const grd = g.createLinearGradient(0, y - 14, 0, y + 14)
      grd.addColorStop(0, 'rgba(120,112,102,0)')
      grd.addColorStop(0.5, 'rgba(120,112,102,0.6)')
      grd.addColorStop(1, 'rgba(120,112,102,0)')
      g.fillStyle = grd
      g.fillRect(0, y - 14, s, 28)
      g.fillStyle = 'rgba(80,74,68,0.35)'
      for (let x = 0; x < s; x += 6) g.fillRect(x, y - 6, 2, 12)
    }
    // Gravel thrown to the edges.
    for (const y0 of [0, s - 10]) {
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect(0, y0, s, 10)
      for (let i = 0; i < 90; i++) {
        g.fillStyle = r() > 0.5 ? '#a49b8f' : '#c7bfb3'
        g.fillRect(r() * s, y0 + r() * 10, 2 + r() * 2, 2 + r() * 2)
      }
    }
  })

// A light beam on an open cylinder: bright at the foot, fading out upward.
export const beamTex = () =>
  make('beam', 64, (g, s) => {
    const grd = g.createLinearGradient(0, s, 0, 0)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.35, 'rgba(255,255,255,0.5)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
  })

// Asphalt tiled `rx` by `ry`, for long streets.
export const roadTex = (rx = 1, ry = rx) => rep(asphaltTex(), 'asphalt', rx, ry)
