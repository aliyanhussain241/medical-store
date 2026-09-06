import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode}) => ({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Production build outputs to backend/public/ so Express can serve it directly.
    // Run `npm run build` in frontend/ — the result is picked up by the backend automatically.
    outDir: mode === 'production' ? '../backend/public' : 'dist',
    emptyOutDir: true,
  }
}))
