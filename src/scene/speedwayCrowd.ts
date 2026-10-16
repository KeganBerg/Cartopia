import { BoxGeometry, BufferGeometry, Matrix4, Object3D, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ARM_LEN, armGeo, handGeo, headGeo, legGeo, torsoGeo } from './peopleGeo'
import { ARC, ARC0, DECK, TIERS, deckAt } from './speedwayLayout'

// The Speedway's grandstand seats and the fans at them, in the model's own
// units. Every fan belongs to one seat and is drawn with that seat's own
// transform, stood on the step just in front of it as in a real stadium: shoes
// flat on the row, shins clear of the cushion. Feet never leave the step;
// cheering only raises the arms.

// Seats: one every SEAT_W along a row, in blocks of BLOCK with an aisle (a
// seat's width, marked by a white stair nosing) between blocks.
export const SEAT_W = 0.12
export const BLOCK = 6
// Where a seat stands on its row: this far out from the row's front edge.
export const SEAT_IN = 0.041

// One seat, facing +z (the track), standing on y = 0.
export const SEAT = {
  w: 0.085,
  // Cushion: top at panTop, front edge at panFront.
  panTop: 0.04,
  panFront: 0.014,
  panBack: -0.023,
  // Seat back: its front face at backFront, up to backTop.
  backFront: -0.023,
  backTop: 0.1,
}

// The standing fan: a townsperson (peopleGeo.ts, face and all) drawn FAN
// times their size so they fit the seats, seat-local. Model units below are
// the townspeople's own (hip LEG high, parts stacked from the hip).
export const FAN = 0.25
const LEG = 0.25
const LEG_HALF_D = 0.035
export const BODY = {
  // Where they stand (the middle of their legs): just clear of the cushion's front edge.
  at: SEAT.panFront + LEG_HALF_D * FAN + 0.0003,
  hip: LEG * FAN,
  shoulder: 0.11 * FAN,
  shoulderY: (LEG + 0.15 + 0.128) * FAN,
  arm: ARM_LEN * FAN,
}

export type Seat = { a: number; r: number; y: number; row: number; r0: number }

// Rows of seats in blocks with aisles between, lined up row over row; `k`
// is how much longer the terraces are in a merged block. Fans take some of
// the seats (about half at level 1, seven in ten at 10), each seat at most one.
export function speedwayStands(lvl: number, k: number) {
  const seats: Seat[] = [], aisles: Seat[] = [], fans: number[] = []
  const rows = deckAt(lvl) ? [...TIERS, ...DECK.rows] : TIERS
  const fill = 0.45 + lvl * 0.025
  // Same slot count every row (set by the front row), so the aisles run straight up.
  const slots = Math.floor((ARC * (TIERS[0].r0 + SEAT_IN) * k) / SEAT_W)
  rows.forEach(({ r0, y }, row) => {
    for (let i = 0; i < slots; i++) {
      const a = ARC0 + (ARC * (i + 0.5)) / slots
      const at = { a, r: r0 + SEAT_IN, y, row, r0 }
      if (i % (BLOCK + 1) === BLOCK) {
        aisles.push(at)
        continue
      }
      const h = Math.abs(Math.sin(i * 12.9898 + row * 78.233) * 43758.5453) % 1
      if (h < fill) fans.push(seats.length)
      seats.push(at)
    }
  })
  return { seats, aisles, fans }
}

// A seat's transform as the block draws it: on its row, facing the track
// (an oval in a stretched pair). Fans use exactly this one.
const o = new Object3D()
export function seatMatrix(s: Seat, sx: number, sz: number, out = new Matrix4()) {
  const x = Math.sin(s.a) * s.r, z = Math.cos(s.a) * s.r
  o.position.set(x, s.y, z)
  o.rotation.set(0, Math.atan2(-x * sx, -z * sz), 0)
  o.scale.set(1, 1, 1)
  o.updateMatrix()
  return out.copy(o.matrix)
}

const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z)

// The seat: cushion and back (white takes the row's colour) on a post.
export function seatParts() {
  const { w, panTop, panFront, panBack, backFront, backTop } = SEAT
  return {
    shell: [
      boxAt(w, 0.016, panFront - panBack, 0, panTop - 0.008, (panFront + panBack) / 2),
      boxAt(w, backTop - 0.03, 0.014, 0, (backTop + 0.03) / 2, backFront - 0.007),
    ],
    post: boxAt(0.05, panTop - 0.016, 0.022, 0, (panTop - 0.016) / 2, -0.004),
  }
}

// The standing fan in four colours, seat-local, plus the loose arm and hand.
// Built once, shared by every fan. White takes the fan's own colour.
type Parts = 'shirt' | 'pants' | 'skin' | 'hair' | 'arm' | 'hand'
let body: Record<Parts, BufferGeometry> | null = null
export function fanBody() {
  if (body) return body
  const z = BODY.at / FAN
  const place = (g: BufferGeometry, x: number, y: number, zz = z) => g.translate(x, y, zz).scale(FAN, FAN, FAN)
  const legs = [-1, 1].map((s) => place(legGeo(LEG), s * 0.045, LEG / 2 + 0.01))
  body = {
    shirt: place(torsoGeo(false), 0, LEG + 0.15),
    pants: mergeGeometries(legs)!,
    skin: place(headGeo(false), 0, LEG + 0.36),
    hair: place(new SphereGeometry(0.085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), 0, LEG + 0.385, z - 0.02),
    arm: armGeo().scale(FAN, FAN, FAN),
    hand: handGeo().scale(FAN, FAN, FAN),
  }
  return body
}

// One arm, seat-local, hung from its shoulder: down at the side, or (cheer 1)
// straight up and waving.
const arm = new Object3D()
export function armMatrix(side: -1 | 1, cheer: number, wave: number, out = new Matrix4()) {
  // Swing forward and up from the shoulder; a little out to the side as it rises.
  const swing = -0.12 - cheer * 2.75
  // Hanging down, a positive turn swings the hand out; held up, a negative one.
  const splay = side * (0.08 * (1 - cheer) - cheer * (0.2 + wave * 0.15))
  arm.rotation.set(swing, 0, splay, 'ZXY')
  arm.updateMatrix()
  // The arm and hand hang from their pivot at the shoulder.
  return out.copy(arm.matrix).setPosition(side * BODY.shoulder, BODY.shoulderY, BODY.at)
}
