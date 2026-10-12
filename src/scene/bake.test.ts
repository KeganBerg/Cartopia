import { describe, expect, it } from 'vitest'
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Euler, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Texture, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bake, bakeable, type Finish } from './bake'

describe('baking plain parts together', () => {
  it('only takes materials whose look a vertex can carry', () => {
    expect(bakeable(new MeshStandardMaterial({ color: '#c62828', roughness: 0.4, metalness: 0.2, emissive: '#ff0000', emissiveIntensity: 2 }))).toBe('plain')
    expect(bakeable(new MeshStandardMaterial({ side: DoubleSide }))).toBe('plain')
    expect(bakeable(new MeshBasicMaterial({ color: '#fafafa' }))).toBe('plain')
    expect(bakeable(new MeshStandardMaterial({ map: new Texture() }))).toBe('map')
    expect(bakeable(new MeshStandardMaterial({ map: new Texture(), emissiveMap: new Texture() }))).toBe(false)
    expect(bakeable(new MeshStandardMaterial({ transparent: true, opacity: 0.5 }))).toBe(false)
    expect(bakeable(new MeshStandardMaterial({ flatShading: true }))).toBe(false)
    expect(bakeable(new MeshBasicMaterial({ toneMapped: false }))).toBe(false)
    expect(bakeable(new MeshPhysicalMaterial())).toBe(false)
    const custom = new MeshStandardMaterial()
    custom.onBeforeCompile = () => {}
    expect(bakeable(custom)).toBe(false)
  })

  it('merges parts with their finish per vertex, double-sided parts drawn both ways', () => {
    const g = bake([
      [new BoxGeometry(1, 1, 1), { color: '#ff0000', rough: 0.3 }],
      [new BoxGeometry(1, 1, 1), { color: '#00ff00', double: true, unlit: true }],
    ])
    const one = new BoxGeometry(1, 1, 1)
    const verts = one.getAttribute('position').count
    expect(g.getAttribute('position').count).toBe(verts * 3)
    expect(g.index!.count).toBe(one.index!.count * 3)
    const look = g.getAttribute('look')
    expect(look.getY(0)).toBeCloseTo(0.3)
    expect(look.getZ(verts)).toBe(1)
    // The back copy has its normals flipped and its winding reversed.
    const n = g.getAttribute('normal')
    expect(n.getX(verts * 2)).toBe(-n.getX(verts))
    const idx = g.index!.array
    const front = one.index!.count
    expect([idx[front * 2], idx[front * 2 + 1], idx[front * 2 + 2]]).toEqual([idx[front] + verts, idx[front + 2] + verts, idx[front + 1] + verts])
  })
})

// The bake as first written: each part copied into its own geometry, moved, then
// all merged. The single-pass bake must give the same mesh, only faster.
function slowBake(parts: [BufferGeometry, Finish, Matrix4?][], uvs = false) {
  const skinned = parts.some(([, f]) => f.skin !== undefined)
  const list = parts.map(([geo, f, m]) => {
    const n = geo.getAttribute('position').count
    const g = new BufferGeometry()
    g.setAttribute('position', geo.getAttribute('position').clone())
    g.setAttribute('normal', geo.getAttribute('normal').clone())
    g.setIndex(geo.index ? geo.index.clone() : new BufferAttribute(Uint32Array.from({ length: n }, (_, i) => i), 1))
    if (uvs) {
      const uv = geo.getAttribute('uv').clone()
      if (f.uv) uv.applyMatrix3(f.uv)
      g.setAttribute('uv', uv)
    }
    if (m) g.applyMatrix4(m)
    const both = f.double ? 2 : 1
    const c = new Color(f.color)
    const color = new Float32Array(n * 3 * both)
    const emissive = new Float32Array(n * 3 * both)
    const look = new Float32Array(n * 4 * both)
    for (let i = 0; i < n * both; i++) {
      color.set([c.r, c.g, c.b], i * 3)
      if (f.emissive) emissive.set([f.emissive.r, f.emissive.g, f.emissive.b], i * 3)
      look.set([f.metal ?? 0, f.rough ?? 1, f.unlit ? 1 : 0, f.glow ? 1 : 0], i * 4)
    }
    if (f.double) {
      const p = g.getAttribute('position').array
      const nr = g.getAttribute('normal').array
      const pos = new Float32Array(n * 6)
      const nor = new Float32Array(n * 6)
      pos.set(p)
      pos.set(p, n * 3)
      nor.set(nr)
      for (let i = 0; i < n * 3; i++) nor[n * 3 + i] = -nr[i]
      const idx = g.index!.array
      const out = new Uint32Array(idx.length * 2)
      out.set(idx)
      for (let t = 0; t < idx.length; t += 3) out.set([idx[t] + n, idx[t + 2] + n, idx[t + 1] + n], idx.length + t)
      g.setAttribute('position', new BufferAttribute(pos, 3))
      g.setAttribute('normal', new BufferAttribute(nor, 3))
      g.setIndex(new BufferAttribute(out, 1))
    }
    g.setAttribute('color', new BufferAttribute(color, 3))
    g.setAttribute('emissive', new BufferAttribute(emissive, 3))
    g.setAttribute('look', new BufferAttribute(look, 4))
    if (skinned) g.setAttribute('skin', new BufferAttribute(new Float32Array(n * both).fill(f.skin ?? 0), 1))
    return g
  })
  return mergeGeometries(list)!
}

describe('single-pass bake', () => {
  const at = (x: number, ry: number, s: number) => new Matrix4().compose(new Vector3(x, 1, -2), new Quaternion().setFromEuler(new Euler(0.3, ry, 0)), new Vector3(s, s * 0.5, s))
  const uvAt = new Texture()
  uvAt.repeat.set(3, 2)
  uvAt.offset.set(0.25, 0.5)
  uvAt.updateMatrix()

  it('matches the merge-based bake', () => {
    const parts: [BufferGeometry, Finish, Matrix4?][] = [
      [new BoxGeometry(1, 2, 3), { color: '#ff0000', rough: 0.3, metal: 0.4, emissive: new Color(0.5, 0.2, 0) }, at(2, 0.5, 1.5)],
      [new CylinderGeometry(0.5, 0.7, 2, 9), { color: new Color('#00ff00'), unlit: true, glow: true, skin: 3 }],
      [new PlaneGeometry(2, 1).toNonIndexed(), { color: '#2233ff' }, at(-4, 1.2, 0.7)],
      [new SphereGeometry(1, 7, 5), { color: '#888888', rough: 0.9 }, at(0, 2, 2)],
    ]
    for (const attr of ['position', 'normal', 'color', 'emissive', 'look', 'skin']) {
      const fast = bake(parts).getAttribute(attr).array
      const slow = slowBake(parts).getAttribute(attr).array
      expect(fast.length, attr).toBe(slow.length)
      for (let i = 0; i < fast.length; i++) expect(fast[i], `${attr}[${i}]`).toBeCloseTo(slow[i], 5)
    }
    expect([...bake(parts).index!.array]).toEqual([...slowBake(parts).index!.array])
  })

  it('matches with texture coordinates and double-sided parts', () => {
    const parts: [BufferGeometry, Finish, Matrix4?][] = [
      [new PlaneGeometry(2, 1), { color: '#ffffff', uv: uvAt.matrix.clone() }, at(1, 0.2, 1)],
      [new BoxGeometry(1, 1, 1), { color: '#ffcc00', double: true }, at(-1, 0.9, 2)],
    ]
    const fast = bake(parts, true)
    const slow = slowBake(parts.map(([g, f, m]) => [g, { ...f, double: false }, m]), true)
    // Single-sided, everything lines up with the old bake, UVs included.
    const single = bake(parts.map(([g, f, m]) => [g, { ...f, double: false }, m]), true)
    for (const attr of ['position', 'normal', 'uv', 'color', 'look']) {
      const a = single.getAttribute(attr).array
      const b = slow.getAttribute(attr).array
      for (let i = 0; i < a.length; i++) expect(a[i], `${attr}[${i}]`).toBeCloseTo(b[i], 5)
    }
    // The back faces carry UVs too (the old bake left them short, shifting every later part's).
    const verts = fast.getAttribute('position').count
    expect(fast.getAttribute('uv').count).toBe(verts)
  })
})
