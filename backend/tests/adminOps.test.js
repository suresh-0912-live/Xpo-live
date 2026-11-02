// Part 4 admin ops tests — markets administration, activity feed, audit-log
// protection and admin profile editing. node:test, no extra dependencies.
// Runs against the local dev database (never production).
//
// Covers: markets list shape (no provider secrets), market toggle +
// validation, activity endpoint scoping, audit-log filters and the absence
// of any write route, profile name edit, password change with current-
// password check, failed-login after rotation, and role-escalation attempts.

process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'

const { default: app } = await import('../src/app.js')
const { default: env } = await import('../src/config/env.js')
const { getPrisma } = await import('../src/config/prisma.js')

let server
let base = ''
// Underscore-joined pid+time: immune to other test files' contains('-x@')
// cleanup patterns (see adminFinance.test.js for the rationale).
const unique = `${process.pid}_${Date.now().toString(36)}`
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
  return { status: response.status, data }
}

async function ensureAdminToken() {
  if (adminToken) return adminToken
  const login = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: env.seed.adminEmail, password: env.seed.adminPassword },
  })
  adminToken = login.data.token
  return adminToken
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
    await prisma.market.deleteMany({ where: { symbol: `TEST_${unique}` } })
    await prisma.admin.deleteMany({ where: { email: { contains: `ops_${unique}@` } } })
    await prisma.auditLog.deleteMany({ where: { action: { contains: `test.audit_probe_${unique}` } } })
    await prisma.$disconnect()
  } catch {
    // best effort cleanup
  }
})

// ------------------------------------------------------------- markets ----

test('GET /api/admin/markets returns universe shape without provider secrets', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/markets', { token })
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.markets))
  assert.ok(data.markets.length >= 5, 'seeded universe present')
  assert.ok(data.providers.forex && data.providers.crypto)

  for (const market of data.markets) {
    assert.equal(typeof market.symbol, 'string')
    assert.ok(market.type === 'Forex' || market.type === 'Crypto')
    assert.equal(market.quote, 'INR', 'every pair quotes INR')
    assert.ok('lastPrice' in market)
    assert.ok('lastPriceAt' in market)
  }

  // No secrets leak: provider objects must not carry key/url material.
  const serialized = JSON.stringify(data.providers)
  assert.ok(!serialized.includes('apiKey'), 'no apiKey in provider status')
  assert.ok(!serialized.includes('Bearer'), 'no bearer material in provider status')
})

test('market enable/disable is admin-only and validated', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const market = await prisma.market.create({
    data: {
      symbol: `TEST_${unique}`,
      pair: `TEST_${unique}/INR`,
      name: 'Toggle Test Market',
      provider: 'crypto',
      category: 'Crypto',
      active: true,
    },
  })

  try {
    const off = await call(`/admin/markets/${market.id}`, {
      method: 'PATCH', token, body: { active: false },
    })
    assert.equal(off.status, 200)
    assert.equal(off.data.market.active, false)

    const bad = await call(`/admin/markets/${market.id}`, {
      method: 'PATCH', token, body: { active: 'yes' },
    })
    assert.equal(bad.status, 400, 'non-boolean active must fail')

    const missing = await call('/admin/markets/does-not-exist', {
      method: 'PATCH', token, body: { active: false },
    })
    assert.equal(missing.status, 404)

    const anon = await call(`/admin/markets/${market.id}`, {
      method: 'PATCH', body: { active: true },
    })
    assert.equal(anon.status, 401)
  } finally {
    await prisma.market.delete({ where: { id: market.id } }).catch(() => {})
  }
})

// ------------------------------------------------------------- activity ---

test('GET /api/admin/activity is admin-scoped and shaped correctly', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/activity', { token })
  assert.equal(status, 200)
  assert.equal(typeof data.pending.deposits, 'number')
  assert.equal(typeof data.pending.withdrawals, 'number')
  assert.ok(Array.isArray(data.recentAudit))
  assert.ok(Array.isArray(data.warnings))
  for (const entry of data.recentAudit) {
    assert.ok(entry.action && entry.actor && entry.createdAt)
  }
  for (const warning of data.warnings) {
    assert.ok(['info', 'warn', 'error'].includes(warning.level))
    assert.equal(typeof warning.message, 'string')
  }

  // Anonymous and ordinary users are locked out.
  assert.equal((await call('/admin/activity')).status, 401)
})

// ---------------------------------------------------------- audit logs ----

test('audit logs support actor filter and have no write routes', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()

  await prisma.auditLog.create({
    data: {
      action: `test.audit_probe_${unique}`,
      actor: `probe_${unique}@example.com`,
      actorRole: 'admin',
      entityType: 'test',
      details: { purpose: 'part4-filter-test' },
    },
  })

  const byActor = await call(`/admin/audit-logs?actor=probe_${unique}`, { token })
  assert.equal(byActor.status, 200)
  assert.equal(byActor.data.total, 1)
  assert.equal(byActor.data.logs[0].action, `test.audit_probe_${unique}`)

  const byAction = await call(`/admin/audit-logs?action=test.audit_probe_${unique}`, { token })
  assert.equal(byAction.data.total, 1)

  const paged = await call('/admin/audit-logs?page=1&pageSize=5', { token })
  assert.ok(paged.data.logs.length <= 5)
  assert.equal(typeof paged.data.pageSize, 'number')

  // The trail is append-only: no PATCH/DELETE route exists anywhere.
  for (const [method, path] of [
    ['PATCH', '/admin/audit-logs/anything'],
    ['DELETE', '/admin/audit-logs/anything'],
    ['PATCH', '/admin/audit-logs'],
    ['DELETE', '/admin/audit-logs'],
  ]) {
    const attempt = await call(path, { method, token, body: { action: 'x' } })
    assert.equal(attempt.status, 404, `${method} ${path} must not exist`)
  }
})

// ------------------------------------------------------------- profile ----

// A temporary admin exercised through the REAL login + profile endpoints —
// the seeded admin's credentials are never touched.
async function makeTempAdmin(prisma) {
  const email = `ops_${unique}@example.com`
  await prisma.admin.create({
    data: {
      email,
      password: await bcrypt.hash('OrigPass123!', 10),
      name: 'Ops Temp Admin',
      role: 'admin',
      status: 'active',
    },
  })
  return email
}

test('admin profile: name edit, password rotation and escalation attempts', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const email = await makeTempAdmin(prisma)

  const login = await call('/admin/auth/login', {
    method: 'POST',
    body: { email, password: 'OrigPass123!' },
  })
  assert.equal(login.status, 200)
  const token = login.data.token

  // --- name edit works and is audited.
  const renamed = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { name: 'Ops Renamed' },
  })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.data.admin.name, 'Ops Renamed')
  assert.equal(renamed.data.admin.email, email, 'email is unchanged')
  assert.equal(renamed.data.admin.role, 'admin', 'role is unchanged')

  const audits = await prisma.auditLog.findMany({
    where: { action: 'admin.profile_update', actor: email },
  })
  assert.equal(audits.length, 1)
  assert.equal(audits[0].details.nameChanged, true)
  assert.equal(audits[0].details.passwordChanged, false)

  // --- validation: empty body, short name, role escalation attempts.
  assert.equal((await call('/admin/auth/profile', { method: 'PATCH', token, body: {} })).status, 400)
  const shortName = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { name: 'x' },
  })
  assert.equal(shortName.status, 400)
  const escalate = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { role: 'superadmin', status: 'active' },
  })
  assert.equal(escalate.status, 400, 'unknown fields alone = nothing to update')
  const afterEscalate = await prisma.admin.findUnique({ where: { email } })
  assert.equal(afterEscalate.role, 'admin', 'role escalation must not work')

  // --- password change requires the correct current password.
  const noCurrent = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { newPassword: 'NewPass456!' },
  })
  assert.equal(noCurrent.status, 400)
  const wrongCurrent = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { currentPassword: 'not-the-pass', newPassword: 'NewPass456!' },
  })
  assert.equal(wrongCurrent.status, 400)
  const shortPw = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { currentPassword: 'OrigPass123!', newPassword: 'short' },
  })
  assert.equal(shortPw.status, 400, 'newPassword min length enforced by validation')

  // --- successful rotation: old password dies, new one works.
  const rotated = await call('/admin/auth/profile', {
    method: 'PATCH', token, body: { currentPassword: 'OrigPass123!', newPassword: 'NewPass456!' },
  })
  assert.equal(rotated.status, 200)

  const oldLogin = await call('/admin/auth/login', {
    method: 'POST', body: { email, password: 'OrigPass123!' },
  })
  assert.equal(oldLogin.status, 401, 'old password must stop working')

  const newLogin = await call('/admin/auth/login', {
    method: 'POST', body: { email, password: 'NewPass456!' },
  })
  assert.equal(newLogin.status, 200, 'new password must work')

  const pwAudit = await prisma.auditLog.findMany({
    where: { action: 'admin.profile_update', actor: email, details: { path: ['passwordChanged'], equals: true } },
  })
  assert.equal(pwAudit.length, 1)
  const serialized = JSON.stringify(pwAudit)
  assert.ok(!serialized.includes('NewPass456!'), 'passwords never appear in the audit trail')

  // --- anonymous and ordinary users are locked out.
  assert.equal((await call('/admin/auth/profile', { method: 'PATCH', body: { name: 'Nope Admin' } })).status, 401)
  const userReg = await call('/auth/register', {
    method: 'POST',
    body: { email: `ops_user_${unique}@example.com`, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'North' },
  })
  assert.equal(userReg.status, 201)
  const asUser = await call('/admin/auth/profile', {
    method: 'PATCH', token: userReg.data.token, body: { name: 'Nope Admin' },
  })
  assert.equal(asUser.status, 403)
  await prisma.user.deleteMany({ where: { email: `ops_user_${unique}@example.com` } })
})
