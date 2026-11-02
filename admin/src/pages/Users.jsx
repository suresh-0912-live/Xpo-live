import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import {
  Button,
  EmptyState,
  ErrorBox,
  PageHeader,
  Pagination,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Status changes (suspend/reactivate with a required reason) live on the
// user detail page — this list is read-only plus navigation.
export default function Users({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (query.trim()) params.set('query', query.trim())
    if (status) params.set('status', status)

    api(`/admin/users?${params}`)
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

  const retry = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Registered XPO users"
        action={
          <div className="toolbar">
            <input
              className="input input--search"
              type="search"
              placeholder="Search email or name…"
              aria-label="Search users"
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
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        }
      />

      {error && (
        <div>
          <ErrorBox>{error}</ErrorBox>
          <Button variant="primary" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      {!data && !error && <Spinner />}

      {data && data.users.length === 0 && <EmptyState>No users match this filter.</EmptyState>}

      {data && data.users.length > 0 && (
        <div className="card">
          {/* Mobile list rows — same fields as the old table: email, name,
              status, registered, last login, View action. Server-side
              search/filter/pagination are unchanged above. */}
          <ul className="rowlist" aria-label="Users">
            {data.users.map((user) => (
              <li key={user.id} className="rowlist__row">
                <div className="rowlist__main">
                  <span className="rowlist__title cell-mono">{user.email}</span>
                  <span className="rowlist__sub">{user.name || '—'}</span>
                  <span className="rowlist__sub">
                    Registered {formatDateTime(user.createdAt)} · Last login{' '}
                    {formatDateTime(user.lastLoginAt)}
                  </span>
                </div>
                <div className="rowlist__side">
                  <StatusBadge status={user.status} />
                  <Button size="sm" onClick={() => onNavigate?.(`/admin/users/${user.id}`)}>
                    View
                  </Button>
                </div>
              </li>
            ))}
          </ul>

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
