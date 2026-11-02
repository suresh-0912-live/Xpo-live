import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime, formatNumber } from '../format.js'
import {
  EmptyState,
  ErrorBox,
  PageHeader,
  Pagination,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

export default function ApiUsage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [provider, setProvider] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: '25' })
    if (provider) params.set('provider', provider)

    api(`/admin/api-usage?${params}`)
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
  }, [page, provider])

  const summary = data?.summary

  return (
    <div>
      <PageHeader
        title="API Usage"
        subtitle="Outbound provider requests (IBRLive / crypto)"
        action={
          <select
            className="input input--select"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All providers</option>
            <option value="ibrlive">IBRLive (forex)</option>
            <option value="crypto">Crypto</option>
          </select>
        }
      />

      {summary && (
        <section className="grid grid--stats">
          <div className="card stat">
            <span className="stat__label">Today's requests</span>
            <span className="stat__value">{formatNumber(summary.todayRequests)}</span>
          </div>
          <div className="card stat">
            <span className="stat__label">Monthly requests</span>
            <span
              className={`stat__value${summary.forex.warning ? ' stat__value--warn' : ''}`}
            >
              {formatNumber(summary.monthlyRequests)}
            </span>
            <span className="stat__hint">
              {summary.forex.warning ? '⚠ warning threshold reached' : 'within limits'}
            </span>
          </div>
          <div className="card stat">
            <span className="stat__label">Monthly limit</span>
            <span className="stat__value">{formatNumber(summary.monthlyLimit)}</span>
            <span className="stat__hint">
              {formatNumber(summary.forex.remaining)} remaining · threshold{' '}
              {formatNumber(summary.forex.warningThreshold)}
            </span>
          </div>
        </section>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Spinner />}
      {data && data.usage.length === 0 && <EmptyState>No usage recorded yet.</EmptyState>}

      {data && data.usage.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Provider</th>
                <th>Endpoint</th>
                <th>Result</th>
                <th>HTTP</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.provider}</td>
                  <td className="cell-mono cell-small">{row.endpoint}</td>
                  <td>
                    <StatusBadge status={row.success ? 'ok' : 'error'} />
                  </td>
                  <td>{row.httpStatus ?? '—'}</td>
                  <td>{row.responseTimeMs !== null ? `${row.responseTimeMs} ms` : '—'}</td>
                  <td className={row.error ? 'cell-error' : ''}>{row.error || '—'}</td>
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
    </div>
  )
}
