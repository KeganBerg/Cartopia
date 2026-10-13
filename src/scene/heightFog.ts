import { Color, Material, ShaderChunk, Vector2, type WebGLProgramParametersWithUniforms } from 'three'

// Fog that lies in the town instead of over it. Every lit material fades into
// it by how much fog the eye looks through on the way to that pixel: thick at
// street level, thinning with height, so lawns and roads sink into it while
// roofs and towers stand clear. Slow noise breaks it into drifting banks.
// It's the scene's own fog chunk, so trees, cars, people and buildings all fog
// the same way at no extra draw cost. uHF = 0 turns it off (races, clear days).
export const fogUniforms = {
  uHF: { value: 0 }, // strength 0..1
  uHFMax: { value: 0.38 }, // the thickest it gets: the town always shows through
  uHFDetail: { value: 1 }, // 0 skips the second layer of noise (phones)
  uHFHeight: { value: 1.5 }, // how fast it thins with height (world units)
  uHFFloor: { value: 0 }, // solid up to here, thinning above
  uHFDensity: { value: 1 },
  uHFPatch: { value: 0.5 }, // 0 an even blanket, 1 broken banks with clear gaps
  uHFScale: { value: 0.045 }, // size of the banks
  uHFGlow: { value: 0 }, // bright lights shine through (night)
  uHFDrift: { value: new Vector2() },
  uHFShade: { value: new Color('#b8c2cc') }, // deep in the fog
  uHFLit: { value: new Color('#f2f0ea') }, // the sunlit tops of the banks
}

// Shares the fog uniforms with a material. Every material gets this by default;
// a custom onBeforeCompile should call it too, or that material skips the fog.
export function addFog(sh: WebGLProgramParametersWithUniforms) {
  Object.assign(sh.uniforms, fogUniforms)
}
Material.prototype.onBeforeCompile = function (sh) {
  addFog(sh)
}

ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogPos;
#endif
`
ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogPos = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);
#endif
`
ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  uniform float uHF;
  uniform float uHFMax;
  uniform float uHFDetail;
  uniform float uHFHeight;
  uniform float uHFFloor;
  uniform float uHFDensity;
  uniform float uHFPatch;
  uniform float uHFScale;
  uniform float uHFGlow;
  uniform vec2 uHFDrift;
  uniform vec3 uHFShade;
  uniform vec3 uHFLit;
  float hfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hfNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hfHash(i), hfHash(i + vec2(1, 0)), f.x), mix(hfHash(i + vec2(0, 1)), hfHash(i + vec2(1, 1)), f.x), f.y);
  }
#endif
`
ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  if ( uHF > 0.001 ) {
    // The eye's ray to this pixel, from wherever it enters the air above.
    vec3 hfRay = isOrthographic ? ( vec3( 0.0, 0.0, - 1.0 ) * mat3( viewMatrix ) ) * 300.0 : vFogPos - cameraPosition;
    vec2 hfQ = vFogPos.xz * uHFScale + uHFDrift;
    float hfN = hfNoise( hfQ );
    if ( uHFDetail > 0.5 ) hfN = hfN * 0.62 + hfNoise( hfQ * 2.3 + vec2( 5.2, 1.3 ) - uHFDrift * 0.7 ) * 0.38;
    // The banks are sampled where the ray lands, which only holds while the ray
    // crosses a short stretch of fog (looking down on the town). A long ray at
    // street level (free view) passes through many banks, so they average out:
    // otherwise neighbouring trees and walls come out in jagged light and dark shards.
    float hfLen = length( hfRay );
    float hfIn = min( hfLen, uHFHeight * 3.0 / max( abs( hfRay.y ) / hfLen, 0.02 ) );
    hfN = mix( 0.5, hfN, clamp( 12.0 / hfIn, 0.0, 1.0 ) );
    // Banks: thicker and taller where the noise is high, thin gaps where it's low.
    float hfBank = mix( 1.0, smoothstep( 0.3, 0.7, hfN ) * 2.0, uHFPatch );
    float hfH = uHFHeight * ( 0.7 + 0.6 * hfN );
    float hfFloor = uHFFloor * ( 0.75 + 0.5 * hfN );
    float hfY0 = max( vFogPos.y - hfFloor, 0.0 );
    float hfY1 = max( vFogPos.y - hfRay.y - hfFloor, 0.0 );
    float hfE0 = exp( - hfY0 / hfH );
    float hfE1 = exp( - hfY1 / hfH );
    float hfDy = hfY1 - hfY0;
    // Fog thinning exponentially with height, summed along the ray.
    float hfTau = uHFDensity * hfBank * hfLen * ( abs( hfDy ) > 0.05 ? hfH * ( hfE0 - hfE1 ) / hfDy : hfE0 );
    float hfF = ( 1.0 - exp( - hfTau ) ) * uHFMax * uHF;
    // Up close in the free view the air is clear: fog only gathers with distance,
    // so a street-level shot isn't behind a flat veil.
    if ( ! isOrthographic ) hfF *= smoothstep( 6.0, 60.0, hfLen );
    // Lit windows and lamps glow through it at night.
    float hfLum = max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) );
    hfF *= 1.0 - uHFGlow * smoothstep( 0.5, 0.95, hfLum );
    vec3 hfCol = mix( uHFShade, uHFLit, clamp( 0.25 + 0.55 * hfN + 0.35 * hfY0 / ( hfH * 2.0 ), 0.0, 1.0 ) );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, hfCol, hfF );
  }
#endif
`
