import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { weatherNow } from '../game/weather'

// The town flag on the Flag Pole, waving in the wind. The cloth ripples in the
// vertex shader, so a flag costs nothing per frame beyond two shared uniforms,
// and Batch can still merge every flag in town into one draw: the wave reads
// only the uv (0 at the pole, 1 at the free end) and the normal, both of which
// survive a merge, and the material is kept by identity (`live`). Breezier
// weather makes it flap harder and faster.

const W = 0.66
const H = 0.44
const flagUniforms = { uFlagTime: { value: 0 }, uFlagWind: { value: 0.2 } }

const cache = new Map<string, MeshStandardMaterial>()

// Green over white with a gold disc in the middle: the town's colours.
function flagTex(gold: string) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 86
  const g = c.getContext('2d')!
  g.fillStyle = '#2e7d32'
  g.fillRect(0, 0, 128, 43)
  g.fillStyle = '#fafafa'
  g.fillRect(0, 43, 128, 43)
  g.fillStyle = gold
  g.beginPath()
  g.arc(64, 43, 15, 0, Math.PI * 2)
  g.fill()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function flagMat(gold: string) {
  let m = cache.get(gold)
  if (m) return m
  m = new MeshStandardMaterial({ map: typeof document === 'undefined' ? null : flagTex(gold), roughness: 0.85, side: DoubleSide })
  m.userData.live = true
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, flagUniforms)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFlagTime;\nuniform float uFlagWind;\nvarying float vFlagShade;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Each flag in its own phase, from where it stands in town.
        vec4 flagAt = modelMatrix * vec4(position, 1.0);
        float flagPhase = flagAt.x * 0.9 + flagAt.z * 0.6;
        float flagSpeed = 3.0 + 6.0 * uFlagWind;
        float flagRipple = sin(uv.x * 7.0 - uFlagTime * flagSpeed + flagPhase)
          + 0.35 * sin(uv.x * 13.0 - uFlagTime * flagSpeed * 1.7 + uv.y * 3.0 + flagPhase);
        // Still at the pole, flapping most at the free end.
        transformed += objectNormal * (0.02 + 0.05 * uFlagWind) * uv.x * flagRipple;
        // The cloth droops a little in a calm and streams out in a gale.
        transformed.y -= (1.0 - uFlagWind) * 0.04 * uv.x * uv.x;
        vFlagShade = 1.0 + 0.16 * uv.x * cos(uv.x * 7.0 - uFlagTime * flagSpeed + flagPhase);`,
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFlagShade;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vFlagShade;')
  }
  m.customProgramCacheKey = () => 'waving-flag'
  cache.set(gold, m)
  return m
}

// The cloth starts at the pole (x = 0) and flies out along +x.
const geo = new PlaneGeometry(W, H, 12, 3).translate(W / 2, 0, 0)

let frame = -1
export function WavingFlag({ gold, at }: { gold: string; at: [number, number, number] }) {
  useFrame(({ clock }) => {
    // Shared by every flag: update once a frame.
    if (clock.elapsedTime === frame) return
    frame = clock.elapsedTime
    flagUniforms.uFlagTime.value = frame
    const wind = 0.2 + 0.8 * weatherNow().wind
    flagUniforms.uFlagWind.value += (wind - flagUniforms.uFlagWind.value) * 0.02
  })
  return <mesh geometry={geo} material={flagMat(gold)} position={at} castShadow dispose={null} />
}
