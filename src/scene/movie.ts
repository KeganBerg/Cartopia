import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

// The Drive-In's film: a few short original cartoons drawn into one small
// canvas, looping forever. Every drive-in in town (and its shop thumbnail)
// shares this one texture, and it redraws at a lazy 12 frames a second, so a
// town full of cinemas costs the same as one.

const W = 160
const H = 90
const FPS = 12
const LEADER = 1.5 // countdown between reels
const REEL = 7

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let tex: CanvasTexture | null = null
let lastFrame = -1

export function movieTex() {
  if (tex) return tex
  canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  ctx = canvas.getContext('2d')
  tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = tex.magFilter = LinearFilter
  tex.generateMipmaps = false
  draw(0)
  return tex
}

// Called from every mounted screen each frame; only the first call per film
// frame does any work.
export function tickMovie(now = performance.now()) {
  if (!tex || !ctx) return
  const f = Math.floor((now / 1000) * FPS)
  if (f === lastFrame) return
  lastFrame = f
  draw(f / FPS)
  tex.needsUpdate = true
}

type Reel = { title: string; draw: (g: CanvasRenderingContext2D, t: number) => void }
const REELS: Reel[] = [
  { title: 'TURBO CHASE', draw: chase },
  { title: 'SPACE COWS', draw: space },
  { title: 'MEGA LIZARD', draw: lizard },
]
const CYCLE = REELS.length * (LEADER + REEL)

function draw(time: number) {
  const g = ctx
  if (!g) return
  const t = time % CYCLE
  const i = Math.floor(t / (LEADER + REEL))
  const local = t - i * (LEADER + REEL)
  g.save()
  if (local < LEADER) leader(g, local)
  else {
    const rt = local - LEADER
    REELS[i].draw(g, rt)
    if (rt < 1.6) titleCard(g, REELS[i].title, rt)
  }
  g.restore()
  grain(g, Math.floor(time * FPS))
}

// ---- helpers --------------------------------------------------------------

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  g.fillStyle = c
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

function sky(g: CanvasRenderingContext2D, top: string, bottom: string) {
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
}

// Cheap deterministic hash for star fields and skylines.
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function car(g: CanvasRenderingContext2D, x: number, y: number, body: string, t: number, siren = false) {
  const bob = Math.sin(t * 20 + x) > 0 ? 0 : 1
  y += bob
  rect(g, x, y - 8, 30, 8, body)
  rect(g, x + 7, y - 14, 14, 7, body)
  rect(g, x + 9, y - 13, 10, 5, '#b3e5fc')
  rect(g, x + 27, y - 7, 3, 2, '#fff59d')
  rect(g, x, y - 7, 2, 2, '#e53935')
  if (siren) rect(g, x + 12, y - 17, 4, 3, Math.floor(t * 6) % 2 ? '#2979ff' : '#ff1744')
  for (const wx of [x + 7, x + 23]) {
    circle(g, wx, y, 4, '#212121')
    circle(g, wx, y, 1.5, '#9e9e9e')
  }
}

// ---- reels ----------------------------------------------------------------

// A red hot rod tearing across the city at sunset, a police cruiser on its tail.
function chase(g: CanvasRenderingContext2D, t: number) {
  sky(g, '#ff8a65', '#ffd54f')
  circle(g, 120, 46, 14, '#fff3e0')
  // Two parallax skylines.
  for (const [speed, col, base, hi] of [[12, '#ab47bc', 66, 30], [30, '#6a1b9a', 70, 22]] as const) {
    const off = (t * speed) % 20
    for (let i = -1; i < 10; i++) {
      const k = i + Math.floor((t * speed) / 20)
      const h = 10 + hash(k * (speed === 12 ? 1 : 7)) * hi
      rect(g, i * 20 - off, base - h, 16, h, col)
    }
  }
  rect(g, 0, 70, W, 20, '#424242')
  const dash = (t * 90) % 24
  for (let x = -dash; x < W; x += 24) rect(g, x, 79, 12, 2, '#fff176')
  // The chase drifts back and forth across the screen.
  const lead = 92 + Math.sin(t * 1.3) * 18
  car(g, lead, 78, '#e53935', t)
  car(g, lead - 52 + Math.sin(t * 2.1) * 6, 78, '#eceff1', t + 0.3, true)
  // Speed lines behind the leader.
  g.fillStyle = 'rgba(255,255,255,0.7)'
  for (let i = 0; i < 3; i++) g.fillRect(lead - 10 - ((t * 60 + i * 9) % 18), 66 + i * 4, 6, 1)
}

// A flying saucer cruising over a farm and beaming up a very surprised cow.
function space(g: CanvasRenderingContext2D, t: number) {
  sky(g, '#0d1b4c', '#283593')
  for (let i = 0; i < 40; i++) {
    const x = (hash(i) * W + t * 4) % W
    const y = hash(i + 50) * 60
    const tw = Math.sin(t * 5 + i) > 0.6 ? '#ffffff' : '#9fa8da'
    rect(g, x, y, 1, 1, tw)
  }
  // Ringed planet.
  circle(g, 30, 22, 10, '#ffb74d')
  g.strokeStyle = '#ffe0b2'
  g.lineWidth = 2
  g.beginPath()
  g.ellipse(30, 22, 17, 4, -0.3, 0, Math.PI * 2)
  g.stroke()
  // Hills and a barn.
  g.fillStyle = '#1b5e20'
  g.beginPath()
  g.moveTo(0, 74)
  g.quadraticCurveTo(50, 62, 100, 72)
  g.quadraticCurveTo(135, 66, W, 70)
  g.lineTo(W, H)
  g.lineTo(0, H)
  g.fill()
  rect(g, 128, 58, 18, 14, '#c62828')
  g.fillStyle = '#8e0000'
  g.beginPath()
  g.moveTo(126, 58)
  g.lineTo(137, 50)
  g.lineTo(148, 58)
  g.fill()
  // Saucer glides in, hovers, and lifts the cow.
  const sx = 82 + Math.sin(t * 0.9) * 10
  const sy = 26 + Math.sin(t * 3) * 2
  const lift = Math.min(1, Math.max(0, (t - 1.5) / 4))
  g.fillStyle = 'rgba(178,255,89,0.35)'
  g.beginPath()
  g.moveTo(sx - 6, sy + 4)
  g.lineTo(sx + 6, sy + 4)
  g.lineTo(sx + 16, 74)
  g.lineTo(sx - 16, 74)
  g.fill()
  const cy = 70 - lift * 38
  const cx = sx + Math.sin(t * 4) * 2 * lift
  rect(g, cx - 7, cy - 6, 14, 7, '#fafafa')
  rect(g, cx - 4, cy - 6, 4, 3, '#212121')
  rect(g, cx + 2, cy - 3, 3, 3, '#212121')
  rect(g, cx + 6, cy - 8, 5, 5, '#fafafa')
  rect(g, cx + 9, cy - 6, 2, 2, '#f48fb1')
  for (const lx of [cx - 6, cx - 2, cx + 2, cx + 5]) rect(g, lx, cy + 1, 1.5, 3, '#fafafa')
  g.fillStyle = '#b0bec5'
  g.beginPath()
  g.ellipse(sx, sy + 2, 20, 5, 0, 0, Math.PI * 2)
  g.fill()
  circle(g, sx, sy - 1, 7, '#80deea')
  for (let i = 0; i < 5; i++) circle(g, sx - 14 + i * 7, sy + 3, 1.3, Math.floor(t * 8 + i) % 3 ? '#ffee58' : '#ff5252')
}

// A giant green lizard stomping through downtown while a little plane buzzes it.
function lizard(g: CanvasRenderingContext2D, t: number) {
  sky(g, '#4fc3f7', '#e1f5fe')
  for (const [x, y] of [[20, 14], [110, 10]]) {
    circle(g, x + ((t * 3) % W), y, 6, '#ffffff')
    circle(g, x + 7 + ((t * 3) % W), y + 1, 5, '#ffffff')
  }
  const stomp = Math.abs(Math.sin(t * 2.4))
  const shake = stomp < 0.12 ? (Math.floor(t * 24) % 2 ? 1 : -1) : 0
  g.translate(shake, 0)
  const mx = 30 + ((t * 9) % 90)
  const my = 40 - stomp * 3
  // Drawn at 1.6x around its feet so it towers over the city.
  g.save()
  g.translate(mx, 80)
  g.scale(1.6, 1.6)
  g.translate(-mx, -80)
  // Tail, body, head, spikes.
  g.fillStyle = '#43a047'
  g.beginPath()
  g.moveTo(mx - 6, my + 26)
  g.quadraticCurveTo(mx - 24, my + 30, mx - 30, my + 40)
  g.lineTo(mx - 4, my + 34)
  g.fill()
  rect(g, mx - 8, my + 2, 18, 32, '#43a047')
  rect(g, mx - 4, my + 8, 10, 22, '#c5e1a5')
  rect(g, mx + 2, my - 8, 16, 12, '#43a047')
  rect(g, mx + 12, my - 5, 2, 2, '#212121')
  const roar = Math.sin(t * 1.7) > 0.3
  rect(g, mx + 10, my + 1, 8, roar ? 4 : 2, roar ? '#b71c1c' : '#2e7d32')
  g.fillStyle = '#ffeb3b'
  for (let i = 0; i < 4; i++) {
    g.beginPath()
    g.moveTo(mx - 8, my + i * 8)
    g.lineTo(mx - 13, my + i * 8 + 4)
    g.lineTo(mx - 8, my + i * 8 + 7)
    g.fill()
  }
  rect(g, mx + 8, my + 12, 8, 3, '#43a047')
  rect(g, mx - 6, my + 34, 6, 6 - stomp * 3, '#2e7d32')
  rect(g, mx + 4, my + 34, 6, 3 + stomp * 3, '#2e7d32')
  if (roar) {
    g.strokeStyle = '#ffffff'
    g.lineWidth = 1
    for (let i = 1; i <= 3; i++) {
      g.beginPath()
      g.arc(mx + 18, my + 2, i * 4 + ((t * 20) % 4), -0.6, 0.6)
      g.stroke()
    }
  }
  g.restore()
  // City in front of its feet.
  for (let i = 0; i < 9; i++) {
    const h = 14 + hash(i + 9) * 16
    const x = i * 19 - 4
    rect(g, x, H - h, 16, h, i % 2 ? '#546e7a' : '#78909c')
    for (let wy = H - h + 3; wy < H - 3; wy += 5) {
      rect(g, x + 3, wy, 3, 2, '#fff59d')
      rect(g, x + 10, wy, 3, 2, hash(i * 3 + wy) > 0.5 ? '#fff59d' : '#37474f')
    }
  }
  g.translate(-shake, 0)
  // The plane loops around.
  const a = t * 1.4
  const px = 80 + Math.cos(a) * 60
  const py = 20 + Math.sin(a * 2) * 6
  const dir = -Math.sin(a) >= 0 ? 1 : -1
  rect(g, px - 6, py, 12, 3, '#ff7043')
  rect(g, px - 2, py - 4, 3, 11, '#ff7043')
  rect(g, px - 6 * dir - (dir < 0 ? 2 : 0), py - 2, 2, 4, '#ff7043')
}

// ---- film dressing --------------------------------------------------------

function leader(g: CanvasRenderingContext2D, t: number) {
  rect(g, 0, 0, W, H, '#a8a8a8')
  const n = 3 - Math.floor((t / LEADER) * 3)
  const sweep = ((t / LEADER) * 3) % 1
  g.fillStyle = '#7a7a7a'
  g.beginPath()
  g.moveTo(W / 2, H / 2)
  g.arc(W / 2, H / 2, 70, -Math.PI / 2, -Math.PI / 2 + sweep * Math.PI * 2)
  g.fill()
  g.strokeStyle = '#212121'
  g.lineWidth = 1.5
  for (const r of [30, 36]) {
    g.beginPath()
    g.arc(W / 2, H / 2, r, 0, Math.PI * 2)
    g.stroke()
  }
  rect(g, 0, H / 2, W, 1, '#212121')
  rect(g, W / 2, 0, 1, H, '#212121')
  g.fillStyle = '#212121'
  g.font = 'bold 40px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(Math.max(1, n)), W / 2, H / 2 + 2)
}

function titleCard(g: CanvasRenderingContext2D, title: string, t: number) {
  const a = t < 1.1 ? 1 : 1 - (t - 1.1) / 0.5
  g.fillStyle = `rgba(0,0,0,${0.55 * a})`
  g.fillRect(0, 28, W, 34)
  g.globalAlpha = a
  g.font = 'bold 20px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#3e2723'
  g.fillText(title, W / 2 + 1, H / 2 + 1)
  g.fillStyle = '#ffd54f'
  g.fillText(title, W / 2, H / 2)
  g.globalAlpha = 1
}

// Old-film flicker, a scratch now and then and darkened corners.
function grain(g: CanvasRenderingContext2D, f: number) {
  const flick = hash(f) * 0.08
  g.fillStyle = `rgba(0,0,0,${flick})`
  g.fillRect(0, 0, W, H)
  if (hash(f + 3) > 0.7) rect(g, Math.floor(hash(f + 5) * W), 0, 1, H, 'rgba(255,255,255,0.35)')
  for (let i = 0; i < 6; i++) rect(g, hash(f * 7 + i) * W, hash(f * 11 + i) * H, 1, 1, 'rgba(255,255,255,0.4)')
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.35)')
  g.fillStyle = v
  g.fillRect(0, 0, W, H)
}
