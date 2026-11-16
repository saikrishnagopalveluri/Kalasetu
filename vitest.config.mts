import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // translations.ts has grown to 750+ keys across 23 languages; importing
    // and transforming it in a cold worker can exceed Vitest's 5s default,
    // which made the branding suite flake without any real bug involved.
    testTimeout: 20000,
    // OpenJarvis/ and pagekaro/ are separate projects that happen to live in
    // this folder; their tests need their own dependencies and are not ours.
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
})
