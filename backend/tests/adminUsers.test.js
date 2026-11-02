// Admin dashboard + user-management tests — node:test, no extra deps.
// Covers: dashboard aggregates, user search/pagination/status filter,
// user detail, per-user transaction scoping, guarded deletion, and
// unauthorized access to the new endpoints.

process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')
const { default: env } = await import('../src/config/env.js')
const { getPrisma } = await import('../src/config/prisma.js')

let server
let base = ''
const unique = Date.now().toString(36)
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

async function ensureAdminToken() {
  if (adminToken) return adminToken
  const login = await call('/admin/auth/login', {
    method: 'POST',
    body: { email: env.seed.adminEmail, password: env.seed.adminPassword },
  })
  adminToken = login.data.token
  return adminToken
}

// Create a user directly in the DB (no login needed for admin assertions).
async function makeUser(prisma, suffix, { status = 'active', wallet = null, txs = [] } = {}) {
  const user = await prisma.user.create({
    data: {
      email: `adm-${suffix}-${unique}@example.com`,
      password: '$2b$10$notarealhashusedbytests',
      name: `Adm Test ${suffix}`,
      status,
      ...(wallet !== null ? { wallet: { create: { balance: wallet } } } : {}),
    },
  })
  for (const tx of txs) {
    await prisma.transaction.create({ data: { userId: user.id, ...tx } })
  }
  return user
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
    await prisma.user.deleteMany({ where: { email: { contains: `-${unique}@` } } })
    await prisma.$disconnect()
  } catch {
    // best effort cleanup
  }
})

// ------------------------------------------------------------- dashboard --

test('GET /api/admin/dashboard aggregates are self-consistent', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const { status, data } = await call('/admin/dashboard', { token })
  assert.equal(status, 200)

  // Finance: byStatus must sum to total for both types.
  for (const kind of ['deposits', 'withdrawals']) {
    const summary = data.finance[kind]
    const sum = Object.values(summary.byStatus).reduce((a, b) => a + b, 0)
    assert.equal(sum, summary.total, `${kind} byStatus must sum to total`)
  }

  // Wallets: array of { currency, total, accounts } with numeric fields.
  assert.ok(Array.isArray(data.finance.wallets))
  for (const row of data.finance.wallets) {
    assert.equal(typeof row.currency, 'string')
    assert.equal(typeof row.total, 'number')
    assert.ok(Number.isInteger(row.accounts))
  }

  // Holdings: numeric summary present.
  assert.ok(Number.isFinite(data.finance.holdings.positions))
  assert.ok(Number.isFinite(data.finance.holdings.invested))
  assert.ok(Number.isFinite(data.finance.holdings.currentValue))

  // Recent transactions: max 8, newest-first, no password leakage.
  assert.ok(Array.isArray(data.recentTransactions))
  assert.ok(data.recentTransactions.length <= 8)
  if (data.recentTransactions.length > 1) {
    const first = new Date(data.recentTransactions[0].createdAt).getTime()
    const last = new Date(data.recentTransactions[data.recentTransactions.length - 1].createdAt).getTime()
    assert.ok(first >= last, 'recent transactions must be newest-first')
  }
  const serialized = JSON.stringify(data.recentTransactions)
  assert.ok(!serialized.includes('$2b$'), 'password hashes must never be serialized')

  // Markets + market-data health.
  assert.ok(Number.isFinite(data.markets.total))
  assert.ok(data.markets.active <= data.markets.total)
  assert.ok(data.providers.forex.status)
  assert.ok(data.lastMarketUpdate !== undefined)
})

test('dashboard wallet totals reflect known seeded balances', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const user = await makeUser(prisma, 'wal', { wallet: 1234.56 })

  try {
    const token = await ensureAdminToken()
    const { data } = await call('/admin/dashboard', { token })
    const inr = data.finance.wallets.find((row) => row.currency === 'INR')
    assert.ok(inr, 'INR wallet aggregate expected')
    assert.ok(inr.total >= 1234.56, 'aggregate must include the known balance')
    assert.ok(inr.accounts >= 1)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

// ------------------------------------------------------------ user lists --

test('user list supports search, status filter and pagination', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const active = await makeUser(prisma, 'list-a', { status: 'active' })
  const suspended = await makeUser(prisma, 'list-s', { status: 'suspended' })

  try {
    // Search by unique email fragment (shared prefix of both test users).
    const search = await call(`/admin/users?query=adm-list-`, { token })
    assert.equal(search.status, 200)
    const found = search.data.users.filter((u) => u.email.includes(`-${unique}@`))
    assert.equal(found.length, 2, 'search must find both created users')

    // Status filter narrows to one.
    const filtered = await call(`/admin/users?query=adm-list-&status=suspended`, { token })
    assert.equal(filtered.status, 200)
    const onlySuspended = filtered.data.users.filter((u) => u.email.includes(`-${unique}@`))
    assert.equal(onlySuspended.length, 1)
    assert.equal(onlySuspended[0].id, suspended.id)
    assert.equal(onlySuspended[0].status, 'suspended')

    // Pagination: pageSize=1 returns one row and a sane total.
    const paged = await call(`/admin/users?query=adm-list-&pageSize=1&page=1`, { token })
    assert.equal(paged.status, 200)
    assert.equal(paged.data.users.length, 1)
    assert.equal(paged.data.total, 2)
    assert.equal(paged.data.page, 1)
    assert.equal(paged.data.pageSize, 1)

    // Page 2 returns the *other* user.
    const page2 = await call(`/admin/users?query=adm-list-&pageSize=1&page=2`, { token })
    assert.equal(page2.data.users.length, 1)
    assert.notEqual(page2.data.users[0].id, paged.data.users[0].id)

    // Invalid status filter rejected.
    const bad = await call('/admin/users?status=bogus', { token })
    assert.equal(bad.status, 400)

    // Passwords never exposed.
    assert.ok(!('password' in search.data.users[0]))
    assert.ok([active.id, suspended.id].length === 2)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [active.id, suspended.id] } } })
  }
})


// ----------------------------------------------------------- user detail --

test('GET /api/admin/users/:id returns profile, wallet and scoped summaries', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'det', {
    wallet: 500,
    txs: [
      { type: 'deposit', amount: 100, status: 'pending', reference: `DET-DEP-${unique}` },
      { type: 'withdrawal', amount: 50, status: 'completed', reference: `DET-WD-${unique}` },
    ],
  })

  try {
    const { status, data } = await call(`/admin/users/${user.id}`, { token })
    assert.equal(status, 200)
    assert.equal(data.user.id, user.id)
    assert.ok(!('password' in data.user), 'no password in detail response')
    assert.equal(data.wallet.balance, 500)
    assert.equal(data.wallet.currency, 'INR')
    assert.equal(data.summary.deposits.total, 1)
    assert.equal(data.summary.deposits.byStatus.pending, 1)
    assert.equal(data.summary.withdrawals.total, 1)
    assert.equal(data.summary.withdrawals.byStatus.completed, 1)
    assert.equal(data.recentTransactions.length, 2)
    // Deletion blocked: wallet non-zero + transactions exist.
    assert.equal(data.deletion.allowed, false)
    assert.ok(data.deletion.blockers.length >= 2)

    const missing = await call('/admin/users/nonexistent-id', { token })
    assert.equal(missing.status, 404)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('user transaction history is scoped to that user only', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const mine = await makeUser(prisma, 'own', {
    txs: [
      { type: 'deposit', amount: 10, status: 'pending', reference: `OWN-DEP-${unique}` },
      { type: 'deposit', amount: 20, status: 'completed', reference: `OWN-DEP2-${unique}` },
    ],
  })
  const other = await makeUser(prisma, 'oth', {
    txs: [{ type: 'deposit', amount: 999, status: 'pending', reference: `OTH-DEP-${unique}` }],
  })

  try {
    const { status, data } = await call(`/admin/users/${mine.id}/transactions`, { token })
    assert.equal(status, 200)
    assert.equal(data.total, 2)
    assert.ok(data.transactions.every((tx) => tx.userId === mine.id))
    assert.ok(
      !data.transactions.some((tx) => tx.reference === `OTH-DEP-${unique}`),
      "another user's transaction must never appear",
    )

    // Type filter.
    const deposits = await call(`/admin/users/${mine.id}/transactions?type=deposit`, { token })
    assert.equal(deposits.data.total, 2)
    const badType = await call(`/admin/users/${mine.id}/transactions?type=transfer`, { token })
    assert.equal(badType.status, 400)

    // Unknown user -> 404.
    const missing = await call('/admin/users/nope/transactions', { token })
    assert.equal(missing.status, 404)

    const otherDetail = await call(`/admin/users/${other.id}`, { token })
    assert.equal(otherDetail.data.summary.deposits.total, 1)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [mine.id, other.id] } } })
  }
})


// ------------------------------------------------------- status + delete --

test('suspend/reactivate requires a reason and records it in the audit trail', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'sus')

  try {
    // Missing reason -> 400.
    const noReason = await call(`/admin/users/${user.id}`, {
      method: 'PATCH',
      token,
      body: { status: 'suspended' },
    })
    assert.equal(noReason.status, 400)

    const suspended = await call(`/admin/users/${user.id}`, {
      method: 'PATCH',
      token,
      body: { status: 'suspended', reason: 'fraud review (test)' },
    })
    assert.equal(suspended.status, 200)
    assert.equal(suspended.data.user.status, 'suspended')

    // Audit entry contains actor + reason.
    const audit = await call('/admin/audit-logs?action=user_status_update&page=1&pageSize=20', {
      token,
    })
    const entry = audit.data.logs.find(
      (log) => log.entityId === user.id && log.details && log.details.reason === 'fraud review (test)',
    )
    assert.ok(entry, 'audit entry with reason expected')
    assert.ok(entry.actor)

    // Financial history preserved: only status changed.
    const stored = await prisma.user.findUnique({ where: { id: user.id } })
    assert.equal(stored.status, 'suspended')

    // Reactivate.
    const reactivated = await call(`/admin/users/${user.id}`, {
      method: 'PATCH',
      token,
      body: { status: 'active', reason: 'review cleared (test)' },
    })
    assert.equal(reactivated.data.user.status, 'active')
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('permanent deletion is blocked by financial footprint', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'del', {
    wallet: 10,
    txs: [{ type: 'deposit', amount: 10, status: 'pending', reference: `DEL-DEP-${unique}` }],
  })

  try {
    const blocked = await call(`/admin/users/${user.id}`, {
      method: 'DELETE',
      token,
      body: { reason: 'cleanup attempt (test)' },
    })
    assert.equal(blocked.status, 409, 'users with financial history must not be deletable')
    assert.ok(Array.isArray(blocked.data.details))
    assert.ok(blocked.data.details.length >= 2)

    const still = await prisma.user.findUnique({ where: { id: user.id } })
    assert.ok(still, 'user must survive a blocked delete')

    // Missing reason -> 400 even before policy check.
    const noReason = await call(`/admin/users/${user.id}`, { method: 'DELETE', token, body: {} })
    assert.equal(noReason.status, 400)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('clean account with zero footprint can be deleted', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'clean', { wallet: 0 })

  const deleted = await call(`/admin/users/${user.id}`, {
    method: 'DELETE',
    token,
    body: { reason: 'test cleanup of empty account' },
  })
  assert.equal(deleted.status, 200)
  assert.equal(deleted.data.deleted, true)

  const gone = await prisma.user.findUnique({ where: { id: user.id } })
  assert.equal(gone, null)
})


// -------------------------------------------------------- unauthorized ----

test('new admin endpoints reject missing and non-admin tokens', async () => {
  const prisma = await getPrisma()
  const user = await makeUser(prisma, 'unauth')

  try {
    for (const path of ['/admin/dashboard', `/admin/users/${user.id}`, `/admin/users/${user.id}/transactions`]) {
      const missing = await call(path)
      assert.equal(missing.status, 401, `${path} without token`)
    }

    // A *valid* ordinary-user token must be rejected with 403.
    const reg = await call('/auth/register', {
      method: 'POST',
      body: { email: `unauth-token-${unique}@example.com`, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'North' },
    })
    assert.equal(reg.status, 201)
    const userTok = reg.data.token

    for (const path of ['/admin/dashboard', `/admin/users/${user.id}`, `/admin/users/${user.id}/transactions`]) {
      const asUser = await call(path, { token: userTok })
      assert.equal(asUser.status, 403, `${path} with ordinary user token`)
    }
    const patchAsUser = await call(`/admin/users/${user.id}`, {
      method: 'PATCH',
      token: userTok,
      body: { status: 'suspended', reason: 'not allowed' },
    })
    assert.equal(patchAsUser.status, 403)
    const delAsUser = await call(`/admin/users/${user.id}`, {
      method: 'DELETE',
      token: userTok,
      body: { reason: 'not allowed' },
    })
    assert.equal(delAsUser.status, 403)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    await prisma.user.deleteMany({ where: { email: `unauth-token-${unique}@example.com` } })
  }
})

