import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/parsy/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
      },
    },
  },
})
