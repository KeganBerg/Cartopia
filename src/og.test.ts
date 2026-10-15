import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Link previews (iMessage, Discord, WhatsApp, X...). index.html is rewritten by
// scripts/splash/build.mjs and by merges, so check the share card survives.
describe('link preview', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const meta = (attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]

  it('has Open Graph and Twitter card tags', () => {
    for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height']) expect(meta('property', k), k).toBeTruthy()
    for (const k of ['twitter:title', 'twitter:description', 'twitter:image']) expect(meta('name', k), k).toBeTruthy()
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('points at an absolute share image that exists at the stated size', () => {
    const img = meta('property', 'og:image')!
    expect(img).toMatch(/^%SITE_URL%\/og\/[\w.-]+\.jpg$/)
    expect(meta('name', 'twitter:image')).toBe(img)
    const file = new URL(`../public/og/${img.split('/').pop()}`, import.meta.url)
    expect(existsSync(file)).toBe(true)
    // WhatsApp drops previews over about 300 KB.
    expect(statSync(file).size).toBeLessThan(300_000)
    // Read the JPEG's frame header for its real size.
    const b = readFileSync(file)
    let i = 2
    while (i < b.length && !(b[i] === 0xff && b[i + 1] >= 0xc0 && b[i + 1] <= 0xc2)) i += 2 + b.readUInt16BE(i + 2)
    expect([b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]).toEqual([+meta('property', 'og:image:width')!, +meta('property', 'og:image:height')!])
  })

  it('fills in the site URL at build time', () => {
    expect(readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')).toContain("replaceAll('%SITE_URL%'")
  })

  it('names the tab "Cartopia" and every icon it links exists', () => {
    expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe('Cartopia')
    const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    expect(hrefs).toContain('/favicon.ico')
    expect(hrefs).toContain('/icons/apple-touch-icon.png')
    for (const h of hrefs) expect(existsSync(new URL(`../public${h}`, import.meta.url)), h).toBe(true)
    const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as { icons: { src: string }[] }
    for (const i of manifest.icons) expect(existsSync(new URL(`../public${i.src}`, import.meta.url)), i.src).toBe(true)
  })
})
