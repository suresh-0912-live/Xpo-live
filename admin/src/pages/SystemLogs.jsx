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

function levelTone(level) {
  if (level === 'error') return 'badge--off'
  if (level === 'warn') return 'badge--warn'
  return 'badge--neutral'
}

export default function SystemLogs() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: '25' })
    if (level) params.set('level', level)

    api(`/admin/system-logs?${params}`)
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
  }, [page, level])

  return (
    <div>
      <PageHeader
        title="System Logs"
        subtitle="Scheduler, provider and API events"
        action={
          <select
            className="input input--select"
            value={level}
            onChange={(event) => {
              setLevel(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Spinner />}
      {data && data.logs.length === 0 && <EmptyState>No logs found.</EmptyState>}

      {data && data.logs.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Source</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>
                    <span className={`badge ${levelTone(log.level)}`}>{log.level}</span>
                  </td>
                  <td>{log.source}</td>
                  <td className="cell-wrap">{log.message}</td>
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
