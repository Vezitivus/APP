import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/APP/companion/',
  build: {
    outDir: '../companion',
    emptyOutDir: true,
  },
})
