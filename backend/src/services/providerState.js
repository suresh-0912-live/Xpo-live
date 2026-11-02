// In-memory provider health state (survives within the process; after a
// restart we fall back to the ApiUsage table for last-known values).

const EMPTY = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  nextRefreshAt: null,
  consecutiveFailures: 0,
}

const state = {
  forex: { ...EMPTY },
  crypto: { ...EMPTY },
}

export function markAttempt(provider) {
  state[provider].lastAttemptAt = new Date().toISOString()
}

export function markSuccess(provider) {
  const entry = state[provider]
  entry.lastSuccessAt = new Date().toISOString()
  entry.lastError = null
  entry.consecutiveFailures = 0
}

export function markFailure(provider, error) {
  const entry = state[provider]
  entry.lastErrorAt = new Date().toISOString()
  entry.lastError = String(error?.message || error).slice(0, 500)
  entry.consecutiveFailures += 1
}

export function setNextRefresh(provider, isoDate) {
  state[provider].nextRefreshAt = isoDate
}

export function getProviderState(provider) {
  return { ...state[provider] }
}
