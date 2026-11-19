// The night sky's deep-space layer, shared by the free view's sky dome
// (Horizon.tsx) and the race sky (RaceScene.tsx): a soft Milky Way band with a
// warm core and a dark dust lane, two faint galaxies, and four planets of
// different colours, two of them ringed. Everything is fixed in the sky and
// drawn in the one sky shader, so it costs no meshes or textures.
//
// cosmos(d) takes a unit view direction in the cosmos frame, where +x is the
// "front" the planets and galaxies are grouped round (callers turn it to face
// where their camera mostly looks) and returns the colour to add; the caller
// scales it by how dark and clear the sky is. COSMOS_OCT sets the noise detail
// (fewer on phones) and COSMOS_STARS adds a plain star field for skies that
// have none of their own.

const R = Math.PI / 180

// Azimuth (radians, from the front, towards +z) and elevation (degrees) to a
// direction, in the same convention as the moon in Horizon.tsx.
function dir(az: number, el: number) {
  const e = el * R
  return [Math.cos(az) * Math.cos(e), Math.sin(e), Math.sin(az) * Math.cos(e)] as const
}
const v3 = (v: readonly number[]) => `vec3(${v.map((n) => n.toFixed(5)).join(', ')})`

// Low enough that the race cameras, which look along the road, catch them.
export const COSMOS_ITEMS = {
  ringed: dir(0.02, 12),
  red: dir(0.17, 6),
  spiral: dir(0.32, 13),
  giant: dir(0.55, 21),
  ice: dir(-0.62, 24),
  faceOn: dir(-0.45, 42),
}

// The Milky Way: a great circle leaving the horizon a little left of the
// front and climbing to 65° on the right. Its core sits low above the horizon
// near where it rises, like the summer sky's.
const MW_RISE = dir(-0.3, 0)
const MW_TOP = dir(-0.3 + Math.PI / 2, 65)
function cross(a: readonly number[], b: readonly number[]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
const MW_N = cross(MW_RISE, MW_TOP)
const t = 0.2
const MW_CORE = MW_RISE.map((n, i) => n * Math.cos(t) + MW_TOP[i] * Math.sin(t))

export const COSMOS_GLSL = /* glsl */ `
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cFbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < COSMOS_OCT; i++) { v += a * cNoise(p); p = p * 2.13 + 9.1; a *= 0.5; }
  return v;
}
// Coordinates on the sky round a centre c, in units of r.
vec2 cLocal(vec3 d, vec3 c, float r) {
  vec3 right = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, c);
  return vec2(dot(d, right), dot(d, up)) / r;
}
mat2 cRot(float a) { float s = sin(a), k = cos(a); return mat2(k, s, -s, k); }

// A galaxy: a bright core in a mottled disc wound into two arms, tipped over
// by squash (1 = face on).
vec3 cGalaxy(vec3 d, vec3 c, float r, float turn, float squash, vec3 tint) {
  if (dot(d, c) < 0.99) return vec3(0.0);
  vec2 p = cRot(turn) * cLocal(d, c, r);
  p.y /= squash;
  float rr = length(p);
  if (rr > 1.5) return vec3(0.0);
  float th = atan(p.y, p.x);
  float arm = 0.5 + 0.5 * cos(2.0 * th - log(rr + 0.04) * 3.6);
  float disc = exp(-rr * 3.0) * (0.3 + 0.7 * arm * smoothstep(0.06, 0.35, rr));
  disc *= 0.7 + 0.6 * cNoise(p * 9.0 + c.xz * 31.0);
  float core = exp(-rr * rr * 70.0);
  return tint * disc * 0.42 + vec3(1.0, 0.93, 0.82) * core * 0.75;
}

// A planet: a lit ball with soft bands (giant > 0) and, if ring > 0, a tilted
// ring that passes in front of its lower half and behind its upper half.
// Returns the colour and how much of the sky it covers.
vec4 cPlanet(vec3 d, vec3 c, float r, vec3 base, vec3 band, float giant, float ring, float tilt, float squash) {
  if (dot(d, c) < 0.995) return vec4(0.0);
  vec2 p = cLocal(d, c, r);
  float rr = length(p);
  float aa = max(fwidth(rr), 0.02);
  vec2 q = cRot(tilt) * p;
  vec4 o = vec4(0.0);
  // A faint glow round it.
  o.rgb += base * exp(-max(rr - 1.0, 0.0) * 2.2) * 0.1 * step(1.0, rr);
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);
  if (disc > 0.0) {
    vec3 n = vec3(p, sqrt(max(0.0, 1.0 - rr * rr)));
    float lit = smoothstep(-0.2, 0.45, dot(n, normalize(vec3(-0.55, 0.4, 0.75))));
    float b = 0.5 + 0.5 * sin(q.y * 9.0 + cNoise(q * vec2(2.0, 6.0)) * 2.5);
    vec3 col = mix(base, band, b * giant);
    col *= 0.06 + 0.72 * lit;
    o = vec4(mix(o.rgb, col, disc), disc);
  }
  if (ring > 0.0) {
    float e = length(vec2(q.x, q.y / squash));
    float ea = max(fwidth(e), 0.02);
    float m = smoothstep(1.35 - ea, 1.35 + ea, e) * (1.0 - smoothstep(2.15 - ea, 2.15 + ea, e));
    m *= 0.55 + 0.45 * smoothstep(0.03, 0.07, abs(e - 1.8));
    m *= 0.8 + 0.2 * sin(e * 40.0);
    // In front of the ball below its middle; hidden behind it above.
    m *= max(step(q.y, 0.0), step(1.0, rr));
    vec3 rc = band * (0.45 + 0.3 * smoothstep(2.1, 1.4, e));
    o = vec4(mix(o.rgb, rc, m * ring), max(o.a, m * ring));
  }
  return o;
}

vec3 cosmos(vec3 d) {
  vec3 col = vec3(0.0);
  float y = d.y;
  float high = smoothstep(-0.02, 0.2, y);
  // The Milky Way: a soft band, clumpy along its length, with a dust lane
  // down the middle and a warm glow round its core.
  float b = dot(d, ${v3(MW_N)});
  if (abs(b) < 0.45 && y > -0.05) {
    float lon = atan(dot(d, ${v3(MW_RISE)}), dot(d, ${v3(MW_TOP)}));
    float w = 0.12 + 0.06 * cNoise(vec2(lon * 1.7, 3.0));
    float band = exp(-b * b / (w * w));
    float core = pow(max(dot(d, ${v3(MW_CORE)}), 0.0), 8.0);
    float clump = cFbm(vec2(lon * 13.0, b * 26.0));
    float lane = smoothstep(0.035, 0.0, abs(b - 0.025 * sin(lon * 3.0) + (cNoise(vec2(lon * 8.0, 1.0)) - 0.5) * 0.04));
    float mw = band * (0.25 + clump * clump * 1.3) * (0.45 + 1.3 * core) * (1.0 - 0.7 * lane * (0.4 + 0.6 * band));
    col += mix(vec3(0.5, 0.58, 0.95), vec3(1.0, 0.84, 0.62), core) * mw * 0.15 * high;
    // Crowds of faint stars inside the band.
    vec3 sq = d * 330.0;
    vec3 sc = floor(sq);
    float h = cHash(sc.xy * 0.913 + sc.z * 2.71);
    col += vec3(0.85, 0.9, 1.0) * step(1.0 - 0.05 * band, h) * smoothstep(0.45, 0.0, length(fract(sq) - 0.5)) * 0.7 * high;
  }
  #ifdef COSMOS_STARS
  {
    vec3 sq = d * 210.0;
    vec3 sc = floor(sq);
    float h = cHash(sc.xy * 0.731 + sc.z * 3.17);
    col += vec3(step(0.986, h) * smoothstep(0.42, 0.0, length(fract(sq) - 0.5))) * 1.2 * smoothstep(0.02, 0.25, y);
  }
  #endif
  // Two far galaxies: a big tilted spiral and a small face-on one.
  col += cGalaxy(d, ${v3(COSMOS_ITEMS.spiral)}, 0.06, 0.5, 0.36, vec3(0.75, 0.8, 1.0)) * high;
  col += cGalaxy(d, ${v3(COSMOS_ITEMS.faceOn)}, 0.032, 1.3, 0.85, vec3(0.95, 0.72, 1.0)) * high;
  // Planets, from the ringed gold one to a small red one.
  float low = smoothstep(-0.01, 0.1, y);
  vec4 p = cPlanet(d, ${v3(COSMOS_ITEMS.ringed)}, 0.016, vec3(0.95, 0.8, 0.5), vec3(0.85, 0.7, 0.45), 0.6, 1.0, 0.38, 0.32);
  col = mix(col, p.rgb, p.a * low) + p.rgb * (1.0 - p.a) * low;
  p = cPlanet(d, ${v3(COSMOS_ITEMS.red)}, 0.009, vec3(0.95, 0.45, 0.28), vec3(0.8, 0.35, 0.25), 0.15, 0.0, 0.0, 1.0);
  col = mix(col, p.rgb, p.a * low) + p.rgb * (1.0 - p.a) * low;
  p = cPlanet(d, ${v3(COSMOS_ITEMS.giant)}, 0.013, vec3(0.95, 0.87, 0.74), vec3(0.78, 0.55, 0.38), 1.0, 0.0, -0.12, 1.0);
  col = mix(col, p.rgb, p.a * low) + p.rgb * (1.0 - p.a) * low;
  p = cPlanet(d, ${v3(COSMOS_ITEMS.ice)}, 0.011, vec3(0.25, 0.62, 0.9), vec3(0.55, 0.85, 1.0), 0.35, 0.7, -0.6, 0.22);
  col = mix(col, p.rgb, p.a * low) + p.rgb * (1.0 - p.a) * low;
  return col;
}
`
