import { Box3, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three'

// How much room a model takes on a turntable: the radius it sweeps as it
// spins, and its height.
export type Bounds = { r: number; h: number }

// Measures a model as it stands, unrotated, then moves it so its footprint is
// centred on the turntable's axis and its base sits on the floor. `scale` can
// shrink or grow it to taste from its natural bounds. Shared by every
// turntable preview so tall towers and wide lots all frame the same way.
export function seat(model: Object3D, turntable: Object3D, scale?: (b: Bounds) => number): Bounds {
  const turn = turntable.rotation.y
  const at = turntable.position.clone()
  turntable.rotation.y = 0
  turntable.position.set(0, 0, 0)
  model.scale.setScalar(1)
  model.position.set(0, 0, 0)
  turntable.updateMatrixWorld(true)
  // Effects that reach far beyond the model (searchlight beams) opt out with userData.noFit.
  const box = new Box3()
  model.traverse((o) => {
    if ((o as Mesh).isMesh && !o.userData.merged && !hasNoFit(o, model)) box.expandByObject(o, false)
  })
  turntable.rotation.y = turn
  turntable.position.copy(at)
  if (box.isEmpty()) return { r: 0, h: 0 }
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const b = { r: Math.hypot(size.x, size.z) / 2, h: size.y }
  const k = scale ? scale(b) : 1
  model.scale.setScalar(k)
  model.position.set(-center.x * k, -box.min.y * k, -center.z * k)
  return { r: b.r * k, h: b.h * k }
}

function hasNoFit(o: Object3D, root: Object3D) {
  for (let p: Object3D | null = o; p && p !== root.parent; p = p.parent) if (p.userData.noFit) return true
  return false
}

const RING = 16
const up = new Vector3(0, 1, 0)

// Places the camera along `dir` (from the model towards the camera) so a
// spinning model with these bounds fills the frame at every angle, with `pad`
// of the frame left free around it. `lo`..`hi` is how far the model bobs up,
// and `floor` the radius of anything drawn on the ground under it. Returns
// the point the camera ends up aimed at.
export function frame(cam: PerspectiveCamera, b: Bounds, dir: Vector3, opts: { lo?: number; hi?: number; floor?: number; pad?: number } = {}): Vector3 {
  const { lo = 0, hi = 0, floor = 0, pad = 0.08 } = opts
  const back = dir.clone().normalize()
  const right = new Vector3().crossVectors(up, back).normalize()
  const top = new Vector3().crossVectors(back, right)
  // The swept cylinder's rims, plus the shadow on the ground.
  const pts: Vector3[] = []
  const r = Math.max(b.r, 0.05)
  for (let i = 0; i < RING; i++) {
    const a = (i / RING) * Math.PI * 2
    const x = Math.cos(a)
    const z = Math.sin(a)
    pts.push(new Vector3(x * r, lo, z * r), new Vector3(x * r, hi + b.h, z * r))
    if (floor > 0) pts.push(new Vector3(x * floor, 0, z * floor))
  }
  const tanV = Math.tan((cam.fov * Math.PI) / 360) * (1 - pad)
  const tanH = tanV * cam.aspect
  const look = new Vector3(0, (lo + hi + b.h) / 2, 0)
  const rel = new Vector3()
  let d = 1
  // Find the distance that fits everything, then nudge the aim so the model
  // sits in the middle of the frame rather than wherever perspective puts it.
  for (let pass = 0; pass < 4; pass++) {
    d = 0
    for (const p of pts) {
      rel.subVectors(p, look)
      const z = rel.dot(back)
      d = Math.max(d, z + Math.abs(rel.dot(right)) / tanH, z + Math.abs(rel.dot(top)) / tanV)
    }
    let min = Infinity
    let max = -Infinity
    for (const p of pts) {
      rel.subVectors(p, look)
      const y = rel.dot(top) / (d - rel.dot(back))
      min = Math.min(min, y)
      max = Math.max(max, y)
    }
    look.addScaledVector(top, ((min + max) / 2) * d)
  }
  cam.near = Math.max(0.05, d - r * 2 - b.h - hi)
  cam.far = d + r * 2 + b.h + hi + floor + 1
  cam.position.copy(look).addScaledVector(back, d)
  cam.lookAt(look)
  cam.updateProjectionMatrix()
  return look
}
