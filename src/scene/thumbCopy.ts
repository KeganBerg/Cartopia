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

// A thumbnail on the page. `still`: a picture drawn once, at the angle reduced motion uses,
// then left alone (a page of them, like Shop > Upgrades in a big town, redrew dozens of
// detailed buildings every frame). `fresh`: it still needs drawing.
export type Slot = { key: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; seen: boolean; still: boolean; fresh: boolean }

// Still pictures drawn per frame, so a page full of them fills in over a few frames
// instead of stalling one.
export const STILL_PER_FRAME = 4

// Which thumbnails to draw this frame: every turning one on screen, and the next few still
// ones that haven't been drawn. Keyed by model, still and shape, so one model at two sizes of
// the same shape draws once. Two shapes draw twice: a wide drawing copied into a narrower box
// squeezed the car (the Car Packs showcase and the card below it show the same car).
type Need = { key: string; still: boolean; w: number; h: number; x: number; y: number; slots: Slot[] }
// Boxes whose width-to-height differ by under about 2% share a drawing.
export const shapeOf = (w: number, h: number) => Math.round(Math.log(w / h) * 50)
export function pickThumbs(all: Iterable<Slot>, mounted: (key: string) => boolean, budget = STILL_PER_FRAME) {
  const need = new Map<string, Need>()
  let waiting = false
  for (const s of all) {
    if (!s.seen || !s.ctx || s.canvas.width < 2 || (s.still && !s.fresh)) continue
    const id = `${s.key}|${s.still ? 'still' : ''}|${shapeOf(s.canvas.width, s.canvas.height)}`
    const n = need.get(id)
    if (n) {
      // Grow to the bigger box, keeping this drawing's shape.
      const k = Math.max(s.canvas.width / n.w, s.canvas.height / n.h, 1)
      n.w = Math.round(n.w * k)
      n.h = Math.round(n.h * k)
      n.slots.push(s)
    } else if (!mounted(s.key)) waiting = true // its model isn't mounted yet: try again next frame
    else if (s.still && budget <= 0) waiting = true
    else {
      if (s.still) budget--
      need.set(id, { key: s.key, still: s.still, w: s.canvas.width, h: s.canvas.height, x: 0, y: 0, slots: [s] })
    }
  }
  return { need, waiting }
}
