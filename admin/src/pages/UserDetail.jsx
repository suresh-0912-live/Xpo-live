import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime, formatMoney, formatNumber } from '../format.js'
import { toast } from '../toast.js'
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorBox,
  FormField,
  PageHeader,
  Pagination,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Loads one user's admin view: profile, wallet, per-status summaries, recent
// activity, full history (paginated), holdings, and the deletion policy hint.
export default function UserDetail({ userId, onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // History pagination + type filter.
  const [history, setHistory] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')

  // Dialogs: status change (reason required) and delete (reason required).
  const [statusDialog, setStatusDialog] = useState(null) // 'suspend' | 'reactivate' | null
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [reason, setReason] = useState('')
  const [dialogError, setDialogError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    api(`/admin/users/${userId}`)
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
  }, [userId])

  useEffect(() => load(), [load, reloadKey])

  // The history effect keys its result so a refetch shows the spinner
  // (history.key mismatch) without a synchronous setState in the effect.
  const historyKey = `${historyPage}|${typeFilter}|${reloadKey}`

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    const params = new URLSearchParams({ page: String(historyPage), pageSize: '10' })
    if (typeFilter) params.set('type', typeFilter)
    const key = `${historyPage}|${typeFilter}|${reloadKey}`
    api(`/admin/users/${userId}/transactions?${params}`)
      .then((result) => {
        if (!cancelled) setHistory({ key, ...result })
      })
      .catch((err) => {
        if (!cancelled) {
          setHistory({ key, error: err.message, transactions: [], total: 0, page: 1, pageSize: 10 })
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId, historyPage, typeFilter, reloadKey])

  const retry = () => {
    setHistoryPage(1)
    setReloadKey((key) => key + 1)
  }

  function openDialog(kind) {
    setReason('')
    setDialogError(null)
    setStatusDialog(kind)
  }

  async function submitStatusChange() {
    if (reason.trim().length < 3) {
      setDialogError('A reason of at least 3 characters is required.')
      return
    }
    const next = statusDialog === 'suspend' ? 'suspended' : 'active'
    setBusy(true)
    setDialogError(null)
    try {
      await api(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: { status: next, reason: reason.trim() },
      })
      setStatusDialog(null)
      toast(`User ${next === 'active' ? 'reactivated' : 'suspended'}.`, 'ok')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitDelete() {
    if (reason.trim().length < 3) {
      setDialogError('A reason of at least 3 characters is required.')
      return
    }
    setBusy(true)
    setDialogError(null)
    try {
      await api(`/admin/users/${userId}`, { method: 'DELETE', body: { reason: reason.trim() } })
      setDeleteDialog(false)
      toast('User permanently deleted.', 'ok')
      onNavigate?.('/admin/users')
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!userId) return <ErrorBox>No user selected.</ErrorBox>
  if (!data && !error) return <Spinner />
  if (error && !data) {
    return (
      <div>
        <PageHeader title="User detail" subtitle="Could not load this user" />
        <ErrorBox>{error}</ErrorBox>
        <Button variant="primary" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }

  const { user, wallet, summary, recentTransactions, deletion } = data
  const isSuspended = user.status === 'suspended'

  return (
    <div>
      <PageHeader
        title={user.name || user.email}
        subtitle="User detail"
        action={
          <div className="toolbar">
            <Button onClick={() => onNavigate?.('/admin/users')}>← Back to users</Button>
            {isSuspended ? (
              <Button variant="primary" onClick={() => openDialog('reactivate')}>
                Reactivate
              </Button>
            ) : (
              <Button onClick={() => openDialog('suspend')}>Suspend</Button>
            )}
          </div>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      {/* Profile */}
      <Card title="Profile">
        <table className="table table--pairs">
          <tbody>
            <tr>
              <td className="settings__label">Email</td>
              <td className="cell-mono">{user.email}</td>
            </tr>
            <tr>
              <td className="settings__label">Name</td>
              <td>{user.name || '—'}</td>
            </tr>
            <tr>
              <td className="settings__label">Status</td>
              <td>
                <StatusBadge status={user.status} />
              </td>
            </tr>
            <tr>
              <td className="settings__label">Registered</td>
              <td>{formatDateTime(user.createdAt)}</td>
            </tr>
            <tr>
              <td className="settings__label">Last login</td>
              <td>{formatDateTime(user.lastLoginAt)}</td>
            </tr>
          </tbody>
        </table>
      </Card>


      {/* Wallet + summaries */}
      <section className="grid grid--stats">
        <div className="card stat">
          <span className="stat__label">Wallet balance</span>
          <span className="stat__value">
            {wallet ? formatMoney(wallet.balance) : '—'}
          </span>
          <span className="stat__hint">
            {wallet
              ? `${wallet.currency} · available cash, updated ${formatDateTime(wallet.updatedAt)}`
              : 'No wallet yet'}
          </span>
        </div>
        <div className="card stat">
          <span className="stat__label">Deposits</span>
          <span className="stat__value">{formatNumber(summary.deposits.total)}</span>
          <span className="stat__hint">
            {formatNumber(summary.deposits.byStatus.pending)} pending ·{' '}
            {formatNumber(summary.deposits.byStatus.completed)} completed
          </span>
        </div>
        <div className="card stat">
          <span className="stat__label">Withdrawals</span>
          <span className="stat__value">{formatNumber(summary.withdrawals.total)}</span>
          <span className="stat__hint">
            {formatNumber(summary.withdrawals.byStatus.pending)} pending ·{' '}
            {formatNumber(summary.withdrawals.byStatus.completed)} completed
          </span>
        </div>
        <div className="card stat">
          <span className="stat__label">Holdings</span>
          <span className="stat__value">
            {summary.holdings.positions > 0 ? formatMoney(summary.holdings.currentValue) : '—'}
          </span>
          <span className="stat__hint">
            {summary.holdings.positions > 0
              ? `${formatNumber(summary.holdings.positions)} position(s) · invested ${formatMoney(summary.holdings.invested)}`
              : 'No holdings recorded'}
          </span>
        </div>
      </section>

      {/* Recent activity */}
      <Card title="Recent transactions">
        {recentTransactions.length === 0 ? (
          <EmptyState>No transactions yet.</EmptyState>
        ) : (
          <ul className="rowlist" aria-label="Recent transactions">
            {recentTransactions.map((tx) => (
              <li key={tx.id} className="rowlist__row">
                <div className="rowlist__main">
                  <span className="rowlist__title">{tx.type}</span>
                  <span className="rowlist__sub">
                    {formatDateTime(tx.createdAt)} · {tx.reference || '—'}
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


      {/* Full transaction history (paginated, server-filtered) */}
      <Card
        title="Transaction history"
        action={
          <select
            className="input input--select"
            aria-label="Filter transaction type"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value)
              setHistoryPage(1)
            }}
          >
            <option value="">All types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
          </select>
        }
      >
        {!history || history.key !== historyKey ? (
          <Spinner />
        ) : history.error ? (
          <ErrorBox>{history.error}</ErrorBox>
        ) : history.transactions.length === 0 ? (
          <EmptyState>
            {typeFilter ? `No ${typeFilter} records.` : 'No transactions yet.'}
          </EmptyState>
        ) : (
          <>
            {/* Same six fields as the old table: When, Type, Amount, Status,
                Method, Reference — as stacked touch rows instead. */}
            <ul className="rowlist" aria-label="Transaction history">
              {history.transactions.map((tx) => (
                <li key={tx.id} className="rowlist__row">
                  <div className="rowlist__main">
                    <span className="rowlist__title">
                      {tx.type} · {formatMoney(tx.amount)}
                    </span>
                    <span className="rowlist__sub">{formatDateTime(tx.createdAt)}</span>
                    <span className="rowlist__sub cell-mono">
                      {tx.method || '—'} · {tx.reference || '—'}
                    </span>
                  </div>
                  <div className="rowlist__side">
                    <StatusBadge status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={history.page}
              pageSize={history.pageSize}
              total={history.total}
              onPage={setHistoryPage}
            />
          </>
        )}
      </Card>

      {/* Danger zone — deletion policy from the server */}
      <Card title="Danger zone" className="card--danger">
        <p className="muted">
          Suspension preserves all financial history and is the recommended action. Permanent
          deletion is only permitted by the server when this account has zero financial footprint.
        </p>
        {!deletion.allowed && (
          <p className="alert alert--error">
            Deletion blocked: {deletion.blockers.join('; ')}.
          </p>
        )}
        <Button
          variant="danger"
          disabled={!deletion.allowed}
          onClick={() => {
            setReason('')
            setDialogError(null)
            setDeleteDialog(true)
          }}
        >
          Delete user permanently…
        </Button>
      </Card>

      {/* Status change dialog — reason is recorded in the audit trail */}
      <Dialog
        open={statusDialog !== null}
        title={statusDialog === 'suspend' ? 'Suspend user?' : 'Reactivate user?'}
        onClose={() => setStatusDialog(null)}
        footer={
          <>
            <Button onClick={() => setStatusDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={submitStatusChange}
            >
              {statusDialog === 'suspend' ? 'Suspend' : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p>
          {statusDialog === 'suspend'
            ? 'A suspended user cannot sign in. Financial history and balances are untouched.'
            : 'The user will be able to sign in again.'}
        </p>
        <FormField label="Reason (required — recorded in the audit trail)">
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. suspected fraud review"
          />
        </FormField>
        {dialogError && <p className="alert alert--error">{dialogError}</p>}
      </Dialog>

      {/* Delete dialog — only reachable when the server allows it */}
      <Dialog
        open={deleteDialog}
        title="Permanently delete user?"
        onClose={() => setDeleteDialog(false)}
        footer={
          <>
            <Button onClick={() => setDeleteDialog(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p>
          This removes the account itself. The server re-checks the deletion policy and refuses if
          any financial footprint appears. This cannot be undone.
        </p>
        <FormField label="Reason (required — recorded in the audit trail)">
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. account created in error, verified empty"
          />
        </FormField>
        {dialogError && <p className="alert alert--error">{dialogError}</p>}
      </Dialog>
    </div>
  )
}
