// Photo mode (the full-screen car view's 📸): a backdrop for the car, a filter for the shot,
// and the snap itself, saved or shared as a PNG with a small Cartopia mark in the corner.

// bg: the background colour (null: the usual light gradient behind the canvas). beams: the
// headlights shine on the floor. key/fill: the main light's colour and strength, and the sky light's.
export type Backdrop = { id: string; name: string; icon: string; bg: string | null; floor: string; key: [string, number]; fill: [string, string, number]; beams?: boolean }
export const BACKDROPS: Backdrop[] = [
  { id: 'studio', name: 'Studio', icon: '💡', bg: null, floor: '#cfd8dc', key: ['#ffffff', 1.4], fill: ['#ffffff', '#90a4ae', 1] },
  { id: 'sunset', name: 'Sunset', icon: '🌅', bg: '#f08a5d', floor: '#b8664a', key: ['#ffb070', 1.6], fill: ['#ffd1a8', '#5a3a4a', 0.8] },
  { id: 'night', name: 'Night', icon: '🌙', bg: '#0b1430', floor: '#1c2740', key: ['#9fb7ff', 0.7], fill: ['#5d7bd6', '#0b1430', 0.45], beams: true },
  { id: 'neon', name: 'Neon', icon: '🟣', bg: '#1a0630', floor: '#2b0b4a', key: ['#ff4fd8', 1.3], fill: ['#4fe3ff', '#1a0630', 0.6], beams: true },
  { id: 'snow', name: 'Snow', icon: '❄️', bg: '#e6f0f7', floor: '#ffffff', key: ['#f2f7ff', 1.5], fill: ['#ffffff', '#b8cbe0', 1.1] },
]

// A CSS filter for the live view and the saved picture.
export type PhotoFilter = { id: string; name: string; css: string }
export const FILTERS: PhotoFilter[] = [
  { id: 'none', name: 'None', css: 'none' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.45) contrast(1.08)' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.35) saturate(1.25) hue-rotate(-8deg)' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.15)' },
  { id: 'retro', name: 'Retro', css: 'sepia(0.6) contrast(0.92) brightness(1.06)' },
]

export const backdrop = (id: string) => BACKDROPS.find((b) => b.id === id) ?? BACKDROPS[0]
export const photoFilter = (id: string) => FILTERS.find((f) => f.id === id) ?? FILTERS[0]

// The finished picture: the frame with the filter on, over the backdrop colour (or the usual
// light gradient), and the mark in the corner.
export function compose(shot: HTMLCanvasElement, bd: Backdrop, filter: PhotoFilter) {
  const out = document.createElement('canvas')
  out.width = shot.width
  out.height = shot.height
  const ctx = out.getContext('2d')
  if (!ctx) return null
  if (bd.bg) ctx.fillStyle = bd.bg
  else {
    const g = ctx.createLinearGradient(0, 0, 0, out.height)
    g.addColorStop(0, '#dfe7ec')
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
  }
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.filter = filter.css
  ctx.drawImage(shot, 0, 0)
  ctx.filter = 'none'
  const px = Math.max(14, Math.round(out.width / 40))
  ctx.font = `900 ${px}px Nunito, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.strokeStyle = 'rgba(0,0,0,.35)'
  ctx.lineWidth = px / 6
  ctx.strokeText('📸 Cartopia', out.width - px, out.height - px * 0.8)
  ctx.fillText('📸 Cartopia', out.width - px, out.height - px * 0.8)
  return out
}

// Shares the picture through the phone's share sheet when it can take files, else downloads it.
export async function savePhoto(pic: HTMLCanvasElement, name: string) {
  const blob = await new Promise<Blob | null>((ok) => pic.toBlob(ok, 'image/png'))
  if (!blob) return false
  const file = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'car'}-cartopia.png`
  try {
    const f = new File([blob], file, { type: 'image/png' })
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f] })
      return true
    }
  } catch (e) {
    // Closed the share sheet: that's an answer. Otherwise sharing files isn't allowed here, so download.
    if (e instanceof DOMException && e.name === 'AbortError') return false
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
