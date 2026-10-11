import { PAL, SEASON } from './season'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

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

export const grassTex = (rx = 1, ry = rx) =>
  rep(make(`grass|${SEASON}`, 128, (g, s, r) => {
    g.fillStyle = PAL.grass
    g.fillRect(0, 0, s, s)
    speckle(g, s, r, PAL.grassSpeckle, 900, 3)
    // Flowers in spring, fallen leaves in fall, sparkle on the snow.
    speckle(g, s, r, PAL.grassDots, PAL.dots, 2)
  }), `grass|${SEASON}`, rx, ry)

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

// Car rim with spokes, used on the outside face of each wheel.
export const rimTex = () =>
  make('rim', 64, (g, s) => {
    const c = s / 2
    g.fillStyle = '#1b1b1b'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#e8eaed'
    g.beginPath(); g.arc(c, c, s * 0.42, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#9aa0a6'
    g.beginPath(); g.arc(c, c, s * 0.36, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#f5f6f7'
    g.lineWidth = 5
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * s * 0.36, c + Math.sin(a) * s * 0.36); g.stroke()
    }
    g.fillStyle = '#5f6368'
    g.beginPath(); g.arc(c, c, s * 0.08, 0, Math.PI * 2); g.fill()
  })

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
