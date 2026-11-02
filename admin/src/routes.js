// URL routing for the admin panel — same lightweight, router-library-free
// architecture as the XPO frontend (pathname <-> view mapping with
// history.pushState, see src/App.jsx in the main app). Every panel route
// lives under /admin/* and is guarded in App.jsx: without a server-verified
// admin session the app always lands on /admin/login.

export const LOGIN_PATH = '/admin/login'
export const DEFAULT_PATH = '/admin'

// todo: true marks a page that is intentionally NOT implemented yet — it
// renders a clearly-labelled placeholder, never fake data or dead buttons.
export const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { path: '/admin', view: 'dashboard', label: 'Dashboard' },
      { path: '/admin/users', view: 'users', label: 'Users' },
      { path: '/admin/deposits', view: 'deposits', label: 'Deposits' },
      { path: '/admin/withdrawals', view: 'withdrawals', label: 'Withdrawals' },
      { path: '/admin/transactions', view: 'transactions', label: 'Transactions' },
      { path: '/admin/notifications', view: 'notifications', label: 'Notifications' },
      { path: '/admin/profile', view: 'profile', label: 'Profile' },
      { path: '/admin/password-resets', view: 'password-resets', label: 'Password Resets' },
    ],
  },
]

const ROUTE_ITEMS = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  { path: '/admin/markets', view: 'markets', label: 'Markets' },
  { path: '/admin/api-usage', view: 'api-usage', label: 'API Usage' },
  { path: '/admin/system-logs', view: 'system-logs', label: 'System Logs' },
  { path: '/admin/audit-logs', view: 'audit-logs', label: 'Audit Logs' },
  { path: '/admin/settings', view: 'settings', label: 'Settings' },
]

const VIEW_LABELS = { login: 'Sign in', notfound: 'Page not found' }
const PATH_TO_VIEW = { [LOGIN_PATH]: 'login' }

for (const item of ROUTE_ITEMS) {
  PATH_TO_VIEW[item.path] = item.view
  VIEW_LABELS[item.view] = item.label
}

// Trailing slashes are noise: '/admin/users/' means '/admin/users'.
export function normalizePath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '')
  return path === '' ? '/' : path
}

export function viewFromPath(pathname) {
  const path = normalizePath(pathname)
  if (path === '/' || path === DEFAULT_PATH) return 'dashboard'
  // Detail route: /admin/users/<id> (cuid or any non-slash segment).
  if (/^\/admin\/users\/[^/]+$/.test(path)) return 'user-detail'
  return PATH_TO_VIEW[path] ?? 'notfound'
}

export function labelForView(view) {
  if (view === 'user-detail') return 'User detail'
  return VIEW_LABELS[view] ?? 'XPO Admin'
}

// Extract the :id from /admin/users/<id> (null when not on that route).
export function userIdFromPath(pathname) {
  const match = normalizePath(pathname).match(/^\/admin\/users\/([^/]+)$/)
  return match ? match[1] : null
}

// Reverse lookup for keeping the address bar in sync with the guarded view.
// 'notfound' and 'user-detail' return null — the URL already IS the target.
export function pathForView(view) {
  if (view === 'notfound' || view === 'user-detail') return null
  if (view === 'login') return LOGIN_PATH
  const route = ROUTE_ITEMS.find((item) => item.view === view)
  if (route) return route.path
  return DEFAULT_PATH
}
