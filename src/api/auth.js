// Auth client for the mobile frontend — mirrors admin/src/api.js.
// Token + user profile live in localStorage and are attached as a Bearer
// header. A 401 on an authenticated request clears the session and dispatch
// `xpo-unauthorized`, which drops the app back to the login page.

const API_BASE = import.meta.env.VITE_API_URL || ''

const TOKEN_KEY = 'xpo_token'
const USER_KEY = 'xpo_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// Display helpers (kept here so page modules only export components).
export function displayName(user) {
  if (!user) return ''
  if (user.name) return user.name
  if (user.email) return user.email.split('@')[0]
  return 'Trader'
}

export function initialsFor(user) {
  const name = displayName(user).trim()
  if (!name) return 'X'
  const parts = name.split(/\s+/)
  const initials = (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  return initials
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

// `request` is exported for the finance client (src/api/finance.js), which
// reuses the same token/attachment rules but opts out of the 401 logout.
export async function request(path, { method = 'GET', body, auth = false } = {}) {
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
    throw new ApiError(0, 'Cannot reach the server — is the backend running?')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession()
      window.dispatchEvent(new Event('xpo-unauthorized'))
    }
    throw new ApiError(
      response.status,
      data?.error || `Request failed (HTTP ${response.status})`,
      data?.details,
    )
  }
  return data
}

export async function loginUser({ email, password }) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password } })
  if (data.recovery) return { recovery: data.recovery }
  setSession(data.token, data.user)
  return { user: data.user }
}

export async function registerUser({ email, password, name, securityQuestion, securityAnswer }) {
  const body = { email, password, securityQuestion, securityAnswer }
  if (name) body.name = name
  const data = await request('/auth/register', { method: 'POST', body })
  setSession(data.token, data.user)
  return data.user
}

export async function fetchMe() {
  const data = await request('/auth/me', { auth: true })
  if (getToken()) localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}
