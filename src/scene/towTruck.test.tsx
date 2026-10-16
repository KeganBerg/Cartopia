// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Object3D } from 'three'
import { wheelRig } from './CarModel'
import { TowTruck, rollWheels } from './TownCars'

// Kegan (2026-10-16): Rusty's tow truck slid round town on wheels that never turned.
// The truck now takes a rig (required), and whoever draws it rolls the wheels.
describe("Rusty's tow truck", () => {
  it('has four wheels that roll as it drives', async () => {
    const rig = wheelRig('truck')
    const r = await ReactThreeTestRenderer.create(<TowTruck rig={rig} />)
    const spin = rig.spin.filter((w): w is NonNullable<typeof w> => !!w)
    expect(spin.length).toBe(4)
    // Each spin group holds the wheel's meshes, so turning it turns the tyre.
    const meshes = (o: Object3D) => { let n = 0; o.traverse((c) => void ((c as { isMesh?: boolean }).isMesh && n++)); return n }
    for (const w of spin) expect(meshes(w)).toBeGreaterThan(0)
    const before = spin.map((w) => w.rotation.x)
    rollWheels(rig, 1.6, 1 / 30, 1)
    spin.forEach((w, i) => expect(w.rotation.x).toBeGreaterThan(before[i]))
    // Parked: no roll.
    const still = spin.map((w) => w.rotation.x)
    rollWheels(rig, 0, 1 / 30, 1)
    spin.forEach((w, i) => expect(w.rotation.x).toBe(still[i]))
    await r.unmount()
  })
})
