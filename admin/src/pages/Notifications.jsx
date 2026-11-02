import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import { toast } from '../toast.js'
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  FormField,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui.jsx'
import './Notifications.css'

const EMPTY_FORM = { title: '', body: '', type: 'general', target: 'all', recipientIds: '' }

function recipientIdsFromText(value) {
  return value.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deliveries, setDeliveries] = useState(null)
  const [deliveryTitle, setDeliveryTitle] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api('/admin/notifications?page=1&pageSize=50')
      .then((result) => {
        if (!cancelled) {
          setNotifications(result.notifications || [])
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function startEditing(notification) {
    setEditingId(notification.id)
    setForm({
      title: notification.title,
      body: notification.body,
      type: notification.type,
      target: notification.target,
      recipientIds: notification.recipientIds || '',
    })
  }

  function clearForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function saveDraft(event) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title,
      body: form.body,
      type: form.type,
      target: form.target,
      ...(form.target === 'all' ? {} : { recipientIds: recipientIdsFromText(form.recipientIds) }),
    }
    try {
      await api(editingId ? `/admin/notifications/${editingId}` : '/admin/notifications', {
        method: editingId ? 'PATCH' : 'POST',
        body: payload,
      })
      toast(editingId ? 'Draft updated' : 'Draft created', 'ok')
      clearForm()
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendDraft(notification) {
    try {
      await api(`/admin/notifications/${notification.id}/send`, { method: 'POST' })
      toast('Notification delivered in app', 'ok')
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function removeDraft(notification) {
    if (!window.confirm(`Delete draft “${notification.title}”?`)) return
    try {
      await api(`/admin/notifications/${notification.id}`, { method: 'DELETE' })
      toast('Draft deleted', 'ok')
      if (editingId === notification.id) clearForm()
      setReloadKey((key) => key + 1)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function showDeliveries(notification) {
    try {
      const [history, status] = await Promise.all([
        api(`/admin/notifications/${notification.id}/deliveries?pageSize=100`),
        api(`/admin/notifications/${notification.id}/delivery-status`),
      ])
      setDeliveryTitle(notification.title)
      setDeliveries({ rows: history.deliveries || [], statuses: status.statuses || {} })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Create in-app messages and review delivery history"
        action={<Button variant="primary" onClick={clearForm}>New draft</Button>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Card title={editingId ? 'Edit draft' : 'New draft'} className="notification-composer">
        <form onSubmit={saveDraft}>
          <div className="notification-form-grid">
            <FormField label="Title" htmlFor="notification-title">
              <input id="notification-title" className="input" name="title" value={form.title} onChange={updateField} maxLength={200} required />
            </FormField>
            <FormField label="Type" htmlFor="notification-type">
              <select id="notification-type" className="input input--select" name="type" value={form.type} onChange={updateField}>
                <option value="general">General</option>
                <option value="announcement">Announcement</option>
                <option value="deposit_status">Deposit status</option>
                <option value="withdrawal_status">Withdrawal status</option>
              </select>
            </FormField>
            <FormField label="Audience" htmlFor="notification-target">
              <select id="notification-target" className="input input--select" name="target" value={form.target} onChange={updateField}>
                <option value="all">All active users</option>
                <option value="selected">Selected users</option>
                <option value="individual">One user</option>
              </select>
            </FormField>
            {form.target !== 'all' && (
              <FormField label={form.target === 'individual' ? 'User ID' : 'User IDs'} hint="Enter user IDs separated by commas or spaces." htmlFor="notification-recipients">
                <input id="notification-recipients" className="input" name="recipientIds" value={form.recipientIds} onChange={updateField} required />
              </FormField>
            )}
          </div>
          <FormField label="Message" htmlFor="notification-body">
            <textarea id="notification-body" className="input" name="body" value={form.body} onChange={updateField} rows={4} maxLength={10000} required />
          </FormField>
          <div className="notification-form-actions">
            {editingId && <Button onClick={clearForm}>Cancel edit</Button>}
            <Button type="submit" variant="primary" loading={saving}>{editingId ? 'Save changes' : 'Save draft'}</Button>
          </div>
        </form>
      </Card>

      <Card title="History">
        {loading ? <Spinner /> : notifications.length === 0 ? <EmptyState>No notifications yet.</EmptyState> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Message</th><th>Audience</th><th>Status</th><th>Recipients</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {notifications.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong><div className="muted notification-preview">{item.body}</div></td>
                    <td>{item.target}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{item._count?.deliveries ?? 0}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <div className="notification-actions">
                        {item.status === 'draft' && <>
                          <Button size="sm" onClick={() => startEditing(item)}>Edit</Button>
                          <Button size="sm" variant="primary" onClick={() => sendDraft(item)}>Send</Button>
                          <Button size="sm" variant="danger" onClick={() => removeDraft(item)}>Delete</Button>
                        </>}
                        {item.status !== 'draft' && <Button size="sm" onClick={() => showDeliveries(item)}>Deliveries</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deliveries && (
        <Card title={`Delivery history: ${deliveryTitle}`} action={<Button size="sm" onClick={() => setDeliveries(null)}>Close</Button>}>
          <p className="muted">{Object.entries(deliveries.statuses).map(([status, count]) => `${status}: ${count}`).join(' · ') || 'No deliveries'}</p>
          {deliveries.rows.length === 0 ? <EmptyState>No delivery rows.</EmptyState> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>User</th><th>Status</th><th>Delivered</th></tr></thead>
                <tbody>{deliveries.rows.map((row) => (
                  <tr key={row.id}><td>{row.user?.name || row.user?.email || row.userId}</td><td><StatusBadge status={row.status} /></td><td>{formatDateTime(row.deliveredAt)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
