import { defineConfig } from 'vite'

export default defineConfig({
  // PENTING: Ganti nama repo ini sesuai dengan nama repository GitHub kamu
  // Kalau nama repo kamu 'gis-bank-sampah', biarkan seperti ini.
  base: '/gis-bank-sampah/', 
  
  build: {
    // Ini fitur lama kamu (tetap kita simpan)
    sourcemap: true,

    // Tambahan biar terminal tidak bawel soal ukuran file
    chunkSizeWarningLimit: 1600,
  },
})