import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// The admin panel is a separate app (see /admin) with its own origin. When
// this build knows where it runs (VITE_ADMIN_URL — set to
// http://localhost:5174 in .env.development), forward /admin* hits there so
// they never fall through to the user home screen. In dev the Vite server
// also 302-redirects them (vite.config.js) before this code can run.
const ADMIN_BASE = (import.meta.env.VITE_ADMIN_URL || '').replace(/\/$/, '')

// Only forward when the admin app really lives on another origin — a
// same-origin match would loop forever.
const adminTarget =
  ADMIN_BASE && /^\/admin(\/|$)/.test(window.location.pathname)
    ? new URL(ADMIN_BASE, window.location.origin)
    : null

if (adminTarget && adminTarget.origin !== window.location.origin) {
  window.location.replace(
    `${ADMIN_BASE}${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
