// Shop, garage and player-card thumbnails: copying each one's picture out of the shared
// 3D atlas (see BuildingPreview.tsx).

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
