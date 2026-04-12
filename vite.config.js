import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/TeamFlow/',  // Must match your GitHub repo name exactly
  server: {
    port: 5173,
    strictPort: true,
  },
})
