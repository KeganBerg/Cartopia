import { Box3, Matrix4, Vector3, type Material, type Mesh, type Object3D } from 'three'

// The doors townspeople use. A building model marks the mesh that is its
// front door with `userData={doorTag()}`; the walkers (Townspeople.tsx) find
// those doors in the drawn town, walk up to them, and DoorLeaves.tsx swings
// (or slides) them open while someone steps in or out. Because the doors are
// read from the model as drawn, every level, theme and merged block gets the
// door it actually shows, with nothing to keep in step by hand.
//
// How a door opens: 'swing' is one leaf hinged on one side, 'double' two
// leaves from the middle, 'slide' two glass panels that part sideways (an
// automatic store door), 'gate' an opening with nothing to open (a venue's
// turnstiles or arch). Tag the panel itself: its face is the doorway.
export type DoorKind = 'swing' | 'double' | 'slide' | 'gate'
// How far past a gate people walk on into an open-air venue before they stop to look around.
export const GATE = 0.8
export const doorTag = (kind: DoorKind = 'swing') => ({ door: kind })

// A door in town (or model) coordinates: the middle of its doorway on the
// outside face, which way it faces (unit, on the ground), how wide and tall
// it is, the height of its sill, and the colour of its panel.
// `hinge` is the side a swing door hangs on: +1 at (x, z) + (nz, -nx) * w / 2, -1 the other edge.
export type DoorSpot = { x: number; z: number; nx: number; nz: number; w: number; h: number; y: number; kind: DoorKind; color: string; hinge: 1 | -1 }

const box = new Box3()
const size = new Vector3()
const mid = new Vector3()
const n = new Vector3()
const inv = new Matrix4()
const rel = new Matrix4()

// Every tagged door under `root`, in `frame`'s coordinates (the town, for
// walkers; the model itself, for tests). A door faces its mesh's own +z, the
// way every model is built facing its street.
export function doorsIn(root: Object3D, frame: Object3D | null): DoorSpot[] {
  root.updateWorldMatrix(true, true)
  if (frame) inv.copy(frame.matrixWorld).invert()
  else inv.identity()
  const out: DoorSpot[] = []
  root.traverse((o) => {
    const kind = o.userData?.door as DoorKind | undefined
    const m = o as Mesh
    if (!kind || !m.isMesh) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    rel.multiplyMatrices(inv, m.matrixWorld)
    box.copy(m.geometry.boundingBox!).applyMatrix4(rel)
    box.getSize(size)
    box.getCenter(mid)
    // The panel's own +z (its face, for a plane) on the ground, snapped to the nearest side.
    n.set(0, 0, 1).transformDirection(rel)
    let nx = 0
    let nz = 0
    if (Math.abs(n.x) > Math.abs(n.z)) nx = Math.sign(n.x)
    else nz = Math.sign(n.z) || 1
    const depth = nx ? size.x : size.z
    const w = nx ? size.z : size.x
    out.push({
      x: mid.x + (nx * depth) / 2, z: mid.z + (nz * depth) / 2, nx, nz, w, h: size.y, y: box.min.y, kind, hinge: 1,
      color: `#${(m.material as Material & { color?: { getHexString(): string } }).color?.getHexString?.() ?? '6d4c41'}`,
    })
  })
  return out
}

// Each drawn lot by building uid (World registers them). A merged block draws
// once, under the uid of its first building.
export const lotRoots = new Map<string, Object3D>()

// Anything this low (a step, a mat) or this high (an awning) doesn't stop a door swinging.
const LOW = 0.12
const HIGH = 0.62
const near = new Box3()
const other = new Box3()
const sweep = new Box3()

// Which side a swing door can open to without hitting a planter or a bench:
// +1, -1, or 0 for neither.
function swingSide(root: Object3D, frame: Object3D | null, d: DoorSpot): 0 | 1 | -1 {
  const tx = d.nz, tz = -d.nx
  const reach = d.w
  near.makeEmpty()
  near.expandByPoint(new Vector3(d.x - reach * 1.2, LOW, d.z - reach * 1.2)).expandByPoint(new Vector3(d.x + reach * 1.2, HIGH, d.z + reach * 1.2))
  const hits: Box3[] = []
  if (frame) inv.copy(frame.matrixWorld).invert()
  else inv.identity()
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || !o.visible || o.userData.door || (m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    rel.multiplyMatrices(inv, m.matrixWorld)
    other.copy(m.geometry.boundingBox!).applyMatrix4(rel)
    if (other.max.y <= LOW || other.min.y >= HIGH || !other.intersectsBox(near)) return
    hits.push(other.clone())
  })
  const free = (side: 1 | -1) => {
    // The quarter of the doorway by the hinge, out as far as the leaf reaches.
    const hx = d.x + (tx * side * d.w) / 2, hz = d.z + (tz * side * d.w) / 2
    const ix = hx - tx * side * d.w * 0.25, iz = hz - tz * side * d.w * 0.25
    sweep.makeEmpty()
    sweep.expandByPoint(new Vector3(hx + d.nx * 0.01, LOW, hz + d.nz * 0.01)).expandByPoint(new Vector3(ix + d.nx * reach, HIGH, iz + d.nz * reach))
    return !hits.some((b) => b.intersectsBox(sweep))
  }
  return free(1) ? 1 : free(-1) ? -1 : 0
}

// The doors of a lot in its parent's frame (the town's), re-read every few
// seconds so a building that levels up, merges or changes look shows its new
// door. A swing door with no room to swing either way slides instead.
const found = new WeakMap<Object3D, { at: number; doors: DoorSpot[] }>()
export function lotDoors(uid: string): DoorSpot[] {
  const root = lotRoots.get(uid)
  if (!root?.parent) return []
  const now = performance.now()
  const was = found.get(root)
  if (was && now - was.at < 8000) return was.doors
  const frame = root.parent
  const doors = doorsIn(root, frame)
  for (const d of doors) {
    if (d.kind !== 'swing') continue
    const side = swingSide(root, frame, d)
    if (side) d.hinge = side
    else d.kind = 'slide'
  }
  found.set(root, { at: now, doors })
  return doors
}

// The door of a lot nearest a point (where a walker reaches the lot) that faces it.
export function doorNear(uid: string, x: number, z: number): DoorSpot | null {
  let best: DoorSpot | null = null
  let bestD = Infinity
  for (const d of lotDoors(uid)) {
    // Only doors that open towards the point, not round the back.
    if ((x - d.x) * d.nx + (z - d.z) * d.nz < 0.05) continue
    const dd = Math.hypot(d.x + d.nx * 0.3 - x, d.z + d.nz * 0.3 - z)
    if (dd < bestD) {
      bestD = dd
      best = d
    }
  }
  return best
}

// Doors standing open (or swinging) right now, by where they are. A walker
// holds a door open while passing through; it swings shut a moment after.
export type OpenDoor = { spot: DoorSpot; open: number; until: number }
export const openDoors = new Map<string, OpenDoor>()
const doorKey = (d: DoorSpot) => `${d.x.toFixed(2)},${d.z.toFixed(2)}`
// Ask for a door to be open, and how open it is (0 shut to 1 wide open).
export function holdOpen(d: DoorSpot, now = performance.now() / 1000): number {
  const k = doorKey(d)
  let o = openDoors.get(k)
  if (!o) openDoors.set(k, (o = { spot: d, open: 0, until: 0 }))
  o.until = now + 0.7
  return d.kind === 'gate' ? 1 : o.open
}
// How fast doors move, in fractions of fully open per second.
const OPENS = 2.6
const CLOSES = 1.6
export function tickDoors(dt: number, now = performance.now() / 1000) {
  for (const [k, o] of openDoors) {
    if (o.spot.kind === 'gate') {
      if (now > o.until) openDoors.delete(k)
      continue
    }
    if (now < o.until) o.open = Math.min(1, o.open + dt * OPENS)
    else {
      o.open = Math.max(0, o.open - dt * CLOSES)
      if (o.open === 0) openDoors.delete(k)
    }
  }
}
