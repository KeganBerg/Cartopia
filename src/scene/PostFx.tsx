import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, Effect, KernelSize, TiltShiftEffect, ToneMappingMode, type BloomEffect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'
import { fxState, type Look } from './look'
import { usePrefs } from '../lib/prefs'
import { onFx } from '../game/fx'
import { PACES, paceDown, useTownPace } from './townPace'

// Colour grade applied to the whole frame after tone mapping. Keep in step
// with gradeColor() in look.ts, which repeats it for the page background.
const GRADE_FRAG = /* glsl */ `
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float vibrance;
uniform float greens;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float vignette;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(max(inputColor.rgb * exposure, 0.0), vec3(1.0 / 2.2));
  float green = clamp(c.g - max(c.r, c.b), 0.0, 1.0) * greens;
  c += vec3(-0.22, -0.2, 0.03) * green;
  float l0 = luma(c);
  c += shadowTint * (1.0 - smoothstep(0.0, 0.6, l0)) + highlightTint * smoothstep(0.4, 1.0, l0);
  c = (c - 0.5) * contrast + 0.5;
  float l = luma(c);
  float spread = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, saturation + vibrance * (1.0 - min(1.0, spread * 2.0)));
  vec2 d = (uv - 0.5) * vec2(1.0, 0.85);
  c *= 1.0 - vignette * smoothstep(0.3, 0.75, length(d));
  outputColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['exposure', new Uniform(1)],
        ['contrast', new Uniform(1)],
        ['saturation', new Uniform(1)],
        ['vibrance', new Uniform(0)],
        ['greens', new Uniform(0)],
        ['shadowTint', new Uniform(new Vector3())],
        ['highlightTint', new Uniform(new Vector3())],
        ['vignette', new Uniform(0)],
      ]),
    })
  }

  apply(look: Look) {
    const g = look.grade
    const u = this.uniforms
    u.get('exposure')!.value = g.exposure
    u.get('contrast')!.value = g.contrast
    u.get('saturation')!.value = g.saturation
    u.get('vibrance')!.value = g.vibrance
    u.get('greens')!.value = g.greens
    ;(u.get('shadowTint')!.value as Vector3).set(g.shadows.r, g.shadows.g, g.shadows.b)
    ;(u.get('highlightTint')!.value as Vector3).set(g.highlights.r, g.highlights.g, g.highlights.b)
    u.get('vignette')!.value = g.vignette
  }
}

// postprocessing's tilt-shift swaps to its blurred copy with a hard step() at the
// edge of the focus band, which shows as a straight line across the town. Fade
// between the sharp and blurred frames over the feather instead.
const TILT_FRAG = /* glsl */ `
uniform mediump sampler2D map;
uniform vec2 maskParams;
uniform float fade;
varying vec2 vUv2;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float mask = smoothstep(maskParams.x - fade, maskParams.x, vUv2.y) - smoothstep(maskParams.y, maskParams.y + fade, vUv2.y);
  outputColor = mix(texture2D(map, uv), inputColor, mask);
}
`

class SoftTiltShift extends TiltShiftEffect {
  constructor(focusArea: number, feather: number) {
    super({ blendFunction: BlendFunction.NORMAL, focusArea, feather, kernelSize: KernelSize.VERY_SMALL, resolutionScale: 0.5 })
    this.uniforms.set('fade', new Uniform(feather))
    this.setFragmentShader(TILT_FRAG)
  }
}

// How much post-processing a device gets.
// high: full bloom and 4x anti-aliasing (desktops, laptops, tablets).
// low: lighter bloom and 2x anti-aliasing (phones).
// off: plain render, still tone mapped (the fallback if a device struggles).
export type FxTier = 'high' | 'low' | 'off'
const TIERS: FxTier[] = ['high', 'low', 'off']
const STORE = 'cartopia-fx'

function startTier(): FxTier {
  if (typeof window === 'undefined') return 'low'
  const pin = new URLSearchParams(location.search).get('fx')
  if (pin === 'high' || pin === 'low' || pin === 'off') return pin
  // The player's choice in Settings > Graphics wins over the device guess.
  const pick = usePrefs.getState().graphics
  if (pick === 'high') return 'high'
  if (pick === 'saver') return 'off'
  let tier: FxTier = 'high'
  const phone = Math.min(window.innerWidth, window.innerHeight) < 700 || /iPhone|iPod|Android.*Mobile/.test(navigator.userAgent)
  if (phone || (navigator.hardwareConcurrency ?? 8) <= 4) tier = 'low'
  // A device that already had to step down this session starts there.
  try {
    const saved = sessionStorage.getItem(STORE) as FxTier | null
    if (saved && TIERS.indexOf(saved) > TIERS.indexOf(tier)) tier = saved
  } catch {
    // Storage can be blocked; the default tier is fine.
  }
  return tier
}

const pinned = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fx')

// Bloom, tilt-shift, tone mapping and the colour grade.
// `look` is read every frame so the grade follows the time of day. Steps down a
// tier by itself if the frame rate drops.
export function PostFx({ look, town, tiltShift }: { look: Look; town?: boolean; tiltShift?: boolean }) {
  const [tier, setTier] = useState<FxTier>(startTier)
  const graphics = usePrefs((p) => p.graphics)
  useEffect(() => setTier(startTier()), [graphics])
  // Shader compiles and texture uploads stutter the first seconds; only judge after.
  // A burst of effects (Collect All, a build) dips the frame rate for a moment too.
  // Stepping down then rebuilds every shader, a far longer freeze than the dip
  // itself, so judging pauses for a few seconds after each one.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    let id = setTimeout(() => setArmed(true), 5000)
    const off = onFx(() => {
      clearTimeout(id)
      setArmed(false)
      id = setTimeout(() => setArmed(true), 4000)
    })
    return () => {
      off()
      clearTimeout(id)
    }
  }, [])
  const grade = useMemo(() => new GradeEffect(), [])
  const tilt = useMemo(() => new SoftTiltShift(0.72, 0.28), [])
  const bloom = useRef<BloomEffect>(null)

  useEffect(() => () => grade.dispose(), [grade])
  useEffect(() => () => tilt.dispose(), [tilt])
  useEffect(() => {
    if (town) fxState.on = tier !== 'off'
  }, [town, tier])

  useFrame(() => {
    grade.apply(look)
    const b = bloom.current
    if (b) {
      b.intensity = look.grade.bloom * (tier === 'high' ? 1 : 0.85)
      b.luminanceMaterial.threshold = look.grade.threshold
    }
  })

  // The town tries drawing fewer pixels, then fewer frames, before giving up effects.
  const pace = useTownPace((p) => p.step)
  const stepDown = () => {
    if (town && paceDown()) return
    setTier((t) => {
      const next = TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(t) + 1)]
      try {
        sessionStorage.setItem(STORE, next)
      } catch {
        // Not remembered; it will step down again if needed.
      }
      return next
    })
  }

  return (
    <>
      {/* Remounted after each town step so it judges the new setting afresh; at 30 fps the bar drops with it. */}
      {armed && !pinned && graphics === 'auto' && (
        <PerformanceMonitor key={town ? pace : 0} bounds={() => (town && PACES[pace].fps < 60 ? [22, 120] : [40, 120])} flipflops={3} onDecline={stepDown} />
      )}
      {tier !== 'off' && (
        <EffectComposer multisampling={tier === 'high' ? 4 : 2} enableNormalPass={false}>
          {/* Tilt-shift blurs the raw frame, so it goes before bloom; after it, the blurred bands lost their glow. */}
          {tiltShift ? <primitive object={tilt} /> : <></>}
          <Bloom ref={bloom} mipmapBlur levels={tier === 'high' ? 7 : 5} radius={0.75} luminanceThreshold={1} luminanceSmoothing={0.25} intensity={0.3} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <primitive object={grade} />
        </EffectComposer>
      )}
    </>
  )
}
