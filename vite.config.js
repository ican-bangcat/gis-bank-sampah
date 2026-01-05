import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Nama repo GitHub kamu
  base: '/gis-bank-sampah/',
  
  build: {
    chunkSizeWarningLimit: 1600,
    // Konfigurasi Multi-Page App
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
        data: resolve(__dirname, 'data.html'),
      },
    },
  },
})