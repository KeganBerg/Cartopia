import { describe, expect, it } from 'vitest'
import { Box3, BufferAttribute, InstancedBufferAttribute } from 'three'
import { ARM_LEN, CLUB_FIGURES, clubArmGeo, clubHeadGeo } from './clubPeople'
import { headGeo } from './peopleGeo'
import { CLUB } from './clubLayout'

// The club's people were once plain capsules and boxes next to detailed
// townspeople. These keep them built from the townspeople's own parts, and
// keep the bouncer and the way in clear of the entrance's fittings.

describe('club people match the townspeople', () => {
  it('heads carry the full townsperson face, plus hair', () => {
    const club = clubHeadGeo().getAttribute('position').count
    const town = headGeo(false).getAttribute('position').count
    expect(club).toBeGreaterThan(town)
  })

  it('arms end in a hand where a townsperson’s hand hangs', () => {
    const g = clubArmGeo()
    g.computeBoundingBox()
    const b = g.boundingBox as Box3
    // The townsperson's hand hangs 0.19 below the shoulder pivot.
    expect(-b.min.y).toBeGreaterThan(ARM_LEN)
    expect(-b.min.y).toBeLessThan(0.24)
  })

  it('only the bouncer wears the shades, earpiece and armband, and only he is bald', () => {
    const head = clubHeadGeo().getAttribute('alt') as InstancedBufferAttribute
    const arm = clubArmGeo().getAttribute('alt') as InstancedBufferAttribute
    expect(head.count).toBe(CLUB_FIGURES)
    for (let i = 0; i < head.count; i++) expect(head.getW(i)).toBe(i === 0 ? 1 : 0)
    for (let i = 0; i < arm.count; i++) expect(arm.getW(i)).toBe(i === 1 ? 1 : 0)
    // Every vertex says which tint it takes.
    for (const g of [clubHeadGeo(), clubArmGeo()]) expect((g.getAttribute('part') as BufferAttribute).count).toBe(g.getAttribute('position').count)
  })
})

describe('the way in at the rope', () => {
  // The canopy's front poles stand at the door ± 0.3, 0.44 out from the wall.
  const poles = [-1, 1].map((s) => [CLUB.doorX + s * 0.3, CLUB.doorZ + 0.44])
  const seg = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
    return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)
  }

  it('walks people round the canopy poles, not through them', () => {
    const path = [[CLUB.queueX, CLUB.queueZ], ...CLUB.inPath, [CLUB.doorX, CLUB.doorZ]]
    for (let i = 1; i < path.length; i++) for (const p of poles) expect(seg(p, path[i - 1], path[i])).toBeGreaterThan(0.15)
  })
})
