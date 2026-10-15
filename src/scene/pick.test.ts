import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { firstSolid, tapOwnedBy } from './pick'
import { prunedSet } from './pruned'

// Two buildings, the front one overlapping the back one on screen.
function town() {
  const front = new Group()
  const back = new Group()
  // The front building's soft shadow sheet reaches over the back building.
  const shadow = new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false }))
  // A part only shown at night.
  const lamp = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  lamp.visible = false
  front.add(shadow, lamp)
  // Merged into the town: hidden, but it is what the player sees there.
  const wall = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  wall.visible = false
  wall.userData.batched = true
  back.add(wall)
  return { front, back, shadow, lamp, wall }
}

describe('tap picking', () => {
  it('skips a neighbour’s faint or hidden parts and picks the building under the finger', () => {
    const { front, back, shadow, lamp, wall } = town()
    const hits = [{ object: shadow }, { object: lamp }, { object: wall }]
    expect(firstSolid(hits)?.object).toBe(wall)
    expect(tapOwnedBy(hits, back)).toBe(true)
    expect(tapOwnedBy(hits, front)).toBe(false)
  })

  it('still picks a merged wall when the merge also hid its emptied group', () => {
    const { front, back, shadow, wall } = town()
    back.visible = false
    prunedSet.add(back)
    const hits = [{ object: shadow }, { object: wall }]
    expect(tapOwnedBy(hits, back)).toBe(true)
    expect(tapOwnedBy(hits, front)).toBe(false)
  })

  it('keeps the front building when its solid wall really is in front', () => {
    const { front, back, wall } = town()
    const facade = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    front.add(facade)
    const hits = [{ object: facade }, { object: wall }]
    expect(tapOwnedBy(hits, front)).toBe(true)
    expect(tapOwnedBy(hits, back)).toBe(false)
  })

  it('counts glass as solid, so a tap on a shop window picks that shop', () => {
    const { front, back, wall } = town()
    const glass = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: true, opacity: 0.55 }))
    front.add(glass)
    expect(tapOwnedBy([{ object: glass }, { object: wall }], front)).toBe(true)
    expect(tapOwnedBy([{ object: glass }, { object: wall }], back)).toBe(false)
  })
})
