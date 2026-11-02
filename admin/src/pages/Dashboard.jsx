import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime, formatMoney, formatNumber } from '../format.js'
import { Button, Card, EmptyState, ErrorBox, PageHeader, StatusBadge } from '../ui.jsx'

// Mobile dashboard — vertical compact sections. EVERY metric comes from
// GET /api/admin/dashboard (real server aggregates); recent admin activity
// comes from GET /api/admin/activity. Nothing here is mocked: missing data
// renders as '—' and failed sections show honest errors.

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`card stat${tone ? ` stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  )
}

// Loading skeleton — matches the shape of the loaded dashboard.
function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton skeleton--title" />
      <div className="kpi-grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton--kpi" />
        ))}
      </div>
      <div className="skeleton skeleton--block" />
      <div className="skeleton skeleton--block" />
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => {
    let cancelled = false
    api('/admin/dashboard')
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load, reloadKey])

  const retry = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  if (!data && !error) return <DashboardSkeleton />
  if (error && !data) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="XPO backend overview" />
        <ErrorBox>Dashboard data unavailable: {error}</ErrorBox>
        <Button variant="primary" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }

  const { users, finance } = data
  const pendingDeposits = finance.deposits.byStatus?.pending ?? 0
  const pendingWithdrawals = finance.withdrawals.byStatus?.pending ?? 0
  const wallets = finance.wallets ?? []

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview"
        action={
          <Button onClick={retry} aria-label="Refresh dashboard data">
            Refresh
          </Button>
        }
      />

      {error && (
        <p className="alert alert--error" role="alert">
          Refresh failed: {error} — showing last loaded data.
        </p>
      )}

      <section className="kpi-grid" aria-label="Key metrics">
        <StatCard
          label="Total users"
          value={formatNumber(users.total)}
        />
        <StatCard
          label="Active users"
          value={formatNumber(users.active)}
        />
        <StatCard
          label="Pending deposits"
          value={formatNumber(pendingDeposits)}
          hint="awaiting review"
          tone={pendingDeposits > 0 ? 'warn' : undefined}
        />
        <StatCard
          label="Pending withdrawals"
          value={formatNumber(pendingWithdrawals)}
          hint="awaiting review"
          tone={pendingWithdrawals > 0 ? 'warn' : undefined}
        />
        <StatCard
          label="Total wallet balance"
          value={wallets.length
            ? wallets.map((wallet) => `${wallet.currency} ${formatNumber(wallet.total)}`).join(' · ')
            : '—'}
        />
      </section>

      <Card
        title="Recent transactions"
        action={
          <Button size="sm" onClick={() => onNavigate?.('/admin/transactions')}>
            View all
          </Button>
        }
      >
        {data.recentTransactions.length === 0 ? (
          <EmptyState>No transactions recorded yet.</EmptyState>
        ) : (
          <ul className="rowlist" aria-label="Recent transactions">
            {data.recentTransactions.map((tx) => (
              <li key={tx.id} className="rowlist__row">
                <div className="rowlist__main">
                  <span className="rowlist__title">{tx.user?.email || '—'}</span>
                  <span className="rowlist__sub">
                    {formatDateTime(tx.createdAt)} · {tx.type} · {tx.reference || '—'}
                  </span>
                </div>
                <div className="rowlist__side">
                  <span className="rowlist__amount">{formatMoney(tx.amount)}</span>
                  <StatusBadge status={tx.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  )
}
