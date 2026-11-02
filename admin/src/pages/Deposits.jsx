import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime, formatMoney } from '../format.js'
import { toast } from '../toast.js'
import {
  Button,
  Dialog,
  EmptyState,
  ErrorBox,
  FormField,
  PageHeader,
  Pagination,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Deposit review (Part 3). Every row is a `pending` user request created by
// POST /api/deposits — the wallet is credited ONLY when an admin approves
// here, and the server guarantees that credit happens exactly once (atomic
// status guard). XPO has no payment provider: approval records the admin's
// manual verification of the bank transfer, it never claims an automated
// check. Rejection requires a reason and credits nothing.

// The backend status for an approved deposit is 'completed'.
const FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function Deposits() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  // Detail dialog + review actions.
  const [selected, setSelected] = useState(null) // deposit row (detail view)
  const [detailError, setDetailError] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'approve' | 'reject' | null
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query.trim()) params.set('query', query.trim())
    if (status) params.set('status', status)

    api(`/admin/deposits?${params}`)
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
  }, [page, query, status, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  async function openDetail(id) {
    setSelected(null)
    setDetailError(null)
    try {
      const result = await api(`/admin/deposits/${id}`)
      setSelected(result.deposit)
    } catch (err) {
      setDetailError(err.message)
    }
  }

  function openConfirm(kind) {
    setReason('')
    setActionError(null)
    setConfirm(kind)
  }

  async function submitAction() {
    if (confirm === 'reject' && reason.trim().length < 3) {
      setActionError('A rejection reason of at least 3 characters is required.')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      const result = await api(`/admin/deposits/${selected.id}/${confirm}`, {
        method: 'POST',
        body: confirm === 'reject' ? { reason: reason.trim() } : {},
      })
      setConfirm(null)
      toast(result.message, 'ok')
      reload()
      openDetail(selected.id)
    } catch (err) {
      // 409 = already processed by someone else; show it and refresh.
      setActionError(err.message)
      if (err.status === 409) {
        setConfirm(null)
        reload()
        openDetail(selected.id)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Deposits"
        subtitle="Approval credits the wallet exactly once (manual verification — no payment provider)"
        action={
          <div className="toolbar">
            <input
              className="input input--search"
              type="search"
              placeholder="Search user or reference…"
              aria-label="Search deposits"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
            <select
              className="input input--select"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              {FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error && (
        <div>
          <ErrorBox>{error}</ErrorBox>
          <Button variant="primary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {!data && !error && <Spinner />}

      {data && data.deposits.length === 0 && (
        <EmptyState>No deposit requests match this filter.</EmptyState>
      )}

      {data && data.deposits.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>User</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Reviewed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.deposits.map((row) => (
                <tr key={row.id}>
                  <td className="cell-mono">{row.reference || row.id}</td>
                  <td>{row.user?.email || row.userId}</td>
                  <td>{row.method ? row.method.replace(/_/g, ' ') : '—'}</td>
                  <td>{formatMoney(row.amount)}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td className="cell-small">
                    {row.reviewedAt ? (
                      <>
                        {formatDateTime(row.reviewedAt)}
                        <br />
                        <span className="muted">{row.reviewedBy}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="cell-actions">
                    <Button size="sm" onClick={() => openDetail(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </div>
      )}

      {/* Detail view + review actions */}
      <Dialog
        open={selected !== null || detailError !== null}
        title="Deposit request"
        onClose={() => {
          setSelected(null)
          setDetailError(null)
        }}
        footer={
          selected ? (
            <>
              <Button
                onClick={() => {
                  setSelected(null)
                }}
                disabled={busy}
              >
                Close
              </Button>
              {selected.status === 'pending' && (
                <>
                  <Button variant="danger" disabled={busy} onClick={() => openConfirm('reject')}>
                    Reject…
                  </Button>
                  <Button variant="primary" disabled={busy} onClick={() => openConfirm('approve')}>
                    Approve…
                  </Button>
                </>
              )}
            </>
          ) : null
        }
      >
        {detailError && <p className="alert alert--error">{detailError}</p>}
        {selected && (
          <table className="table table--pairs">
            <tbody>
              <tr>
                <td className="settings__label">Request ID</td>
                <td className="cell-mono">{selected.id}</td>
              </tr>
              <tr>
                <td className="settings__label">Reference</td>
                <td className="cell-mono">{selected.reference || '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">User</td>
                <td>{selected.user?.email || selected.userId}</td>
              </tr>
              <tr>
                <td className="settings__label">Method</td>
                <td>{selected.method ? selected.method.replace(/_/g, ' ') : '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Amount</td>
                <td>{formatMoney(selected.amount)}</td>
              </tr>
              <tr>
                <td className="settings__label">Status</td>
                <td>
                  <StatusBadge status={selected.status} />
                </td>
              </tr>
              <tr>
                <td className="settings__label">Requested</td>
                <td>{formatDateTime(selected.createdAt)}</td>
              </tr>
              <tr>
                <td className="settings__label">Last updated</td>
                <td>{formatDateTime(selected.updatedAt)}</td>
              </tr>
              <tr>
                <td className="settings__label">Reviewed by</td>
                <td>{selected.reviewedBy || '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Reviewed at</td>
                <td>{formatDateTime(selected.reviewedAt)}</td>
              </tr>
              {selected.rejectionReason && (
                <tr>
                  <td className="settings__label">Rejection reason</td>
                  <td>{selected.rejectionReason}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {selected && (
          <p className="muted">
            XPO has no payment provider — no automated verification or payment proof exists.
            Approval credits the wallet once and records your manual verification in the audit
            trail.
          </p>
        )}
      </Dialog>

      {/* Approve confirmation */}
      <Dialog
        open={confirm === 'approve'}
        title="Approve deposit?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={submitAction}>
              Approve and credit wallet
            </Button>
          </>
        }
      >
        <p>
          This marks the request <strong>approved</strong> and credits{' '}
          <strong>{selected ? formatMoney(selected.amount) : ''}</strong> to the user&apos;s wallet
          exactly once. Confirm you verified the bank transfer out of band — the action is
          recorded in the audit trail with your account.
        </p>
        {actionError && <p className="alert alert--error">{actionError}</p>}
      </Dialog>

      {/* Reject confirmation — reason required */}
      <Dialog
        open={confirm === 'reject'}
        title="Reject deposit?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitAction}>
              Reject request
            </Button>
          </>
        }
      >
        <p>
          The request will be marked <strong>rejected</strong>. No wallet credit is made. The
          reason is stored on the request and in the audit trail.
        </p>
        <FormField label="Rejection reason (required)">
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. no matching bank transfer found"
          />
        </FormField>
        {actionError && <p className="alert alert--error">{actionError}</p>}
      </Dialog>
    </div>
  )
}
