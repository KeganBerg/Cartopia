import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, NormalBlending, Points, PointsMaterial, type Texture } from 'three'
import type { CheerDef } from '../game/flair'

// The win celebration (game/flair.ts CHEERS): a burst of particles round the player's car as
// the finish hero shot plays. One Points mesh with its buffers written in place each frame. The
// owner calls start() when the shot begins on a win, update() every frame, and draws `mesh`.
// Each kind is a different launch: confetti pops up and flutters down, sparks spray out low,
// fireworks burst high in three shells, coins rain from above, hearts and stars float up.

const N = 180

let dot: Texture | null = null
// A soft round dot, so particles aren't squares (confetti keeps square chips).
function dotTex() {
  if (dot) return dot
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 32, 32)
  dot = new CanvasTexture(c)
  return dot
}

type Kind = CheerDef['id']
// gravity (m/s²), air drag (per second), particle size, lifetime (s).
const FEEL: Record<Kind, { grav: number; drag: number; size: number; life: number }> = {
  confetti: { grav: 3.2, drag: 1.6, size: 0.22, life: 2.4 },
  sparks: { grav: 6, drag: 0.8, size: 0.16, life: 1.1 },
  fireworks: { grav: 2.2, drag: 1.2, size: 0.3, life: 1.5 },
  coins: { grav: 7, drag: 0.2, size: 0.26, life: 2 },
  hearts: { grav: -0.8, drag: 0.6, size: 0.34, life: 2.2 },
  stars: { grav: -1.2, drag: 0.4, size: 0.28, life: 2 },
}

export class Celebration {
  readonly mesh: Points<BufferGeometry, PointsMaterial>
  private pos = new Float32Array(N * 3)
  // RGBA: the alpha fades each particle out.
  private col = new Float32Array(N * 4)
  // Per particle: velocity x, y, z, age (negative: not launched yet), base colour r, g, b.
  private p = new Float32Array(N * 7)
  private kind: Kind = 'confetti'
  private on = false
  private c = new Color()

  constructor() {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('color', new BufferAttribute(this.col, 4))
    const m = new PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, toneMapped: false })
    this.mesh = new Points(g, m)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.renderOrder = 4
  }

  // Launches a celebration round (x, y, z), a car `len` long. `rand` is for tests.
  start(cheer: CheerDef, x: number, y: number, z: number, len: number, rand: () => number = Math.random) {
    const k = (this.kind = cheer.id)
    const m = this.mesh.material
    const f = FEEL[k]
    m.size = f.size
    m.map = k === 'confetti' ? null : dotTex()
    m.blending = k === 'confetti' || k === 'coins' ? NormalBlending : AdditiveBlending
    m.needsUpdate = true
    const p = this.p
    const shells = [[0, 0], [-0.8, 0.45], [0.8, 0.9]] // fireworks: sideways offset (car lengths), delay (s)
    for (let i = 0; i < N; i++) {
      const o = i * 7
      const a = rand() * Math.PI * 2
      let vx = 0, vy = 0, vz = 0, px = x, py = y, pz = z, delay = 0
      if (k === 'confetti') {
        const s = 2 + rand() * 3
        vx = Math.cos(a) * s; vz = Math.sin(a) * s; vy = 4 + rand() * 4
        py = y + len * 0.3
        delay = rand() * 0.25
      } else if (k === 'sparks') {
        const s = 3 + rand() * 4
        vx = Math.cos(a) * s; vz = Math.sin(a) * s; vy = 1 + rand() * 3
        py = y + len * 0.15
        delay = rand() * 1
      } else if (k === 'fireworks') {
        // A sphere of sparks from one of three shells high over the car.
        const [side, d] = shells[i % 3]
        const u = rand() * 2 - 1
        const r = Math.sqrt(1 - u * u)
        const s = 3 + rand() * 0.8
        vx = Math.cos(a) * r * s; vz = Math.sin(a) * r * s; vy = u * s
        px = x + side * len; py = y + len * 2.2 + (i % 3) * 0.4; delay = d
      } else if (k === 'coins') {
        px = x + (rand() - 0.5) * len * 2; pz = z + (rand() - 0.5) * len * 2; py = y + len * 2 + rand() * 1.5
        vy = -1 - rand() * 2
        delay = rand() * 1.2
      } else {
        // Hearts and stars drift up round the car.
        px = x + Math.cos(a) * len * (0.4 + rand() * 0.6); pz = z + Math.sin(a) * len * (0.4 + rand() * 0.6); py = y + rand() * len * 0.3
        vx = Math.cos(a) * 0.4; vz = Math.sin(a) * 0.4; vy = 0.6 + rand() * 1.2
        delay = rand() * 1.2
      }
      this.pos[i * 3] = px; this.pos[i * 3 + 1] = py; this.pos[i * 3 + 2] = pz
      p[o] = vx; p[o + 1] = vy; p[o + 2] = vz; p[o + 3] = -delay
      this.c.set(cheer.colors[Math.floor(rand() * cheer.colors.length)])
      p[o + 4] = this.c.r; p[o + 5] = this.c.g; p[o + 6] = this.c.b
    }
    this.on = true
    this.mesh.visible = true
  }

  stop() {
    this.on = false
    this.mesh.visible = false
  }

  update(dt: number) {
    if (!this.on) return
    const f = FEEL[this.kind]
    const p = this.p
    const keep = Math.exp(-f.drag * dt)
    let alive = false
    for (let i = 0; i < N; i++) {
      const o = i * 7
      const v = i * 3
      p[o + 3] += dt
      const age = p[o + 3]
      let fade = 0
      if (age >= 0 && age < f.life) {
        alive = true
        p[o] *= keep; p[o + 2] *= keep
        p[o + 1] = p[o + 1] * keep - f.grav * dt
        this.pos[v] += p[o] * dt; this.pos[v + 1] += p[o + 1] * dt; this.pos[v + 2] += p[o + 2] * dt
        // Confetti chips twinkle as they turn; the rest fade out over their last third.
        const tail = Math.min(1, (f.life - age) / (f.life / 3))
        fade = this.kind === 'confetti' ? tail * (0.55 + 0.45 * Math.abs(Math.sin(age * 9 + i))) : tail
      } else if (age < 0) {
        alive = true
      }
      const c = i * 4
      this.col[c] = p[o + 4]; this.col[c + 1] = p[o + 5]; this.col[c + 2] = p[o + 6]; this.col[c + 3] = fade
    }
    if (!alive) return this.stop()
    this.mesh.geometry.attributes.position.needsUpdate = true
    this.mesh.geometry.attributes.color.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
