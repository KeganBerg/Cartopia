import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { legalHtml, PRIVACY, TERMS } from './src/legal/legal.ts'

// Link previews need absolute URLs. Netlify sets URL to the site's primary
// domain (cartopia.lol once it is primary), so shared links point at it.
const SITE_URL = (process.env.URL || 'https://cartopia.lol').replace(/\/$/, '')
const siteUrl = (): Plugin => ({ name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL) })

// Each build gets an id, baked into the bundle and written to /version.json.
// Open games poll that file and reload when a newer build is live
// (src/lib/update.ts), so nobody plays on a stale tab for hours.
const BUILD_ID = process.env.COMMIT_REF?.slice(0, 12) || String(Date.now())
const version = (): Plugin => ({
  name: 'version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD_ID }) })
  },
})

// Public Terms of Service and Privacy Policy pages at /terms and /privacy, from
// the same text the game shows in its Menu (src/legal/legal.ts).
const legal = (): Plugin => ({
  name: 'legal',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'terms/index.html', source: legalHtml(TERMS, PRIVACY) })
    this.emitFile({ type: 'asset', fileName: 'privacy/index.html', source: legalHtml(PRIVACY, TERMS) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl(), version(), legal()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
