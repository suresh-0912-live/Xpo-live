import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Markets from './pages/Markets.jsx'
import ApiUsage from './pages/ApiUsage.jsx'
import SystemLogs from './pages/SystemLogs.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Settings from './pages/Settings.jsx'
import Profile from './pages/Profile.jsx'
import UserDetail from './pages/UserDetail.jsx'
import Deposits from './pages/Deposits.jsx'
import Withdrawals from './pages/Withdrawals.jsx'
import Transactions from './pages/Transactions.jsx'
import Notifications from './pages/Notifications.jsx'
import PasswordResets from './pages/PasswordResets.jsx'
import { api, clearToken, getToken, setToken } from './api.js'
import { toast } from './toast.js'
import { Button, Dialog } from './ui.jsx'
import {
  DEFAULT_PATH,
  LOGIN_PATH,
  NAV_SECTIONS,
  labelForView,
  normalizePath,
  pathForView,
  userIdFromPath,
  viewFromPath,
} from './routes.js'

const PAGES = {
  dashboard: Dashboard,
  users: Users,
  'user-detail': UserDetail,
  markets: Markets,
  'api-usage': ApiUsage,
  'system-logs': SystemLogs,
  'audit-logs': AuditLogs,
  settings: Settings,
  profile: Profile,
  deposits: Deposits,
  withdrawals: Withdrawals,
  transactions: Transactions,
  notifications: Notifications,
  'password-resets': PasswordResets,
}

// Redirect the address bar without adding a history entry.
function replacePath(path) {
  window.history.replaceState(null, '', path)
}

// Rendered for unknown /admin/* paths — honest 404, never a mismatched page.
function NotFoundPage({ onBack }) {
  return (
    <div>
      <h1 className="page-title">Page not found</h1>
      <p className="page-sub">
        No admin page is registered at <span className="cell-mono">{window.location.pathname}</span>.
      </p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        Back to dashboard
      </button>
    </div>
  )
}

function NavIcon({ view }) {
  const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  }
  const paths = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-3.3 2.5-5 6-5s5.5 1.7 6 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.2.6 3.5 2.2 4 5" /></>,
    deposits: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M4 17v3h16v-3" /></>,
    withdrawals: <><path d="M12 15V3m-5 5 5-5 5 5" /><path d="M4 17v3h16v-3" /></>,
    transactions: <><path d="M4 7h15l-3-3m4 13H5l3 3" /><path d="M5 7v4m14 2v4" /></>,
    notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.1 3.4-6 8-6s7.3 1.9 8 6" /></>,
    'password-resets': <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  }
  return <svg {...shared}>{paths[view]}</svg>
}

export default function App() {
  const [admin, setAdmin] = useState(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  // The URL is the single source of truth for the active view (no router
  // library — same architecture as the XPO frontend).
  const [view, setView] = useState(() => viewFromPath(window.location.pathname))
  const [sessionNotice, setSessionNotice] = useState(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navigate = useCallback((path, { replace = false } = {}) => {
    const next = normalizePath(path)
    if (replace) replacePath(next)
    else window.history.pushState(null, '', next)
    setView(viewFromPath(next))
  }, [])

  // Boot: validate any stored token against the server. Only a successful
  // GET /admin/auth/me produces an admin — localStorage is never trusted.
  // `checking` starts true only when a token exists (useState initializer).
  useEffect(() => {
    if (!getToken()) return undefined
    let cancelled = false
    api('/admin/auth/me')
      .then((data) => {
        if (!cancelled) setAdmin(data.admin)
      })
      .catch(() => {
        // 401 clears the token inside api(); anything else means we cannot
        // prove an admin session, so the guard below still shows login.
        if (!cancelled) setAdmin(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Browser back/forward buttons.
  useEffect(() => {
    const onPopState = () => setView(viewFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Expired/revoked session: api() emits this on any 401 response.
  useEffect(() => {
    const onUnauthorized = () => {
      setAdmin(null)
      setSessionNotice('Your session has expired or is no longer valid. Please sign in again.')
    }
    window.addEventListener('xpo-admin-unauthorized', onUnauthorized)
    return () => window.removeEventListener('xpo-admin-unauthorized', onUnauthorized)
  }, [])

  // Route guard, derived during render: the URL alone never decides what is
  // shown — only the server-verified session does. Unauthenticated visitors
  // are treated as being on the login route; authenticated ones are bounced
  // off it to the dashboard.
  let activeView = view
  if (!checking) {
    if (!admin && view !== 'login') activeView = 'login'
    else if (admin && view === 'login') activeView = 'dashboard'
  }

  // Keep the address bar in line with the guarded view (replace, not push,
  // so Back never lands on a route the guard would reject).
  useEffect(() => {
    const target = pathForView(activeView)
    if (target && normalizePath(window.location.pathname) !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [activeView])

  async function handleLogin(token, adminData) {
    setToken(token)
    setAdmin(adminData)
    setSessionNotice(null)
    navigate(DEFAULT_PATH, { replace: true })
    toast(`Welcome, ${adminData.name || adminData.email}`, 'ok')
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      // Best-effort: records admin.logout in the audit trail. If the token
      // is already dead the local sign-out below still runs.
      await api('/admin/auth/logout', { method: 'POST' })
    } catch {
      // ignore — logout must always succeed locally
    }
    clearToken()
    setAdmin(null)
    setConfirmLogout(false)
    setSessionNotice(null)
    navigate(LOGIN_PATH, { replace: true })
    toast('Signed out.', 'info')
    setLoggingOut(false)
  }

  if (checking) {
    return <div className="boot">Loading XPO Admin…</div>
  }

  // Guarded: without a server-verified admin session only login is reachable.
  if (!admin) {
    return <Login onLogin={handleLogin} notice={sessionNotice} />
  }

  const title = labelForView(activeView)

  const Page = PAGES[activeView] || Dashboard
  const showNotFound = activeView === 'notfound'
  // Keep "Users" highlighted while a user detail page is open.
  const navView = activeView === 'user-detail' ? 'users' : activeView

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark">X</span>
          <span className="sidebar__wordmark">XPO<small>ADMIN PANEL</small></span>
        </div>
        <nav className="sidebar__nav" aria-label="Primary">
          {NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
            <button
              key={item.view}
              type="button"
              className={`sidebar__item${navView === item.view ? ' sidebar__item--on' : ''}`}
              aria-current={navView === item.view ? 'page' : undefined}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <NavIcon view={item.view} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__account" title={admin.email}>
          <span className="sidebar__avatar">{(admin.email[0] || '?').toUpperCase()}</span>
          <span>{admin.name || admin.email}</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar__heading">
            <span className="topbar__eyebrow">XPO ADMIN</span>
            <span className="topbar__title">{title}</span>
          </div>
          <span className="topbar__spacer" />
          <button
            type="button"
            className="topbar__profile"
            aria-label={`Profile — signed in as ${admin.email}`}
            onClick={() => navigate('/admin/profile')}
          >
            {(admin.email[0] || '?').toUpperCase()}
          </button>
          <button type="button" className="topbar__logout" onClick={() => setConfirmLogout(true)}>
            Sign out
          </button>
        </header>

        <nav className="mobile-nav" aria-label="Primary">
          {NAV_SECTIONS.flatMap((section) => section.items).map((item) => (
            <button
              key={item.view}
              type="button"
              className={`mobile-nav__item${navView === item.view ? ' mobile-nav__item--on' : ''}`}
              aria-current={navView === item.view ? 'page' : undefined}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <NavIcon view={item.view} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <main className="content">
          {showNotFound ? (
            <NotFoundPage onBack={() => navigate(DEFAULT_PATH, { replace: true })} />
          ) : (
            <Page
              admin={admin}
              onLogout={() => setConfirmLogout(true)}
              onNavigate={navigate}
              userId={userIdFromPath(window.location.pathname)}
            />
          )}
        </main>
      </div>

      <Dialog
        open={confirmLogout}
        title="Sign out of XPO Admin?"
        onClose={() => setConfirmLogout(false)}
        footer={
          <>
            <Button onClick={() => setConfirmLogout(false)} disabled={loggingOut}>
              Cancel
            </Button>
            <Button variant="primary" loading={loggingOut} onClick={handleLogout}>
              Sign out
            </Button>
          </>
        }
      >
        <p>
          This clears the admin session from this browser and records an{' '}
          <span className="cell-mono">admin.logout</span> entry in the audit trail.
        </p>
      </Dialog>
    </div>
  )
}


