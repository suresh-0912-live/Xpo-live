// Shared formatting helpers for the Crypto / Forex investment pages.
// Values are rendered exactly as they arrive from src/api/marketApi.js —
// nothing here invents, rounds into existence, or simulates market data.
// Missing values always fall back to the '—' placeholder.
// Every pair is quoted against the Indian Rupee: crypto/commodity prices
// carry '₹', forex rows stay plain (91.2345).

export function isUsablePrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

// Formats a live price the same way the Markets page does
// (91.2345 / 149.23 / 3456.78 / 56,23,421.00).
export function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (price >= 100) return price.toFixed(2)
  if (price >= 10) return price.toFixed(3)
  return price.toFixed(4)
}

export function formatChange(percent) {
  const rounded = Math.round(percent * 100) / 100
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(2)}%`
}

// Row / hero price label: crypto/commodity quotes get '₹', forex stays plain.
export function priceLabel(asset, quote) {
  if (!quote || !isUsablePrice(quote.price)) return '—'
  const value = formatPrice(quote.price)
  return asset.category === 'Forex' ? value : `₹${value}`
}

// Same as priceLabel but for an explicit numeric value (detail stats).
export function statPrice(asset, value) {
  if (!isUsablePrice(value)) return '—'
  const formatted = formatPrice(value)
  return asset.category === 'Forex' ? formatted : `₹${formatted}`
}

export function changeLabel(quote) {
  return quote && Number.isFinite(quote.changePercent)
    ? formatChange(quote.changePercent)
    : '—'
}

// Large notional values (volume / market cap) in compact rupees.
export function formatCompactInr(value) {
  if (!isUsablePrice(value)) return '—'
  if (value >= 1e9) return `₹${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `₹${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `₹${value.toLocaleString('en-IN')}`
  return `₹${value.toFixed(2)}`
}

// Estimated units received for a ₹ amount (crypto quantities vary hugely).
export function formatQuantity(value) {
  if (!isUsablePrice(value)) return '—'
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 100) return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (value >= 1) return value.toFixed(4)
  return value.toPrecision(3)
}

// Rupee amounts; 0 / missing renders as '—' (never a fake ₹0).
export function formatInr(value) {
  if (!isUsablePrice(value)) return '—'
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// Tinted icon background (same recipe MarketRow uses).
export function hexTint(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16)
  if (Number.isNaN(value)) return 'rgba(37, 99, 235, 0.16)'
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
