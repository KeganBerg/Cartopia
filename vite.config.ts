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
  // Rave Mode plays onte's "halcyon" (NCS) only once its in-game licence lands:
  // flip this to true. While false the song isn't built into the game (src/game/raveSong.ts).
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __RAVE_HALCYON__: 'false' },
  build: {
    rolldownOptions: {
      output: {
        // Keeps rolldown's helper runtime in its own file. Without it, 705d811 folded the
        // runtime into the game's sound chunk, which imports r3f, which imports react, which
        // needs the runtime: react ran first and the game never started (stuck splash).
        // scripts/check-dist.mjs fails the build on any such loop.
        strictExecutionOrder: true,
        // Libraries change far less often than the game, so they get their own
        // files: after a deploy, returning players only download the game code.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'r3f', test: /node_modules[\\/](@react-three|postprocessing|three-stdlib|zustand|its-fine|suspend-react)[\\/]/ },
          ],
        },
      },
    },
  },
})
