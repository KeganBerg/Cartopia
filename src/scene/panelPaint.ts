import { Color, Vector4, type WebGLProgramParametersWithUniforms } from 'three'
import { PATTERNS, type Panels } from '../game/data'

// Custom paint on single panels of a car's body (game/data.ts PANELS): the hood, the
// doors and the roof each in their own colour and pattern, and a pattern over the rest.
// The body is one mesh, so panels are picked per pixel from the car's own space (it
// faces +z): the roof is painted metal above the belt line behind the cowl, the hood
// is upward-facing paint ahead of the cowl, the doors are side-facing paint between
// the wheel arches. Patterns are worked out from the same position, in shades of the
// panel's colour, so they line up across a whole car and need no textures.

// Where a car's panels are: [cowl z, belt line y, front door edge z, rear door edge z].
export type Zones = [number, number, number, number]

export type PanelUniforms = {
  uPanC: { value: Color[] }
  uPanPat: { value: Vector4 }
  uZone: { value: Vector4 }
  uZoneOn: { value: number }
}

export const panelUniforms = (): PanelUniforms => ({
  uPanC: { value: [new Color(), new Color(), new Color(), new Color()] },
  uPanPat: { value: new Vector4() },
  uZone: { value: new Vector4() },
  uZoneOn: { value: 0 },
})

const ZONE_OF = ['body', 'hood', 'doors', 'roof'] as const
const patternN = (id?: string) => PATTERNS.find((p) => p.id === id)?.n ?? 0

// Does this paint need the panel shader at all? (Rims are drawn by the wheels.)
export const paintsPanels = (p?: Panels | null) => !!p && ZONE_OF.some((z) => p[z]?.color || p[z]?.pattern)

// Fills the uniforms for a car: `body` is the body's drawn colour, `tint` turns a panel's
// chart colour into how it's drawn (the finish's lift). A panel left alone shows the body
// and its pattern; one with anything set shows its own colour (or the body's) and pattern.
export function setPanels(u: PanelUniforms, panels: Panels | null | undefined, body: string, tint: (c: string) => string, zones?: Zones) {
  const bodyPat = patternN(panels?.body?.pattern)
  const pats = [bodyPat, 0, 0, 0]
  ZONE_OF.forEach((z, i) => {
    const p = i ? panels?.[z] : undefined
    const set = !!(p && (p.color || p.pattern))
    u.uPanC.value[i].set(set && p!.color ? tint(p!.color) : body)
    if (i) pats[i] = set ? patternN(p!.pattern) : bodyPat
  })
  u.uPanPat.value.set(pats[0], pats[1], pats[2], pats[3])
  if (zones) u.uZone.value.set(...zones)
  u.uZoneOn.value = zones ? 1 : 0
}

const GLSL = /* glsl */ `
varying vec3 vPanP;
varying vec3 vPanN;
uniform vec3 uPanC[4];
uniform vec4 uPanPat;
uniform vec4 uZone;
uniform float uZoneOn;
float panH(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float panN(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(panH(i), panH(i + vec3(1, 0, 0)), f.x), mix(panH(i + vec3(0, 1, 0)), panH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(panH(i + vec3(0, 0, 1)), panH(i + vec3(1, 0, 1)), f.x), mix(panH(i + vec3(0, 1, 1)), panH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float panF(vec3 p) { return panN(p) * 0.55 + panN(p * 2.07 + 7.1) * 0.3 + panN(p * 4.3 + 3.3) * 0.15; }
// Mirrored across the car's centre line, as a painter would do both sides.
vec3 panSym(vec3 p) { return vec3(abs(p.x), p.y, p.z); }
// Which panel a point is on: 0 body, 1 hood, 2 doors, 3 roof.
int panZone(vec3 p, vec3 n) {
  if (uZoneOn < 0.5) return 0;
  if (p.y > uZone.y + 0.015 && p.z < uZone.x + 0.02) return 3;
  if (n.y > 0.35 && p.z > uZone.x) return 1;
  if (abs(n.x) > 0.55 && p.z < uZone.z && p.z > uZone.w && p.y < uZone.y) return 2;
  return 0;
}
// Three shades of the colour in soft blobs, with a light fleck.
vec3 panCamo(vec3 c, vec3 p, float edge) {
  float a = panF(p * 6.5);
  float b = panF(p * 6.5 + vec3(11.3, 4.1, 8.7));
  float l = panF(p * 8.0 + vec3(3.7, 9.2, 1.4));
  vec3 o = mix(c, c * 0.55, smoothstep(0.5 - edge, 0.5 + edge, a));
  o = mix(o, c * 0.26, smoothstep(0.56 - edge, 0.56 + edge, b));
  return mix(o, mix(c, vec3(1.0), 0.4), smoothstep(0.63 - edge, 0.63 + edge, l) * (1.0 - smoothstep(0.5 - edge, 0.5 + edge, a)));
}
// Two axes of the face a point is on, picked by the normal, for flat patterns.
vec2 panFace(vec3 p, vec3 n) {
  vec3 m = abs(n);
  return m.y > m.x && m.y > m.z ? p.xz : m.x > m.z ? p.zy : p.xy;
}
vec3 panPattern(int id, vec3 c, vec3 p, vec3 n) {
  vec3 q = panSym(p);
  if (id == 1) return panCamo(c, q, 0.012);
  if (id == 2) return panCamo(c, floor(q / 0.028) * 0.028, 0.0);
  if (id == 3) {
    // Tiger: dark stripes wrapping round the body, wavering, thinning out to points.
    float w = q.z * 42.0 + q.y * 14.0 + panF(q * 4.0) * 6.0;
    float t = sin(w) * 0.5 + 0.5;
    float k = 0.55 + 0.4 * panN(vec3(floor(w / 6.2832) * 1.7, q.x * 7.0 + q.y * 5.0, 0.5));
    return mix(c, c * 0.06, smoothstep(k, k + 0.05, t));
  }
  if (id == 4) {
    vec2 g = floor(panFace(q, n) / 0.07);
    return mix(c, vec3(0.012), mod(g.x + g.y, 2.0));
  }
  if (id == 5) {
    // Carbon weave: dark tows over-under, catching a little of the colour.
    vec2 f = panFace(p, n) / 0.022;
    vec2 cell = floor(f);
    vec2 t = fract(f);
    bool along = mod(cell.x + cell.y, 2.0) < 1.0;
    float across = along ? t.y : t.x;
    float sheen = 0.5 + 0.5 * sin(across * 3.14159);
    return mix(vec3(0.012), c * 0.35 + 0.02, sheen * (along ? 0.75 : 0.45));
  }
  return c;
}
`

// Adds the panels to a standard material's shader, after its colour is set and before
// any skin, which is drawn on top.
export function withPanels(sh: WebGLProgramParametersWithUniforms, u: PanelUniforms) {
  Object.assign(sh.uniforms, u)
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPanP;\nvarying vec3 vPanN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanP = position;\nvPanN = normal;')
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${GLSL}`)
    .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
    {
      vec3 pn = normalize(vPanN) * (gl_FrontFacing ? 1.0 : -1.0);
      int z = panZone(vPanP, pn);
      vec3 c = z == 0 ? diffuseColor.rgb : uPanC[z];
      float pat = z == 0 ? uPanPat.x : z == 1 ? uPanPat.y : z == 2 ? uPanPat.z : uPanPat.w;
      diffuseColor.rgb = panPattern(int(pat + 0.5), c, vPanP, pn);
    }`)
}
