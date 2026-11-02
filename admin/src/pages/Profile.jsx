import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import { toast } from '../toast.js'
import {
  Button,
  Card,
  ErrorBox,
  FormField,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Admin's own account. Profile editing uses PATCH /api/admin/auth/profile:
// display name and password change (current password required) only — email,
// role and status are server-protected and not editable here. Every change is
// written to the audit trail; passwords are never displayed or logged.
export default function Profile({ admin, onLogout }) {
  const [me, setMe] = useState(admin)
  const [error, setError] = useState(null)

  // Name form.
  const [name, setName] = useState(admin?.name || '')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState(null)

  // Password form.
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState(null)

  // After a save the server row is authoritative — re-fetch /auth/me so the
  // page never shows a stale name/lastLogin.
  useEffect(() => {
    let cancelled = false
    api('/admin/auth/me')
      .then((result) => {
        if (!cancelled) {
          setMe(result.admin)
          setName(result.admin.name || '')
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

  if (!me) {
    return error ? <ErrorBox>{error}</ErrorBox> : <Spinner />
  }

  async function saveName(event) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters.')
      return
    }
    setNameBusy(true)
    setNameError(null)
    try {
      const result = await api('/admin/auth/profile', {
        method: 'PATCH',
        body: { name: name.trim() },
      })
      setMe(result.admin)
      toast('Profile name updated.', 'ok')
    } catch (err) {
      setNameError(err.message)
    } finally {
      setNameBusy(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setPwBusy(true)
    setPwError(null)
    try {
      await api('/admin/auth/profile', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      toast('Password changed.', 'ok')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwBusy(false)
    }
  }

  const rows = [
    ['Email', <span className="cell-mono">{me.email}</span>],
    ['Role', <span className="cell-mono">{me.role}</span>],
    ['Status', <StatusBadge status={me.status} />],
    ['Last login', formatDateTime(me.lastLoginAt)],
  ]

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your admin account"
        action={
          <Button variant="primary" onClick={onLogout}>
            Sign out
          </Button>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card title="Account details">
        <table className="table table--pairs">
          <tbody>
            <tr>
              <td className="settings__label">Name</td>
              <td>{me.name || '—'}</td>
            </tr>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="settings__label">{label}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          Email, role and status are managed server-side and cannot be edited here.
        </p>
      </Card>

      <Card title="Edit name" className="card--spaced">
        <form onSubmit={saveName}>
          <FormField label="Display name" htmlFor="admin-name">
            <input
              id="admin-name"
              className="input"
              type="text"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          {nameError && <p className="alert alert--error">{nameError}</p>}
          <Button type="submit" variant="primary" loading={nameBusy}>
            Save name
          </Button>
        </form>
      </Card>

      <Card title="Change password" className="card--spaced">
        <form onSubmit={savePassword}>
          <FormField label="Current password" htmlFor="admin-current-pw">
            <input
              id="admin-current-pw"
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </FormField>
          <FormField label="New password (min 8 characters)" htmlFor="admin-new-pw">
            <input
              id="admin-new-pw"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
          {pwError && <p className="alert alert--error">{pwError}</p>}
          <Button type="submit" variant="primary" loading={pwBusy}>
            Change password
          </Button>
        </form>
        <p className="muted">
          Changing the password requires your current one and is recorded in the audit trail.
        </p>
      </Card>

      <Card title="Security" className="card--spaced">
        <p className="muted">
          This session is a JWT stored in this browser only. Signing out clears it locally and
          records an <span className="cell-mono">admin.logout</span> entry in the audit trail.
          Expired or revoked sessions are rejected by the server on every request — admin
          rights are re-checked against the database each time, never trusted from the client.
        </p>
      </Card>
    </div>
  )
}
