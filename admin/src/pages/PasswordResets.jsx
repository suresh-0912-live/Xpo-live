import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import { toast } from '../toast.js'
import { Button, Card, Dialog, EmptyState, ErrorBox, PageHeader, Pagination, Spinner, StatusBadge } from '../ui.jsx'

const PAGE_SIZE = 25

export default function PasswordResets({ onNavigate }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [decision, setDecision] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status) params.set('status', status)
    if (appliedQuery) params.set('query', appliedQuery)
    api(`/admin/password-resets?${params}`)
      .then((data) => {
        if (!cancelled) {
          setResult(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [page, status, appliedQuery, reloadKey])

  async function updateRequest(request, action) {
    setBusyId(request.id)
    try {
      const path = `/admin/password-resets/${request.id}`
      const result = await api(action === 'approve' ? `${path}/approve` : `${path}/reject`, {
        method: 'POST',
      })
      if (action === 'approve') {
        setTemporaryPassword({ password: result.temporaryPassword, expiresAt: result.expiresAt })
        toast('Temporary password generated. Share it securely now.', 'ok')
      } else {
        toast('Recovery request rejected.', 'ok')
      }
      setDecision(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  function applySearch(event) {
    event.preventDefault()
    setPage(1)
    setAppliedQuery(query.trim())
  }

  if (!result && !error) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Password Resets"
        subtitle="Review and manage account recovery requests"
        action={error ? <Button onClick={() => setReloadKey((key) => key + 1)}>Retry</Button> : null}
      />
      {error && <ErrorBox>{error}</ErrorBox>}
      <Card>
        <form className="toolbar reset-toolbar" onSubmit={applySearch}>
          <input
            className="input input--search"
            aria-label="Search users"
            placeholder="Search name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="input input--select"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="locked">Locked</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
          <Button type="submit" variant="primary">Search</Button>
        </form>
        {!result ? null : result.requests.length === 0 ? (
          <EmptyState>No password reset requests found.</EmptyState>
        ) : (
          <div className="reset-table-wrap">
            <table className="table reset-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <button
                        type="button"
                        className="reset-user"
                        onClick={() => onNavigate?.(`/admin/users/${request.user.id}`)}
                      >
                        {request.user.name || request.user.email}
                      </button>
                      {request.user.name && <div className="muted cell-small">{request.user.email}</div>}
                    </td>
                    <td><StatusBadge status={request.status} /></td>
                    <td>{formatDateTime(request.createdAt)}</td>
                    <td>{formatDateTime(request.expiresAt)}</td>
                    <td className="reset-actions">
                      {request.status === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" disabled={busyId === request.id} onClick={() => setDecision({ request, action: 'approve' })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" disabled={busyId === request.id} onClick={() => setDecision({ request, action: 'reject' })}>
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
        )}
      </Card>
      <Dialog
        open={Boolean(decision)}
        title={decision?.action === 'approve' ? 'Approve recovery request?' : 'Reject recovery request?'}
        onClose={() => setDecision(null)}
        footer={
          <>
            <Button onClick={() => setDecision(null)} disabled={Boolean(busyId)}>Cancel</Button>
            <Button variant={decision?.action === 'approve' ? 'primary' : 'danger'} loading={Boolean(busyId)} onClick={() => updateRequest(decision.request, decision.action)}>
              {decision?.action === 'approve' ? 'Approve and generate password' : 'Reject request'}
            </Button>
          </>
        }
      >
        {decision?.action === 'approve'
          ? `This creates a one-time temporary password for ${decision?.request.user.email}. It expires in 10 minutes and will be shown only once.`
          : `This rejects the pending recovery request for ${decision?.request.user.email}.`}
      </Dialog>
      <Dialog
        open={Boolean(temporaryPassword)}
        title="Temporary password — copy now"
        onClose={() => setTemporaryPassword(null)}
        footer={<Button variant="primary" onClick={() => setTemporaryPassword(null)}>I have shared it securely</Button>}
      >
        <p>This password is shown only in this dialog. It expires at {formatDateTime(temporaryPassword?.expiresAt)}.</p>
        <code className="cell-mono">{temporaryPassword?.password}</code>
      </Dialog>
    </div>
  )
}
