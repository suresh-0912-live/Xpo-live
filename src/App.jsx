import { useCallback, useEffect, useState } from 'react'
import MobileHeader from './components/MobileHeader.jsx'
import GreetingSection from './components/GreetingSection.jsx'
import PortfolioHero from './components/PortfolioHero.jsx'
import SummaryCard from './components/SummaryCard.jsx'
import QuickActions from './components/QuickActions.jsx'
import MarketSection from './components/MarketSection.jsx'
import Finance from './pages/Finance.jsx'
import MyInvestments from './components/MyInvestments.jsx'
import RecentTransactions from './components/RecentTransactions.jsx'
import BottomNavigation from './components/BottomNavigation.jsx'
import Markets from './pages/Markets.jsx'
import CryptoInvestment from './pages/CryptoInvestment.jsx'
import ForexInvestment from './pages/ForexInvestment.jsx'
import More from './pages/More.jsx'
import Profile from './pages/Profile.jsx'
import Transactions from './pages/Transactions.jsx'
import Notifications from './pages/Notifications.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import {
  clearSession,
  displayName,
  fetchMe,
  getStoredUser,
  getToken,
  request,
} from './api/auth.js'
import {
  DEV_AUTH_BYPASS,
  DEV_BYPASS_USER,
  authModeFromPath,
} from './utils/devAuthBypass.js'
import ActionDialog from './components/ActionDialog.jsx'
import { fetchHoldings, fetchSummary, fetchTransactions } from './api/finance.js'
import {
  markets,
  navItemsFor,
  quickActions,
} from './data/dashboardData.js'
import './dashboard.css'

// Views addressable by URL (/markets, /crypto-investment and
// /forex-investment). Every other view keeps the original state-only
// navigation, so existing behaviour is untouched — no router added.
const VIEW_PATHS = {
  'markets': '/markets',
  'crypto-investment': '/crypto-investment',
  'forex-investment': '/forex-investment',
}
const PATH_VIEWS = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]),
)
function viewFromPath() {
  return PATH_VIEWS[window.location.pathname] ?? null
}

// ------------------------------------------------------- home view-model --
// Formatting helpers for authenticated account data. Anything the API has
// not produced yet renders as '—' — never a fabricated number, and never a
// ₹0.00 that could be mistaken for a real balance.

const EMPTY = '—'

function money(value) {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function signedMoney(value) {
  return `${value < 0 ? '-' : '+'}${money(Math.abs(value))}`
}

function pctStr(value) {
  return `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(2)}%`
}

const TX_META = {
  deposit: { title: 'Deposit', icon: 'download', tone: 'pos', sign: '+' },
  withdrawal: { title: 'Withdrawal', icon: 'upload', tone: 'neg', sign: '-' },
}
const METHOD_LABELS = { bank_transfer: 'Bank Transfer' }
const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  rejected: 'Rejected',
}

function formatTxDate(iso) {
  const date = new Date(iso)
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (dayDiff === 0) return `Today, ${time}`
    if (session.status !== 'signed-in' || !['home', 'transactions'].includes(view)) return undefined
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toTransactionRow(tx) {
  const meta = TX_META[tx.type] ?? { title: tx.type, icon: 'bars', tone: 'blue', sign: '+' }
  const method = METHOD_LABELS[tx.method] ?? tx.method ?? 'Account'
  const status = STATUS_LABELS[tx.status] ?? tx.status ?? ''
  return {
    id: tx.id,
    title: meta.title,
    subtitle: `${method} · ${status}`,
    amount: `${meta.sign}${money(tx.amount)}`,
    date: formatTxDate(tx.createdAt),
    icon: meta.icon,
    tone: meta.tone,
  }
}

function toInvestmentRow(holding) {
  const change =
    holding.investedAmount > 0
      ? ((holding.currentValue - holding.investedAmount) / holding.investedAmount) * 100
      : null
  return {
    id: holding.id,
    name: holding.name,
    icon: holding.symbol.toLowerCase(),
    value: money(holding.currentValue),
    change: change === null ? EMPTY : pctStr(change),
    up: change !== null && change >= 0,
  }
}

function cardsFor(summary) {
  if (!summary) {
    return [
      { id: 'cash', icon: 'wallet', label: 'Cash Balance', value: EMPTY, tone: 'neutral' },
      { id: 'invested', icon: 'bars', label: 'Invested', value: EMPTY, tone: 'neutral' },
      { id: 'today', icon: 'trendUp', label: "Today's P/L", value: EMPTY, tone: 'neutral' },
      { id: 'total', icon: 'trendUp', label: 'Total P/L', value: EMPTY, tone: 'neutral' },
    ]
  }
  const todayNeg = summary.todayPnl < 0
  const totalNeg = summary.totalPnl < 0
  return [
    {
      id: 'cash',
      icon: 'wallet',
      label: 'Cash Balance',
      value: money(summary.cashBalance),
      tone: 'neutral',
    },
    {
      id: 'invested',
      icon: 'bars',
      label: 'Invested',
      value: money(summary.invested),
      tone: 'neutral',
    },
    {
      id: 'today',
      icon: todayNeg ? 'trendDown' : 'trendUp',
      label: "Today's P/L",
      value: signedMoney(summary.todayPnl),
      change: pctStr(summary.todayPnlPct),
      tone: todayNeg ? 'neg' : 'pos',
    },
    {
      id: 'total',
      icon: totalNeg ? 'trendDown' : 'trendUp',
      label: 'Total P/L',
      value: signedMoney(summary.totalPnl),
      change: pctStr(summary.totalPnlPct),
      tone: totalNeg ? 'neg' : 'pos',
    },
  ]
}

function portfolioFor(summary) {
  return {
    label: 'Total Portfolio Value',
    value: summary ? money(summary.portfolioValue) : EMPTY,
    change: summary
      ? `${pctStr(summary.todayPnlPct)} (${signedMoney(summary.todayPnl)})`
      : EMPTY,
    period: 'Today',
    timeFilters: ['1D', '1W', '1M', '3M', '1Y', 'ALL'],
    activeFilter: '1D',
  }
}

// Fresh dashboard state — used on login/logout so a previous session's data
// is never visible while the next one loads.
const EMPTY_DASH = {
  status: 'loading',
  summary: null,
  transactions: [],
  holdings: [],
  error: null,
}

// Loads the home account data from the API. A pure async fetch: resolves to
// the next `dash` state, never throws, and never calls setState itself, so
// effects can schedule it without tripping set-state-in-effect.
async function fetchDashboard() {
  // Dev bypass: no token exists, so the API is never called (a 401 here must
  // not start a logout) and the sections fall back to their placeholders.
  if (DEV_AUTH_BYPASS) {
    return { ...EMPTY_DASH, status: 'bypass' }
  }
  try {
    const [summary, recent, holdings] = await Promise.all([
      fetchSummary(),
      fetchTransactions({ limit: 10 }),
      fetchHoldings(),
    ])
    return {
      status: 'ready',
      summary,
      transactions: Array.isArray(recent.data) ? recent.data : [],
      holdings: Array.isArray(holdings.data) ? holdings.data : [],
      error: null,
    }
  } catch (error) {
    return {
      ...EMPTY_DASH,
      status: 'error',
      error: error?.message || 'Could not reach the backend.',
    }
  }
}

function App() {
  const [view, setView] = useState(() => viewFromPath() ?? 'home')
  // 'login' | 'signup' — seeded from /login or /signup under the dev bypass.
  const [mode, setMode] = useState(() => authModeFromPath() ?? 'login')
  // DEVELOPMENT-ONLY: true when the bypass is on AND the URL is /login or
  // /signup, so those screens stay reachable by URL without ever being
  // required. Always false when VITE_DEV_AUTH_BYPASS is not "true".
  const [authScreen, setAuthScreen] = useState(() =>
    Boolean(authModeFromPath()),
  )
  const [session, setSession] = useState(() => {
    // DEVELOPMENT-ONLY auth bypass (VITE_DEV_AUTH_BYPASS=true): skip token
    // validation and enter the app directly with a local dev profile. The
    // branch is compiled out when the flag is missing/false — the standard
    // flow below is untouched.
    if (DEV_AUTH_BYPASS) {
      return {
        status: 'signed-in',
        user: getStoredUser() ?? DEV_BYPASS_USER,
      }
    }
    const token = getToken()
    return {
      status: token ? 'validating' : 'signed-out',
      user: token ? getStoredUser() : null,
    }
  })

  // Home account data (summary / recent transactions / holdings) from the
  // authenticated backend. Under the dev auth bypass there is no token, so
  // the API is never called (no 401 → no logout) and the sections fall back
  // to their '—' / placeholder states.
  const [dash, setDash] = useState({
    status: 'loading', // 'loading' | 'ready' | 'error' | 'bypass'
    summary: null,
    transactions: [],
    holdings: [],
    error: null,
  })
  const [dialog, setDialog] = useState(null) // 'deposit' | 'withdraw' | 'invest'
  const [unreadCount, setUnreadCount] = useState(0)

  // Manual refresh path (retry button, and after a deposit/withdrawal) —
  // only ever called from event handlers, never from an effect.
  const loadDashboard = useCallback(async () => {
    setDash((prev) => ({ ...prev, status: 'loading', error: null }))
    setDash(await fetchDashboard())
  }, [])

  // Initial load. setState happens only in the async continuation (same
  // pattern as the fetchMe effect below), never synchronously in the effect.
  useEffect(() => {
    if (session.status !== 'signed-in' || !['home', 'transactions'].includes(view)) return undefined
    let cancelled = false
    const refresh = () => fetchDashboard().then((next) => {
      if (!cancelled) setDash(next)
    })
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
    }
  }, [session.status, view])

  useEffect(() => {
    if (session.status !== 'signed-in' || DEV_AUTH_BYPASS) {
      setUnreadCount(0)
      return undefined
    }
    let cancelled = false
    request('/notifications?page=1&pageSize=1')
      .then((result) => {
        if (!cancelled) setUnreadCount(result.unreadCount || 0)
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0)
      })
    return () => { cancelled = true }
  }, [session.status])

  // Validate any stored token on boot so a stale session drops back to login.
  useEffect(() => {
    if (session.status !== 'validating') return undefined
    let cancelled = false
    fetchMe()
      .then((user) => {
        if (!cancelled) setSession({ status: 'signed-in', user })
      })
      .catch((error) => {
        if (cancelled) return
        // Backend unreachable: keep the cached session (app data is local).
        if (error.status === 0 && getStoredUser()) {
          setSession({ status: 'signed-in', user: getStoredUser() })
        } else {
          clearSession()
          setSession({ status: 'signed-out', user: null })
        }
      })
    return () => {
      cancelled = true
    }
  }, [session.status])

  // Any authenticated request that returns 401 lands back on login.
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession()
      setSession({ status: 'signed-out', user: null })
      setView('home')
      setMode('login')
    }
    window.addEventListener('xpo-unauthorized', onUnauthorized)
    return () => window.removeEventListener('xpo-unauthorized', onUnauthorized)
  }, [])

  // Keep the address bar in sync for the routed pages (markets + investments).
  useEffect(() => {
    const path = VIEW_PATHS[view]
    const current = window.location.pathname
    if (path) {
      if (current !== path) window.history.pushState({ xpoView: view }, '', path)
    } else if (PATH_VIEWS[current]) {
      window.history.replaceState({ xpoView: view }, '', '/')
    }
  }, [view])

  // Browser back/forward across the routed pages; views without a URL
  // (home, transactions, ...) never touch history, so this can't disturb them.
  useEffect(() => {
    const onPopState = () => {
      // Under the dev bypass, back/forward across /login and /signup toggles
      // the auth screens; any other path clears them (a no-op when the flag
      // is off, since authModeFromPath() then always returns null).
      const authMode = authModeFromPath()
      if (authMode) {
        setMode(authMode)
        setAuthScreen(true)
        return
      }
      setAuthScreen(false)
      const routed = viewFromPath()
      if (routed) setView(routed)
      else setView((prev) => (VIEW_PATHS[prev] ? 'home' : prev))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function handleSwitchMode(next) {
    setMode(next)
    // Keep the address bar aligned when an auth screen was opened by URL
    // under the dev bypass (never true in the normal flow).
    if (authScreen) {
      window.history.replaceState(
        {},
        '',
        next === 'signup' ? '/signup' : '/login',
      )
    }
  }

  function handleAuthSuccess(user) {
    setSession({ status: 'signed-in', user })
    setAuthScreen(false)
    setView('home')
    setDash({ ...EMPTY_DASH })
    // Return to `/` after signing in from a /login or /signup URL (bypass only).
    if (authModeFromPath()) window.history.replaceState({}, '', '/')
  }

  function handleLogout() {
    clearSession()
    setSession({ status: 'signed-out', user: null })
    setView('home')
    setMode('login')
    setDash({ ...EMPTY_DASH })
  }

  if (session.status === 'validating') {
    return (
      <div className="auth auth--splash">
        <div className="auth__spinner" aria-hidden="true" />
        <p className="auth__splash">Loading your session…</p>
      </div>
    )
  }

  if (session.status === 'signed-out' || authScreen) {
    return mode === 'signup' ? (
      <Signup
        onSwitch={() => handleSwitchMode('login')}
        onSuccess={handleAuthSuccess}
      />
    ) : (
      <Login
        onSwitch={() => handleSwitchMode('signup')}
        onSuccess={handleAuthSuccess}
      />
    )
  }

  const homeUser = {
    greeting: 'Welcome back,',
    name: displayName(session.user),
    subtitle: 'Your account overview',
    currency: dash.summary?.currency || 'INR',
    live: false,
  }

  if (view === 'markets') return <Markets onNavigate={setView} />
  if (view === 'crypto-investment')
    return <CryptoInvestment onNavigate={setView} />
  if (view === 'forex-investment') return <ForexInvestment onNavigate={setView} />
  if (view === 'transactions')
    return (
      <Transactions
        onNavigate={setView}
        transactions={dash.transactions.map(toTransactionRow)}
        state={dash.status}
      />
    )
  if (view === 'finance') return <Finance onNavigate={setView} user={session.user} />
  if (view === 'notifications') {
    return <Notifications onNavigate={setView} onUnreadChange={setUnreadCount} />
  }
  if (view === 'more') return <More onNavigate={setView} user={session.user} />
  if (view === 'profile')
    return (
      <Profile
        onNavigate={setView}
        user={session.user}
        onLogout={handleLogout}
      />
    )

  return (
    <div className="shell">
      <MobileHeader
        showAvatar={false}
        hasNotification={unreadCount > 0}
        onNotifications={() => setView('notifications')}
      />

      <main className="screen">
        <GreetingSection user={homeUser} />

        {dash.status === 'error' && (
          <p className="dashnotice dashnotice--error" role="alert">
            <span>Account data unavailable: {dash.error}</span>
            <button type="button" className="dashnotice__btn" onClick={loadDashboard}>
              Retry
            </button>
          </p>
        )}
        {dash.status === 'bypass' && (
          <p className="dashnotice">
            Development bypass is active — account sections show placeholders instead of live
            data.
          </p>
        )}

        <PortfolioHero portfolio={portfolioFor(dash.summary)} />

        <section className="summary">
          {cardsFor(dash.summary).map((card) => (
            <SummaryCard key={card.id} {...card} />
          ))}
        </section>

        <QuickActions actions={quickActions} onSelect={setDialog} />

        <MarketSection markets={markets} onNavigate={setView} />

        <MyInvestments
          investments={dash.holdings.map(toInvestmentRow)}
          state={dash.status}
        />

        <RecentTransactions
          transactions={dash.transactions.slice(0, 4).map(toTransactionRow)}
          state={dash.status}
        />
      </main>

      <BottomNavigation items={navItemsFor('home')} onSelect={setView} />

      {dialog && (
        <ActionDialog
          type={dialog}
          user={session.user}
          onClose={() => setDialog(null)}
          onChanged={loadDashboard}
          onNavigate={(nextView) => {
            setDialog(null)
            setView(nextView)
          }}
        />
      )}
    </div>
  )
}

export default App
