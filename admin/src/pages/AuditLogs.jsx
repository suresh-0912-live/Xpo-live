import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import {
  EmptyState,
  ErrorBox,
  PageHeader,
  Pagination,
  Spinner,
} from '../ui.jsx'

export default function AuditLogs() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: '25' })
    if (action.trim()) params.set('action', action.trim())
    if (actor.trim()) params.set('actor', actor.trim())

    api(`/admin/audit-logs?${params}`)
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
  }, [page, action, actor])

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Append-only record of admin actions — cannot be edited or deleted through the API"
        action={
          <div className="toolbar">
            <input
              className="input input--search"
              type="search"
              placeholder="Filter by action…"
              aria-label="Filter by action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value)
                setPage(1)
              }}
            />
            <input
              className="input input--search"
              type="search"
              placeholder="Filter by actor email…"
              aria-label="Filter by actor"
              value={actor}
              onChange={(event) => {
                setActor(event.target.value)
                setPage(1)
              }}
            />
          </div>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Spinner />}
      {data && data.logs.length === 0 && <EmptyState>No audit entries found.</EmptyState>}

      {data && data.logs.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td className="cell-mono">{log.action}</td>
                  <td>{log.actor}</td>
                  <td>{log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId.slice(-6)}` : ''}` : '—'}</td>
                  <td className="cell-mono">{log.ip || '—'}</td>
                  <td className="cell-mono cell-small cell-wrap">
                    {log.details ? JSON.stringify(log.details) : '—'}
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
    </div>
  )
}
