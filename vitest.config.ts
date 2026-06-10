// Standalone vitest config — deliberately not vite.config.ts, so the dev/build
// plugins (react, tailwind, cloudflare) stay out of the test pipeline. Tests
// default to the node environment; DOM-dependent files opt into jsdom with a
// `// @vitest-environment jsdom` docblock.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
