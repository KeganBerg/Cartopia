import type { Color } from 'three'

let meta: HTMLMetaElement | null = null
let shown = ''
let town = ''
let held: string | null = null

function apply(hex: string): void {
  if (!hex || hex === shown) return
  shown = hex
  document.documentElement.style.backgroundColor = hex
  document.body.style.backgroundColor = hex
  meta ??= document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', hex)
}

// Mobile browsers colour their status bar and toolbar from the page background
// and theme-color, so keep both matched to what the town view is showing.
export function setPageTint(color: Color): void {
  town = `#${color.getHexString()}`
  if (held === null) apply(town)
}

// A full-screen view on top of the town (the race) takes over the tint until released.
export function holdPageTint(hex: string): () => void {
  held = hex
  apply(hex)
  return () => {
    if (held === hex) held = null
    apply(town)
  }
}
