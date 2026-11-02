import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Proxy API calls to the Express backend in dev and `vite preview`, so the
// app never depends on CORS. For a deployed backend set VITE_API_URL instead.
const apiProxy = {
  '/api': 'http://localhost:4000',
}

// The admin panel is a separate Vite app under /admin (its own dev server,
// port 5174 — see admin/vite.config.js). This app does not own /admin
// paths, so instead of silently rendering the user home screen for them,
// forward the request to the admin app's origin. Dev-server only; built
// deployments set VITE_ADMIN_URL at build time and src/main.jsx forwards
// there (or configure your web server to route /admin to the admin build).
const ADMIN_ORIGIN = process.env.VITE_ADMIN_URL || 'http://localhost:5174'

const adminForward = {
  name: 'xpo-admin-forward',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = (req.url || '').split('?')[0]
      if (req.method !== 'GET' || !/^\/admin(\/|$)/.test(path)) return next()

      // Never redirect to our own origin (e.g. this app started on 5174):
      // that would loop forever.
      const address = server.httpServer?.address()
      const currentPort = typeof address === 'object' && address ? address.port : null
      const target = new URL(`${ADMIN_ORIGIN.replace(/\/$/, '')}${req.url}`)
      if (currentPort && Number(target.port || 80) === currentPort) return next()

      res.statusCode = 302
      res.setHeader('Location', target.toString())
      res.end()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminForward],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
