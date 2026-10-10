import { tiles, toWorld, TILE } from './layout'

// Deterministic pseudo-random so building heights don't change between renders.
const rand = (x: number, z: number) => ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1

const BUILDING_COLORS = ['#f4a261', '#e9c46a', '#e76f51', '#a8dadc', '#cdb4db']

export function Town() {
  return (
    <group>
      {tiles.map(({ x, z, kind }) => {
        const [wx, wz] = toWorld(x, z)
        if (kind === 'road') {
          return (
            <mesh key={`${x},${z}`} position={[wx, 0, wz]} rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial color="#555b63" />
            </mesh>
          )
        }
        const r = rand(x, z)
        const h = 0.6 + r * 2.4
        return (
          <group key={`${x},${z}`} position={[wx, 0, wz]}>
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial color="#7cc77c" />
            </mesh>
            {r > 0.35 && (
              <mesh position={[0, h / 2, 0]} castShadow>
                <boxGeometry args={[TILE * 0.7, h, TILE * 0.7]} />
                <meshStandardMaterial color={BUILDING_COLORS[Math.floor(r * 97) % BUILDING_COLORS.length]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}
