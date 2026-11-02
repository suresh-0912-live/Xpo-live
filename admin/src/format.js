// Pure formatting helpers (kept out of ui.jsx so that file exports only
// components, as required by react-refresh).

export function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatPrice(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 })
}

// INR currency display. Returns '—' for null/undefined so the UI never
// fabricates a ₹0.00 balance.
export function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
