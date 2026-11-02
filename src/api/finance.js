// Finance/account API client for the mobile frontend. Every call attaches the
// signed-in user's JWT and returns backend data as-is — this module never
// fills gaps with sample values; callers render '—' for anything missing.
//
// `request` is used WITHOUT `auth: true`, so a 401 surfaces as an error state
// in the UI instead of tearing the session down (the session is validated
// once at boot by fetchMe in src/App.jsx).

import { request } from './auth.js'

// Keep in sync with DEPOSIT_METHODS in backend/src/routes/finance.routes.js.
// No payment provider (card/gateway) is connected — bank transfer only.
export const DEPOSIT_METHODS = ['bank_transfer']

export function fetchSummary() {
  return request('/dashboard/summary')
}

export function fetchTransactions({ limit = 10 } = {}) {
  return request(`/transactions?limit=${limit}`)
}

export function fetchHoldings() {
  return request('/holdings')
}

export function createDeposit({ amount, method = DEPOSIT_METHODS[0] }) {
  return request('/deposits', { method: 'POST', body: { amount, method } })
}

export function createWithdrawal({ amount, bankDetails }) {
  return request('/withdrawals', { method: 'POST', body: { amount, bankDetails } })
}