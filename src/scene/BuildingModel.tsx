import { TILE, type BuildingDef } from '../game/data'
import { signTexture } from './signTexture'
import { CarModel } from './CarModel'
import type { Texture } from 'three'
import { brickTex, sidingTex, shingleTex, gravelTex, awningTex, windowTex } from './textures'

type Props = { def: BuildingDef; ghost?: boolean; valid?: boolean }

// Shared material props so ghost previews render translucent.
function useMat(ghost?: boolean, valid?: boolean) {
  return (color: string, map?: Texture) => (
    <meshStandardMaterial
      map={ghost ? null : map ?? null}
      color={ghost ? (valid ? '#66bb6a' : '#ef5350') : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
    />
  )
}

function RoofProp({ prop, y }: { prop: NonNullable<BuildingDef['prop']>; y: number }) {
  switch (prop) {
    case 'donut':
      return (
        <group position={[0, y + 0.45, -0.1]}>
          <mesh rotation-x={-0.3} castShadow><torusGeometry args={[0.32, 0.15, 12, 24]} /><meshStandardMaterial color="#d7a86e" /></mesh>
          <mesh rotation-x={-0.3} position={[0, 0.05, 0.02]}><torusGeometry args={[0.32, 0.12, 12, 24]} /><meshStandardMaterial color="#f06292" /></mesh>
        </group>
      )
    case 'burger':
      return (
        <group position={[0, y + 0.15, -0.1]}>
          <mesh position-y={0.05} castShadow><cylinderGeometry args={[0.38, 0.38, 0.1, 20]} /><meshStandardMaterial color="#e0a052" /></mesh>
          <mesh position-y={0.15}><cylinderGeometry args={[0.4, 0.4, 0.1, 20]} /><meshStandardMaterial color="#5d4037" /></mesh>
          <mesh position-y={0.21}><cylinderGeometry args={[0.42, 0.42, 0.03, 20]} /><meshStandardMaterial color="#66bb6a" /></mesh>
          <mesh position-y={0.3}><sphereGeometry args={[0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e0a052" /></mesh>
        </group>
      )
    case 'cone':
      return (
        <group position={[0, y + 0.4, -0.1]}>
          <mesh rotation-x={Math.PI} castShadow><coneGeometry args={[0.22, 0.6, 14]} /><meshStandardMaterial color="#d7a86e" /></mesh>
          <mesh position-y={0.38}><sphereGeometry args={[0.26, 14, 10]} /><meshStandardMaterial color="#f8bbd0" /></mesh>
        </group>
      )
    case 'tire':
      return (
        <mesh position={[0, y + 0.45, -0.1]} castShadow><torusGeometry args={[0.32, 0.14, 12, 24]} /><meshStandardMaterial color="#212121" /></mesh>
      )
    case 'pin':
      return (
        <group position={[0.6, y + 0.4, -0.1]}>
          <mesh castShadow><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color="#fafafa" /></mesh>
          <mesh position-y={0.28}><cylinderGeometry args={[0.08, 0.12, 0.3, 12]} /><meshStandardMaterial color="#fafafa" /></mesh>
          <mesh position-y={0.24}><cylinderGeometry args={[0.105, 0.105, 0.05, 12]} /><meshStandardMaterial color="#e53935" /></mesh>
          <mesh position-y={0.47}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#fafafa" /></mesh>
        </group>
      )
    case 'popcorn':
      return null
  }
}

function Sign({ text, w, y, z, bg, fg }: { text: string; w: number; y: number; z: number; bg?: string; fg?: string }) {
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={signTexture(text, bg, fg)} toneMapped={false} />
    </mesh>
  )
}

export function BuildingModel({ def, ghost, valid }: Props) {
  const m = useMat(ghost, valid)
  const W = def.w * TILE
  const D = def.h * TILE
  const sign = !ghost && def.sign

  switch (def.id) {
    case 'bush':
      return (
        <group>
          {[[-0.3, 0.1, 0.42], [0.25, -0.2, 0.5], [0.1, 0.3, 0.36]].map(([x, z, r], i) => (
            <mesh key={i} position={[x, r * 0.8, z]} castShadow>
              <sphereGeometry args={[r, 10, 8]} />
              {m(i % 2 ? def.roof : def.color)}
            </mesh>
          ))}
        </group>
      )
    case 'rock':
      return (
        <group>
          <mesh position={[0, 0.4, 0]} rotation={[0.3, 0.6, 0.2]} castShadow>
            <dodecahedronGeometry args={[0.65, 0]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0.5, 0.2, 0.35]} rotation={[0.5, 0.2, 0]} castShadow>
            <dodecahedronGeometry args={[0.3, 0]} />
            {m(def.roof)}
          </mesh>
        </group>
      )
    case 'cactus':
      return (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <capsuleGeometry args={[0.2, 1.1, 4, 10]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0.35, 0.85, 0]} rotation-z={-0.2} castShadow>
            <capsuleGeometry args={[0.12, 0.45, 4, 8]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[-0.32, 1.05, 0]} rotation-z={0.25} castShadow>
            <capsuleGeometry args={[0.11, 0.35, 4, 8]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.55, 0.6, 0.12, 14]} />
            {m('#d7b77b')}
          </mesh>
        </group>
      )
    case 'tree':
      // Cartoon oak: tapered trunk under a cluster of faceted leaf balls.
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.17, 0.7, 7]} />
            {m('#7b5034')}
          </mesh>
          {([[0, 1.15, 0, 0.55, def.color], [0.32, 0.95, 0.12, 0.38, '#5cb85c'], [-0.3, 0.98, -0.08, 0.4, def.roof], [0.05, 1.5, -0.05, 0.38, '#66c266'], [-0.08, 1.02, 0.32, 0.34, '#4caf50']] as const).map(([x, y, z, r, c], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <icosahedronGeometry args={[r, 1]} />
              <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : c} transparent={ghost} opacity={ghost ? 0.55 : 1} flatShading />
            </mesh>
          ))}
        </group>
      )
    case 'palm':
      // Curved, banded trunk with drooping fronds and coconuts.
      return (
        <group>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[i * i * 0.012, 0.18 + i * 0.32, 0]} rotation-z={-0.05 - i * 0.03} castShadow>
              <cylinderGeometry args={[0.09 - i * 0.008, 0.11 - i * 0.008, 0.34, 7]} />
              {m(i % 2 ? '#a1887f' : '#8d6e63')}
            </mesh>
          ))}
          <group position={[0.2, 1.72, 0]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <group key={i} rotation-y={(i * Math.PI * 2) / 7}>
                {[0, 1, 2].map((j) => (
                  <mesh key={j} position={[0.18 + j * 0.24, 0.02 - j * j * 0.07, 0]} rotation-z={-0.15 - j * 0.35} castShadow>
                    <boxGeometry args={[0.28, 0.03, 0.2 - j * 0.04]} />
                    {m(j === 2 ? '#43a047' : def.color)}
                  </mesh>
                ))}
              </group>
            ))}
            {[0, 1, 2].map((i) => (
              <mesh key={`c${i}`} position={[Math.cos(i * 2.1) * 0.1, -0.1, Math.sin(i * 2.1) * 0.1]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                {m('#6d4c41')}
              </mesh>
            ))}
          </group>
        </group>
      )
    case 'fountain':
      return (
        <group>
          <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.85, 0.9, 0.3, 24]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.03, 24]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.18, 0.8]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <sphereGeometry args={[0.22, 12, 8]} />
            {m('#b3e5fc')}
          </mesh>
        </group>
      )
    case 'flowers':
      return (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow><boxGeometry args={[1.3, 0.16, 1.3]} />{m(def.roof)}</mesh>
          {[[-0.4, -0.4], [0, -0.35], [0.4, -0.4], [-0.35, 0], [0.05, 0.05], [0.4, 0], [-0.4, 0.4], [0, 0.4], [0.4, 0.38]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.26, z]}><sphereGeometry args={[0.13, 8, 6]} />{m(['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043'][i % 4])}</mesh>
          ))}
        </group>
      )
    case 'lamp':
      return (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 1.8]} />{m(def.color)}</mesh>
          <mesh position={[0.2, 1.78, 0]}><boxGeometry args={[0.45, 0.05, 0.08]} />{m(def.color)}</mesh>
          <mesh position={[0.38, 1.72, 0]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color={def.roof} emissive={def.roof} emissiveIntensity={0.6} /></mesh>
        </group>
      )
    case 'bench':
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[1, 0.06, 0.32]} />{m(def.color)}</mesh>
          <mesh position={[0, 0.5, -0.15]} castShadow><boxGeometry args={[1, 0.3, 0.05]} />{m(def.color)}</mesh>
          {[-0.42, 0.42].map((x) => <mesh key={x} position={[x, 0.15, 0]}><boxGeometry args={[0.06, 0.3, 0.3]} />{m(def.roof)}</mesh>)}
        </group>
      )
    case 'billboard':
      return (
        <group>
          {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.9, 0]} castShadow><boxGeometry args={[0.08, 1.8, 0.08]} />{m('#78909c')}</mesh>)}
          <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[1.8, 0.8, 0.08]} />{m(def.color)}</mesh>
          {!ghost && (
            <mesh position={[0, 1.7, 0.05]}>
              <planeGeometry args={[1.7, 0.7]} />
              <meshBasicMaterial map={signTexture('CARTOPIA', '#1e88e5', '#ffffff')} toneMapped={false} />
            </mesh>
          )}
        </group>
      )
    case 'statue':
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[1, 0.7, 1]} />{m(def.roof)}</mesh>
          <group position={[0, 0.7, 0]} rotation-y={0.6} scale={1.2}>
            {ghost ? <mesh position-y={0.25}><boxGeometry args={[0.7, 0.4, 1.2]} />{m(def.color)}</mesh> : <CarModel body="super" color={def.color} />}
          </group>
        </group>
      )
    case 'pond':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.8, 1.8, 0.06, 32]} />{m(def.roof)}</mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.5, 1.5, 0.04, 32]} />{m(def.color)}</mesh>
          {!ghost && [[0.4, 0.2], [-0.5, -0.3]].map(([x, z], i) => (
            <group key={i} position={[x, 0.15, z]}>
              <mesh><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial color="#fff59d" /></mesh>
              <mesh position={[0, 0.1, 0.08]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#fff59d" /></mesh>
              <mesh position={[0, 0.1, 0.16]}><coneGeometry args={[0.03, 0.06, 6]} /><meshStandardMaterial color="#ff9800" /></mesh>
            </group>
          ))}
          {[[1.4, 1.2], [-1.3, 1.3], [1.3, -1.3]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.3, z]} castShadow><sphereGeometry args={[0.3, 10, 8]} />{m('#388e3c')}</mesh>
          ))}
        </group>
      )
    case 'stadium':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[1.9, 1.9, 0.06, 40]} />{m('#5f646b')}</mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[1.2, 1.2, 0.04, 40]} />{m('#66bb6a')}</mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[1.95, 1.95, 0.9, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : def.color} side={2} transparent={ghost} opacity={ghost ? 0.55 : 1} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[2.0, 2.0, 0.12, 40, 1, true, Math.PI * 0.15, Math.PI * 1.1]} />
            <meshStandardMaterial color={def.roof} side={2} />
          </mesh>
          {sign && <Sign text="SPEEDWAY" w={2} y={1.25} z={0} bg="#c62828" fg="#ffffff" />}
        </group>
      )
    case 'house':
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.3, 1, 1.2]} />
            {m(def.color, sidingTex(1, 1.5))}
          </mesh>
          <mesh position={[0, 1.35, 0]} rotation-y={Math.PI / 4} castShadow>
            <coneGeometry args={[1.15, 0.7, 4]} />
            {m(def.roof, shingleTex(3, 1.5))}
          </mesh>
          <mesh position={[0, 0.3, 0.61]}>
            <planeGeometry args={[0.3, 0.6]} />
            {m('#795548')}
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.6, 0.605]}>
              <planeGeometry args={[0.28, 0.26]} />
              {m('#ffffff', windowTex())}
            </mesh>
          ))}
        </group>
      )
    case 'showroom':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[W * 0.95, 0.1, D * 0.95]} />
            {m('#e0e0e0')}
          </mesh>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[1.5, 1.5, 1.8, 32]} />
            <meshStandardMaterial color={ghost ? (valid ? '#66bb6a' : '#ef5350') : '#80deea'} transparent opacity={ghost ? 0.55 : 0.75} metalness={0.3} roughness={0.1} />
          </mesh>
          <mesh position={[0, 2.05, 0]} castShadow>
            <cylinderGeometry args={[1.65, 1.65, 0.35, 32]} />
            {m('#eceff1')}
          </mesh>
          {!ghost && (
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.9, 0.4, 0.5]} />
              <meshStandardMaterial color="#d32f2f" metalness={0.4} roughness={0.3} />
            </mesh>
          )}
          {sign && <Sign text="SHOWROOM" w={2.4} y={2.05} z={1.67} bg="#eceff1" fg="#37474f" />}
        </group>
      )
    case 'garage':
      return (
        <group>
          <mesh position={[0, 0.8, -0.3]} castShadow receiveShadow>
            <boxGeometry args={[W * 0.9, 1.6, D * 0.6]} />
            {m(def.color)}
          </mesh>
          <mesh position={[0, 1.65, -0.3]} castShadow>
            <boxGeometry args={[W * 0.95, 0.12, D * 0.65]} />
            {m(def.roof)}
          </mesh>
          {[-0.95, 0, 0.95].map((x) => (
            <mesh key={x} position={[x, 0.55, D * 0.3 - 0.29]}>
              <planeGeometry args={[0.8, 1.05]} />
              {m('#eceff1')}
            </mesh>
          ))}
          <mesh position={[0, 0.03, 1.1]} receiveShadow>
            <boxGeometry args={[W * 0.9, 0.05, 1.2]} />
            {m('#9e9e9e')}
          </mesh>
          {sign && <Sign text="MY GARAGE" w={2.2} y={1.35} z={0.32} bg="#263238" fg="#ffca28" />}
        </group>
      )
    case 'gas':
      return (
        <group>
          {[[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]].map(([x, z], i) => (
            <mesh key={i} position={[x - 0.3, 0.7, z]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 1.4]} />
              {m('#eeeeee')}
            </mesh>
          ))}
          <mesh position={[-0.3, 1.45, 0]} castShadow>
            <boxGeometry args={[3, 0.2, 1.5]} />
            {m(def.roof)}
          </mesh>
          {[-1, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]} castShadow>
              <boxGeometry args={[0.3, 0.7, 0.3]} />
              {m(def.color)}
            </mesh>
          ))}
          <mesh position={[1.55, 0.5, 0]} castShadow>
            <boxGeometry args={[0.8, 1, 1.4]} />
            {m('#fafafa')}
          </mesh>
          {sign && <Sign text="GAS" w={1.2} y={1.45} z={0.76} bg="#e53935" fg="#ffffff" />}
        </group>
      )
    case 'cinema':
      return (
        <group>
          <mesh position={[0, 1.4, -1.5]} castShadow>
            <boxGeometry args={[3, 1.8, 0.15]} />
            {m('#fafafa')}
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.6, -1.55]} castShadow>
              <boxGeometry args={[0.15, 1.2, 0.15]} />
              {m('#5d4037')}
            </mesh>
          ))}
          {[-1.9, 1.9].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]} castShadow>
              <boxGeometry args={[0.1, 0.7, 3.8]} />
              {m(def.color)}
            </mesh>
          ))}
          <mesh position={[0, 0.03, 0.2]} receiveShadow>
            <boxGeometry args={[3.6, 0.05, 3]} />
            {m('#757575')}
          </mesh>
          <mesh position={[1.2, 0.5, 1.3]} castShadow>
            <boxGeometry args={[0.8, 1, 0.8]} />
            {m('#e53935')}
          </mesh>
          {sign && <Sign text="DRIVE-IN" w={2.4} y={1.6} z={-1.42} bg="#fafafa" fg="#3e2723" />}
        </group>
      )
    default: {
      // Generic storefront: body, roof trim, awning and a sign over the door.
      const h = def.w > 1 ? 1.5 : 1.3
      return (
        <group>
          <mesh position={[0, h / 2, -0.1]} castShadow receiveShadow>
            <boxGeometry args={[W * 0.82, h, D * 0.72]} />
            {m(def.color, brickTex(W * 0.6, h * 0.8))}
          </mesh>
          {/* Flat gravel roof inside a coloured parapet. */}
          <mesh position={[0, h + 0.06, -0.1]} castShadow>
            <boxGeometry args={[W * 0.88, 0.14, D * 0.78]} />
            {m(def.roof)}
          </mesh>
          <mesh position={[0, h + 0.135, -0.1]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[W * 0.78, D * 0.68]} />
            {m('#ffffff', gravelTex(W, D))}
          </mesh>
          {/* Big shop windows either side of the door. */}
          <mesh position={[0, 0.42, D * 0.26 + 0.008]}>
            <planeGeometry args={[W * 0.7, 0.62]} />
            {m('#ffffff', windowTex())}
          </mesh>
          <mesh position={[0, 0.08, D * 0.26 + 0.02]}>
            <boxGeometry args={[W * 0.82, 0.16, 0.03]} />
            {m('#eceff1')}
          </mesh>
          <mesh position={[0, 0.82, D * 0.26 + 0.2]} rotation-x={0.45} castShadow>
            <boxGeometry args={[W * 0.76, 0.03, 0.44]} />
            {m('#ffffff', awningTex(def.roof === '#f5f5f5' || def.roof === '#fff8e1' ? def.color : def.roof))}
          </mesh>
          <mesh position={[0, 0.32, D * 0.26 + 0.012]}>
            <planeGeometry args={[0.4, 0.6]} />
            {m('#4e342e')}
          </mesh>
          {def.prop && <RoofProp prop={def.prop} y={h + 0.13} />}
          {def.id === 'motel' && [-1.2, -0.6, 0.6, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.32, D * 0.26 + 0.01]}>
              <planeGeometry args={[0.3, 0.55]} />
              {m('#00897b')}
            </mesh>
          ))}
          {def.id === 'carwash' && (
            <mesh position={[0, 0.6, D * 0.26 + 0.02]}>
              <planeGeometry args={[1.4, 1]} />
              {m('#0277bd')}
            </mesh>
          )}
          {sign && (
            <group position={[0, h + 0.38, D * 0.22]}>
              <mesh position={[0, 0, -0.03]}>
                <boxGeometry args={[Math.min(W * 0.8, 2.4) + 0.08, Math.min(W * 0.8, 2.4) / 4 + 0.08, 0.05]} />
                <meshStandardMaterial color={def.roof} />
              </mesh>
              <Sign text={def.sign!} w={Math.min(W * 0.8, 2.4)} y={0} z={0} bg="#fffde7" fg={def.id === 'tires' ? '#212121' : '#c62828'} />
            </group>
          )}
        </group>
      )
    }
  }
}
