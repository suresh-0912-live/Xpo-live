// Admin finance tests — deposit/withdrawal review and the transaction ledger.
// node:test, no extra dependencies. Runs against the local dev database.
//
// Covers: unauthorized access, invalid input, deposit approval crediting the
// wallet EXACTLY ONCE (incl. duplicate + concurrent requests), deposit
// rejection never crediting, withdrawal rejection refunding EXACTLY ONCE
// (incl. duplicates), withdrawal approval not pretending a payout happened,
// ledger filters/search/pagination, capped CSV export, and audit rows.

process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')
const { default: env } = await import('../src/config/env.js')
const { getPrisma } = await import('../src/config/prisma.js')

let server
let base = ''
// Include the pid, joined by underscores: node --test runs test files in
// parallel processes, and adminUsers.test.js cleans up with
// `contains('-<millis>@')` — keeping our separator distinct from '-' (and our
// own cleanup equally specific) makes cross-file fixture deletion impossible.
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

// User + wallet fixture created directly in the DB (wallet balance = prior
// verified funds; no payment provider exists to create one via the API).
async function makeUser(prisma, suffix, { wallet = 0 } = {}) {
  return prisma.user.create({
    data: {
      email: `fin_${suffix}_${unique}@example.com`,
      password: '$2b$10$notarealhashusedbytests',
      name: `Fin Test ${suffix}`,
      wallet: { create: { balance: wallet, currency: 'INR' } },
    },
  })
}

async function makeTx(prisma, userId, data) {
  return prisma.transaction.create({
    data: { userId, ...data },
  })
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
    await prisma.user.deleteMany({ where: { email: { contains: `fin_${unique}@` } } })
    await prisma.$disconnect()
  } catch {
    // best effort cleanup
  }
})

// ---------------------------------------------------------- unauthorized ---

test('finance admin endpoints reject anonymous and ordinary-user tokens', async () => {
  const prisma = await getPrisma()
  const user = await makeUser(prisma, 'unauth')
  let txId
  try {
    txId = (await makeTx(prisma, user.id, {
      type: 'deposit', amount: 10, status: 'pending', reference: `UNAUTH-DEP-${unique}`,
    })).id

    const paths = [
      '/admin/deposits',
      `/admin/deposits/${txId}`,
      '/admin/withdrawals',
      `/admin/withdrawals/${txId}`,
      '/admin/transactions',
      `/admin/transactions/${txId}`,
      '/admin/transactions/export.csv',
    ]
    for (const path of paths) {
      const missing = await call(path)
      assert.equal(missing.status, 401, `${path} without token`)
    }

    const reg = await call('/auth/register', {
      method: 'POST',
      body: { email: `fin_usertok_${unique}@example.com`, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'North' },
    })
    assert.equal(reg.status, 201)
    for (const path of paths) {
      const asUser = await call(path, { token: reg.data.token })
      assert.equal(asUser.status, 403, `${path} with user token`)
    }
    const approveAsUser = await call(`/admin/deposits/${txId}/approve`, {
      method: 'POST', token: reg.data.token, body: {},
    })
    assert.equal(approveAsUser.status, 403)
    await prisma.user.deleteMany({ where: { email: `fin_usertok_${unique}@example.com` } })
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

// ---------------------------------------------------------- invalid input --

test('invalid filters and missing rejection reasons return 400', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'invalid')
  let txId
  try {
    txId = (await makeTx(prisma, user.id, {
      type: 'deposit', amount: 5, status: 'pending', reference: `INV-DEP-${unique}`,
    })).id

    const badStatus = await call('/admin/deposits?status=frozen', { token })
    assert.equal(badStatus.status, 400)
    const badType = await call('/admin/transactions?type=transfer', { token })
    assert.equal(badType.status, 400)
    const badDate = await call('/admin/transactions?from=not-a-date', { token })
    assert.equal(badDate.status, 400)

    const noReason = await call(`/admin/deposits/${txId}/reject`, {
      method: 'POST', token, body: {},
    })
    assert.equal(noReason.status, 400, 'rejection without reason must fail')
    const shortReason = await call(`/admin/deposits/${txId}/reject`, {
      method: 'POST', token, body: { reason: 'x' },
    })
    assert.equal(shortReason.status, 400)

    // The row must still be pending after the failed attempts.
    const row = await prisma.transaction.findUnique({ where: { id: txId } })
    assert.equal(row.status, 'pending')
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

// ------------------------------------------------ deposit approval flow ---

test('deposit approval credits the wallet exactly once; duplicates cannot', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'approve', { wallet: 0 })
  try {
    const tx = await makeTx(prisma, user.id, {
      type: 'deposit', amount: 250, status: 'pending', reference: `APPR-DEP-${unique}`,
    })

    const first = await call(`/admin/deposits/${tx.id}/approve`, { method: 'POST', token, body: {} })
    assert.equal(first.status, 200)
    assert.equal(first.data.deposit.status, 'completed')

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 250, 'wallet credited exactly the deposit amount')

    // Duplicate approval -> 409, wallet untouched.
    const dup = await call(`/admin/deposits/${tx.id}/approve`, { method: 'POST', token, body: {} })
    assert.equal(dup.status, 409)
    const after = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(after.balance, 250, 'duplicate approval must not double-credit')

    // Concurrent approvals: exactly one 200, wallet credited once total.
    const user2 = await makeUser(prisma, 'concurrent', { wallet: 0 })
    const tx2 = await makeTx(prisma, user2.id, {
      type: 'deposit', amount: 100, status: 'pending', reference: `CONC-DEP-${unique}`,
    })
    const results = await Promise.all([
      call(`/admin/deposits/${tx2.id}/approve`, { method: 'POST', token, body: {} }),
      call(`/admin/deposits/${tx2.id}/approve`, { method: 'POST', token, body: {} }),
    ])
    const ok = results.filter((r) => r.status === 200)
    const conflict = results.filter((r) => r.status === 409)
    assert.equal(ok.length, 1, 'exactly one concurrent approval succeeds')
    assert.equal(conflict.length, 1)
    const wallet2 = await prisma.wallet.findUnique({ where: { userId: user2.id } })
    assert.equal(wallet2.balance, 100, 'concurrent approvals credit exactly once')
    await prisma.user.delete({ where: { id: user2.id } }).catch(() => {})

    // Audit rows exist with the admin actor.
    const audits = await prisma.auditLog.findMany({
      where: { action: 'admin.deposit_approve', entityId: tx.id },
    })
    assert.equal(audits.length, 1)
    assert.equal(audits[0].actor, env.seed.adminEmail)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('deposit rejection never credits the wallet and records the reason', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'reject', { wallet: 40 })
  try {
    const tx = await makeTx(prisma, user.id, {
      type: 'deposit', amount: 75, status: 'pending', reference: `REJ-DEP-${unique}`,
    })

    const rejected = await call(`/admin/deposits/${tx.id}/reject`, {
      method: 'POST', token, body: { reason: 'payment not received (test)' },
    })
    assert.equal(rejected.status, 200)
    assert.equal(rejected.data.deposit.status, 'rejected')

    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 40, 'rejection must not credit the wallet')

    const row = await prisma.transaction.findUnique({ where: { id: tx.id } })
    assert.equal(row.rejectionReason, 'payment not received (test)')
    assert.equal(row.reviewedBy, env.seed.adminEmail)
    assert.ok(row.reviewedAt)

    // Rejecting an already-rejected row -> 409.
    const dup = await call(`/admin/deposits/${tx.id}/reject`, {
      method: 'POST', token, body: { reason: 'second attempt (test)' },
    })
    assert.equal(dup.status, 409)

    // Approving a rejected row -> 409, wallet still untouched.
    const approveAfter = await call(`/admin/deposits/${tx.id}/approve`, {
      method: 'POST', token, body: {},
    })
    assert.equal(approveAfter.status, 409)
    const still = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(still.balance, 40)

    const audits = await prisma.auditLog.findMany({
      where: { action: 'admin.deposit_reject', entityId: tx.id },
    })
    assert.equal(audits.length, 1)
    assert.equal(audits[0].details.outcome, 'rejected')
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

// ------------------------------------------------ withdrawal review flow ---

// Fixture mirrors the real funding model: createWithdrawal debits the wallet
// at request time, so a pending withdrawal row arrives with funds RESERVED.
async function makeReservedWithdrawal(prisma, user, amount, tag) {
  await prisma.wallet.update({
    where: { userId: user.id },
    data: { balance: { decrement: amount } },
  })
  return makeTx(prisma, user.id, {
    type: 'withdrawal',
    amount,
    status: 'pending',
    method: 'bank_transfer',
    reference: `WDR-${tag}-${unique}`,
    details: {
      accountHolder: 'Fin Test',
      bankName: 'Test Bank',
      accountNumberMasked: '****6789',
      routingCodeMasked: '****2468',
    },
  })
}

test('withdrawal rejection refunds the reserved amount exactly once', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'wdrreject', { wallet: 500 })
  try {
    const tx = await makeReservedWithdrawal(prisma, user, 120, 'REJ')
    // Wallet reflects the reservation before any admin action.
    let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 380)

    const rejected = await call(`/admin/withdrawals/${tx.id}/reject`, {
      method: 'POST', token, body: { reason: 'bank details could not be confirmed (test)' },
    })
    assert.equal(rejected.status, 200)
    assert.equal(rejected.data.withdrawal.status, 'rejected')

    wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 500, 'rejection refunds the reserved amount once')

    // Duplicate rejection -> 409, NO double refund.
    const dup = await call(`/admin/withdrawals/${tx.id}/reject`, {
      method: 'POST', token, body: { reason: 'second attempt (test)' },
    })
    assert.equal(dup.status, 409)
    wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 500, 'duplicate rejection must not double-refund')

    // Concurrent rejections: exactly one refund.
    const user2 = await makeUser(prisma, 'wdrconc', { wallet: 300 })
    const tx2 = await makeReservedWithdrawal(prisma, user2, 60, 'CONC')
    const results = await Promise.all([
      call(`/admin/withdrawals/${tx2.id}/reject`, { method: 'POST', token, body: { reason: 'concurrent test a' } }),
      call(`/admin/withdrawals/${tx2.id}/reject`, { method: 'POST', token, body: { reason: 'concurrent test b' } }),
    ])
    assert.equal(results.filter((r) => r.status === 200).length, 1, 'one concurrent rejection wins')
    assert.equal(results.filter((r) => r.status === 409).length, 1)
    const wallet2 = await prisma.wallet.findUnique({ where: { userId: user2.id } })
    assert.equal(wallet2.balance, 300, 'exactly one refund across concurrent rejections')
    await prisma.user.delete({ where: { id: user2.id } }).catch(() => {})
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('withdrawal approval marks processing without touching the wallet', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'wdrapprove', { wallet: 800 })
  try {
    const tx = await makeReservedWithdrawal(prisma, user, 200, 'APPR')
    // Wallet already reflects the reservation (800 - 200).
    let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 600)

    const approved = await call(`/admin/withdrawals/${tx.id}/approve`, { method: 'POST', token, body: {} })
    assert.equal(approved.status, 200)
    assert.equal(approved.data.withdrawal.status, 'processing', 'approval = approved for manual transfer')
    assert.equal(approved.data.withdrawal.reviewedBy, env.seed.adminEmail)

    wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 600, 'approval must not move money again')

    // Duplicate approval -> 409.
    const dup = await call(`/admin/withdrawals/${tx.id}/approve`, { method: 'POST', token, body: {} })
    assert.equal(dup.status, 409)

    // Rejecting an approved (processing) withdrawal still refunds once.
    const rejected = await call(`/admin/withdrawals/${tx.id}/reject`, {
      method: 'POST', token, body: { reason: 'transfer aborted (test)' },
    })
    assert.equal(rejected.status, 200)
    wallet = await prisma.wallet.findUnique({ where: { userId: user.id } })
    assert.equal(wallet.balance, 800, 'rejecting after approval refunds the reservation once')
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

// ------------------------------------------------------- ledger + export ---

test('ledger filters, search, pagination and detail work', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'ledger', { wallet: 10 })
  try {
    await makeTx(prisma, user.id, {
      type: 'deposit', amount: 11, status: 'pending', reference: `LEDGER-DEP-${unique}`,
    })
    await makeTx(prisma, user.id, {
      type: 'withdrawal', amount: 22, status: 'completed', reference: `LEDGER-WDR-${unique}`,
    })

    const all = await call('/admin/transactions?pageSize=100', { token })
    assert.equal(all.status, 200)
    const mine = all.data.transactions.filter((row) => row.userId === user.id)
    assert.equal(mine.length, 2)

    const byType = await call('/admin/transactions?type=deposit&pageSize=100', { token })
    assert.ok(byType.data.transactions.every((row) => row.type === 'deposit'))

    const byStatus = await call('/admin/transactions?status=completed&pageSize=100', { token })
    assert.ok(byStatus.data.transactions.every((row) => row.status === 'completed'))

    const byRef = await call(`/admin/transactions?query=LEDGER-WDR-${unique}`, { token })
    assert.equal(byRef.data.total, 1)
    assert.equal(byRef.data.transactions[0].reference, `LEDGER-WDR-${unique}`)

    const byEmail = await call(`/admin/transactions?query=fin_ledger_${unique}`, { token })
    assert.ok(byEmail.data.total >= 2, 'search matches user email')

    const paged = await call('/admin/transactions?page=1&pageSize=1', { token })
    assert.equal(paged.data.transactions.length, 1)
    assert.ok(paged.data.total >= 2)

    const detail = await call(`/admin/transactions/${paged.data.transactions[0].id}`, { token })
    assert.equal(detail.status, 200)
    assert.ok(detail.data.transaction.user.email)

    const missing = await call('/admin/transactions/does-not-exist', { token })
    assert.equal(missing.status, 404)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})

test('CSV export is admin-only, filtered and bounded', { skip: !adminAvailable }, async () => {
  const token = await ensureAdminToken()
  const response = await fetch(`${base}/api/admin/transactions/export.csv?type=deposit`, {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/csv/)
  assert.match(response.headers.get('content-disposition'), /attachment/)

  const text = await response.text()
  const lines = text.split('\n')
  assert.ok(lines[0].includes('reference'), 'header row present')
  assert.ok(lines[0].includes('amount_inr'))
  // Every data line is a deposit (filter honored).
  for (const line of lines.slice(1)) {
    assert.match(line, /,deposit,/, 'export honors the type filter')
  }

  // Invalid filters also 400 on the export route.
  const bad = await fetch(`${base}/api/admin/transactions/export.csv?status=frozen`, {
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(bad.status, 400)
})

test('deposit/withdrawal lists filter by status and never leak secrets', { skip: !adminAvailable }, async () => {
  const prisma = await getPrisma()
  const token = await ensureAdminToken()
  const user = await makeUser(prisma, 'lists', { wallet: 100 })
  try {
    await makeTx(prisma, user.id, {
      type: 'deposit', amount: 33, status: 'pending', reference: `LIST-DEP-${unique}`,
    })
    await makeReservedWithdrawal(prisma, user, 15, 'LIST')

    const pending = await call('/admin/deposits?status=pending&pageSize=100', { token })
    assert.equal(pending.status, 200)
    assert.ok(pending.data.deposits.every((row) => row.status === 'pending'))
    assert.ok(pending.data.deposits.some((row) => row.reference === `LIST-DEP-${unique}`))

    const approved = await call('/admin/deposits?status=completed&pageSize=100', { token })
    assert.ok(approved.data.deposits.every((row) => row.status === 'completed'))

    const wdrs = await call(`/admin/withdrawals?query=fin_lists_${unique}`, { token })
    assert.equal(wdrs.data.total, 1)
    const wdr = wdrs.data.withdrawals[0]
    // Masked values only — the API never receives or returns full account
    // numbers (creation masks them; the list can only echo masked fields).
    assert.equal(wdr.details.accountNumberMasked, '****6789')
    assert.equal(wdr.details.accountNumber, undefined)

    // Detail endpoints 404 on the wrong type (deposit id via withdrawals).
    const depId = pending.data.deposits.find((row) => row.reference === `LIST-DEP-${unique}`).id
    const wrongType = await call(`/admin/withdrawals/${depId}`, { token })
    assert.equal(wrongType.status, 404)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
})
