// jsdom has no 2D canvas; sign and texture painters only need it not to throw.
// Import this first in a test that draws scene models.
const noop = () => undefined
const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get(t, k) {
    if (k in t) return t[k]
    if (k === 'measureText') return () => ({ width: 10 })
    if (k === 'getImageData' || k === 'createImageData') return (_x: number, _y: number, w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
    if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop })
    if (k === 'canvas') return document.createElement('canvas')
    return noop
  },
  set(t, k, v) {
    t[k] = v
    return true
  },
})
HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
