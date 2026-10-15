import { headGeo, legGeo, PERSON, torsoGeo } from './peopleGeo'
import { PEOPLE_SIZED } from './keepShape'

// A person standing still in a scene (a skater, a spectator), built from the
// townspeople's own parts so they're exactly as big as the people walking
// about, and kept at that size when the building around them merges and
// grows. Feet at the group's origin, facing +z. Out of Batch: the parts carry
// their shading (eyes, belt, soles) as vertex colours, which a merge drops.
// humanScale.test.tsx checks every figure stands townsperson height.

const TORSO = torsoGeo()
const HEAD = headGeo()
const LEG = legGeo(PERSON.leg)
const FIGURE = { ...PEOPLE_SIZED, figure: true, noBatch: true }

export function Figure({ shirt, pants, skin, hat }: { shirt: string; pants: string; skin: string; hat: string }) {
  const hip = PERSON.leg
  return (
    <group userData={FIGURE}>
      <group scale={PERSON.scale}>
        <mesh geometry={TORSO} position-y={hip + PERSON.torso} castShadow><meshStandardMaterial vertexColors color={shirt} /></mesh>
        <mesh geometry={HEAD} position-y={hip + PERSON.head}><meshStandardMaterial vertexColors color={skin} /></mesh>
        <mesh position={[0, hip + PERSON.hair, -0.02]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={hat} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} geometry={LEG} position={[sd * 0.045, hip / 2, 0]}><meshStandardMaterial vertexColors color={pants} /></mesh>
        ))}
      </group>
    </group>
  )
}
