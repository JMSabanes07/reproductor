import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    emptyOutDir: false, // Don't delete the popup/background build
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/content.ts'),
      name: 'ContentScript',
      fileName: () => 'src/content.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
})
