import type { WebGLProgramParametersWithUniforms } from 'three'

// Car skins: animated patterns that sit at depth inside the paint, like a holo
// decal under a clear coat. Each layer is drawn as if it lay a little way under
// the surface, found by following the view ray into the paint, so the layers
// slide against each other as the car turns or the camera moves.
//
// The pattern works in the car's own space (positions are a car-length of about
// one unit), projected on whichever axis the face mostly points along. One shader
// serves every skin, picked by number (SKINS[].n in game/data.ts); 0 is no skin.
// Town cars share one baked material, so there the number rides on a vertex
// attribute and skins cost no extra draws (see carBatch.ts).

// Shared clock for every skin, set each frame by whichever canvas draws a skinned car.
export const skinClock = { value: 0 }
export const tickSkins = () => void (skinClock.value = (performance.now() / 1000) % 3600)

const GLSL = /* glsl */ `
float skH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 skH2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float skNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skH(i), skH(i + vec2(1.0, 0.0)), f.x), mix(skH(i + vec2(0.0, 1.0)), skH(i + vec2(1.0, 1.0)), f.x), f.y);
}
float skFbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * skNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
vec3 skHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }

// A face's own 2D coordinates: the object-space point seen down the face's main axis.
vec2 skPlane(vec3 q, vec3 n) {
  vec3 a = abs(n);
  return a.x > a.y && a.x > a.z ? q.zy : a.y > a.z ? q.xz : q.xy;
}
// Where the view ray reaches depth d under the paint, in the face's coordinates.
vec2 skAt(vec3 p, vec3 n, vec3 v, float d) { return skPlane(p + v * (d / max(-dot(v, n), 0.3)), n); }

// Hex grid: distance in from the nearest edge (0 on it) and the cell's id.
vec3 skHex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  vec4 r = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
  vec2 a = abs(r.xy);
  return vec3(0.5 - max(dot(a, s * 0.5), a.x), r.zw);
}
// Cracked plates: distance to the nearest border and the plate's id.
vec2 skVor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + skH2(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = skH(i + g); } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d2) - sqrt(d1), id);
}
// A field of stars: round points in some cells, each twinkling on its own beat.
vec3 skStars(vec2 uv, float scale, float t, float keep) {
  vec2 c = floor(uv * scale);
  vec2 h = skH2(c);
  vec2 f = fract(uv * scale) - 0.5 - (h - 0.5) * 0.6;
  float on = step(keep, h.x);
  float s = smoothstep(0.11, 0.0, length(f)) + smoothstep(0.03, 0.0, min(abs(f.x), abs(f.y))) * smoothstep(0.3, 0.0, length(f)) * 0.6;
  float tw = 0.55 + 0.45 * sin(t * (2.0 + h.y * 3.0) + h.x * 60.0);
  return mix(vec3(1.0, 0.95, 0.85), vec3(0.6, 0.8, 1.0), h.y) * s * on * tw;
}

// Paints skin \`id\` over the base colour. p, n: the point and its normal in the car's
// space; v: the view direction there (camera to point). Adds light to glow and may
// change how rough the paint is.
void skinShade(int id, vec3 p, vec3 n, vec3 v, float t, inout vec3 col, inout vec3 glow, inout float rough) {
  float facing = clamp(-dot(v, n), 0.0, 1.0);
  float rim = pow(1.0 - facing, 2.0);
  vec2 uv0 = skPlane(p, n);
  if (id == 1) {
    // Hexcore: a honeycomb glowing deep in the paint, a pulse rolling through it,
    // a dark honeycomb printed on top that slides across the lit one.
    const vec3 cyan = vec3(0.1, 0.89, 1.0);
    vec3 hd = skHex(skAt(p, n, v, 0.07) * 15.0);
    float wave = pow(0.5 + 0.5 * sin(t * 2.2 - dot(hd.yz, vec2(0.35, 0.22)) * 2.0), 6.0);
    float line = smoothstep(0.07, 0.0, hd.x);
    glow += cyan * line * (0.12 + 0.75 * wave);
    col = mix(col, cyan * 0.5, line * 0.35);
    vec3 hm = skHex(skAt(p, n, v, 0.035) * 15.0);
    float r = skH(hm.yz);
    float lit = step(0.82, r) * (0.5 + 0.5 * sin(t * 3.0 + r * 40.0)) * smoothstep(0.0, 0.15, hm.x);
    col = col * 0.7 + cyan * 0.25 * lit;
    glow += cyan * lit * 0.2;
    vec3 hs = skHex(uv0 * 15.0);
    col *= mix(0.35, 1.0, smoothstep(0.0, 0.035, hs.x));
    glow += cyan * rim * 0.12;
  } else if (id == 2) {
    // Overclock: circuit traces under the coat with data pulses racing along them,
    // copper pads and vias on the surface.
    const vec3 green = vec3(0.22, 1.0, 0.53);
    const vec3 copper = vec3(0.95, 0.62, 0.3);
    col *= 0.62;
    for (int i = 0; i < 2; i++) {
      float d = i == 0 ? 0.065 : 0.03;
      float sc = i == 0 ? 11.0 : 7.0;
      vec2 g = skAt(p, n, v, d) * sc + float(i) * 3.7;
      vec2 c = floor(g), f = fract(g);
      float r = skH(c + float(i) * 9.1);
      bool across = r < 0.5;
      float off = across ? abs(f.y - 0.5) : abs(f.x - 0.5);
      float lineW = i == 0 ? 0.05 : 0.07;
      float line = smoothstep(lineW, lineW * 0.4, off) * step(0.12, fract(r * 7.0));
      float run = across ? g.x : g.y;
      float pulse = pow(0.5 + 0.5 * sin(run * 1.1 - t * (3.0 + r * 3.0) + r * 20.0), 14.0);
      float dot1 = smoothstep(0.16, 0.1, length(f - 0.5)) * step(0.8, r);
      float amt = i == 0 ? 0.55 : 1.0;
      glow += green * (line * (0.07 + pulse * 0.9) + dot1 * (0.15 + 0.35 * pulse)) * amt;
      col = mix(col, green * 0.35, line * 0.3 * amt);
    }
    vec2 pg = uv0 * 7.0 + 3.7;
    vec2 pf = fract(pg) - 0.5;
    float pr = skH(floor(pg) + 9.1);
    float pad = step(0.8, pr) * smoothstep(0.2, 0.17, length(pf)) * smoothstep(0.08, 0.1, length(pf));
    col = mix(col, copper * 0.8, pad);
    rough = mix(rough, 0.2, pad);
  } else if (id == 3) {
    // Deep Space: three star fields at different depths over a faint nebula.
    col = mix(col, vec3(0.015, 0.02, 0.06), 0.82);
    vec2 un = skAt(p, n, v, 0.16);
    float neb = skFbm(un * 2.6 + vec2(t * 0.02, 0.0));
    float neb2 = skFbm(un * 4.0 - vec2(0.0, t * 0.015) + 5.0);
    vec3 nc = mix(vec3(0.45, 0.1, 0.65), vec3(0.05, 0.55, 0.75), neb2);
    col += nc * pow(neb, 2.5) * 0.35;
    glow += nc * pow(neb, 3.5) * 0.2;
    glow += skStars(skAt(p, n, v, 0.11), 13.0, t, 0.55) * 0.7;
    glow += skStars(skAt(p, n, v, 0.06), 19.0, t * 1.3, 0.6) * 1.0;
    glow += skStars(skAt(p, n, v, 0.02), 28.0, t * 0.8, 0.75) * 1.3;
    glow += vec3(0.4, 0.5, 1.0) * rim * 0.2;
  } else if (id == 4) {
    // Prismatic: holo foil. Rainbow bands that roll with the viewing angle, fine
    // diffraction lines on top, glints that flash deeper down.
    vec2 ud = skAt(p, n, v, 0.03);
    float band = fract(dot(ud, vec2(0.62, 0.78)) * 3.2 + facing * 1.6 + skNoise(ud * 4.0) * 0.35 + t * 0.08);
    vec3 holo = skHue(band) * 0.85 + 0.15;
    float lines = 0.5 + 0.5 * sin(dot(uv0, vec2(1.0, -1.0)) * 260.0);
    col = mix(col, holo, 0.58) * (0.82 + 0.25 * lines);
    glow += holo * (0.06 + 0.3 * rim);
    vec2 gs = skAt(p, n, v, 0.06) * 34.0;
    vec2 gc = floor(gs);
    float gh = skH(gc);
    float flash = pow(max(0.0, sin(t * 2.5 + gh * 70.0 + facing * 9.0)), 24.0) * step(0.72, gh);
    glow += vec3(1.0) * flash * smoothstep(0.35, 0.0, length(fract(gs) - 0.5)) * 2.0;
    rough = min(rough, 0.18);
  } else if (id == 5) {
    // Fault Line: charred plates over moving lava. The cracks are cut at the
    // surface; the lava is read deeper down, so the cracks look like real gaps.
    vec2 vs = skVor(uv0 * 6.5);
    vec2 vd = skVor(skAt(p, n, v, 0.04) * 6.5);
    vec2 ul = skAt(p, n, v, 0.09);
    float flow = skFbm(ul * 5.0 + vec2(0.0, t * 0.35));
    vec3 lava = mix(vec3(1.0, 0.18, 0.0), vec3(1.0, 0.82, 0.25), flow);
    float crack = smoothstep(0.0, 0.07, vs.x);
    float wall = smoothstep(0.0, 0.16, vd.x);
    float beat = 0.8 + 0.35 * sin(t * 1.8 + vs.y * 30.0);
    col = mix(lava * 0.35, col * mix(0.32, 0.62, vs.y) + vec3(0.03, 0.02, 0.02) * flow, crack);
    glow += lava * (1.0 - crack) * 0.9 * beat;
    glow += lava * (1.0 - wall) * crack * 0.14;
    rough = mix(0.85, rough, crack * 0.5);
  } else if (id == 6) {
    // Aurora: two curtains of light at different depths, swaying slowly.
    col = mix(col, vec3(0.005, 0.015, 0.04), 0.85);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, 0.04 + 0.07 * fi) * (1.6 + fi * 0.5);
      float x = u.x * 2.4 + skFbm(vec2(u.x * 1.3 + fi * 4.0, t * 0.12)) * 2.2;
      float y = u.y * 2.0 + sin(x + t * 0.35 + fi * 2.0) * 0.3;
      float curtain = smoothstep(0.26, 0.0, abs(fract(y + fi * 0.37) - 0.5));
      float rays = pow(skNoise(vec2(x * 9.0, t * 0.6 + fi)), 2.5);
      vec3 c = i == 0 ? vec3(0.24, 1.0, 0.62) : vec3(0.7, 0.3, 1.0);
      glow += c * curtain * (0.12 + 0.75 * rays) * (i == 0 ? 0.6 : 0.45);
      col += c * curtain * 0.08;
    }
    glow += skStars(skAt(p, n, v, 0.14), 20.0, t, 0.8) * 0.4;
  } else if (id == 7) {
    // Riptide: wave lines at three depths, each drifting at its own speed.
    col *= 0.72;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, 0.015 + 0.04 * fi);
      float y = u.y * 8.0 + sin(u.x * 4.5 + t * (0.9 + 0.3 * fi) + fi * 2.0) * 0.55 + skNoise(u * 2.5 + fi) * 0.9;
      float line = smoothstep(0.09, 0.0, abs(fract(y + t * 0.12 * (fi + 1.0)) - 0.5) - 0.03);
      vec3 c = mix(vec3(0.85, 1.0, 1.0), vec3(0.0, 0.55, 1.0), fi / 2.0);
      glow += c * line * (0.55 - 0.15 * fi);
      col = mix(col, c * 0.6, line * 0.25);
    }
  } else if (id == 8) {
    // Static: pixels blinking deep in the paint, scanlines on top.
    col *= 0.55;
    vec2 g = skAt(p, n, v, 0.05) * 17.0;
    vec2 c = floor(g), f = fract(g);
    float r = skH(c);
    float on = step(0.86, skH(c + floor(t * 3.0 + r * 8.0) * 0.137));
    float sq = step(0.14, f.x) * step(0.14, f.y) * step(f.x, 0.9) * step(f.y, 0.9);
    vec3 pc = r < 0.33 ? vec3(1.0, 0.16, 0.7) : r < 0.66 ? vec3(0.1, 0.95, 1.0) : vec3(1.0, 0.9, 0.2);
    glow += pc * on * sq * 0.7;
    col = mix(col, pc * 0.4, on * sq * 0.5);
    vec2 gm = skAt(p, n, v, 0.022) * 34.0;
    float fine = step(0.93, skH(floor(gm) + floor(t * 7.0) * 0.31)) * step(0.2, fract(gm.x)) * step(0.2, fract(gm.y));
    glow += vec3(0.75) * fine * 0.25;
    col *= 0.86 + 0.14 * sin(uv0.y * 170.0 + t * 9.0);
  } else if (id == 9) {
    // Event Horizon: a dark spiral turning on every panel, a hot accretion ring
    // deep down and a violet one nearer the top, stars behind it all.
    col = mix(col, vec3(0.006, 0.003, 0.012), 0.94);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, 0.1 - 0.06 * fi) * 3.0;
      vec2 cell = floor(u + 0.5);
      vec2 q = u - cell;
      float r = length(q);
      float a = atan(q.y, q.x);
      float arm = fract(a / 6.2831853 * 2.0 + log(r + 0.04) * 1.6 - t * (0.25 + 0.1 * fi));
      float s = smoothstep(0.5, 0.0, abs(arm - 0.5)) * smoothstep(0.5, 0.12, r) * smoothstep(0.03, 0.09, r);
      vec3 c = i == 0 ? vec3(1.0, 0.45, 0.1) : vec3(0.62, 0.25, 1.0);
      glow += c * pow(s, 2.0) * (i == 0 ? 0.75 : 0.5);
    }
    glow += skStars(skAt(p, n, v, 0.15), 22.0, t, 0.7) * 0.6;
    glow += vec3(0.55, 0.3, 1.0) * rim * 0.18;
  } else if (id == 10) {
    // Cold Snap: black glassy ice. Faceted shards on top, each catching the light at
    // its own tilt, frost-white seams between them, frozen crystals and glints deeper
    // down, and a cold blue glow coming up through the seams.
    const vec3 ice = vec3(0.55, 0.9, 1.0);
    col = mix(col, vec3(0.006, 0.01, 0.018), 0.97);
    vec2 sh = skVor(uv0 * 5.5);
    float facet = skH(vec2(sh.y * 91.0, 3.1));
    float tilt = pow(clamp(facing * (0.6 + 0.8 * facet) - 0.25, 0.0, 1.0), 3.0);
    col += vec3(0.025, 0.05, 0.08) * tilt + vec3(0.006, 0.01, 0.018) * facet;
    float seam = smoothstep(0.022, 0.0, sh.x);
    col = mix(col, vec3(0.6, 0.85, 0.97), seam * 0.75);
    glow += ice * seam * 0.12;
    vec2 sd = skVor(skAt(p, n, v, 0.035) * 5.5);
    glow += ice * smoothstep(0.12, 0.0, sd.x) * (0.18 + 0.12 * sin(t * 0.8 + sd.y * 20.0));
    vec2 cr = skVor(skAt(p, n, v, 0.07) * 13.0);
    float frost = smoothstep(0.06, 0.0, cr.x) * skFbm(skAt(p, n, v, 0.07) * 3.0 + 2.0);
    glow += ice * frost * 0.3;
    vec2 gs = skAt(p, n, v, 0.02) * 40.0;
    float gh = skH(floor(gs));
    float glint = pow(max(0.0, sin(t * 1.7 + gh * 80.0 + facing * 12.0)), 30.0) * step(0.8, gh);
    glow += vec3(0.9, 0.97, 1.0) * glint * smoothstep(0.3, 0.0, length(fract(gs) - 0.5)) * 1.6;
    glow += ice * rim * 0.14;
    rough = 0.22;
  }
}
`

// The point, normal and view direction in the car's own space, for skinShade.
const VARYINGS = 'varying vec3 vSkP;\nvarying vec3 vSkN;\nvarying vec3 vSkV;\nuniform float uSkinT;'
const VERTEX = /* glsl */ `
vSkP = position;
vSkN = normal;
// The model's rotation undone (uniform scale only shrinks it, and it's normalised later).
vSkV = transpose(mat3(modelMatrix)) * ((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);`

// Adds skins to a standard material's shader. `id` is a GLSL int expression: a
// constant for one car's own paint, or the baked per-vertex number for town cars.
export function withSkin(sh: WebGLProgramParametersWithUniforms, id: string, attr = false) {
  sh.uniforms.uSkinT = skinClock
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${VARYINGS}${attr ? '\nattribute float skin;\nflat varying float vSkin;' : ''}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX}${attr ? '\nvSkin = skin;' : ''}`)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${VARYINGS}${attr ? '\nflat varying float vSkin;' : ''}\n${GLSL}`)
    .replace('#include <normal_fragment_begin>', /* glsl */ `vec3 skGlow = vec3(0.0);
    {
      int skId = ${id};
      if (skId > 0) {
        vec3 skCol = diffuseColor.rgb;
        skinShade(skId, vSkP, normalize(vSkN) * (gl_FrontFacing ? 1.0 : -1.0), normalize(vSkV), uSkinT, skCol, skGlow, roughnessFactor);
        diffuseColor.rgb = skCol;
      }
    }
    #include <normal_fragment_begin>`)
    .replace('#include <lights_fragment_begin>', 'totalEmissiveRadiance += skGlow;\n#include <lights_fragment_begin>')
}
