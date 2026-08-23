import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      // Resolve workspace package to TS source directly — no build step required
      '@brio/api-client': resolve(__dirname, '../packages/api-client/src/index.ts'),
      '@brio/content': resolve(__dirname, '../packages/content/src/index.ts'),
      '@': resolve(__dirname, '.'),
    },
  },
})
