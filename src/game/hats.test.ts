// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame, saveOf, type SaveState } from './store'
import { carsInClass } from './classes'
import { COWBOY_COLORS, HATS, HAT_PAINTS, cleanHat, hatChoices, hatDef, hatPaint, hatProgress, newHatQuest, ownedHats, sameHat } from './hats'

const car = { uid: 'h1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
const g = () => useGame.getState()

describe('hat catalogue', () => {
  it('has the asked-for hats, each its own item', () => {
    const ids = HATS.map((h) => h.id)
    expect(new Set(ids).size).toBe(HATS.length)
    for (const id of ['cap', 'backcap', 'cowboy', 'pinkcowboy', 'fez', 'crown', 'hardhat', 'tophat', 'beanie', 'chef', 'party', 'pirate', 'viking', 'propeller', 'sombrero', 'cone']) expect(ids).toContain(id)
  })
  it('wins every hat by a challenge or a crate, never coins', () => {
    for (const h of HATS) {
      expect(h.challenge || h.crates?.length, h.id).toBeTruthy()
      expect('coins' in h, h.id).toBe(false)
      if (h.challenge) {
        expect(h.challenge.goal).toBeGreaterThan(0)
        expect(h.challenge.text.split(/\s+/).length).toBeLessThanOrEqual(12)
      }
    }
    // Crate-only hats.
    for (const id of ['crown', 'tophat']) {
      expect(hatDef(id)!.challenge).toBeUndefined()
      expect(hatDef(id)!.crates!.length).toBeGreaterThan(0)
    }
    expect(hatDef('cowboy')!.challenge).toMatchObject({ stat: 'raceCars', goal: 5, cls: 'muscle' })
  })
  it('counts only Muscle car wins toward the Cowboy Hat', () => {
    const cowboy = hatDef('cowboy')!
    const quest = { ...newHatQuest(), cars: ['pip', 'stallion', 'charger', 'miata', 'lemans'] }
    // stallion and charger are Muscle bodies; lemans carries Muscle as its second tag.
    expect(hatProgress(cowboy, { stats: {}, hatQuest: quest })).toBe(3)
    expect(carsInClass('muscle').filter((c) => !c.rescueOnly && !c.season && !c.secret).length).toBeGreaterThanOrEqual(cowboy.challenge!.goal)
  })
  it('gives each hat base colours its rule allows', () => {
    for (const h of HATS) {
      const ok = hatChoices(h)
      if (ok) for (const c of h.base) expect(ok).toContain(c)
      expect(h.base.length).toBe(h.colors === 'twoTone' ? 2 : 1)
    }
  })
})

describe('hat colour rules', () => {
  it('caps take one colour or two', () => {
    expect(cleanHat({ id: 'cap', colors: ['#1e88e5'] })).toEqual({ id: 'cap', colors: ['#1e88e5'] })
    expect(hatPaint({ id: 'cap', colors: ['#1e88e5'] })).toEqual(['#1e88e5', '#1e88e5'])
    expect(cleanHat({ id: 'backcap', colors: ['#1e88e5', '#fdd835'] })).toEqual({ id: 'backcap', colors: ['#1e88e5', '#fdd835'] })
    // Two of the same is one colour; the base colours are no colours.
    expect(cleanHat({ id: 'cap', colors: ['#1e88e5', '#1e88e5'] })).toEqual({ id: 'cap', colors: ['#1e88e5'] })
    expect(cleanHat({ id: 'cap', colors: hatDef('cap')!.base })).toEqual({ id: 'cap' })
  })
  it('cowboy hats come in brown, dark brown and black only', () => {
    expect(cleanHat({ id: 'cowboy', colors: [COWBOY_COLORS[2]] })).toEqual({ id: 'cowboy', colors: [COWBOY_COLORS[2]] })
    expect(cleanHat({ id: 'cowboy', colors: ['#ec407a'] })).toEqual({ id: 'cowboy' })
    expect(cleanHat({ id: 'cowboy', colors: [COWBOY_COLORS[0], COWBOY_COLORS[1]] })).toEqual({ id: 'cowboy' })
  })
  it('fixed hats ignore colours, pick hats take one from the chart', () => {
    expect(cleanHat({ id: 'pinkcowboy', colors: ['#212121'] })).toEqual({ id: 'pinkcowboy' })
    expect(cleanHat({ id: 'beanie', colors: [HAT_PAINTS[0].color, '#fff'] })).toEqual({ id: 'beanie', colors: [HAT_PAINTS[0].color] })
    expect(cleanHat({ id: 'party', colors: ['#123456'] })).toEqual({ id: 'party' })
  })
  it('drops unknown hats and junk', () => {
    expect(cleanHat({ id: 'sock' })).toBeNull()
    expect(cleanHat(null)).toBeNull()
    expect(cleanHat('cap')).toBeNull()
    expect(cleanHat({ id: 'cap', colors: [7, null] })).toEqual({ id: 'cap' })
    expect(sameHat({ id: 'cap', colors: hatDef('cap')!.base }, { id: 'cap' })).toBe(true)
  })
})

const fresh = (extra: object = {}) => useGame.setState({ level: 1, coins: 500, hats: [], hatQuest: newHatQuest(g().stats), raceCar: null, cars: [car], ...extra })

describe('wearing hats', () => {
  it('wears an owned hat in any colours its rule allows, on any car, for free', () => {
    fresh({ hats: ['cap'], cars: [car, { ...car, uid: 'h2' }] })
    expect(g().hatCar('h1', { id: 'cap', colors: ['#1e88e5', '#fdd835'] })).toBe(true)
    expect(g().cars[0].hat).toEqual({ id: 'cap', colors: ['#1e88e5', '#fdd835'] })
    expect(g().hatCar('h2', { id: 'cap' })).toBe(true)
    expect(g().cars[1].hat).toEqual({ id: 'cap' })
    expect(g().coins).toBe(500)
  })
  it('recolours an owned hat and takes it off', () => {
    fresh({ hats: ['cowboy'], cars: [{ ...car, hat: { id: 'cowboy' } }] })
    expect(g().hatCar('h1', { id: 'cowboy', colors: [COWBOY_COLORS[2]] })).toBe(true)
    expect(g().cars[0].hat).toEqual({ id: 'cowboy', colors: [COWBOY_COLORS[2]] })
    expect(g().hatCar('h1', { id: 'cowboy', colors: [COWBOY_COLORS[2]] })).toBe(false)
    expect(g().hatCar('h1', null)).toBe(true)
    expect(g().cars[0].hat).toBeUndefined()
    expect(g().hats).toEqual(['cowboy'])
  })
  it('never sells a hat: ones you have not won stay off', () => {
    fresh({ coins: 1e6, level: 50 })
    for (const id of ['cap', 'crown', 'tophat', 'viking', 'sock']) expect(g().hatCar('h1', { id })).toBe(false)
    expect(g().cars[0].hat).toBeUndefined()
    expect(g().hats).toEqual([])
    expect(g().coins).toBe(1e6)
  })
})

describe('hat challenges', () => {
  it('counts only what is done since hats arrived, and grants the hat at the goal', () => {
    const stats = { ...saveOf(g()).stats, built: 40 }
    useGame.setState({ hats: [], stats, hatQuest: newHatQuest(stats) })
    const d = hatDef('hardhat')!
    expect(hatProgress(d, g())).toBe(0)
    useGame.setState({ stats: { ...stats, built: 49 } })
    expect(hatProgress(d, g())).toBe(9)
    expect(g().hats).not.toContain('hardhat')
    useGame.setState({ stats: { ...stats, built: 50 } })
    expect(g().hats).toContain('hardhat')
    // Never taken back or reset.
    useGame.setState({ stats: { ...stats, built: 50 } })
    expect(g().hats.filter((h) => h === 'hardhat')).toHaveLength(1)
  })
  it('the cowboy hat takes race wins in 5 different Muscle cars', () => {
    const models = ['stallion', 'charger', 'hellcat', 'rattler', 'bandit']
    fresh({ cars: models.map((model, i) => ({ ...car, uid: `c${i}`, model })) })
    for (const [i, model] of models.entries()) {
      useGame.setState({ raceCar: `c${i}` })
      g().finishRace(true, 10)
      // A loss and a second win in the same car don't count.
      g().finishRace(false, 10)
      if (i === 0) g().finishRace(true, 10)
      expect(g().hatQuest.cars).toContain(model)
      expect(hatProgress(hatDef('cowboy')!, g())).toBe(i + 1)
      expect(g().hats.includes('cowboy')).toBe(i === 4)
    }
  })
  it('skips wins in cars outside the Muscle class for the cowboy hat', () => {
    fresh({ cars: [{ ...car, uid: 'c0', model: 'miata' }] })
    useGame.setState({ raceCar: 'c0' })
    g().finishRace(true, 10)
    expect(g().hatQuest.cars).toContain('miata')
    expect(hatProgress(hatDef('cowboy')!, g())).toBe(0)
  })
  it('counts kart Grand Prix wins and arcade games', () => {
    fresh()
    for (let i = 0; i < 9; i++) g().finishArcade(0, 0)
    expect(g().hats).not.toContain('party')
    g().finishArcade(0, 0)
    expect(g().hats).toContain('party')
    useGame.setState({ hatQuest: { ...g().hatQuest, kart: 9 } })
    expect(g().hats).not.toContain('pirate')
    g().gpResult('rookie', true)
    expect(g().hatQuest.kart).toBe(10)
    expect(g().hats).toContain('pirate')
  })
  it('adds a hat from a crate', () => {
    fresh()
    g().applyCrate({ crate: 'diamond', cost: { coins: 0, bucks: 0 }, drop: { kind: 'hat', hat: 'crown' } })
    expect(g().hats).toEqual(['crown'])
    expect(g().hatCar('h1', { id: 'crown' })).toBe(true)
    expect(ownedHats(g())).toEqual(['crown'])
  })
})

describe('saves', () => {
  it('loads a save from before hats with no hats, counting challenges from then on', () => {
    const old = saveOf(g()) as Partial<SaveState>
    delete old.hats
    delete old.hatQuest
    const stats = { ...old.stats!, racesWon: 500, built: 500 }
    g().loadSave({ ...old, stats, cars: [car] } as SaveState)
    expect(g().hats).toEqual([])
    expect(g().cars[0].hat).toBeUndefined()
    expect(g().hatQuest.base.racesWon).toBe(500)
    expect(hatProgress(hatDef('cap')!, g())).toBe(0)
    expect(saveOf(g()).hats).toEqual([])
    expect(saveOf(g()).hatQuest).toEqual(g().hatQuest)
  })
  it('keeps owned hats and worn hats through a cloud round trip', () => {
    const quest = { base: { ...g().stats }, cars: ['pip'], kart: 3, arcade: 1 }
    useGame.setState({ hats: ['cap', 'fez'], hatQuest: quest, cars: [{ ...car, hat: { id: 'cap', colors: ['#1e88e5'] } }] })
    const back = JSON.parse(JSON.stringify(saveOf(g()))) as SaveState
    expect(back.hats).toEqual(['cap', 'fez'])
    expect(back.cars[0].hat).toEqual({ id: 'cap', colors: ['#1e88e5'] })
    expect(back.hatQuest).toEqual(quest)
    useGame.setState({ hats: [], hatQuest: newHatQuest(), cars: [] })
    g().loadSave(back)
    expect(g().hats).toEqual(['cap', 'fez'])
    expect(g().cars[0].hat).toEqual({ id: 'cap', colors: ['#1e88e5'] })
    expect(g().hatQuest).toEqual(quest)
  })
})
