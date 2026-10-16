// Where things stand at the nightclub, in the lot's own coordinates (2x1 lot,
// x from -2 to 2, front door side +z). The model and the townspeople queue
// share these so the line forms along the velvet rope.
export const CLUB = {
  doorX: -1.0, // the entrance and red carpet
  doorZ: 0.36, // the front wall
  ropeZ: 0.6, // velvet rope line, from ropeFrom to ropeTo along x
  ropeFrom: -0.62,
  ropeTo: 1.62,
  queueZ: 0.82, // where people stand in line, just outside the rope
  queueX: -0.5, // first in line, then one step of `gap` further from the door each
  gap: 0.3,
  queueMax: 8,
  // The way in once the bouncer waves you through: out round the canopy's
  // front pole (at doorX + 0.3, z 0.8), then up the red carpet to the door.
  inPath: [[-0.55, 0.98], [-1.0, 0.98]] as [number, number][],
  lampX: 1.45, // searchlights on the roof's back corners: ±lampX, and lampZ from the building's middle
  lampZ: -0.43,
}
