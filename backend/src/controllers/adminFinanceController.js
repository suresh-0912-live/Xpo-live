// Admin finance API — deposit review, withdrawal review and the cross-user
// transaction ledger (Part 3).
//
// XPO's funding model (enforced, never assumed):
//   * Deposits are created as `pending` Transaction rows; the wallet is NOT
//     credited at request time (no payment provider is connected). Admin
//     approval IS the manual verification step: it atomically moves the row
//     from `pending` and credits the wallet exactly once. Nothing here claims
//     an automated payment check happened — the approving admin asserts they
//     verified the bank transfer out of band.
//   * Withdrawals debit (reserve) the wallet at request time. Approval marks
//     the request `processing` for a MANUAL bank transfer — there is no payout
//     provider, so approval never claims an external payout succeeded.
//     Rejection refunds the reserved amount exactly once.
//   * Every decision runs in one DB transaction with an atomic status guard
//     (`updateMany` on the current status), so duplicate or concurrent
//     requests cannot double-credit, double-refund, or double-review. The
//     AuditLog row is written inside the same transaction: a financial change
//     without an audit trail must not persist.
//   * Only masked bank details are ever stored (see finance.controller.js) and
//     only admins holding a valid, active admin row may reach these routes.

import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getPrisma } from '../config/prisma.js'
import { getPagination } from '../utils/pagination.js'
import { retryOnInconsistentResult } from '../utils/prismaRetry.js'

// Statuses a Transaction can hold (schema default is 'pending').
const TX_STATUSES = ['pending', 'processing', 'completed', 'failed', 'rejected']
const TX_TYPES = ['deposit', 'withdrawal']

// CSV export cap — the export is bounded server-side no matter what the
// client asks for; the response is flagged when the cap truncates it.
const EXPORT_MAX_ROWS = 5000

const money = (value) => Math.round(value * 100) / 100

// Explicit field selection — list rows never serialize `details` (masked bank
// data lives there); the detail endpoints below return it deliberately.
const TX_SELECT = {
  id: true,
  userId: true,
  type: true,
  amount: true,
  status: true,
  method: true,
  reference: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, name: true } },
}

// Shared list filter: ?status= &query= (user email/name or reference)
// &from= &to= (YYYY-MM-DD, ledger only). Throws 400 on invalid values.
function buildTxWhere(query, { allowDateRange = false } = {}) {
  const where = {}
  const status = (query.status || '').trim()
  const type = (query.type || '').trim()
  const search = (query.query || '').trim()

  if (status) {
    if (!TX_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter')
    where.status = status
  }
  if (type) {
    if (!TX_TYPES.includes(type)) throw ApiError.badRequest('Invalid type filter')
    where.type = type
  }
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { user: { OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ] } },
    ]
  }

  if (allowDateRange) {
    const from = parseDay(query.from, 'from', false)
    const to = parseDay(query.to, 'to', true)
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }
  }
  return where
}

// 'YYYY-MM-DD' -> Date (start or end of day UTC); absent -> null.
function parseDay(value, field, endOfDay) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest('Invalid date filter', [`${field} must be YYYY-MM-DD`])
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Invalid date filter', [`${field} is not a real date`])
  }
  if (endOfDay) date.setUTCHours(23, 59, 59, 999)
  return date
}

// Fetch a single deposit/withdrawal row for review, or 404. The `type` guard
// stops a withdrawal id from being reviewed through the deposits endpoints
// (and vice versa).
async function findReviewable(prisma, type, id) {
  const row = await retryOnInconsistentResult(() =>
    prisma.transaction.findUnique({
      where: { id },
      select: { ...TX_SELECT, details: true },
    }),
  )
  if (!row || row.type !== type) {
    throw ApiError.notFound(type === 'deposit' ? 'Deposit not found' : 'Withdrawal not found')
  }
  return row
}

// --------------------------------------------------------------- deposits --

// GET /api/admin/deposits?status=&query=&page=&pageSize=
export const listDeposits = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query)
  const where = { type: 'deposit', ...buildTxWhere(req.query) }

  const [total, deposits] = await Promise.all([
    prisma.transaction.count({ where }),
    retryOnInconsistentResult(() =>
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: TX_SELECT,
      }),
    ),
  ])

  res.json({ deposits, total, page, pageSize })
})

// GET /api/admin/deposits/:id — full detail incl. the (masked-only) details
// JSON. XPO stores no payment proof, so none is shown or invented here.
export const getDepositDetail = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const deposit = await findReviewable(prisma, 'deposit', req.params.id)
  res.json({ deposit })
})

// POST /api/admin/deposits/:id/approve — manual verification outcome.
// Atomically: pending -> completed + wallet credit exactly once + audit row.
export const approveDeposit = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    // Atomic guard: only a still-pending row can be approved. A concurrent
    // or repeated approval matches zero rows -> 409, and no credit happens.
    const claimed = await tx.transaction.updateMany({
      where: { id: req.params.id, type: 'deposit', status: 'pending' },
      data: { status: 'completed', reviewedBy: req.auth.email, reviewedAt: now },
    })
    if (claimed.count === 0) {
      const existing = await tx.transaction.findUnique({
        where: { id: req.params.id },
        select: { type: true, status: true },
      })
      if (!existing || existing.type !== 'deposit') {
        throw ApiError.notFound('Deposit not found')
      }
      throw ApiError.conflict('Deposit was already processed', { status: existing.status })
    }

    const row = await tx.transaction.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, amount: true, reference: true, status: true },
    })

    // Credit the wallet exactly once (upsert covers users with no wallet yet).
    await tx.wallet.upsert({
      where: { userId: row.userId },
      create: { userId: row.userId, balance: money(row.amount), currency: 'INR' },
      update: { balance: { increment: money(row.amount) } },
    })

    await tx.auditLog.create({
      data: {
        action: 'admin.deposit_approve',
        actor: req.auth.email,
        actorRole: req.auth.role,
        entityType: 'transaction',
        entityId: row.id,
        details: { reference: row.reference, amount: row.amount, outcome: 'wallet_credited' },
        ip: req.ip,
      },
    })

    return row
  })

  res.json({
    deposit: result,
    message:
      'Deposit approved and wallet credited once. No automated payment verification exists — this records your manual verification of the bank transfer.',
  })
})

// POST /api/admin/deposits/:id/reject — { reason }. No wallet credit.
export const rejectDeposit = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { reason } = req.body
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: req.params.id, type: 'deposit', status: 'pending' },
      data: { status: 'rejected', reviewedBy: req.auth.email, reviewedAt: now, rejectionReason: reason },
    })
    if (claimed.count === 0) {
      const existing = await tx.transaction.findUnique({
        where: { id: req.params.id },
        select: { type: true, status: true },
      })
      if (!existing || existing.type !== 'deposit') {
        throw ApiError.notFound('Deposit not found')
      }
      throw ApiError.conflict('Deposit was already processed', { status: existing.status })
    }

    const row = await tx.transaction.findUnique({
      where: { id: req.params.id },
      select: { id: true, reference: true, amount: true, status: true, rejectionReason: true },
    })

    await tx.auditLog.create({
      data: {
        action: 'admin.deposit_reject',
        actor: req.auth.email,
        actorRole: req.auth.role,
        entityType: 'transaction',
        entityId: row.id,
        details: { reference: row.reference, amount: row.amount, outcome: 'rejected', reason },
        ip: req.ip,
      },
    })

    return row
  })

  res.json({ deposit: result, message: 'Deposit rejected. No wallet credit was made.' })
})

// ------------------------------------------------------------ withdrawals --

// GET /api/admin/withdrawals?status=&query=&page=&pageSize=
export const listWithdrawals = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query)
  const where = { type: 'withdrawal', ...buildTxWhere(req.query) }

  const [total, withdrawals] = await Promise.all([
    prisma.transaction.count({ where }),
    retryOnInconsistentResult(() =>
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        // `details` holds ONLY masked account data (enforced at creation);
        // including it here lets the list show masked numbers to admins.
        select: { ...TX_SELECT, details: true },
      }),
    ),
  ])

  res.json({ withdrawals, total, page, pageSize })
})

// GET /api/admin/withdrawals/:id — detail incl. masked bank details.
export const getWithdrawalDetail = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const withdrawal = await findReviewable(prisma, 'withdrawal', req.params.id)
  res.json({ withdrawal })
})

// POST /api/admin/withdrawals/:id/approve — funds stay reserved (already
// debited at request time); status becomes `processing` for the MANUAL bank
// transfer. No payout provider exists, so this never claims money was sent.
export const approveWithdrawal = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: req.params.id, type: 'withdrawal', status: 'pending' },
      data: { status: 'processing', reviewedBy: req.auth.email, reviewedAt: now },
    })
    if (claimed.count === 0) {
      const existing = await tx.transaction.findUnique({
        where: { id: req.params.id },
        select: { type: true, status: true },
      })
      if (!existing || existing.type !== 'withdrawal') {
        throw ApiError.notFound('Withdrawal not found')
      }
      throw ApiError.conflict('Withdrawal was already processed', { status: existing.status })
    }

    const row = await tx.transaction.findUnique({
      where: { id: req.params.id },
      select: { id: true, reference: true, amount: true, status: true, reviewedBy: true, reviewedAt: true },
    })

    await tx.auditLog.create({
      data: {
        action: 'admin.withdrawal_approve',
        actor: req.auth.email,
        actorRole: req.auth.role,
        entityType: 'transaction',
        entityId: row.id,
        details: { reference: row.reference, amount: row.amount, outcome: 'approved_manual_transfer' },
        ip: req.ip,
      },
    })

    return row
  })

  res.json({
    withdrawal: result,
    message:
      'Withdrawal approved for manual bank transfer. Reserved funds stay debited; XPO has no payout provider, so no external transfer was executed by this action.',
  })
})

// POST /api/admin/withdrawals/:id/reject — { reason }. Refunds the reserved
// amount exactly once (atomic status guard: pending|processing -> rejected).
export const rejectWithdrawal = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { reason } = req.body
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: req.params.id, type: 'withdrawal', status: { in: ['pending', 'processing'] } },
      data: { status: 'rejected', reviewedBy: req.auth.email, reviewedAt: now, rejectionReason: reason },
    })
    if (claimed.count === 0) {
      const existing = await tx.transaction.findUnique({
        where: { id: req.params.id },
        select: { type: true, status: true },
      })
      if (!existing || existing.type !== 'withdrawal') {
        throw ApiError.notFound('Withdrawal not found')
      }
      throw ApiError.conflict('Withdrawal was already processed', { status: existing.status })
    }

    const row = await tx.transaction.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, reference: true, amount: true, status: true, rejectionReason: true },
    })

    // Refund the reserved funds exactly once (same guard as above: only the
    // request that flipped the status reaches this line).
    await tx.wallet.update({
      where: { userId: row.userId },
      data: { balance: { increment: money(row.amount) } },
    })

    await tx.auditLog.create({
      data: {
        action: 'admin.withdrawal_reject',
        actor: req.auth.email,
        actorRole: req.auth.role,
        entityType: 'transaction',
        entityId: row.id,
        details: { reference: row.reference, amount: row.amount, outcome: 'refunded', reason },
        ip: req.ip,
      },
    })

    return row
  })

  res.json({ withdrawal: result, message: 'Withdrawal rejected and the reserved amount refunded once.' })
})

// ------------------------------------------------------------- ledger ------

// GET /api/admin/transactions?type=&status=&query=&from=&to=&page=&pageSize=
export const listAllTransactions = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query)
  const where = buildTxWhere(req.query, { allowDateRange: true })

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    retryOnInconsistentResult(() =>
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: TX_SELECT,
      }),
    ),
  ])

  res.json({ transactions, total, page, pageSize })
})

// GET /api/admin/transactions/:id — detail incl. details JSON + user.
export const getTransactionDetail = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const transaction = await retryOnInconsistentResult(() =>
    prisma.transaction.findUnique({
      where: { id: req.params.id },
      select: { ...TX_SELECT, details: true },
    }),
  )
  if (!transaction) throw ApiError.notFound('Transaction not found')
  res.json({ transaction })
})

// CSV cell escaping (RFC 4180): quote when needed, double inner quotes.
function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// GET /api/admin/transactions/export.csv — same filters as the ledger,
// admin-JWT protected (router-level requireAdmin), capped at EXPORT_MAX_ROWS
// rows server-side. Read-only export of existing rows: it never fabricates
// history and never mutates any balance.
export const exportTransactionsCsv = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const where = buildTxWhere(req.query, { allowDateRange: true })

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    retryOnInconsistentResult(() =>
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: EXPORT_MAX_ROWS,
        select: TX_SELECT,
      }),
    ),
  ])

  const header = [
    'id', 'reference', 'type', 'amount_inr', 'status', 'method',
    'user_email', 'user_name', 'reviewed_by', 'reviewed_at',
    'rejection_reason', 'created_at',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push([
      csvCell(row.id),
      csvCell(row.reference),
      csvCell(row.type),
      csvCell(row.amount),
      csvCell(row.status),
      csvCell(row.method),
      csvCell(row.user?.email),
      csvCell(row.user?.name),
      csvCell(row.reviewedBy),
      csvCell(row.reviewedAt ? row.reviewedAt.toISOString() : ''),
      csvCell(row.rejectionReason),
      csvCell(row.createdAt.toISOString()),
    ].join(','))
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="xpo-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
  )
  res.setHeader('X-Export-Total', String(total))
  res.setHeader('X-Export-Rows', String(rows.length))
  res.setHeader('X-Export-Truncated', String(rows.length < total))
  res.send(lines.join('\n'))
})