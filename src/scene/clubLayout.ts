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
}
