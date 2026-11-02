// Finance/account API tests — dashboard summary, deposits and withdrawals.
// node:test, no extra dependencies. Runs against the local dev database.
//
// The wallet row created below is a TEST FIXTURE standing in for a
// previously verified deposit (no payment provider exists to create one
// through the API). The API itself must never credit balances on its own —
// that is asserted explicitly in the deposit tests.

process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')
const { getPrisma } = await import('../src/config/prisma.js')

let server
let base = ''
const unique = Date.now().toString(36)
let userToken = ''
let userId = ''
const testEmail = `finance-${unique}@example.com`

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

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`

  const registered = await call('/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: 'password123', name: 'Finance Tester', securityQuestion: 'First school?', securityAnswer: 'North' },
  })
  if (registered.status !== 201) {
    throw new Error(`setup: register failed: ${registered.status}`)
  }
  userToken = registered.data.token
  userId = registered.data.user.id
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

// ------------------------------------------------------------------ summary

test('finance endpoints require a user token', async () => {
  for (const path of ['/dashboard/summary', '/transactions', '/holdings']) {
    const { status } = await call(path)
    assert.equal(status, 401, `${path} must reject anonymous calls`)
  }
  const deposit = await call('/deposits', {
    method: 'POST',
    body: { amount: 10, method: 'bank_transfer' },
  })
  assert.equal(deposit.status, 401)
  const withdrawal = await call('/withdrawals', {
    method: 'POST',
    body: { amount: 10, bankDetails: {} },
  })
  assert.equal(withdrawal.status, 401)
})

test('GET /api/dashboard/summary returns genuine zeros for a user with no records', async () => {
  const { status, data } = await call('/dashboard/summary', { token: userToken })
  assert.equal(status, 200)
  assert.equal(data.cashBalance, 0)
  assert.equal(data.invested, 0)
  assert.equal(data.portfolioValue, 0)
  assert.equal(data.todayPnl, 0)
  assert.equal(data.todayPnlPct, 0)
  assert.equal(data.totalPnl, 0)
  assert.equal(data.totalPnlPct, 0)
  assert.equal(data.currency, 'INR')
})

test('GET /api/transactions and /api/holdings start empty and are user-scoped', async () => {
  const tx = await call('/transactions', { token: userToken })
  assert.equal(tx.status, 200)
  assert.deepEqual(tx.data.data, [])

  const holdings = await call('/holdings', { token: userToken })
  assert.equal(holdings.status, 200)
  assert.deepEqual(holdings.data.data, [])
})

// ----------------------------------------------------------------- deposits

test('POST /api/deposits validates amount and method', async () => {
  const cases = [
    { amount: 0, method: 'bank_transfer' },
    { amount: -25, method: 'bank_transfer' },
    { amount: 10.999, method: 'bank_transfer' },
    { amount: '100', method: 'bank_transfer' },
    { amount: 100, method: 'credit_card' },
    { amount: 100 },
  ]
  for (const body of cases) {
    const { status, data } = await call('/deposits', {
      method: 'POST',
      token: userToken,
      body,
    })
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(body)}`)
    assert.ok(data.error)
  }
})

test('POST /api/deposits records a pending request and NEVER credits the balance', async () => {
  const { status, data } = await call('/deposits', {
    method: 'POST',
    token: userToken,
    body: { amount: 500, method: 'bank_transfer' },
  })
  assert.equal(status, 201)
  assert.equal(data.status, 'pending')
  assert.equal(data.transaction.type, 'deposit')
  assert.equal(data.transaction.amount, 500)
  assert.ok(data.transaction.reference?.startsWith('XPO-DEP-'))

  // No verified payment → balance must not move.
  const summary = await call('/dashboard/summary', { token: userToken })
  assert.equal(summary.data.cashBalance, 0, 'deposit must not credit the wallet')

  const tx = await call('/transactions', { token: userToken })
  assert.equal(tx.data.data.length, 1)
  assert.equal(tx.data.data[0].status, 'pending')
})

// -------------------------------------------------------------- withdrawals

test('POST /api/withdrawals requires bank details and valid amount', async () => {
  const missing = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: { amount: 10 },
  })
  assert.equal(missing.status, 400)

  const badAccount = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: {
      amount: 10,
      bankDetails: {
        accountHolder: 'Finance Tester',
        accountNumber: 'abc',
        routingCode: '123456789',
        bankName: 'Test Bank',
      },
    },
  })
  assert.equal(badAccount.status, 400)

  const badAmount = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: {
      amount: -1,
      bankDetails: {
        accountHolder: 'Finance Tester',
        accountNumber: '1234567890',
        routingCode: '123456789',
        bankName: 'Test Bank',
      },
    },
  })
  assert.equal(badAmount.status, 400)
})

test('POST /api/withdrawals rejects withdrawals beyond the backend balance', async () => {
  const { status, data } = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: {
      amount: 25,
      bankDetails: {
        accountHolder: 'Finance Tester',
        accountNumber: '1234567890',
        routingCode: '123456789',
        bankName: 'Test Bank',
      },
    },
  })
  assert.equal(status, 400)
  assert.match(data.error, /Insufficient balance/)
})

test('POST /api/withdrawals reserves funds atomically and masks bank details', async () => {
  // TEST FIXTURE: simulate a previously verified deposit (the API has no
  // flow that can create balances on its own — by design).
  const prisma = await getPrisma()
  await prisma.wallet.upsert({
    where: { userId },
    update: { balance: 100 },
    create: { userId, balance: 100 },
  })

  const before = await call('/dashboard/summary', { token: userToken })
  assert.equal(before.data.cashBalance, 100)

  const { status, data } = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: {
      amount: 40.5,
      bankDetails: {
        accountHolder: 'Finance Tester',
        accountNumber: '1234567890',
        routingCode: '123456789',
        bankName: 'Test Bank',
      },
    },
  })
  assert.equal(status, 201)
  assert.equal(data.status, 'pending')
  assert.equal(data.transaction.type, 'withdrawal')
  assert.ok(data.transaction.reference?.startsWith('XPO-WDR-'))

  // Masked only — the full account/routing numbers are never persisted.
  const stored = await prisma.transaction.findUnique({
    where: { id: data.transaction.id },
  })
  assert.equal(stored.details.accountNumberMasked, '****7890')
  assert.equal(stored.details.routingCodeMasked, '****6789')
  assert.ok(!JSON.stringify(stored.details).includes('1234567890'))

  const afterSummary = await call('/dashboard/summary', { token: userToken })
  assert.equal(afterSummary.data.cashBalance, 59.5, 'balance must be debited')

  // A second withdrawal beyond the remaining balance must fail.
  const overdraw = await call('/withdrawals', {
    method: 'POST',
    token: userToken,
    body: {
      amount: 59.51,
      bankDetails: {
        accountHolder: 'Finance Tester',
        accountNumber: '1234567890',
        routingCode: '123456789',
        bankName: 'Test Bank',
      },
    },
  })
  assert.equal(overdraw.status, 400)
})
