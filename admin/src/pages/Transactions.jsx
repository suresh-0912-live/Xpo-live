import { useEffect, useState } from 'react'
import { api, apiBlob } from '../api.js'
import { formatDateTime, formatMoney } from '../format.js'
import {
  Button,
  Dialog,
  EmptyState,
  ErrorBox,
  PageHeader,
  Pagination,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Cross-user transaction ledger (Part 3). Reads existing Transaction rows
// only — it never fabricates history and never mutates balances. CSV export
// is downloaded with the same admin JWT and the same server-side filters;
// the backend caps the export row count.

const TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdrawal', label: 'Withdrawals' },
]
const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
]

export default function Transactions() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [selected, setSelected] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Single source of truth for the active query — reused by the list and the
  // CSV export so both always cover exactly the same rows.
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  if (query.trim()) params.set('query', query.trim())
  if (type) params.set('type', type)
  if (status) params.set('status', status)
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  useEffect(() => {
    let cancelled = false
    api(`/admin/transactions?${params}`)
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
    // params is rebuilt each render from the same state — safe dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, type, status, from, to, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  async function openDetail(id) {
    setSelected(null)
    setDetailError(null)
    try {
      const result = await api(`/admin/transactions/${id}`)
      setSelected(result.transaction)
    } catch (err) {
      setDetailError(err.message)
    }
  }

  async function downloadCsv() {
    setExporting(true)
    setExportError(null)
    try {
      const exportParams = new URLSearchParams(params)
      exportParams.delete('page')
      exportParams.delete('pageSize')
      // apiBlob shares api()'s base URL, bearer token and 401 handling.
      const blob = await apiBlob(`/admin/transactions/export.csv?${exportParams}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `xpo-transactions-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Cross-user ledger of deposits and withdrawals (read-only; balances are never edited here)"
        action={
          <div className="toolbar">
            <input
              className="input input--search"
              type="search"
              placeholder="Search user or reference…"
              aria-label="Search transactions"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
            <select
              className="input input--select"
              aria-label="Filter by type"
              value={type}
              onChange={(event) => {
                setType(event.target.value)
                setPage(1)
              }}
            >
              {TYPE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <select
              className="input input--select"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="date"
              aria-label="From date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
            />
            <input
              className="input"
              type="date"
              aria-label="To date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
            />
            <Button loading={exporting} onClick={downloadCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      {exportError && <ErrorBox>CSV export failed: {exportError}</ErrorBox>}
      {error && (
        <div>
          <ErrorBox>{error}</ErrorBox>
          <Button variant="primary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {!data && !error && <Spinner />}

      {data && data.transactions.length === 0 && (
        <EmptyState>No transactions match this filter.</EmptyState>
      )}

      {data && data.transactions.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((row) => (
                <tr key={row.id}>
                  <td className="cell-mono">{row.id}</td>
                  <td>{row.user?.email || row.userId}</td>
                  <td>{row.type}</td>
                  <td>{formatMoney(row.amount)}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="cell-mono">{row.reference || '—'}</td>
                  <td>{formatDateTime(row.createdAt)}</td>
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

      {/* Detail view */}
      <Dialog
        open={selected !== null || detailError !== null}
        title="Transaction"
        onClose={() => {
          setSelected(null)
          setDetailError(null)
        }}
        footer={
          <Button
            onClick={() => {
              setSelected(null)
            }}
          >
            Close
          </Button>
        }
      >
        {detailError && <p className="alert alert--error">{detailError}</p>}
        {selected && (
          <table className="table table--pairs">
            <tbody>
              <tr>
                <td className="settings__label">Transaction ID</td>
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
                <td className="settings__label">Type</td>
                <td>{selected.type}</td>
              </tr>
              <tr>
                <td className="settings__label">Amount</td>
                <td>{formatMoney(selected.amount)}</td>
              </tr>
              <tr>
                <td className="settings__label">Method</td>
                <td>{selected.method ? selected.method.replace(/_/g, ' ') : '—'}</td>
              </tr>
              <tr>
                <td className="settings__label">Status</td>
                <td>
                  <StatusBadge status={selected.status} />
                </td>
              </tr>
              <tr>
                <td className="settings__label">Created</td>
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
              {selected.details && (
                <tr>
                  <td className="settings__label">Details (masked)</td>
                  <td className="cell-mono cell-wrap">
                    {JSON.stringify(selected.details, null, 2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Dialog>
    </div>
  )
}
