import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  define: {
    'import.meta.env.VITE_SERVER_URL': JSON.stringify(process.env.VITE_SERVER_URL || 'http://localhost:3000'),
  },
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
