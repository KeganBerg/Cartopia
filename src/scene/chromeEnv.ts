import { BackSide, BufferAttribute, Color, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SphereGeometry, type Texture, type WebGLRenderer } from 'three'

const cache = new WeakMap<WebGLRenderer, Texture>()

// A crisp studio for chrome paint to mirror: bright sky, a hard white horizon, a dark
// floor and two softbox strips. The town's soft sky map is too even for metal to read
// as chrome. Baked once per renderer and shared by every chrome car.
export function chromeEnv(gl: WebGLRenderer): Texture {
  let tex = cache.get(gl)
  if (tex) return tex
  const geo = new SphereGeometry(10, 64, 32)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const sky = new Color('#cfe6ff'), zenith = new Color('#5f93d6'), horizon = new Color('#ffffff'), floor = new Color('#1d2226'), far = new Color('#5a6168')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 10, y = pos.getY(i) / 10, z = pos.getZ(i) / 10
    if (y > 0.08) c.copy(sky).lerp(zenith, Math.pow((y - 0.08) / 0.92, 0.7))
    else if (y > -0.04) c.copy(horizon)
    else c.copy(far).lerp(floor, Math.min(1, (-y - 0.04) * 4))
    // Softbox strips up and to either side.
    const strip = Math.abs(Math.atan2(z, x)) % (Math.PI / 2)
    if (y > 0.25 && y < 0.7 && Math.abs(strip - Math.PI / 4) < 0.12) c.set('#ffffff').multiplyScalar(1.6)
    col.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const scene = new Scene()
  scene.add(new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide })))
  const pmrem = new PMREMGenerator(gl)
  tex = pmrem.fromScene(scene, 0).texture
  pmrem.dispose()
  geo.dispose()
  cache.set(gl, tex)
  return tex
}
