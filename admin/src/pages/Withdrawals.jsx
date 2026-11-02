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

// Withdrawal review (Part 3). XPO reserves (debits) the wallet when the user
// REQUESTS a withdrawal. Approval therefore moves the request to
// `processing` for the MANUAL bank transfer — XPO has no payout provider, so
// approval never claims money was sent. Rejection refunds the reserved
// amount exactly once (atomic server-side guard). Only masked account
// numbers are ever stored, so the detail view can never expose a full one.

const FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Approved (processing)' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

export default function Withdrawals() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [selected, setSelected] = useState(null)
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

    api(`/admin/withdrawals?${params}`)
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
      const result = await api(`/admin/withdrawals/${id}`)
      setSelected(result.withdrawal)
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
      const result = await api(`/admin/withdrawals/${selected.id}/${confirm}`, {
        method: 'POST',
        body: confirm === 'reject' ? { reason: reason.trim() } : {},
      })
      setConfirm(null)
      toast(result.message, 'ok')
      reload()
      openDetail(selected.id)
    } catch (err) {
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
        title="Withdrawals"
        subtitle="Reserved funds are refunded exactly once on rejection; approval = manual bank transfer"
        action={
          <div className="toolbar">
            <input
              className="input input--search"
              type="search"
              placeholder="Search user or reference…"
              aria-label="Search withdrawals"
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

      {data && data.withdrawals.length === 0 && (
        <EmptyState>No withdrawal requests match this filter.</EmptyState>
      )}

      {data && data.withdrawals.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>User</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Reviewed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.withdrawals.map((row) => (
                <tr key={row.id}>
                  <td className="cell-mono">{row.reference || row.id}</td>
                  <td>{row.user?.email || row.userId}</td>
                  <td>{formatMoney(row.amount)}</td>
                  <td className="cell-mono">{row.details?.accountNumberMasked || '—'}</td>
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
        title="Withdrawal request"
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
              {(selected.status === 'pending' || selected.status === 'processing') && (
                <>
                  <Button variant="danger" disabled={busy} onClick={() => openConfirm('reject')}>
                    Reject…
                  </Button>
                  {selected.status === 'pending' && (
                    <Button variant="primary" disabled={busy} onClick={() => openConfirm('approve')}>
                      Approve…
                    </Button>
                  )}
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
                <td className="settings__label">Account holder</td>
                <td>{selected.details?.accountHolder || '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Bank</td>
                <td>{selected.details?.bankName || '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Account number</td>
                <td className="cell-mono">{selected.details?.accountNumberMasked || '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Routing code</td>
                <td className="cell-mono">{selected.details?.routingCodeMasked || '—'}</td>
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
            Only masked account numbers are stored — XPO never receives the full number. The
            funds were reserved (debited) when this request was created.
          </p>
        )}
      </Dialog>

      {/* Approve confirmation */}
      <Dialog
        open={confirm === 'approve'}
        title="Approve withdrawal?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={submitAction}>
              Approve for manual transfer
            </Button>
          </>
        }
      >
        <p>
          This approves{' '}
          <strong>{selected ? formatMoney(selected.amount) : ''}</strong> for a MANUAL bank
          transfer and marks the request <strong>processing</strong>. XPO has no payout
          provider — no external transfer is executed by this action. The reserved funds stay
          debited; rejecting later refunds them exactly once.
        </p>
        {actionError && <p className="alert alert--error">{actionError}</p>}
      </Dialog>

      {/* Reject confirmation — reason required, refunds reserved funds */}
      <Dialog
        open={confirm === 'reject'}
        title="Reject withdrawal?"
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button onClick={() => setConfirm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={submitAction}>
              Reject and refund
            </Button>
          </>
        }
      >
        <p>
          The request will be marked <strong>rejected</strong> and the reserved{' '}
          <strong>{selected ? formatMoney(selected.amount) : ''}</strong> is refunded to the
          user&apos;s wallet exactly once. The reason is stored on the request and in the audit
          trail.
        </p>
        <FormField label="Rejection reason (required)">
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. bank details could not be confirmed"
          />
        </FormField>
        {actionError && <p className="alert alert--error">{actionError}</p>}
      </Dialog>
    </div>
  )
}
