import { DoubleSide } from 'three'
import { Box, Cone } from './RaceVenues'

// One balloon: a striped envelope (radius 3.2 round its middle), its skirt and the
// basket hanging about 6 below. Also flies over the town (SkyExtras.tsx).
export function BalloonModel({ c }: { c: readonly string[] }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={k} rotation-y={(k / 8) * Math.PI * 2}>
          <sphereGeometry args={[3.2, 6, 12, 0, Math.PI / 4]} />
          <meshStandardMaterial color={c[k % 2]} side={DoubleSide} />
        </mesh>
      ))}
      <Cone p={[0, -3.6, 0]} r={1.6} h={2.4} c={c[0]} />
      <Box p={[0, -5.4, 0]} s={[1.1, 0.9, 1.1]} c="#8d6e63" />
    </>
  )
}
