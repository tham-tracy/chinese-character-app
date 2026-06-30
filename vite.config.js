import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fully client-side SPA. `base` is relative so the build works on GitHub Pages
// project sites (served from /<repo>/) as well as at a domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.{js,mjs}'],
  },
})
