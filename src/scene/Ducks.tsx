import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, ConeGeometry, CylinderGeometry, Matrix4, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Upright } from './mergeScale'
import { floaters, heightAt, splash, wake } from './liveWater'

// Mallards: a drake (green head, white collar, chestnut breast), a hen (mottled
// brown) and yellow ducklings, each one mesh with its markings in vertex
// colours, so a duck is one draw. True size: a mallard is about 60 cm nose to
// tail, a third of a townsperson's height. Origin at the waterline, facing +z.

const c = new Color()
function paint(g: BufferGeometry, hex: string) {
  const geo = g.index ? g.toNonIndexed() : g
  c.set(hex)
  const n = geo.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  geo.setAttribute('color', new BufferAttribute(col, 3))
  geo.deleteAttribute('uv')
  return geo
}
const m4 = new Matrix4()
const place = (g: BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
  g.applyMatrix4(m4.makeScale(sx, sy, sz))
  g.rotateX(rx).rotateY(ry).rotateZ(rz)
  return g.translate(x, y, z)
}

type Plumage = { body: string; back: string; breast: string; head: string; bill: string; wing: string; tail: string; collar?: string }
const DRAKE: Plumage = { body: '#d9d6cf', back: '#8a8170', breast: '#7a3b22', head: '#1f6b3a', bill: '#f2c230', wing: '#7d7768', tail: '#222222', collar: '#ffffff' }
const HEN: Plumage = { body: '#9b7451', back: '#6e4f35', breast: '#a57f58', head: '#8a6646', bill: '#d9862b', wing: '#5f442d', tail: '#7a5a3e' }
const CHICK: Plumage = { body: '#f7d64a', back: '#c9a43a', breast: '#fae37a', head: '#f5d03c', bill: '#e08a2a', wing: '#e9c444', tail: '#f1cc3e' }

function duckGeo(p: Plumage, chick = false) {
  const parts = [
    // Body: a long rounded hull riding low, a darker back, a full breast.
    paint(place(new SphereGeometry(0.1, 14, 10), 0, 0.035, 0, 0.82, 0.62, 1.42), p.body),
    paint(place(new SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), 0, 0.045, -0.01, 0.74, 0.62, 1.3), p.back),
    paint(place(new SphereGeometry(0.068, 10, 8), 0, 0.05, 0.085, 1, 0.95, 0.9), p.breast),
    // Folded wings along the sides, with the blue speculum patch on an adult.
    ...[-1, 1].map((s) => paint(place(new SphereGeometry(0.06, 10, 6), s * 0.05, 0.06, -0.025, 0.42, 0.42, 1.55, 0, 0, s * -0.25), p.wing)),
    ...(chick ? [] : [-1, 1].map((s) => paint(place(new BoxGeometry(0.004, 0.018, 0.04), s * 0.073, 0.062, -0.02, 1, 1, 1, 0, 0, s * -0.25), '#2f56c8'))),
    // Tail tipped up, with the drake's curl.
    paint(place(new ConeGeometry(0.045, 0.09, 8), 0, 0.06, -0.15, 1.1, 1, 0.5, -Math.PI / 2 + 0.45), p.tail),
    ...(p.collar ? [paint(place(new TorusGeometry(0.012, 0.004, 4, 8), 0, 0.09, -0.19, 1, 1, 1, 0, Math.PI / 2), '#111111')] : []),
    // Neck, head, bill, eyes.
    paint(place(new CylinderGeometry(0.028, 0.036, 0.075, 10), 0, 0.105, 0.085, 1, 1, 1, 0.25), p.head),
    ...(p.collar ? [paint(place(new CylinderGeometry(0.0335, 0.0335, 0.009, 12, 1, true), 0, 0.086, 0.08, 1, 1, 1, 0.25), p.collar)] : []),
    paint(place(new SphereGeometry(0.045, 12, 9), 0, 0.15, 0.1, 0.9, 0.92, 1.12), p.head),
    paint(place(new BoxGeometry(0.034, 0.014, 0.055), 0, 0.137, 0.155, 1, 1, 1, 0.15), p.bill),
    paint(place(new SphereGeometry(0.006, 6, 4), 0, 0.133, 0.183), '#3b2a1a'),
    ...[-1, 1].map((s) => paint(place(new SphereGeometry(0.008, 6, 4), s * 0.035, 0.158, 0.125), '#101010')),
    // The hen's dark eye stripe; the duckling's dark cap.
    ...(p === HEN ? [-1, 1].map((s) => paint(place(new BoxGeometry(0.003, 0.006, 0.04), s * 0.039, 0.16, 0.112), '#4a3423')) : []),
    ...(chick ? [paint(place(new SphereGeometry(0.046, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.35), 0, 0.152, 0.098, 0.92, 0.92, 1.12), '#8d6e2f')] : []),
  ]
  return mergeGeometries(parts)!
}

let geos: { drake: BufferGeometry; hen: BufferGeometry; chick: BufferGeometry; mat: MeshStandardMaterial } | null = null
export const duckParts = () =>
  (geos ??= { drake: duckGeo(DRAKE), hen: duckGeo(HEN), chick: duckGeo(CHICK, true), mat: new MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }) })
// A duckling is this much of an adult.
export const CHICK_SIZE = 0.48

export type DuckKind = 'drake' | 'hen' | 'chick'
type Duck = { kind: DuckKind; x: number; z: number; h: number; v: number; tx: number; tz: number; next: number; dab: number; dabAt: number; follow: number }

// A family paddling round a pond: the adults wander, dabble now and then with
// their tails in the air, and the ducklings follow their mother in a line.
// Positions are in the parent's space inside an ellipse rx by rz (so a merged
// pond's family spreads over the bigger water); each duck stays true size.
// y is the water surface. Leaves wakes and dabbling rings on the live water.
// They wander round cx, cz over `spread` of the water, and paddle clear of
// anything afloat (floaters in liveWater.ts, the fisherman's boat).
export function DuckFamily({ kinds, rx, rz, y, seed = 1, cx = 0, cz = 0, spread = 0.72 }: { kinds: DuckKind[]; rx: number; rz: number; y: number; seed?: number; cx?: number; cz?: number; spread?: number }) {
  const g = useRef<Group>(null)
  const id = useMemo(() => `duck${Math.random().toString(36).slice(2, 8)}`, [])
  const ducks = useMemo<Duck[]>(() => {
    let s = seed * 9301 + 49297
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const mom = kinds.indexOf('hen')
    let prev = mom
    return kinds.map((kind, i) => {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.4
      const follow = kind === 'chick' && mom >= 0 ? prev : -1
      if (kind === 'chick') prev = i
      return { kind, x: cx + Math.cos(a) * rx * d, z: cz + Math.sin(a) * rz * d, h: r() * 6.28, v: 0, tx: cx, tz: cz, next: 0, dab: 0, dabAt: 4 + r() * 10, follow }
    })
  }, [kinds, rx, rz, seed, cx, cz])
  const p = useMemo(() => new Vector3(), [])
  const f = useMemo(() => new Vector3(), [])
  useFrame(({ clock }, delta) => {
    const root = g.current
    if (!root || !root.parent) return
    const dt = Math.min(delta, 0.1)
    const t = clock.elapsedTime
    const scale = Math.max(rx, rz)
    ducks.forEach((d, i) => {
      const lead = d.follow >= 0 ? ducks[d.follow] : null
      if (lead) {
        // Line astern: aim for a spot just behind the duck ahead.
        d.tx = lead.x - Math.sin(lead.h) * 0.2
        d.tz = lead.z - Math.cos(lead.h) * 0.2
      } else if (t > d.next || Math.hypot(d.tx - d.x, d.tz - d.z) < 0.1) {
        const a = Math.random() * Math.PI * 2, k = Math.sqrt(Math.random()) * spread
        d.tx = cx + Math.cos(a) * rx * k
        d.tz = cz + Math.sin(a) * rz * k
        d.next = t + 5 + Math.random() * 7
      }
      // Dabbling: tip up, feed, bob back. Adults only, and not while leading chicks along.
      if (d.kind !== 'chick') {
        if (d.dab > 0) d.dab = Math.max(0, d.dab - dt)
        else if (t > d.dabAt) {
          d.dab = 2.2
          d.dabAt = t + 9 + Math.random() * 14
          root.localToWorld(p.set(d.x + Math.sin(d.h) * 0.12, y, d.z + Math.cos(d.h) * 0.12))
          splash(p.x, p.z, 0.45)
        }
      }
      const dx = d.tx - d.x, dz = d.tz - d.z
      const dist = Math.hypot(dx, dz)
      const want = Math.atan2(dx, dz)
      let turn = ((want - d.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      turn = Math.max(-1.6 * dt, Math.min(1.6 * dt, turn))
      d.h += turn
      const cruise = d.dab > 0 ? 0 : (lead ? Math.min(0.2, dist * 0.9) : Math.min(0.11, dist * 0.4)) * (0.6 + 0.4 * Math.min(2.5, scale / 1.5))
      d.v += (cruise - d.v) * Math.min(1, dt * 2)
      // Keep apart.
      ducks.forEach((o, j) => {
        if (j === i) return
        // Room for a body length between adults, less for a duckling.
        const room = d.kind === 'chick' || o.kind === 'chick' ? 0.16 : 0.3
        const ox = d.x - o.x, oz = d.z - o.z, od = Math.hypot(ox, oz)
        if (od < room && od > 1e-4) {
          d.x += (ox / od) * (room - od) * 0.5
          d.z += (oz / od) * (room - od) * 0.5
        }
      })
      d.x += Math.sin(d.h) * d.v * dt
      d.z += Math.cos(d.h) * d.v * dt
      // Stay on the water, and out from under boats.
      const e = Math.hypot(d.x / rx, d.z / rz)
      if (e > 0.86) {
        d.x *= 0.86 / e
        d.z *= 0.86 / e
      }
      root.localToWorld(p.set(d.x, y, d.z))
      for (const b of floaters.values()) {
        const bx = p.x - b.x, bz = p.z - b.z, bd = Math.hypot(bx, bz)
        if (bd < b.r && bd > 1e-4) {
          // The family's ponds and the lake aren't turned or grown, so world and local offsets match.
          d.x += (bx / bd) * (b.r - bd) * Math.min(1, dt * 4)
          d.z += (bz / bd) * (b.r - bd) * Math.min(1, dt * 4)
          if (!lead) {
            d.tx = d.x + (bx / bd) * 1.5
            d.tz = d.z + (bz / bd) * 1.5
          }
        }
      }
      const o = root.children[i]
      if (!o) return
      root.localToWorld(p.set(d.x, y, d.z))
      const wy = heightAt(p.x, p.z)
      // Dabbling pitches the duck nose-down, tail up.
      const tip = d.dab > 0 ? Math.sin(Math.min(1, (2.2 - d.dab) / 0.35, d.dab / 0.4) * Math.PI / 2) * 1.25 : 0
      o.position.set(d.x, y + wy * 0.8 + Math.sin(t * 2.6 + i * 1.7) * 0.003 - tip * 0.03, d.z)
      o.rotation.set(tip + Math.sin(t * 1.9 + i) * 0.04, d.h, Math.sin(t * 2.3 + i * 2.1) * 0.05, 'YXZ')
      if (d.v > 0.02) {
        f.set(d.x + Math.sin(d.h), y, d.z + Math.cos(d.h))
        root.localToWorld(f)
        wake(`${id}${i}`, p.x, p.z, Math.atan2(f.x - p.x, f.z - p.z), (d.kind === 'chick' ? 0.13 : 0.27) * Math.min(1, d.v / 0.08))
      }
    })
  })
  const parts = duckParts()
  return (
    <group ref={g} userData={{ noBatch: true }}>
      {ducks.map((d, i) => (
        <group key={i}>
          <Upright size={d.kind === 'chick' ? CHICK_SIZE : 1}>
            <mesh geometry={parts[d.kind]} material={parts.mat} raycast={() => null} />
          </Upright>
        </group>
      ))}
    </group>
  )
}
