import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { env } from 'node:process'

const apiAddress = env.QWQ_API_ADDR || '127.0.0.1:18743'
const webPort = Number(env.QWQ_WEB_PORT || 15173)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://${apiAddress}`,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
})
