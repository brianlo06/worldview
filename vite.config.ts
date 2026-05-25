import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Allow cloudflared quick tunnels so the dev server can be reached
    // through a *.trycloudflare.com hostname for sharing demos.
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    // The Globe chunk (~600 KB) is Three.js + scene code, lazy-loaded behind
    // the boot screen. The main chunk that blocks first paint is ~230 KB.
    // Raise the warning threshold so the intended-large Globe chunk doesn't
    // produce a misleading "chunk too big" message on every build.
    chunkSizeWarningLimit: 700,
  },
})