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
// Like skVor, plus the cell's own point: border distance, id, point.
vec4 skVorP(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  vec2 pt = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = skH2(i + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = skH(i + g); pt = i + g + o; } else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d2) - sqrt(d1), id, pt);
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

// Weekly event skins' helpers.
// Water caustics: bright wavy lines of sunlight focused by ripples (Shallows). Wants p far
// from the origin (around -250), where the lines come out thin.
float skCaustic(vec2 p, float t) {
  vec2 i = p;
  float c = 1.0;
  for (int k = 0; k < 4; k++) {
    float tt = t * (1.0 - 3.5 / float(k + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.006), p.y / (cos(i.y + tt) / 0.006)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
// Out-of-focus city lights: soft discs in neon colours drifting past (Rain Glass).
vec3 skBokeh(vec2 u, float t) {
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 g = u * (3.0 + fk * 2.2) + vec2(t * (0.05 + fk * 0.04), fk * 3.1);
    vec2 c = floor(g);
    vec2 h = skH2(c + fk * 7.0);
    float d = length(fract(g) - 0.5 - (h - 0.5) * 0.5);
    float r = 0.18 + h.y * 0.16;
    float disc = smoothstep(r, r - 0.06, d) * (0.75 + 0.25 * smoothstep(r - 0.1, r - 0.02, d));
    vec3 hue = h.x < 0.33 ? vec3(1.0, 0.25, 0.85) : h.x < 0.66 ? vec3(0.2, 0.85, 1.0) : vec3(1.0, 0.78, 0.25);
    float on = step(0.35, fract(h.x * 13.0)) * (0.75 + 0.25 * sin(t * (0.7 + h.y) + h.x * 40.0));
    acc += hue * disc * on * (0.9 - fk * 0.35);
  }
  return acc;
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
    // Cold Snap: shattered ice. Long angular shards in white, pale ice and teal, each
    // split once more by a crack and tilted its own way so it brightens or dims as
    // the view turns; darker teal breaks between them, and a deeper layer of teal
    // shards that slides beneath the top one.
    const mat2 rotA = mat2(0.8, 0.6, -0.6, 0.8);
    const mat2 rotB = mat2(0.34, -0.94, 0.94, 0.34);
    vec2 su = (rotA * uv0) * vec2(4.6, 10.5);
    vec4 sh = skVorP(su);
    float a = sh.y * 6.2831853;
    vec2 dir = vec2(cos(a), sin(a));
    float cut = dot(su - sh.zw, dir);
    float sub = step(0.0, cut);
    float fid = fract(sh.y * 7.31 + sub * 0.37);
    // White ice at the front fading to teal at the back, shard by shard.
    float along = smoothstep(-0.2, 0.5, p.z + (fid - 0.5) * 0.25);
    vec3 teal = fid < 0.2 ? vec3(0.36, 0.86, 0.9) : fid < 0.48 ? vec3(0.16, 0.7, 0.78) : fid < 0.74 ? vec3(0.06, 0.52, 0.6) : fid < 0.9 ? vec3(0.03, 0.34, 0.42) : vec3(0.02, 0.14, 0.2);
    vec3 white = fid < 0.35 ? vec3(0.96, 0.98, 0.99) : fid < 0.62 ? vec3(0.86, 0.91, 0.93) : fid < 0.82 ? vec3(0.7, 0.79, 0.83) : fid < 0.93 ? vec3(0.45, 0.56, 0.62) : vec3(0.2, 0.3, 0.38);
    vec3 shade = mix(teal, white, along);
    float tiltF = 0.7 + 0.4 * sin(facing * (3.0 + 4.0 * fid) + fid * 30.0);
    float grad = 0.85 + 0.2 * dot(su - sh.zw, vec2(dir.y, -dir.x));
    vec3 top = shade * tiltF * grad;
    vec4 dp = skVorP((rotB * skAt(p, n, v, 0.05)) * vec2(2.4, 6.0) + 4.0);
    vec3 deep = mix(vec3(0.08, 0.3, 0.38), vec3(0.45, 0.78, 0.84), fract(dp.y * 5.3)) * (0.7 + 0.3 * smoothstep(0.0, 0.04, dp.x));
    float clear = (fid > 0.2 && fid < 0.74 ? 0.3 : 0.08) * (1.0 - 0.7 * along);
    col = mix(top, deep, clear);
    float crack = smoothstep(0.035, 0.0, abs(cut)) * 0.85;
    float seam = smoothstep(0.05, 0.0, sh.x);
    col = mix(col, mix(vec3(0.05, 0.17, 0.22), vec3(0.32, 0.4, 0.46), along), max(seam, crack) * 0.9);
    col = mix(col, vec3(1.0), smoothstep(0.012, 0.0, abs(sh.x - 0.045)) * 0.5);
    vec2 gs = skAt(p, n, v, 0.02) * 40.0;
    float gh = skH(floor(gs));
    float glint = pow(max(0.0, sin(t * 1.7 + gh * 80.0 + facing * 12.0)), 30.0) * step(0.85, gh);
    glow += vec3(0.9, 0.97, 1.0) * glint * smoothstep(0.3, 0.0, length(fract(gs) - 0.5)) * 1.2;
    glow += vec3(0.55, 0.85, 1.0) * rim * 0.06;
    rough = 0.2;
  } else if (id == 11) {
    // Ember (mod skin): flames streaming back along the part, a hot layer deep down
    // and a thinner, faster one near the top.
    col = mix(col, vec3(0.04, 0.012, 0.005), 0.85);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec3 q = p + v * ((0.07 - 0.045 * fi) / max(-dot(v, n), 0.3));
      vec2 u = vec2(q.x * 6.0 + fi * 3.0, q.y * 9.0 + q.z * 9.0 + t * (1.4 + 0.8 * fi));
      float f = skFbm(u) * (0.75 + 0.5 * skNoise(u * 0.5 + 7.0));
      float hot = smoothstep(0.45, 0.85, f);
      vec3 c = mix(vec3(0.9, 0.1, 0.0), vec3(1.0, 0.75, 0.2), hot);
      glow += c * smoothstep(0.35, 0.7, f) * (i == 0 ? 0.55 : 0.75);
      col = mix(col, c * 0.4, smoothstep(0.4, 0.8, f) * 0.5);
    }
  } else if (id == 12) {
    // Neon Pulse (mod skin): bright bands racing front to back, magenta deep and cyan
    // shallow, so they split apart at an angle; a fine grid on the surface.
    col *= 0.35;
    vec3 qd = p + v * (0.05 / max(-dot(v, n), 0.3));
    vec3 qs = p + v * (0.015 / max(-dot(v, n), 0.3));
    float bd = pow(0.5 + 0.5 * sin(qd.z * 30.0 + t * 5.0), 10.0);
    float bs = pow(0.5 + 0.5 * sin(qs.z * 30.0 + t * 5.0 - 0.6), 14.0);
    glow += vec3(1.0, 0.17, 0.84) * bd * 0.8 + vec3(0.17, 0.91, 1.0) * bs * 0.9;
    vec2 gl = abs(fract(uv0 * 28.0) - 0.5);
    col += vec3(0.25, 0.1, 0.35) * smoothstep(0.46, 0.5, max(gl.x, gl.y));
    rough = min(rough, 0.25);
  } else if (id == 13) {
    // Carbon Prism (mod skin): a carbon twill on top with gaps that show a rainbow
    // sheen deeper down, its colours rolling with the viewing angle.
    vec2 w = uv0 * 34.0;
    vec2 wc = floor(w);
    float dir = mod(wc.x + wc.y, 2.0);
    float thread = 0.5 + 0.5 * sin((dir > 0.5 ? w.x : w.y) * 6.2831853);
    float weave = mix(0.025, 0.09, thread * (0.6 + 0.4 * facing));
    vec2 ud = skAt(p, n, v, 0.04);
    vec3 holo = skHue(fract(dot(ud, vec2(0.7, 0.7)) * 2.5 + facing * 1.8 + t * 0.05)) * 0.8 + 0.1;
    float gap = smoothstep(0.35, 0.05, thread);
    col = mix(vec3(weave), holo * 0.55, gap * 0.6);
    glow += holo * (gap * 0.25 + rim * 0.2);
    rough = 0.3;
  } else if (id == 14) {
    // Gold Leaf (mod skin): warm gold with flakes at three depths that wink as the
    // car moves.
    col = mix(col, vec3(0.85, 0.6, 0.18), 0.85);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 g = skAt(p, n, v, 0.01 + 0.03 * fi) * (55.0 - 12.0 * fi);
      vec2 c = floor(g);
      vec2 h = skH2(c + fi * 13.0);
      float flake = smoothstep(0.32, 0.12, length(fract(g) - 0.5 - (h - 0.5) * 0.4));
      float wink = pow(max(0.0, sin(h.x * 60.0 + facing * (8.0 + 6.0 * h.y) + t * (0.6 + h.y))), 12.0);
      glow += vec3(1.0, 0.85, 0.45) * flake * wink * (0.9 - 0.25 * fi);
      col += vec3(0.12, 0.08, 0.02) * flake * h.y;
    }
    rough = 0.25;
  } else if (id == 15) {
    // Thunderhead: storm clouds rolling deep in the paint, lit from inside when
    // lightning forks through a nearer layer, each patch striking on its own beat.
    float cl = skFbm(skAt(p, n, v, 0.12) * 3.2 + vec2(t * 0.06, t * 0.02));
    float cl2 = skFbm(skAt(p, n, v, 0.05) * 5.0 - vec2(t * 0.09, 0.0) + 3.0);
    col = mix(vec3(0.01, 0.012, 0.03), vec3(0.24, 0.27, 0.38), smoothstep(0.35, 0.75, cl));
    col = mix(col, vec3(0.36, 0.4, 0.5), smoothstep(0.55, 0.85, cl2) * 0.45);
    vec2 ub = skAt(p, n, v, 0.08) * vec2(2.4, 1.7);
    vec2 bc = floor(ub), bf = fract(ub);
    float bh = skH(bc);
    float rate = 0.16 + bh * 0.14;
    float beat = fract(t * rate + bh * 7.0);
    float si = floor(t * rate + bh * 7.0);
    float strike = step(beat, 0.14) * (0.55 + 0.45 * step(0.5, fract(beat * 60.0)));
    float sd = skH(bc + si * 0.71);
    float x = 0.5 + (skNoise(vec2(bf.y * 5.0, sd * 50.0)) - 0.5) * 0.45 + (skNoise(vec2(bf.y * 19.0, sd * 90.0)) - 0.5) * 0.12;
    float fx = x + (bf.y - 0.55) * (sd > 0.5 ? 0.9 : -0.9) + (skNoise(vec2(bf.y * 23.0, sd * 30.0)) - 0.5) * 0.08;
    float span = smoothstep(0.04, 0.12, bf.y) * smoothstep(0.98, 0.85, bf.y);
    float bolt = smoothstep(0.028, 0.0, abs(bf.x - x)) * span;
    bolt = max(bolt, smoothstep(0.016, 0.0, abs(bf.x - fx)) * step(bf.y, 0.55) * smoothstep(0.1, 0.25, bf.y) * 0.8);
    float halo = smoothstep(0.2, 0.0, abs(bf.x - x)) * span;
    vec3 flash = vec3(0.7, 0.82, 1.0);
    // Between strikes the last bolt still smoulders faintly in the cloud.
    glow += flash * (bolt * (0.3 + 1.9 * strike) + halo * 0.25 * strike);
    glow += vec3(0.45, 0.55, 1.0) * bolt * 0.15;
    col += vec3(0.35, 0.4, 0.55) * strike * smoothstep(0.75, 0.0, length(bf - 0.5)) * cl;
    glow += flash * rim * 0.08;
  } else if (id == 16) {
    // Contour: a topographic map, its height lines glowing teal deep down and amber
    // near the top so they slide apart as the car turns; a scan line climbs the hills.
    col = mix(col, vec3(0.02, 0.05, 0.055), 0.82);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, i == 0 ? 0.08 : 0.02);
      float h = skFbm(u * 1.7 + vec2(4.0, 1.0));
      float c = h * 16.0;
      float dl = abs(fract(c) - 0.5);
      float major = step(mod(floor(c + 0.5), 5.0), 0.5);
      float line = smoothstep(0.39 - major * 0.05, 0.47, dl);
      float scan = pow(1.0 - abs(fract(h * 1.4 - t * 0.07) - 0.5) * 2.0, 18.0);
      vec3 c3 = i == 0 ? vec3(0.1, 0.75, 0.65) : vec3(1.0, 0.7, 0.28);
      glow += c3 * line * ((i == 0 ? 0.22 : 0.35) + major * 0.25 + scan * 1.2);
      col = mix(col, c3 * 0.35, line * (0.25 + fi * 0.2));
      col += c3 * scan * 0.04;
    }
  } else if (id == 17) {
    // Cascade: amber code falling down the panels in columns, a dim layer deep in the
    // paint and a bright one near the top, each glyph flickering as it changes.
    col = mix(col, vec3(0.03, 0.015, 0.0), 0.88);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float sc = i == 0 ? 26.0 : 16.0;
      vec2 g = skAt(p, n, v, i == 0 ? 0.07 : 0.02) * sc + fi * 11.0;
      float colm = floor(g.x);
      float ch = skH(vec2(colm, fi));
      float y = g.y + t * (3.0 + ch * 5.0);
      float trail = fract(y / (10.0 + ch * 12.0) + ch);
      float cy = floor(y);
      vec2 f = vec2(fract(g.x), fract(y));
      vec2 sub = floor(f * vec2(3.0, 5.0));
      float bit = step(0.45, skH(vec2(colm, cy) + sub * 0.17 + floor(t * 3.0 + ch * 9.0) * 0.031 * step(0.9, skH(vec2(cy, colm)))));
      float inGlyph = step(0.15, f.x) * step(f.x, 0.85) * step(0.1, f.y) * step(f.y, 0.9);
      float on = step(0.25, ch) * bit * inGlyph * pow(trail, 2.5);
      vec3 amber = mix(vec3(1.0, 0.45, 0.05), vec3(1.0, 0.92, 0.7), step(0.96, trail));
      glow += amber * on * (i == 0 ? 0.45 : 0.9);
      col += amber * on * 0.12;
    }
    col *= 0.9 + 0.1 * sin(uv0.y * 160.0);
  } else if (id == 18) {
    // Biolume: the deep sea. Glowing jellies drift up through the dark, plankton
    // sparks sit nearer the top and faint caustics ripple over the surface.
    col = mix(col, vec3(0.0, 0.02, 0.05), 0.9);
    vec2 uj = skAt(p, n, v, 0.13) * 4.0 - vec2(0.0, t * 0.12);
    vec2 jc = floor(uj);
    vec2 jh = skH2(jc);
    vec2 jf = fract(uj) - 0.5 - (jh - 0.5) * 0.5;
    float jr = length(jf * vec2(1.0, 1.3));
    float jon = step(0.2, jh.x);
    float pulse = 0.55 + 0.45 * sin(t * (1.2 + jh.y) + jh.x * 40.0);
    vec3 jcol = mix(vec3(1.0, 0.25, 0.75), vec3(0.55, 0.3, 1.0), jh.y);
    glow += jcol * jon * (smoothstep(0.36, 0.0, jr) * 0.7 + smoothstep(0.2, 0.15, jr) * smoothstep(0.08, 0.17, jr) * 0.9) * pulse;
    float tent = smoothstep(0.03, 0.0, abs(sin(jf.x * 25.0 + jf.y * 6.0 + t * 2.0)) * 0.1) * step(0.0, -jf.y) * smoothstep(0.45, 0.1, length(jf));
    glow += jcol * jon * tent * 0.3 * pulse;
    vec2 up = skAt(p, n, v, 0.05) + vec2(sin(t * 0.3) * 0.02, -t * 0.03);
    glow += skStars(up, 24.0, t * 1.5, 0.55) * vec3(0.2, 1.0, 0.85) * 0.9;
    vec2 cs = skVor(uv0 * 5.0 + vec2(t * 0.15, t * 0.1));
    vec2 cs2 = skVor(uv0 * 7.0 - vec2(t * 0.11, 0.0) + 3.0);
    float caus = smoothstep(0.05, 0.0, cs.x) * 0.6 + smoothstep(0.04, 0.0, cs2.x) * 0.4;
    glow += vec3(0.25, 0.7, 0.9) * caus * 0.06;
  } else if (id == 19) {
    // Ghost Camo: blocky digital camo whose colours slide round the wheel as the car
    // turns, with a deeper layer showing through its darkest blocks and a cloak
    // shimmer sweeping across.
    vec2 qb = floor(uv0 * 34.0) / 34.0;
    float lv = skNoise(qb * 4.0) * 0.6 + skNoise(qb * 9.0 + 5.0) * 0.4;
    float band = floor(lv * 4.0) / 3.0;
    float hue = 0.42 + facing * 0.45 + t * 0.015;
    vec3 top = band < 0.4 ? skHue(fract(hue)) * 0.06 + 0.02 : band < 0.7 ? skHue(fract(hue + 0.06)) * 0.3 + 0.03 : skHue(fract(hue + 0.13)) * 0.6 + 0.08;
    vec2 qd = floor(skAt(p, n, v, 0.06) * 22.0) / 22.0;
    float ld = skNoise(qd * 5.0 + 9.0);
    vec3 deep = skHue(fract(hue + 0.5)) * (0.15 + 0.45 * step(0.5, ld));
    col = band < 0.2 ? mix(top, deep, 0.75) : top;
    float sweep = pow(1.0 - abs(fract(dot(uv0, vec2(0.35, 1.0)) * 0.6 - t * 0.12) - 0.5) * 2.0, 10.0);
    vec2 bf = abs(fract(uv0 * 34.0) - 0.5);
    float edge = smoothstep(0.4, 0.5, max(bf.x, bf.y));
    glow += skHue(fract(hue + 0.25)) * sweep * (0.15 + edge * 0.6);
    rough = 0.45;
  } else if (id == 20) {
    // Quicksilver: liquid chrome with drops landing on it, rings spreading out, and
    // an oil-slick sheen deeper down that shows at glancing angles.
    vec2 u = skAt(p, n, v, 0.015) * 3.0;
    float h = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float per = 2.6 + fi * 0.9;
      float k = floor(t / per + fi * 0.37);
      float age = fract(t / per + fi * 0.37);
      vec2 cell = floor(u + fi * 0.5);
      vec2 c = cell + skH2(cell + k * 1.3 + fi);
      float r = length(u + fi * 0.5 - c);
      h += sin(r * 30.0 - age * 20.0) * exp(-r * 5.0) * (1.0 - age) * smoothstep(age * 1.2 + 0.15, age * 1.2 - 0.05, r) * 0.6;
    }
    // Chrome: the reflected ray's height picks dark ground or bright sky, the
    // horizon between them bent by slow liquid swells and the ripples.
    vec3 rf = reflect(v, n);
    float swell = skFbm(uv0 * 2.2 + vec2(t * 0.05, -t * 0.04)) - 0.5;
    float hy = rf.y * 0.45 + swell * 1.3 + h * 0.4 + 0.18 * sin(dot(uv0, vec2(1.0, 3.0)) * 4.0 + t * 0.3);
    vec3 skyc = mix(vec3(0.48, 0.52, 0.6), vec3(1.0), smoothstep(0.05, 0.7, hy));
    vec3 gnd = mix(vec3(0.03, 0.035, 0.045), vec3(0.22, 0.23, 0.26), smoothstep(-0.6, -0.05, hy));
    col = mix(gnd, skyc, smoothstep(-0.03, 0.03, hy));
    col += vec3(1.0) * smoothstep(0.02, 0.0, abs(hy - 0.0)) * 0.4;
    vec3 film = skHue(fract(dot(skAt(p, n, v, 0.06), vec2(0.8, 0.6)) * 1.8 + facing * 2.2 + t * 0.03));
    col = mix(col, col * (0.6 + film * 0.8), rim * 0.8);
    glow += vec3(0.9, 0.95, 1.0) * pow(max(h, 0.0), 3.0) * 0.6;
    rough = 0.04;
  } else if (id == 21) {
    // Wyrmscale: overlapping dragon scales that shift from emerald to gold as the
    // light catches each one, with embers glowing in the seams deeper down.
    vec2 s = uv0 * vec2(14.0, 18.0);
    float fl = floor(s.y);
    float o0 = mod(fl, 2.0) * 0.5;
    vec2 c = vec2(floor(s.x - o0) + 0.5 + o0, fl);
    float d = length((s - c) * vec2(1.0, 1.15));
    if (d > 0.72) {
      float o1 = mod(fl + 1.0, 2.0) * 0.5;
      c = vec2(floor(s.x - o1) + 0.5 + o1, fl + 1.0);
      d = length((s - c) * vec2(1.0, 1.15));
    }
    float edge = 0.72 - d;
    float sid = skH(c);
    float dome = smoothstep(0.72, 0.05, d);
    float irid = 0.5 + 0.5 * sin(facing * 6.0 + sid * 9.0 + (s.y - c.y) * 3.0);
    vec3 sc = mix(vec3(0.0, 0.16, 0.08), vec3(0.08, 0.62, 0.36), irid);
    sc = mix(sc, vec3(0.9, 0.62, 0.1), smoothstep(0.85, 1.0, irid) * 0.7);
    col = sc * (0.2 + 0.85 * dome) * smoothstep(0.0, 0.07, edge);
    col += vec3(0.9, 0.7, 0.2) * smoothstep(0.05, 0.0, abs(edge - 0.08)) * 0.35;
    float heat = skFbm(skAt(p, n, v, 0.05) * 5.0 + vec2(0.0, t * 0.4));
    vec3 ember = mix(vec3(1.0, 0.18, 0.0), vec3(1.0, 0.65, 0.15), heat);
    glow += ember * smoothstep(0.08, 0.0, edge) * (0.25 + 0.9 * smoothstep(0.35, 0.75, heat));
    float glint = pow(max(0.0, sin(facing * 14.0 + sid * 60.0 + t * 0.8)), 20.0);
    glow += vec3(1.0, 0.9, 0.55) * glint * dome * 0.35;
    rough = 0.22;
  } else if (id == 22) {
    // Night Drive: a striped sunset sun low in a violet sky deep in the paint, a
    // neon grid scrolling over the top of it.
    vec2 ud = skAt(p, n, v, 0.1);
    float gy = fract(ud.y * 1.3 + 0.35);
    vec3 sky = mix(vec3(0.04, 0.0, 0.1), vec3(0.85, 0.12, 0.5), smoothstep(0.1, 0.9, gy));
    sky = mix(sky, vec3(1.0, 0.55, 0.2), smoothstep(0.75, 1.0, gy));
    float sx = ud.x * 1.3;
    vec2 q = vec2(sx - floor(sx + 0.5), (gy - 0.62) * 1.0);
    float r = length(q);
    float cut = q.y < 0.0 ? step(0.5 + q.y * 1.5, fract(q.y * 16.0 - t * 0.4)) : 1.0;
    float sun = smoothstep(0.24, 0.23, r) * cut;
    vec3 sunc = mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.9, 0.35), smoothstep(-0.2, 0.2, q.y));
    col = mix(sky * 0.45, sunc * 0.7, sun);
    glow += sunc * sun * 0.55 + sky * 0.08;
    vec2 g = uv0 * 12.0 + vec2(t * 1.6, 0.0);
    vec2 gl = abs(fract(g) - 0.5);
    float grid = max(smoothstep(0.44, 0.49, gl.x), smoothstep(0.44, 0.49, gl.y));
    vec3 gc = mix(vec3(1.0, 0.2, 0.85), vec3(0.2, 0.9, 1.0), 0.5 + 0.5 * sin(t * 0.5 + uv0.x * 2.0));
    glow += gc * grid * 0.75;
    col = mix(col, gc * 0.4, grid * 0.5);
    rough = min(rough, 0.25);
  } else if (id == 23) {
    // Petal Storm: blossom petals tumbling past at three depths over a dusk sky,
    // the far ones dim and soft, the near ones bright.
    vec2 ug = skAt(p, n, v, 0.14);
    col = mix(vec3(0.12, 0.05, 0.2), vec3(0.75, 0.38, 0.5), smoothstep(-0.1, 0.5, ug.y + 0.12 * sin(ug.x * 2.0)));
    col *= 0.6;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float sc = 9.0 - fi * 2.0;
      vec2 u = skAt(p, n, v, 0.1 - 0.04 * fi) * sc + vec2(t * (0.45 + 0.2 * fi), -t * (0.3 + 0.15 * fi)) + fi * 7.3;
      vec2 c = floor(u);
      vec2 h = skH2(c + fi * 3.1);
      vec2 f = fract(u) - 0.5 - (h - 0.5) * 0.4;
      float a = t * (0.8 + h.y * 1.5) + h.x * 30.0;
      f = mat2(cos(a), sin(a), -sin(a), cos(a)) * f;
      float flip = 0.45 + 0.55 * abs(sin(t * (1.0 + h.x) + h.y * 20.0));
      vec2 pf = vec2(f.x / flip, f.y);
      float pd = length(pf * vec2(1.0, 1.9)) + 0.06 * smoothstep(0.0, 0.1, pf.x) * (1.0 - smoothstep(0.0, 0.05, abs(pf.y)));
      float soft = 0.05 - fi * 0.015;
      float petal = smoothstep(0.17 + soft, 0.17 - soft, pd) * step(0.45, h.x);
      vec3 pc = mix(vec3(1.0, 0.55, 0.7), vec3(1.0, 0.92, 0.95), smoothstep(0.1, -0.1, pf.x));
      col = mix(col, pc * (0.55 + 0.2 * fi), petal * (0.45 + 0.25 * fi));
      glow += pc * petal * (0.08 + 0.1 * fi);
    }
  } else if (id == 24) {
    // Kaleido: stained glass turning in a kaleidoscope, lead lines on the surface
    // and a second wheel deeper down spinning the other way through the clear panes.
    vec3 res = vec3(0.0);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, i == 0 ? 0.07 : 0.0) * 1.5;
      vec2 q = u - floor(u + 0.5);
      float r = length(q);
      float a = atan(q.y, q.x) + t * (i == 0 ? -0.12 : 0.18);
      float seg = 6.2831853 / 8.0;
      a = abs(mod(a, seg) - seg * 0.5);
      vec2 k = vec2(cos(a), sin(a)) * r * 6.0;
      vec2 vv = skVor(k + fi * 5.0);
      vec3 glass = skHue(fract(vv.y * 0.8 + r * 0.6 + fi * 0.3 + t * 0.02));
      glass *= glass * 0.9;
      float lead = smoothstep(0.05, 0.1, vv.x);
      if (i == 0) res = glass * (0.3 + 0.7 * lead);
      else {
        float clear = step(0.75, fract(vv.y * 3.7));
        vec3 pane = mix(glass, res, clear * 0.8);
        col = pane * lead * 0.6;
        glow += pane * lead * (0.22 + 0.35 * facing * facing);
        col += vec3(0.02) * (1.0 - lead);
      }
    }
    rough = 0.15;
  } else if (id == 25) {
    // Tracer (mod skin): long-exposure light streaks racing back along the part,
    // white-hot heads fading to red tails, one layer deep and one shallow.
    col = mix(col, vec3(0.02, 0.02, 0.03), 0.85);
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec3 q = p + v * ((0.05 - 0.035 * fi) / max(-dot(v, n), 0.3));
      float lane = (q.y + q.x * 0.6) * (40.0 - fi * 12.0);
      float li = floor(lane);
      float lh = skH(vec2(li, fi));
      float thin = smoothstep(0.35, 0.05, abs(fract(lane) - 0.5));
      float run = fract(q.z * (1.2 + lh) + t * (0.6 + lh * 1.4) + lh * 9.0);
      float streak = pow(run, 3.0) * step(0.4, lh);
      vec3 c = mix(vec3(1.0, 0.1, 0.05), vec3(1.0, 0.95, 0.8), smoothstep(0.8, 1.0, run));
      glow += c * streak * thin * (0.7 + 0.4 * fi);
    }
    rough = 0.3;
  } else if (id == 26) {
    // Toxic (mod skin): glowing green sludge churning deep down, bubbles rising
    // through it and popping at the surface.
    vec2 ug = skAt(p, n, v, 0.06);
    float slime = skFbm(ug * 6.0 + vec2(t * 0.15, -t * 0.4));
    vec3 goo = mix(vec3(0.05, 0.25, 0.0), vec3(0.6, 1.0, 0.1), smoothstep(0.35, 0.8, slime));
    col = goo * 0.45;
    glow += goo * smoothstep(0.5, 0.85, slime) * 0.55;
    vec2 ub = skAt(p, n, v, 0.025) * 14.0 + vec2(0.0, -t * 1.2);
    vec2 bc = floor(ub);
    vec2 bh = skH2(bc);
    vec2 bf = fract(ub) - 0.5 - (bh - 0.5) * 0.4;
    float br = 0.12 + bh.y * 0.15;
    float life = fract(t * 0.5 + bh.x * 5.0);
    br *= smoothstep(0.0, 0.3, life) * step(life, 0.92);
    float bd = length(bf);
    float ring = smoothstep(br, br - 0.04, bd) * smoothstep(br - 0.1, br - 0.04, bd) * step(0.4, bh.x);
    glow += vec3(0.75, 1.0, 0.35) * ring * 0.8;
    col = mix(col, vec3(0.7, 1.0, 0.5), smoothstep(0.04, 0.0, length(bf + br * 0.4)) * step(0.4, bh.x) * step(0.05, br));
    rough = 0.12;
  } else if (id == 27) {
    // Checkered (mod skin): a chequered flag rippling in the wind, a faint red glow
    // of a second flag showing through its black squares from underneath.
    vec2 u = uv0 * 13.0;
    float wv = sin(u.x * 0.55 + u.y * 0.25 - t * 4.0);
    vec2 uf = u + vec2(0.0, wv * 0.35);
    float chk = mod(floor(uf.x) + floor(uf.y), 2.0);
    float shade = 0.72 + 0.28 * cos(u.x * 0.55 + u.y * 0.25 - t * 4.0);
    vec2 ud = skAt(p, n, v, 0.04) * 13.0 + vec2(t * 0.5, 0.0);
    float chd = mod(floor(ud.x) + floor(ud.y), 2.0);
    col = mix(vec3(0.03), vec3(0.95), chk) * shade;
    glow += vec3(1.0, 0.15, 0.1) * (1.0 - chk) * chd * 0.04 * shade;
    rough = 0.35;
  } else if (id == 28) {
    // Hoarfrost (Whiteout Sprint): frost ferns creeping over the surface and melting
    // back, feathered crystal edges catching the light, snow drifting deep below.
    vec2 ud = skAt(p, n, v, 0.1);
    col = mix(vec3(0.02, 0.07, 0.16), vec3(0.12, 0.38, 0.6), skFbm(ud * 3.5 + vec2(0.0, t * 0.03)));
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, 0.09 - fi * 0.045) * (9.0 - fi * 3.5) + vec2(sin(t * 0.3 + fi) * 0.4, t * (0.35 + fi * 0.25));
      vec2 c = floor(u);
      vec2 h = skH2(c + fi * 4.0);
      vec2 f = fract(u) - 0.5 - (h - 0.5) * 0.6;
      float flake = smoothstep(0.09 + fi * 0.03, 0.0, length(f)) * step(0.55, h.x);
      col = mix(col, vec3(0.9, 0.96, 1.0), flake * (0.5 + 0.3 * fi));
      glow += vec3(0.7, 0.85, 1.0) * flake * 0.12;
    }
    float grow = skFbm(uv0 * 3.0 + 3.0) + 0.1 * sin(t * 0.25);
    float cover = smoothstep(0.45, 0.56, grow);
    vec4 vp = skVorP(uv0 * 11.0);
    vec2 q = uv0 * 11.0 - vp.zw;
    float a = atan(q.y, q.x);
    float spoke = abs(sin(a * 3.0 + vp.y * 6.0));
    float rq = length(q);
    float fern = smoothstep(0.12, 0.0, spoke * rq) * smoothstep(0.75, 0.1, rq);
    float barbs = smoothstep(0.55, 0.95, sin(rq * 38.0 - a * 2.0)) * smoothstep(0.35, 0.0, spoke * rq) * smoothstep(0.7, 0.15, rq);
    float edges = smoothstep(0.06, 0.0, skVor(uv0 * 28.0 + 2.0).x);
    float frost = clamp(fern + barbs * 0.6 + edges * 0.35, 0.0, 1.0) * cover;
    col = mix(col, vec3(0.88, 0.95, 1.0), frost * 0.85);
    float glint = pow(max(0.0, sin(facing * 18.0 + vp.y * 50.0 + t * 0.6)), 24.0);
    glow += vec3(0.8, 0.95, 1.0) * (frost * (0.06 + glint * 0.5) + rim * 0.15);
    rough = mix(0.25, 0.55, frost);
  } else if (id == 29) {
    // Harvest Moon (Harvest Moon Run): a giant orange moon low in a plum sky deep in
    // the paint, wheat swaying in silhouette in front of it, fireflies near the top.
    vec2 ud = skAt(p, n, v, 0.12) * 2.6;
    float gy = fract(ud.y + 0.3);
    float sx = ud.x;
    vec3 sky = mix(vec3(0.03, 0.02, 0.1), vec3(0.32, 0.12, 0.28), smoothstep(0.95, 0.2, gy));
    sky = mix(sky, vec3(0.75, 0.32, 0.12), smoothstep(0.45, 0.2, gy) * 0.6);
    vec2 mq = vec2(sx - floor(sx + 0.5), gy - 0.52);
    float mr = length(mq);
    float moon = smoothstep(0.2, 0.19, mr);
    float mare = skFbm(mq * 12.0 + floor(sx + 0.5) * 3.0);
    vec3 mc = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.86, 0.5), smoothstep(0.3, -0.25, mq.y)) * (0.82 + 0.25 * smoothstep(0.65, 0.4, mare));
    col = mix(sky * 0.5, mc * 0.8, moon);
    glow += mc * moon * 0.4 + vec3(1.0, 0.45, 0.15) * smoothstep(0.38, 0.19, mr) * (1.0 - moon) * 0.25;
    vec2 uw = skAt(p, n, v, 0.05) * 2.6;
    float wy = fract(uw.y + 0.3);
    float wx = uw.x * 14.0;
    float stalk = floor(wx);
    float sh = skH(vec2(stalk, 3.0));
    float sway = sin(t * 1.3 + stalk * 0.4) * 0.25 * smoothstep(0.0, 0.4, wy);
    float top = 0.3 + sh * 0.16;
    float lx = fract(wx + sway * min(wy / top, 1.0)) - 0.5;
    float stem = smoothstep(0.12, 0.05, abs(lx)) * step(wy, top);
    float head = smoothstep(1.0, 0.7, length(vec2(lx / 0.2, (wy - top) / 0.06)));
    float field = max(stem, head) + smoothstep(0.16, 0.1, wy);
    col = mix(col, vec3(0.05, 0.025, 0.01), clamp(field, 0.0, 1.0));
    vec2 uf = skAt(p, n, v, 0.02) * 8.0 + vec2(sin(t * 0.4) * 0.6, t * 0.15);
    vec2 fc = floor(uf);
    vec2 fh = skH2(fc + 11.0);
    vec2 ff = fract(uf) - 0.5 - (fh - 0.5) * 0.6 - 0.12 * vec2(sin(t * (1.0 + fh.x) + fh.y * 9.0), cos(t * (0.8 + fh.y)));
    float blink = pow(0.5 + 0.5 * sin(t * (1.5 + fh.y * 2.0) + fh.x * 40.0), 4.0);
    float fly = smoothstep(0.06, 0.0, length(ff)) * step(0.6, fh.x) * blink;
    glow += vec3(0.85, 1.0, 0.35) * fly * 1.2;
    rough = 0.3;
  } else if (id == 30) {
    // Beacon (Foghorn Classic): a lighthouse beam sweeping round through night fog
    // deep in the paint, lighting the fog it passes and glinting off the swell below.
    vec2 ud = skAt(p, n, v, 0.11);
    vec2 cell = floor(ud * 1.8 + 0.5);
    vec2 q = ud * 1.8 - cell;
    float fog = skFbm(ud * 3.0 + vec2(t * 0.08, 0.0));
    col = mix(vec3(0.02, 0.04, 0.08), vec3(0.12, 0.16, 0.22), fog);
    vec2 lp = q - vec2(-0.25, 0.05);
    float ang = atan(lp.y, lp.x);
    float sweep = t * 0.9 + skH(cell) * 6.28;
    float da = abs(mod(ang - sweep + 3.14159, 6.28318) - 3.14159);
    float da2 = abs(mod(ang - sweep, 6.28318) - 3.14159);
    float dist = length(lp);
    float beam = (smoothstep(0.16, 0.0, da) + smoothstep(0.16, 0.0, da2) * 0.5) * exp(-dist * 1.1);
    float lit = beam * (0.45 + 0.9 * fog);
    vec3 warm = vec3(1.0, 0.93, 0.7);
    col += warm * lit * 0.35;
    glow += warm * lit * 1.1;
    float lamp = smoothstep(0.05, 0.0, dist);
    glow += warm * lamp * (1.3 + 0.5 * pow(max(0.0, cos(da)), 40.0));
    float tower = step(abs(lp.x), 0.02 + max(0.0, -lp.y) * 0.08) * step(lp.y, -0.02) * step(-0.22, lp.y);
    col = mix(col, vec3(0.03), tower);
    float swell = q.y + 0.25 + 0.015 * sin(q.x * 30.0 + t * 1.5);
    float sea = smoothstep(0.01, -0.01, swell);
    float crest = pow(max(0.0, sin(q.x * 60.0 + skNoise(q * 20.0 + t) * 4.0 + t * 2.0)), 12.0) * sea;
    col = mix(col, vec3(0.01, 0.03, 0.05), sea * 0.8);
    glow += warm * crest * (0.08 + smoothstep(0.6, 0.0, abs(q.x + 0.25 - cos(sweep) * 0.5)) * 0.6);
    vec2 uw = skAt(p, n, v, 0.03) * 2.0 + vec2(t * 0.15, 0.0);
    col = mix(col, vec3(0.3, 0.36, 0.42), smoothstep(0.55, 0.8, skFbm(uw)) * 0.2);
    rough = 0.25;
  } else if (id == 31) {
    // Rain Glass (Neon Downpour): a blur of neon city lights deep down, seen through
    // rain on the surface: beads sitting still and drops running down with trails,
    // each one a little lens that flips the lights behind it into focus.
    vec2 ud = skAt(p, n, v, 0.13);
    vec2 u = uv0 * 6.0;
    vec2 lens = vec2(0.0);
    float wet = 0.0;
    vec2 bc = floor(u * 2.0);
    vec2 bh = skH2(bc + 5.0);
    vec2 bf = fract(u * 2.0) - 0.5 - (bh - 0.5) * 0.5;
    float br = 0.08 + bh.y * 0.12;
    float bead = smoothstep(br, br - 0.03, length(bf)) * step(0.45, bh.x);
    lens += bf * bead * 0.6;
    wet = max(wet, bead);
    float col1 = floor(u.x * 1.5);
    float ch = skH(vec2(col1, 9.0));
    float fx = fract(u.x * 1.5) - 0.5 + 0.08 * sin(u.y * 3.0 + ch * 20.0);
    float run = fract(-u.y * 0.25 + t * (0.15 + ch * 0.2) + ch * 7.0);
    float dy = (run - 0.85) * 6.0;
    float drop = smoothstep(0.16, 0.1, length(vec2(fx, dy * 0.4))) * step(0.3, ch);
    float trail = smoothstep(0.05, 0.02, abs(fx)) * smoothstep(0.85, 0.3, run) * step(0.3, ch) * step(0.5, fract(run * 12.0 + ch)) * 0.6;
    lens += vec2(fx, dy * 0.2) * drop * 0.8;
    wet = max(wet, max(drop, trail));
    vec3 city = skBokeh(ud + lens * -1.6, t);
    vec3 bg = mix(vec3(0.02, 0.02, 0.06), vec3(0.08, 0.03, 0.12), skFbm(ud * 2.0));
    col = bg + city * 0.25;
    glow += city * (0.35 + wet * 0.5);
    float edge = wet * smoothstep(0.0, 1.0, length(lens) * 4.0);
    glow += vec3(0.85, 0.9, 1.0) * edge * 0.15 + vec3(1.0) * wet * pow(facing, 6.0) * 0.08;
    rough = mix(0.35, 0.02, wet);
  } else if (id == 32) {
    // Shallows (Sunset Shallows Cup): rippled sand deep under clear teal water,
    // sunlight focused into dancing caustic lines on it, glints on the surface.
    vec2 us = skAt(p, n, v, 0.12);
    float rip = sin(us.x * 26.0 + skFbm(us * 3.0) * 6.0 + us.y * 6.0);
    vec3 sand = mix(vec3(0.55, 0.45, 0.28), vec3(0.85, 0.74, 0.52), 0.5 + 0.5 * rip);
    float cau = skCaustic(us * 4.0 - 250.0, t * 0.6);
    float cau2 = skCaustic(us * 4.0 - 249.97, t * 0.6);
    vec3 lightc = vec3(cau2, cau, cau * 0.85);
    vec3 water = vec3(0.0, 0.5, 0.58);
    col = mix(sand, water, 0.7) * 0.55 + lightc * vec3(0.6, 0.9, 0.8) * 0.45;
    glow += lightc * vec3(0.5, 0.95, 0.85) * 0.5;
    vec2 ui = skAt(p, n, v, 0.05) * 5.0 + vec2(t * 0.25, t * 0.1);
    float weed = smoothstep(0.62, 0.7, skFbm(ui)) * 0.25;
    col = mix(col, vec3(0.02, 0.25, 0.3), weed);
    float swell = skFbm(uv0 * 5.0 + vec2(t * 0.2, -t * 0.15));
    col = mix(col, vec3(0.2, 0.75, 0.85), rim * 0.35);
    float spark = pow(max(0.0, sin(swell * 40.0 + t * 2.0)), 30.0) * smoothstep(0.5, 0.7, swell);
    glow += vec3(1.0, 0.95, 0.8) * spark * 0.8;
    rough = 0.22;
  } else if (id == 33) {
    // Mirage (Mirage Mile): three ranges of dunes at different depths under a
    // white-hot sun, heat haze bending them, sand grains blowing over the surface.
    vec2 ud = skAt(p, n, v, 0.14);
    float shimmer = sin(ud.y * 40.0 - t * 3.0) * 0.012 + sin(ud.y * 23.0 + t * 2.1) * 0.008;
    float gy = fract(ud.y * 2.4 + 0.25);
    float sx = ud.x * 2.4;
    vec3 sky = mix(vec3(0.85, 0.28, 0.1), vec3(1.0, 0.72, 0.38), smoothstep(0.95, 0.35, gy));
    vec2 sq = vec2(sx - floor(sx + 0.5) + shimmer, gy - 0.72);
    float sun = smoothstep(0.1, 0.09, length(sq));
    col = sky * 0.5 + vec3(1.0, 0.97, 0.85) * sun * 0.4;
    glow += vec3(1.0, 0.95, 0.75) * (sun * 0.9 + smoothstep(0.3, 0.1, length(sq)) * 0.2);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 u = skAt(p, n, v, 0.11 - fi * 0.04);
      float y = fract(u.y * 2.4 + 0.25);
      float x = u.x * (3.2 + fi * 1.2) + fi * 3.0 + shimmer * (3.0 - fi) * 8.0;
      float ridge = 0.48 - fi * 0.13 + 0.07 * sin(x * 3.0) + 0.05 * sin(x * 7.3 + fi) + 0.03 * skNoise(vec2(x * 4.0, fi));
      float below = smoothstep(ridge + 0.006, ridge - 0.006, y);
      float lit = 0.5 + 0.5 * cos(x * 3.0 + 0.8);
      vec3 dune = mix(vec3(0.3, 0.06, 0.03), vec3(0.88, 0.36, 0.1), lit) * (0.5 + 0.2 * fi);
      dune = mix(dune, sky * 0.5, 0.28 - fi * 0.1);
      col = mix(col, dune, below);
      glow += vec3(1.0, 0.7, 0.35) * below * smoothstep(0.02, 0.0, ridge - y) * 0.15;
    }
    vec2 ug = skAt(p, n, v, 0.015) * vec2(5.0, 40.0) + vec2(t * 2.5, 0.0);
    vec2 gc = floor(ug);
    float gh = skH(gc);
    float streak = smoothstep(0.4, 0.0, abs(fract(ug.y) - 0.5)) * step(0.82, gh) * pow(fract(ug.x + gh * 5.0), 6.0);
    col = mix(col, vec3(1.0, 0.8, 0.5), streak * 0.35);
    rough = 0.35;
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
