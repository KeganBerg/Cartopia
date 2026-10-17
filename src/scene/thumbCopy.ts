// Shop, garage and player-card thumbnails: choosing which to draw each frame and copying
// each one's picture out of the shared 3D atlas (see BuildingPreview.tsx).

// The atlas's used corner, copied out of the 3D canvas once per drawn frame. Kept in
// memory (willReadFrequently) so every thumb's copy from it is a plain memory copy.
let flatCanvas: HTMLCanvasElement | null = null
let flatCtx: CanvasRenderingContext2D | null = null
function readBack(src: CanvasImageSource, w: number, h: number): CanvasImageSource | null {
  if (typeof document === 'undefined') return null
  if (!flatCanvas) {
    flatCanvas = document.createElement('canvas')
    flatCtx = flatCanvas.getContext('2d', { willReadFrequently: true })
  }
  if (!flatCtx) return null
  if (flatCanvas.width < w || flatCanvas.height < h) {
    flatCanvas.width = Math.max(flatCanvas.width, w)
    flatCanvas.height = Math.max(flatCanvas.height, h)
  } else flatCtx.clearRect(0, 0, w, h)
  flatCtx.drawImage(src, 0, 0, w, h, 0, 0, w, h)
  return flatCanvas
}

type Placed = { x: number; y: number; w: number; h: number; slots: { canvas: { width: number; height: number }; ctx: Pick<CanvasRenderingContext2D, 'clearRect' | 'drawImage'> | null }[] }
// Each thumb gets its part of the atlas. Copying straight out of the 3D canvas made the
// browser read the whole 3D picture back once per thumb (a dozen thumbs in a player's card
// ran the page at a few frames a second), so it's read back once and shared.
export function copyThumbs(src: CanvasImageSource, width: number, height: number, placed: Iterable<Placed>, flat = readBack) {
  const from = flat(src, width, height) ?? src
  for (const n of placed) {
    for (const s of n.slots) {
      const ctx = s.ctx!
      ctx.clearRect(0, 0, s.canvas.width, s.canvas.height)
      ctx.drawImage(from, n.x, n.y, n.w, n.h, 0, 0, s.canvas.width, s.canvas.height)
    }
  }
}

// A thumbnail on the page. Every one on screen turns. Drawing them all every frame made a page of
// cars slow and each spin choppy, so the frames share a drawing budget: the ones waiting longest
// draw next, and each one's turn follows the clock, so it moves the right amount whenever it draws.
// The biggest one, nearest the middle (a menu's hero car), draws every frame.
// `still`: holds still (Shop > Upgrades' many buildings) unless the mouse is over it.
// `scene`: an arcade card that animates itself; those keep drawing (at 24 a second).
// `angle`: how far round it has turned (0-1). `at`: when it was last drawn (ms).
// `fresh`: it needs drawing (new, or resized).
export type Slot = { key: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; seen: boolean; still: boolean; scene: boolean; angle: number; at: number; fresh: boolean }

// Held pictures drawn per frame, so a page full of them fills in over a few frames
// instead of stalling one.
export const STILL_PER_FRAME = 4

type Box = { left: number; top: number; width: number; height: number }
// The thumbnail that draws every frame: the biggest on screen (a menu's hero car), and among
// ones about that big, the nearest the middle of the screen.
export function chooseFocus<T>(cands: { slot: T; box: Box }[], vw: number, vh: number): T | null {
  const shown = cands.filter(({ box: b }) => b.width > 0 && b.left + b.width > 0 && b.top + b.height > 0 && b.left < vw && b.top < vh)
  if (!shown.length) return null
  const area = (b: Box) => b.width * b.height
  const big = Math.max(...shown.map((c) => area(c.box)))
  const off = (b: Box) => Math.hypot(b.left + b.width / 2 - vw / 2, b.top + b.height / 2 - vh / 2)
  return shown.filter((c) => area(c.box) >= big * 0.8).sort((a, b) => off(a.box) - off(b.box))[0].slot
}

// How many turning thumbnails fit in a frame's drawing budget, given what one has been costing:
// never fewer than two, the hero and one more, so the hero stays smooth and the rest keep turning.
export const spinsFor = (budgetMs: number, msEach: number) => Math.max(2, Math.floor(budgetMs / Math.max(0.1, msEach)))

// Which thumbnails to draw this frame: the hero, then the turning ones that have waited longest
// (up to `spins`, none drawn again within `gap` ms), the self-animating scenes when they're due,
// and the next few held ones that haven't been drawn. Held ones of the same model at the same
// angle and shape (one car at two sizes) draw once. Two shapes draw twice: a wide drawing
// copied into a narrower box squeezed the car (the Car Packs showcase and the card below it).
// Boxes whose width-to-height differ by under about 2% share a drawing.
export const shapeOf = (w: number, h: number) => Math.round(Math.log(w / h) * 50)
type Need = { key: string; angle: number; spin: boolean; w: number; h: number; x: number; y: number; slots: Slot[] }
type Opts = { focus?: Slot | null; hover?: Slot | null; scenes?: boolean; budget?: number; spins?: number; now?: number; gap?: number; still?: boolean }
export function pickThumbs(all: Iterable<Slot>, mounted: (key: string) => boolean, { focus = null, hover = null, scenes = true, budget = STILL_PER_FRAME, spins = Infinity, now = 0, gap = 0, still = false }: Opts = {}) {
  const need = new Map<string, Need>()
  let waiting = false
  const ok = (s: Slot) => s.seen && !!s.ctx && s.canvas.width >= 2
  const turns = (s: Slot) => !still && !s.scene && (s === hover || !s.still)
  // The turning ones due a drawing, longest waiting first; the hero goes first when there's room
  // for more than one, so on a slow phone the others still get their turns.
  const due: Slot[] = []
  for (const s of all) if (ok(s) && turns(s) && (s.fresh || now - s.at >= gap)) due.push(s)
  const hero = spins > 1 ? focus : null
  due.sort((a, b) => (a === hero ? -1 : b === hero ? 1 : a.at - b.at))
  const turning = new Set(due.slice(0, spins))
  if (due.length > turning.size) waiting = true
  for (const s of all) {
    if (!ok(s)) continue
    const spin = turning.has(s) || (s.scene && !still)
    if (s.scene ? !scenes && !s.fresh : !spin && !s.fresh) continue
    if (!spin && turns(s)) continue // turning, but not its go this frame
    const id = `${spin && !s.scene ? `${s.key}|turn|${s.angle}` : s.scene ? s.key : `${s.key}|${s.angle.toFixed(3)}`}|${shapeOf(s.canvas.width, s.canvas.height)}`
    const n = need.get(id)
    if (n) {
      // Grow to the bigger box, keeping this drawing's shape.
      const k = Math.max(s.canvas.width / n.w, s.canvas.height / n.h, 1)
      n.w = Math.round(n.w * k)
      n.h = Math.round(n.h * k)
      n.slots.push(s)
    } else if (!mounted(s.key)) waiting = true // its model isn't mounted yet: try again next frame
    else if (!spin && budget <= 0) waiting = true
    else {
      if (!spin) budget--
      need.set(id, { key: s.key, angle: s.angle, spin, w: s.canvas.width, h: s.canvas.height, x: 0, y: 0, slots: [s] })
    }
  }
  return { need, waiting }
}
