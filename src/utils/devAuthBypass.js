// DEVELOPMENT-ONLY authentication bypass -------------------------------------
// Everything here is gated behind the VITE_DEV_AUTH_BYPASS environment
// variable. The bypass is active ONLY when the variable is the exact string
// "true" at build/dev time; when it is missing or anything else, every export
// degrades to inert values and src/App.jsx follows the normal auth flow.
//
// The flag is loaded from `.env.development` (dev server only) — `vite build`
// never reads that file, so the bypass cannot leak into a production bundle.
// NEVER set VITE_DEV_AUTH_BYPASS=true for a production build.
//
// No authentication code is removed or altered by this module: Login/Signup
// screens, API auth services and backend token checks all stay in place.
// -----------------------------------------------------------------------------

export const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

// Local placeholder profile used when entering the app without a token.
export const DEV_BYPASS_USER = {
  id: 'dev-bypass',
  name: 'Dev User',
  email: 'dev@xpo.local',
}

// Auth screens reachable by URL under the bypass — available, never required.
const AUTH_PATHS = { '/login': 'login', '/signup': 'signup' }

// Returns 'login' | 'signup' when the current URL is an auth screen and the
// bypass is enabled; otherwise null (so normal behaviour is untouched).
export function authModeFromPath() {
  if (!DEV_AUTH_BYPASS) return null
  return AUTH_PATHS[window.location.pathname] ?? null
}
