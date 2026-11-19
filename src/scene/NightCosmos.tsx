import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BackSide, ShaderMaterial, SphereGeometry, type Mesh } from 'three'
import { COSMOS_GLSL } from './cosmos'

// The race sky at night: stars, the Milky Way, galaxies and planets (cosmos.ts)
// added over the race's painted sky dome and background. Pinned to the far
// plane so the scenery always covers it, and only mounted when the sky is dark
// and clear enough to show it. The planets gather ahead, down the road.

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;
}`

const FRAG = /* glsl */ `
uniform float uVis;
varying vec3 vDir;
${COSMOS_GLSL}
void main() {
  vec3 d = normalize(vDir);
  // The road runs down +z: turn the cosmos's front to face it.
  gl_FragColor = vec4(cosmos(vec3(d.z, d.y, -d.x)) * uVis, 1.0);
  #include <colorspace_fragment>
}`

export function NightCosmos({ vis, small }: { vis: number; small: boolean }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        defines: { COSMOS_OCT: small ? 2 : 3, COSMOS_STARS: 1 },
        uniforms: { uVis: { value: 0 } },
        side: BackSide,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    [small],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const geo = useMemo(() => new SphereGeometry(50, 32, 16), [])
  useEffect(() => () => geo.dispose(), [geo])
  const ref = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    mat.uniforms.uVis.value = vis
    ref.current?.position.copy(camera.position)
  })
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={-5} frustumCulled={false} raycast={() => null} />
}
