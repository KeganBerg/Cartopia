import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, BufferAttribute, Color, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SphereGeometry, type WebGLRenderer, type WebGLRenderTarget } from 'three'

// A soft sky-to-ground gradient with a bright sun patch, baked once into a tiny
// environment map. Gives car paint, glass and metal something to reflect.
// How strongly it shows is set per frame as scene.environmentIntensity.
// Baked once per canvas and kept: the race canvas is reused race after race.
const baked = new WeakMap<WebGLRenderer, WebGLRenderTarget>()
export function SkyEnv() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const rt = baked.get(gl) ?? bake(gl)
    baked.set(gl, rt)
    scene.environment = rt.texture
    return () => {
      if (scene.environment === rt.texture) scene.environment = null
    }
  }, [gl, scene])
  return null
}

function bake(gl: WebGLRenderer) {
  const geo = new SphereGeometry(10, 32, 16)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const top = new Color('#8fc4ff'), horizon = new Color('#f4f1ea'), ground = new Color('#59683f'), sun = new Color('#fff6e0')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 10, y = pos.getY(i) / 10, z = pos.getZ(i) / 10
    if (y >= 0) c.copy(horizon).lerp(top, Math.pow(y, 0.6))
    else c.copy(horizon).lerp(ground, Math.min(1, -y * 3))
    // Sun roughly where the directional light is.
    const s = Math.max(0, x * 0.5 + y * 0.8 + z * 0.3)
    c.lerp(sun, Math.pow(s, 24)).multiplyScalar(1 + Math.pow(s, 40) * 6)
    col.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const sky = new Scene()
  sky.add(new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide })))
  const pmrem = new PMREMGenerator(gl)
  const rt = pmrem.fromScene(sky, 0.02)
  geo.dispose()
  pmrem.dispose()
  return rt
}
