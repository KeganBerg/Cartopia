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

// A thumbnail on the page. Only one thumbnail turns at a time (the focus: the biggest one on
// screen, nearest the middle, or the one under the mouse); the rest hold the last picture they
// were drawn at. Drawing every car or building on a menu 24 times a second made each spin choppy
// and the menu slow, while one turning model can draw at the screen's rate.
// `still`: never picked as the focus by position (Shop > Upgrades), only by the mouse.
// `scene`: an arcade card that animates itself; those keep drawing (at 24 a second).
// `angle`: how far round it has turned (0-1). `fresh`: it needs drawing (new, or resized).
export type Slot = { key: string; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; seen: boolean; still: boolean; scene: boolean; angle: number; fresh: boolean }

// Held pictures drawn per frame, so a page full of them fills in over a few frames
// instead of stalling one.
export const STILL_PER_FRAME = 4

type Box = { left: number; top: number; width: number; height: number }
// The thumbnail that turns: the biggest on screen (a menu's hero car), and among ones about
// that big, the nearest the middle of the screen.
export function chooseFocus<T>(cands: { slot: T; box: Box }[], vw: number, vh: number): T | null {
  const shown = cands.filter(({ box: b }) => b.width > 0 && b.left + b.width > 0 && b.top + b.height > 0 && b.left < vw && b.top < vh)
  if (!shown.length) return null
  const area = (b: Box) => b.width * b.height
  const big = Math.max(...shown.map((c) => area(c.box)))
  const off = (b: Box) => Math.hypot(b.left + b.width / 2 - vw / 2, b.top + b.height / 2 - vh / 2)
  return shown.filter((c) => area(c.box) >= big * 0.8).sort((a, b) => off(a.box) - off(b.box))[0].slot
}

// Which thumbnails to draw this frame: the turning one, the self-animating scenes when they're
// due, and the next few held ones that haven't been drawn. Held ones of the same model at the
// same angle (one car at two sizes) draw once.
type Need = { key: string; angle: number; spin: boolean; w: number; h: number; x: number; y: number; slots: Slot[] }
export function pickThumbs(all: Iterable<Slot>, mounted: (key: string) => boolean, { focus = null as Slot | null, scenes = true, budget = STILL_PER_FRAME } = {}) {
  const need = new Map<string, Need>()
  let waiting = false
  for (const s of all) {
    if (!s.seen || !s.ctx || s.canvas.width < 2) continue
    const spin = s === focus || s.scene
    if (s.scene ? !scenes && !s.fresh : !spin && !s.fresh) continue
    const id = s === focus ? `${s.key}|turn` : s.scene ? s.key : `${s.key}|${s.angle.toFixed(3)}`
    const n = need.get(id)
    if (n) {
      n.w = Math.max(n.w, s.canvas.width)
      n.h = Math.max(n.h, s.canvas.height)
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
