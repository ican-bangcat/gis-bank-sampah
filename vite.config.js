import { defineConfig } from 'vite'
import { resolve } from 'path'

// Perhatikan ada parameter ({ command }) disini
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    // LOGIKA PINTAR:
    // Kalau lagi build (buat GitHub), pakai nama repo.
    // Kalau lagi dev (di laptop), pakai root biasa ('/').
    base: isProduction ? '/gis-bank-sampah/' : '/',
    
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          map: resolve(__dirname, 'map.html'),
          data: resolve(__dirname, 'data.html'),
        },
      },
    },
  }
})