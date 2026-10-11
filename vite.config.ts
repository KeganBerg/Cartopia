import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Link previews need absolute URLs. Netlify sets URL to the site's primary
// domain (cartopia.lol once it is primary), so shared links point at it.
const SITE_URL = (process.env.URL || 'https://cartopia.lol').replace(/\/$/, '')
const siteUrl = (): Plugin => ({ name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL) })

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl()],
})
