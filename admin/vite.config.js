import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev + preview proxy so the panel talks to the backend same-origin.
const proxy = {
  '/api': {
    target: process.env.VITE_API_PROXY || 'http://localhost:4000',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, proxy },
  preview: { port: 5300, proxy },
})
