import { describe, expect, it, vi } from 'vitest'
import type { OwnedCar } from '../game/store'

// The Time Trial podium and board draw other players' cars from their saves. They must look the
// same as in that player's town: skins (which animate), finish, panels, trim, mod skins, hat.
// The board once read only paint and mods, so skinned Tomahawks stood on the podium plain red
// (Kegan, 2026-10-16).

const select = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: () => ({ select: (cols: string) => ({ in: () => select(cols) }) }) } }))
vi.mock('./cloud', () => ({ signedInUser: () => 'me', flushSave: () => Promise.resolve() }))

const { CARS, SKINS, MOD_SKINS } = await import('../game/data')
const { fetchBoardCars } = await import('./trialServer')

const def = CARS[3]
const ups = { engine: 3, tires: 2, nitro: 1 } as unknown as OwnedCar['upgrades']
const styled: OwnedCar = {
  uid: 'a', model: def.id, color: '#c62828', upgrades: ups, finish: 'chrome', skin: SKINS[0].id,
  modSkin: { tracks: MOD_SKINS[0].id }, panels: { hood: { color: '#000000' } } as OwnedCar['panels'], trim: { tint: 'dark' }, hat: { id: 'cap' }, stripe: 'race', mods: [],
}
const plain: OwnedCar = { uid: 'b', model: def.id, color: '#1565c0', upgrades: ups }

describe('Time Trial board cars', () => {
  it('draw each player\'s saved car with its skin, finish, panels, trim, mod skins and hat', async () => {
    select.mockResolvedValue({ data: [{ owner_id: 'p1', best_car: { name: def.name, color: '#c62828', mods: [] }, cars: [plain, styled] }], error: null })
    const cars = await fetchBoardCars([{ owner: 'p1', town: 'T', t: 6.9, pi: 100, car: def.name, place: 1 }])
    expect(select.mock.calls[0][0]).toContain('state->cars')
    expect(cars.p1).toMatchObject({ body: def.body, model: def.id, color: '#c62828', finish: 'chrome', skin: SKINS[0].id, modSkin: { tracks: MOD_SKINS[0].id }, panels: styled.panels, trim: styled.trim, hat: styled.hat, stripe: 'race' })
  })

  it('fall back to the best_car paint when the save has no matching car', async () => {
    select.mockResolvedValue({ data: [{ owner_id: 'p1', best_car: { name: def.name, color: '#2e7d32', mods: ['x'] }, cars: [] }], error: null })
    const cars = await fetchBoardCars([{ owner: 'p1', town: 'T', t: 6.9, pi: 100, car: def.name, place: 1 }])
    expect(cars.p1).toEqual({ body: def.body, model: def.id, color: '#2e7d32', mods: ['x'] })
  })
})
