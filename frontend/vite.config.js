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
    outDir: mode === 'production' ? '../backend/public' : 'dist',
    emptyOutDir: true,
    // Chunk splitting — keeps the initial bundle lean while allowing
    // vendor code to cache independently across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('axios') || id.includes('react-hot-toast')) return 'vendor-utils';
          }
        },
      },
    },
  },
}))
