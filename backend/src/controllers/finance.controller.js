// Account/finance API — dashboard summary, transaction/holding lists and the
// deposit / withdrawal request flows.
//
// Rules enforced here:
//   * Every query is scoped to `req.auth.sub` (the authenticated user).
//   * Balances are NEVER credited without a verified payment. There is no
//     payment provider connected yet, so deposits are recorded as `pending`
//     and do not move money; only a future verification flow may complete
//     them.
//   * Withdrawals atomically check + reserve funds from the wallet balance
//     and store masked bank details only (never full account numbers).
//   * Users with no records get genuine zeros from empty aggregation — the
//     API never substitutes sample/demo values. DB failures propagate to the
//     central error handler (500), so the UI can show an unavailable state.

import crypto from 'node:crypto'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getPrisma } from '../config/prisma.js'

// Supported deposit payment methods. No payment provider (card/gateway) is
// connected, so bank transfer is the only accepted method today — keep the
// frontend list (src/api/finance.js DEPOSIT_METHODS) in sync.
export const DEPOSIT_METHODS = ['bank_transfer']

const MAX_AMOUNT = 1_000_000
const BANK_FIELDS = ['accountHolder', 'accountNumber', 'routingCode', 'bankName']

const money = (value) => Math.round(value * 100) / 100
const pct = (numerator, denominator) =>
  denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0

// Amount rules shared by deposits and withdrawals: positive, finite,
// at most 2 decimal places, sane upper bound. `validateBody` only checks
// type/presence for numbers, so range checks live here.
function assertAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Validation failed', ['amount must be greater than 0'])
  }
  if (amount > MAX_AMOUNT) {
    throw ApiError.badRequest('Validation failed', [
      `amount must be at most ${MAX_AMOUNT.toLocaleString('en-IN')}`,
    ])
  }
  if (Math.round(amount * 100) / 100 !== amount) {
    throw ApiError.badRequest('Validation failed', [
      'amount supports at most 2 decimal places',
    ])
  }
}

function reference(prefix) {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `XPO-${prefix}-${suffix}`
}

function mask(value) {
  return `****${String(value).slice(-4)}`
}

// GET /api/dashboard/summary — cash, invested, today's P/L and total P/L
// for the authenticated user. Missing wallet/holdings mean genuine zeros.
export const getSummary = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const userId = req.auth.sub

  const [wallet, holdings] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.holding.findMany({ where: { userId } }),
  ])

  let invested = 0
  let currentValue = 0
  let prevCloseValue = 0
  for (const holding of holdings) {
    invested += holding.investedAmount
    currentValue += holding.currentValue
    prevCloseValue += holding.prevCloseValue
  }

  const cashBalance = wallet ? wallet.balance : 0
  const todayPnl = currentValue - prevCloseValue
  const totalPnl = currentValue - invested

  res.json({
    cashBalance: money(cashBalance),
    invested: money(invested),
    portfolioValue: money(cashBalance + currentValue),
    todayPnl: money(todayPnl),
    todayPnlPct: pct(todayPnl, prevCloseValue),
    totalPnl: money(totalPnl),
    totalPnlPct: pct(totalPnl, invested),
    currency: wallet ? wallet.currency : 'INR',
  })
})

// GET /api/transactions?limit= — recent user-scoped ledger rows.
export const listTransactions = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const requested = Number(req.query.limit)
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), 50)
    : 10

  const data = await prisma.transaction.findMany({
    where: { userId: req.auth.sub },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  res.json({ data })
})

// GET /api/holdings — user investment positions (empty until investment
// execution is connected).
export const listHoldings = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const data = await prisma.holding.findMany({
    where: { userId: req.auth.sub },
    orderBy: { createdAt: 'asc' },
  })
  res.json({ data })
})

// POST /api/deposits — record a deposit REQUEST. Status stays `pending`;
// the wallet balance is deliberately untouched (no verified payment yet).
export const createDeposit = asyncHandler(async (req, res) => {
  const { amount, method } = req.body
  assertAmount(amount)

  const prisma = await getPrisma()
  const transaction = await prisma.transaction.create({
    data: {
      userId: req.auth.sub,
      type: 'deposit',
      amount: money(amount),
      status: 'pending',
      method,
      reference: reference('DEP'),
      details: { creditPolicy: 'manual_verification' },
    },
  })

  res.status(201).json({
    transaction,
    status: 'pending',
    message:
      'Deposit request created. Your balance is credited only after the payment is verified.',
  })
})

// POST /api/withdrawals — reserve funds atomically (balance check + debit in
// one transaction) and record a pending withdrawal with masked bank details.
export const createWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body
  assertAmount(amount)

  const errors = []
  if (!bankDetails || typeof bankDetails !== 'object') {
    errors.push('bankDetails is required')
  } else {
    for (const field of BANK_FIELDS) {
      const value = bankDetails[field]
      if (typeof value !== 'string' || value.trim().length < 2) {
        errors.push(`${field} is required`)
      }
    }
    if (
      !errors.includes('accountNumber') &&
      !/^[0-9A-Za-z]{6,34}$/.test(bankDetails.accountNumber ?? '')
    ) {
      errors.push('accountNumber must be 6-34 letters or digits')
    }
    if (
      !errors.includes('routingCode') &&
      !/^[0-9A-Za-z-]{3,20}$/.test(bankDetails.routingCode ?? '')
    ) {
      errors.push('routingCode must be 3-20 letters, digits or dashes')
    }
  }
  if (errors.length) throw ApiError.badRequest('Validation failed', errors)

  const prisma = await getPrisma()
  const userId = req.auth.sub
  const masked = {
    accountHolder: bankDetails.accountHolder.trim(),
    bankName: bankDetails.bankName.trim(),
    accountNumberMasked: mask(bankDetails.accountNumber.trim()),
    routingCodeMasked: mask(bankDetails.routingCode.trim()),
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // Atomic guard: only debits when the balance covers the amount, so
    // concurrent requests can't overdraw the wallet.
    const updated = await tx.wallet.updateMany({
      where: { userId, balance: { gte: money(amount) } },
      data: { balance: { decrement: money(amount) } },
    })
    if (updated.count === 0) {
      throw ApiError.badRequest('Insufficient balance for this withdrawal')
    }
    return tx.transaction.create({
      data: {
        userId,
        type: 'withdrawal',
        amount: money(amount),
        status: 'pending',
        method: 'bank_transfer',
        reference: reference('WDR'),
        details: masked,
      },
    })
  })

  res.status(201).json({
    transaction,
    status: 'pending',
    message:
      'Withdrawal requested. Funds are reserved until the transfer is processed.',
  })
})
