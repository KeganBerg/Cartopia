import type { ReactNode } from 'react'
import type { Texture } from 'three'
import { glowMats } from './dayNight'
import { signTexture } from './signTexture'
import { decal } from './layers'

// Small shared pieces for the edge-of-town models (trailer homes, junkyard,
// park styles). Plain static meshes, so Batch bakes them into a few draws.

export type V3 = [number, number, number]
export type Mat = (color: string, map?: Texture) => ReactNode
export type EdgeProps = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean; lvl: number; lift: number; roof: string; color: string }

export const GOLD = '#ffc107'

export function Box({ m, at, s, c, t, rot, shadow = true }: { m: Mat; at: V3; s: V3; c: string; t?: Texture; rot?: V3; shadow?: boolean }) {
  return (
    <mesh position={at} rotation={rot} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      {m(c, t)}
    </mesh>
  )
}

export function Cyl({ m, at, r, r2 = r, h, c, seg = 12, rot, t }: { m: Mat; at: V3; r: number; r2?: number; h: number; c: string; seg?: number; rot?: V3; t?: Texture }) {
  return (
    <mesh position={at} rotation={rot} castShadow>
      <cylinderGeometry args={[r, r2, h, seg]} />
      {m(c, t)}
    </mesh>
  )
}

export function Ball({ m, at, r, c, seg = 8, flat }: { m: Mat; at: V3; r: number; c: string; seg?: number; flat?: boolean }) {
  return (
    <mesh position={at} castShadow>
      {flat ? <icosahedronGeometry args={[r, 0]} /> : <sphereGeometry args={[r, seg, Math.max(4, seg - 2)]} />}
      {m(c)}
    </mesh>
  )
}

// A board with painted lettering, facing +z.
export function Sign({ text, w, at, bg, fg, rot }: { text: string; w: number; at: V3; bg: string; fg: string; rot?: V3 }) {
  return (
    <mesh position={at} rotation={rot}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={signTexture(text, bg, fg)} toneMapped={false} />
    </mesh>
  )
}

// Warm light on the ground under a lamp, at night.
export function Pool({ r, x = 0, z = 0, y = 0.075 }: { r: number; x?: number; z?: number; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]} renderOrder={2}>
      <planeGeometry args={[r * 2, r * 2]} />
      <primitive object={glowMats.pool} attach="material" dispose={null} />
    </mesh>
  )
}

// A flat patch lying on the ground (worn dirt, an oil stain, a lily pad).
export function Patch({ at, r, c, sx = 1, opacity }: { at: V3; r: number; c: string; sx?: number; opacity?: number }) {
  return (
    <mesh position={at} rotation-x={-Math.PI / 2} scale={[sx, 1, 1]} renderOrder={1}>
      <circleGeometry args={[r, 14]} />
      {opacity == null
        ? <meshStandardMaterial color={c} {...decal()} />
        : <meshBasicMaterial color={c} transparent opacity={opacity} depthWrite={false} {...decal()} />}
    </mesh>
  )
}

export function Bulbs({ from, to, n, sag = 0.04 }: { from: V3; to: V3; n: number; sag?: number }) {
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const t = n > 1 ? i / (n - 1) : 0.5
        return (
          <mesh key={i} position={[from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * sag, from[2] + (to[2] - from[2]) * t]}>
            <sphereGeometry args={[0.03, 6, 5]} />
            <primitive object={glowMats.bulb} attach="material" dispose={null} />
          </mesh>
        )
      })}
    </group>
  )
}

// A lamp post with a lit head and its pool of light.
export function Lamp({ m, at, h = 0.9, bulb, ghost }: { m: Mat; at: V3; h?: number; bulb: ReactNode; ghost?: boolean }) {
  return (
    <group position={at}>
      <Cyl m={m} at={[0, h / 2, 0]} r={0.022} r2={0.03} h={h} c="#37474f" seg={6} />
      <mesh position={[0, h + 0.05, 0]}><boxGeometry args={[0.1, 0.1, 0.1]} />{bulb}</mesh>
      <mesh position={[0, h + 0.12, 0]} castShadow><coneGeometry args={[0.09, 0.07, 4]} />{m('#263238')}</mesh>
      {!ghost && <Pool r={0.55} y={0.08} />}
    </group>
  )
}

export function Flag({ at, color, star, tall = 0.7 }: { at: V3; color: string; star?: boolean; tall?: number }) {
  return (
    <group position={at}>
      <mesh position={[0, tall / 2, 0]} castShadow><cylinderGeometry args={[0.018, 0.022, tall, 6]} /><meshStandardMaterial color="#eceff1" metalness={0.4} /></mesh>
      <mesh position={[0.15, tall - 0.13, 0]}><boxGeometry args={[0.28, 0.17, 0.015]} /><meshStandardMaterial color={color} /></mesh>
      {star ? (
        <mesh position={[0, tall + 0.08, 0]} rotation-z={Math.PI / 2}><octahedronGeometry args={[0.1, 0]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} emissive={GOLD} emissiveIntensity={0.25} /></mesh>
      ) : (
        <mesh position={[0, tall + 0.02, 0]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.3} /></mesh>
      )}
    </group>
  )
}

// Park bench facing +z.
export function Bench({ m, at, rot = 0 }: { m: Mat; at: V3; rot?: number }) {
  return (
    <group position={at} rotation-y={rot}>
      {[-0.05, 0.05].map((z) => <Box key={z} m={m} at={[0, 0.17, z]} s={[0.56, 0.025, 0.06]} c="#8d6e63" />)}
      <Box m={m} at={[0, 0.3, -0.09]} s={[0.56, 0.1, 0.025]} c="#8d6e63" rot={[-0.15, 0, 0]} />
      {[-0.24, 0.24].map((x) => <Box key={x} m={m} at={[x, 0.09, -0.01]} s={[0.04, 0.18, 0.2]} c="#37474f" />)}
    </group>
  )
}

// A round-headed broadleaf tree in the season's colours (bare in winter).
export function Tree({ m, at, s = 1, leaves, bare }: { m: Mat; at: V3; s?: number; leaves: string[]; bare: boolean }) {
  return (
    <group position={at} scale={s}>
      <Cyl m={m} at={[0, 0.35, 0]} r={0.05} r2={0.07} h={0.7} c="#6d4c41" seg={7} />
      {bare
        ? [[0.12, 0.75, 0, -0.6], [-0.1, 0.8, 0.05, 0.6], [0, 0.85, -0.1, 0.1]].map(([x, y, z, r], i) => (
            <Cyl key={i} m={m} at={[x, y, z]} r={0.015} r2={0.03} h={0.4} c="#6d4c41" seg={5} rot={[0, 0, r]} />
          ))
        : [[0, 0.95, 0, 0.36], [0.22, 0.82, 0.08, 0.26], [-0.2, 0.84, -0.06, 0.27], [0.04, 0.8, -0.22, 0.24], [-0.05, 0.78, 0.22, 0.23]].map(([x, y, z, r], i) => (
            <Ball key={i} m={m} at={[x, y, z]} r={r} c={leaves[i % leaves.length]} flat />
          ))}
    </group>
  )
}
