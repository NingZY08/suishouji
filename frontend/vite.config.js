import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
        changeOrigin: true
      }
    },
    allowedHosts: ['1d0dd567.r3.cpolar.cn']
  }
})
