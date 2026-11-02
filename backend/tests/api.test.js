// Backend API test suite — node:test, no extra dependencies.
// Runs against the local dev database (schema migrated, admin seeded).

process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')
const { default: env } = await import('../src/config/env.js')
const { getPrisma } = await import('../src/config/prisma.js')
const { signToken, adminTokenPayload } = await import('../src/utils/token.js')

let server
let base = ''
const unique = Date.now().toString(36)
let userToken = ''
const testEmail = `tester-${unique}@example.com`
let adminToken = ''
const adminAvailable = Boolean(env.seed.adminEmail && env.seed.adminPassword)

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  return { status: response.status, data, headers: response.headers }
}

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  try {
    const prisma = await getPrisma()
    await prisma.user.deleteMany({ where: { email: testEmail } })
    await prisma.$disconnect()
  } catch {
    // best effort cleanup
  }
})

// ------------------------------------------------------------------ health

test('GET /api/health reports api + database status', async () => {
  const { status, data } = await call('/health')
  assert.equal(status, 200)
  assert.equal(data.api, 'up')
  assert.ok(['ok', 'degraded'].includes(data.status))
  assert.equal(data.database.status, 'up', 'database should be up in tests')
})

test('security headers are present (helmet)', async () => {
  const response = await fetch(`${base}/api/health`)
  assert.ok(response.headers.get('x-frame-options'))
  assert.ok(response.headers.get('content-security-policy'))
})

test('rate limit headers are exposed', async () => {
  const response = await fetch(`${base}/api/health`)
  assert.ok(response.headers.get('ratelimit') || response.headers.get('ratelimit-limit'))
})

// ------------------------------------------------------------- user auth --

test('POST /api/auth/register creates a user and returns a token', async () => {
  const { status, data } = await call('/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: 'password123', name: 'API Tester', securityQuestion: 'First school?', securityAnswer: 'North' },
  })
  assert.equal(status, 201)
  assert.ok(data.token)
  assert.equal(data.user.email, testEmail)
  assert.ok(!('password' in data.user), 'password must never be returned')

  const prisma = await getPrisma()
  const stored = await prisma.user.findUnique({ where: { email: testEmail } })
  assert.ok(stored.password.startsWith('$'), 'password must be a bcrypt hash')
  assert.notEqual(stored.password, 'password123')
})

test('POST /api/auth/register rejects duplicate emails', async () => {
  const { status, data } = await call('/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'North' },
  })
  assert.equal(status, 409)
  assert.equal(data.error, 'Email is already registered')
})

test('POST /api/auth/register validates input', async () => {
  const { status, data } = await call('/auth/register', {
    method: 'POST',
    body: { email: 'not-an-email', password: 'short' },
  })
  assert.equal(status, 400)
  assert.equal(data.error, 'Validation failed')
  assert.ok(Array.isArray(data.details))
})

test('POST /api/auth/login returns a token for valid credentials', async () => {
  const { status, data } = await call('/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: 'password123' },
  })
  assert.equal(status, 200)
  assert.ok(data.token)
  userToken = data.token
})

test('POST /api/auth/login rejects wrong credentials without user enumeration', async () => {
  const wrongPassword = await call('/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: 'wrong-password' },
  })
  const unknownUser = await call('/auth/login', {
    method: 'POST',
    body: { email: `ghost-${unique}@example.com`, password: 'whatever123' },
  })
  assert.equal(wrongPassword.status, 401)
  assert.equal(unknownUser.status, 401)
  assert.equal(wrongPassword.data.error, unknownUser.data.error)
})

test('GET /api/auth/me requires a user token', async () => {
  const missing = await call('/auth/me')
  assert.equal(missing.status, 401)

  const { status, data } = await call('/auth/me', { token: userToken })
  assert.equal(status, 200)
  assert.equal(data.user.email, testEmail)
  assert.ok(!('password' in data.user))
})
// ------------------------------------------------------------ admin auth --

test('POST /api/admin/auth/login + GET /api/admin/auth/me', { skip: !adminAvailable }, async () => {
  const bad = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: env.seed.adminEmail, password: 'definitely-wrong-pw' },
  })
  assert.equal(bad.status, 401)

  const { status, data } = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: env.seed.adminEmail, password: env.seed.adminPassword },
  })
  assert.equal(status, 200)
  assert.ok(data.token)
  assert.equal(data.admin.role, 'superadmin')
  adminToken = data.token

  const me = await call('/admin/auth/me', { token: adminToken })
  assert.equal(me.status, 200)
  assert.equal(me.data.admin.email, env.seed.adminEmail)
})

test('admin routes reject missing or non-admin tokens', async () => {
  const missing = await call('/admin/dashboard')
  assert.equal(missing.status, 401)

  if (userToken) {
    const asUser = await call('/admin/dashboard', { token: userToken })
    assert.equal(asUser.status, 403)
  }
})

// Authorization for admin APIs is re-checked against the database — a valid
// JWT alone must never be enough (requireAdmin in src/middleware/auth.js).

test('forged admin token for a nonexistent admin is rejected', async () => {
  const ghost = signToken({
    sub: 'nonexistent-admin-id',
    type: 'admin',
    email: 'ghost@example.com',
    role: 'superadmin',
  })
  const { status } = await call('/admin/dashboard', { token: ghost })
  assert.equal(status, 401)
})

test('requireAdmin locks out disabled and deleted admins', async () => {
  const prisma = await getPrisma()
  const email = `temp-admin-${unique}@example.com`
  const admin = await prisma.admin.create({
    data: { email, password: 'unused-hash', role: 'admin', status: 'active' },
  })

  try {
    const token = signToken(adminTokenPayload(admin))

    const active = await call('/admin/dashboard', { token })
    assert.equal(active.status, 200, 'active admin should be allowed')

    await prisma.admin.update({ where: { id: admin.id }, data: { status: 'suspended' } })
    const disabled = await call('/admin/dashboard', { token })
    assert.equal(disabled.status, 401, 'disabled admin must be rejected despite valid token')

    await prisma.admin.delete({ where: { id: admin.id } })
    const deleted = await call('/admin/dashboard', { token })
    assert.equal(deleted.status, 401, 'deleted admin must be rejected despite valid token')
  } finally {
    await prisma.admin.deleteMany({ where: { email } })
  }
})

test('POST /api/admin/auth/logout requires an admin and writes an audit entry', async () => {
  const missing = await call('/admin/auth/logout', { method: 'POST' })
  assert.equal(missing.status, 401)

  if (!adminAvailable) return
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/auth/logout', { method: 'POST', token })
  assert.equal(status, 200)
  assert.equal(data.ok, true)

  const prisma = await getPrisma()
  const entry = await prisma.auditLog.findFirst({
    where: { action: 'admin.logout' },
    orderBy: { createdAt: 'desc' },
  })
  assert.ok(entry, 'logout must be recorded in the audit trail')
})

async function ensureAdminToken() {
  if (adminToken) return adminToken
  const login = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: env.seed.adminEmail, password: env.seed.adminPassword },
  })
  adminToken = login.data.token
  return adminToken
}

test('GET /api/admin/dashboard returns all required metrics', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/dashboard', { token })
  assert.equal(status, 200)
  assert.ok(Number.isFinite(data.users.total))
  assert.ok(Number.isFinite(data.users.active))
  assert.ok(data.providers.forex)
  assert.ok(data.providers.crypto)
  assert.ok(Number.isFinite(data.api.todayRequests))
  assert.ok(Number.isFinite(data.api.monthlyRequests))
  assert.ok(Number.isFinite(data.api.monthlyLimit))
  assert.ok('lastMarketUpdate' in data)
  assert.ok(data.backend)
  assert.ok(data.database)
})

test('GET /api/admin/settings never exposes secrets', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/settings', { token })
  assert.equal(status, 200)
  const serialized = JSON.stringify(data)
  if (env.ibrlive.apiKey) {
    assert.ok(!serialized.includes(env.ibrlive.apiKey), 'IBRLive API key leaked')
  }
  assert.ok(!serialized.toLowerCase().includes('ibrlive_api_key'))
  assert.ok(!('jwtSecret' in data.security))
})

test('admin audit trail records logins', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/audit-logs?page=1&pageSize=10', { token })
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.logs))
  const loginEntries = data.logs.filter((row) => row.action.includes('login'))
  assert.ok(loginEntries.length > 0, 'expected at least one login audit entry')
})

// --------------------------------------------------------------- markets --

test('GET /api/markets/forex serves cached quotes without hitting providers', async () => {
  const { status, data } = await call('/markets/forex')
  assert.equal(status, 200)
  assert.equal(data.provider, 'forex')
  assert.equal(data.source, 'cache')
  assert.ok(Array.isArray(data.data))
  const symbols = data.data.map((row) => row.symbol)
  for (const expected of env.ibrlive.symbols) {
    assert.ok(symbols.includes(expected), `missing market ${expected}`)
  }
  for (const row of data.data) {
    assert.ok('price' in row)
    assert.ok('changePercent' in row)
    // When nothing has been cached yet, price is null — never fake data.
    assert.ok(row.price === null || Number.isFinite(row.price))
  }
})

test('GET /api/markets/crypto returns 503 when no provider is configured', async () => {
  if (env.isCryptoConfigured) return // configured in this environment
  const { status, data } = await call('/markets/crypto')
  assert.equal(status, 503)
  assert.equal(data.details.code, 'crypto_service_unavailable')
})

test('GET /api/markets/status reports providers, usage and backend', async () => {
  const { status, data } = await call('/markets/status')
  assert.equal(status, 200)
  assert.equal(data.backend.status, 'up')
  assert.equal(data.database.status, 'up')
  assert.ok(data.providers.forex.configured !== undefined)
  assert.equal(data.providers.forex.usage.monthlyLimit, env.forex.monthlyRequestLimit)
  assert.ok(data.providers.crypto)
})

// ---------------------------------------------------------------- errors --

test('unknown routes return JSON 404', async () => {
  const { status, data } = await call('/definitely-not-a-route')
  assert.equal(status, 404)
  assert.equal(data.error, 'Route not found: GET /api/definitely-not-a-route')
})

