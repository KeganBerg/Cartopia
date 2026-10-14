// Hue (0-360), saturation and value (0-1) to and from #rrggbb, for the Custom Colour picker.
export type Hsv = [number, number, number]

const hex2 = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
export function hsvToHex([h, s, v]: Hsv) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return `#${hex2(f(5))}${hex2(f(3))}${hex2(f(1))}`
}
export function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, max ? d / max : 0, max]
}
