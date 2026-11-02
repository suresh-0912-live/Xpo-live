// Minimal API client for the admin panel. Token lives in localStorage and
// is attached as a Bearer header. 401 responses trigger a logout event.

const API_BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'xpo_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { accept: 'application/json' }
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'

  let response
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the backend — is it running?')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      window.dispatchEvent(new Event('xpo-admin-unauthorized'))
    }
    throw new ApiError(
      response.status,
      data?.error || `Request failed (HTTP ${response.status})`,
      data?.details,
    )
  }
  return data
}

// Fetch a non-JSON (binary/blob) admin endpoint with the same base URL,
// bearer token and 401 handling as api(). Used by the transactions CSV
// export so it works whether the panel is same-origin (dev proxy) or set
// against a deployed VITE_API_URL.
export async function apiBlob(path) {
  const headers = {}
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE}/api${path}`, { headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the backend — is it running?')
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      window.dispatchEvent(new Event('xpo-admin-unauthorized'))
    }
    const data = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      data?.error || `Request failed (HTTP ${response.status})`,
      data?.details,
    )
  }
  return response.blob()
}
