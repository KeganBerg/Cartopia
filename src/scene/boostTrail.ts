import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial } from 'three'

// A glowing ribbon laid on the road behind a car while its boost burns, fading out behind it.
// Everything about its look lives in one small object so a different trail can be swapped in later.
export type TrailLook = {
  head: string // colour at the car
  tail: string // colour it fades through towards the end
  width: number // world units across at the car
  life: number // seconds a stretch of ribbon lasts
}
export const BOOST_TRAIL: TrailLook = { head: '#ffe082', tail: '#ff3d00', width: 0.55, life: 0.4 }

const POINTS = 24

// One mesh, its buffers written in place each frame (no allocation). The owner calls update()
// after it has moved the car, with the rear of the car, its heading (nose along (sin h, cos h))
// and whether the boost is burning, and draws `mesh`.
export class BoostTrail {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>
  private pos: Float32Array
  private col: Float32Array
  // Ring of points, newest at `head`: x, y, z, side x, side z, age.
  private pts = new Float32Array(POINTS * 6)
  private head = 0
  private clock = 0
  private was = false
  private headCol = new Color()
  private tailCol = new Color()
  private c = new Color()
  private look: TrailLook

  constructor(look: TrailLook = BOOST_TRAIL) {
    this.look = look
    this.pos = new Float32Array(POINTS * 2 * 3)
    this.col = new Float32Array(POINTS * 2 * 3)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('color', new BufferAttribute(this.col, 3))
    const idx: number[] = []
    for (let i = 0; i < POINTS - 1; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    g.setIndex(idx)
    // Additive, so fading the colour to black fades the ribbon out.
    const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false })
    this.mesh = new Mesh(g, m)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.renderOrder = 3
    this.setLook(look)
    for (let i = 0; i < POINTS; i++) this.pts[i * 6 + 5] = Infinity
  }

  setLook(look: TrailLook) {
    this.look = look
    this.headCol.set(look.head)
    this.tailCol.set(look.tail)
  }

  update(dt: number, x: number, y: number, z: number, h: number, on: boolean) {
    const p = this.pts
    const { life, width } = this.look
    for (let i = 0; i < POINTS; i++) p[i * 6 + 5] += dt
    if (on) {
      // A fresh burn starts a fresh ribbon rather than joining up with the last one's tail.
      if (!this.was) for (let i = 0; i < POINTS; i++) p[i * 6 + 5] = Infinity
      this.clock += dt
      if (!this.was || this.clock >= life / (POINTS - 2)) {
        this.clock = 0
        this.head = (this.head + 1) % POINTS
      }
      // The newest point rides with the car.
      const o = this.head * 6
      p[o] = x; p[o + 1] = y; p[o + 2] = z
      p[o + 3] = Math.cos(h); p[o + 4] = -Math.sin(h)
      p[o + 5] = 0
    }
    this.was = on
    // Newest to oldest along the ribbon, narrowing and fading with age.
    // Spent points fold up onto the last live one, so nothing stretches back to where they were.
    let alive = false
    let cx = x, cy = y, cz = z
    for (let n = 0; n < POINTS; n++) {
      const o = ((this.head - n + POINTS) % POINTS) * 6
      const k = Math.min(1, p[o + 5] / life)
      if (k < 1) {
        alive = true
        cx = p[o]; cy = p[o + 1]; cz = p[o + 2]
      }
      const w = (width / 2) * (1 - k) * (1 - (n / (POINTS - 1)) * 0.5)
      const fade = (1 - k) * (1 - k)
      this.c.copy(this.headCol).lerp(this.tailCol, Math.min(1, k * 1.6)).multiplyScalar(fade)
      for (let s = 0; s < 2; s++) {
        const v = (n * 2 + s) * 3
        const d = s ? w : -w
        this.pos[v] = cx + p[o + 3] * d
        this.pos[v + 1] = cy
        this.pos[v + 2] = cz + p[o + 4] * d
        this.col[v] = this.c.r; this.col[v + 1] = this.c.g; this.col[v + 2] = this.c.b
      }
    }
    this.mesh.visible = alive
    if (alive) {
      this.mesh.geometry.attributes.position.needsUpdate = true
      this.mesh.geometry.attributes.color.needsUpdate = true
    }
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
