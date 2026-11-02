// Small shared UI helpers for the admin panel pages.
// Only components are exported here (react-refresh rule); pure helpers and
// the toast pub/sub live in format.js / toast.js.
import { useEffect, useState } from 'react'
import { subscribeToasts } from './toast.js'

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function StatusBadge({ status }) {
  const label = String(status ?? 'unknown')
  const tone =
    ['ok', 'active', 'up', 'true'].includes(label) ? 'ok'
    : ['degraded', 'warn', 'warning', 'pending', 'processing'].includes(label) ? 'warn'
    : ['not_configured', 'off', 'down', 'suspended', 'error', 'failed', 'rejected'].includes(label) ? 'off'
    : 'neutral'
  return <span className={`badge badge--${tone}`}>{label.replace(/_/g, ' ')}</span>
}

export function Spinner() {
  return <p className="muted">Loading…</p>
}

export function ErrorBox({ children }) {
  return <p className="alert alert--error">{children}</p>
}

export function EmptyState({ children }) {
  return <p className="muted empty">{children}</p>
}

export function Button({
  variant = 'default',
  size,
  block,
  loading,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button {...props} type={type} className={classes} disabled={loading || props.disabled}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <div className="card__head">
          {title && <h2 className="card__title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function FormField({ label, hint, htmlFor, children }) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function Dialog({ open, title, children, footer, onClose }) {
  if (!open) return null
  return (
    <div
      className="dialog__backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog__head">
          <h2 className="dialog__title">{title}</h2>
          <button
            type="button"
            className="dialog__close"
            aria-label="Close dialog"
            onClick={() => onClose?.()}
          >
            ×
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>
  )
}

// Generic table: `columns` = [{ key, label, className?, render?(row) }],
// `rows` = data. Pass `children` instead to render custom table markup.
export function DataTable({ columns, rows, rowKey = (row) => row.id, empty, children }) {
  if (children) return children
  if (!rows?.length) return empty ?? <EmptyState>No rows.</EmptyState>
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.key} className={column.className}>
                {column.render ? column.render(row) : (row[column.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Clearly-marked placeholder for pages that are scaffolded but NOT built
// yet. It never fetches data and offers no actions — only an honest
// "unfinished" marker so nobody mistakes it for working functionality.
export function Placeholder({ title, description, next }) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Not implemented yet"
        action={<span className="badge badge--warn">Under construction</span>}
      />
      <section className="card placeholder">
        <p className="placeholder__mark">🚧 This page is unfinished.</p>
        <p className="muted">{description}</p>
        {next && (
          <>
            <h2 className="card__title">Planned here</h2>
            <ul className="placeholder__list">
              {next.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">
          No data is loaded and no actions are available on this page — it is a stub only.
        </p>
      </section>
    </div>
  )
}

// Toast viewport — subscribes to toast.js; mount once in main.jsx.
export function Toaster() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    return subscribeToasts((item) => {
      setToasts((current) => [...current, item])
      window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== item.id))
      }, 4000)
    })
  }, [])
  if (!toasts.length) return null
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          {item.message}
        </div>
      ))}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <div className="pager">
      <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </Button>
      <span className="muted">
        Page {page} of {pages} · {total} total
      </span>
      <Button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </Button>
    </div>
  )
}
