import { getPrisma } from '../config/prisma.js'
import env from '../config/env.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getPagination } from '../utils/pagination.js'
import { getStatus } from '../services/status.service.js'
import { getTodayUsage, getMonthlyUsage, getUsageSummary } from '../services/usage.service.js'
import { getLastMarketUpdate } from '../services/market.service.js'
import { getSchedulerStatus, runForexFetch } from '../jobs/forexScheduler.js'
import { writeAuditLog } from '../services/log.service.js'
import { retryOnInconsistentResult } from '../utils/prismaRetry.js'

// Statuses a Transaction can hold (schema default is 'pending').
const TX_STATUSES = ['pending', 'processing', 'completed', 'failed', 'rejected']

// groupBy rows -> { total, byStatus } with every known status present.
function txSummary(rows, type) {
  const byStatus = Object.fromEntries(TX_STATUSES.map((status) => [status, 0]))
  let total = 0
  for (const row of rows) {
    if (row.type !== type) continue
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row._count._all
    total += row._count._all
  }
  return { total, byStatus }
}

// Explicit field selection — never serializes password hashes or details.
const TX_SELECT = {
  id: true,
  type: true,
  amount: true,
  status: true,
  method: true,
  reference: true,
  createdAt: true,
  userId: true,
}

// GET /api/admin/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    status,
    todayApiRequests,
    monthlyApiRequests,
    lastMarketUpdate,
    txGroups,
    walletGroups,
    holdingsAgg,
    recentTransactions,
    marketTotal,
    marketActive,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'active' } }),
    prisma.user.count({ where: { status: 'suspended' } }),
    getStatus(),
    getTodayUsage('ibrlive'),
    getMonthlyUsage('ibrlive'),
    getLastMarketUpdate(),
    prisma.transaction.groupBy({ by: ['type', 'status'], _count: { _all: true } }),
    prisma.wallet.groupBy({
      by: ['currency'],
      _sum: { balance: true },
      _count: { _all: true },
    }),
    prisma.holding.aggregate({
      _sum: { investedAmount: true, currentValue: true },
      _count: { _all: true },
    }),
    // User relation is loaded in a second query — retry once if a concurrent
    // fixture cleanup deletes a user mid-read ("Inconsistent query result").
    retryOnInconsistentResult(() =>
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { ...TX_SELECT, user: { select: { email: true, name: true } } },
      }),
    ),
    prisma.market.count(),
    prisma.market.count({ where: { active: true } }),
  ])

  res.json({
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
    finance: {
      deposits: txSummary(txGroups, 'deposit'),
      withdrawals: txSummary(txGroups, 'withdrawal'),
      // Aggregate wallet balances: sum of all user wallet balances (available
      // cash), grouped by currency. Accounts = wallet rows in that currency.
      wallets: walletGroups.map((group) => ({
        currency: group.currency,
        total: group._sum.balance ?? 0,
        accounts: group._count._all,
      })),
      holdings: {
        positions: holdingsAgg._count._all,
        invested: holdingsAgg._sum.investedAmount ?? 0,
        currentValue: holdingsAgg._sum.currentValue ?? 0,
      },
    },
    recentTransactions,
    markets: { total: marketTotal, active: marketActive },
    providers: {
      forex: status.providers.forex,
      crypto: status.providers.crypto,
    },
    api: {
      todayRequests: todayApiRequests,
      monthlyRequests: monthlyApiRequests,
      monthlyLimit: env.forex.monthlyRequestLimit,
      warningThreshold: env.forex.warningThreshold,
      warning: monthlyApiRequests >= env.forex.warningThreshold,
    },
    scheduler: getSchedulerStatus(),
    lastMarketUpdate,
    backend: status.backend,
    database: status.database,
  })
})

// GET /api/admin/users?query=&status=&page=&pageSize=
export const listUsers = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query)
  const query = (req.query.query || '').trim()
  const status = (req.query.status || '').trim()

  if (status && !['active', 'suspended'].includes(status)) {
    throw ApiError.badRequest('Invalid status filter')
  }

  const where = {}
  if (status) where.status = status
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ]
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
  ])

  res.json({ users, total, page, pageSize })
})

// Why a permanent delete is unsafe right now (empty list = allowed). Shared
// by the detail endpoint (UI hint) and the DELETE handler (enforcement).
// Policy: deletion is only ever permitted for accounts with NO financial
// footprint at all — any transaction, holding or non-zero balance blocks it.
// Suspension is the supported alternative; financial history always wins.
async function deletionBlockers(prisma, userId) {
  const [txCount, pendingCount, holdingCount, wallet] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId, status: { in: ['pending', 'processing'] } } }),
    prisma.holding.count({ where: { userId } }),
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
  ])

  const blockers = []
  if (pendingCount > 0) blockers.push(`${pendingCount} unresolved deposit/withdrawal request(s)`)
  if (wallet && wallet.balance !== 0) blockers.push('wallet balance is not zero')
  if (txCount > 0) blockers.push('transaction history exists')
  if (holdingCount > 0) blockers.push('holdings exist')
  return blockers
}

// GET /api/admin/users/:id — profile, wallet, summaries, recent activity.
export const getUserDetail = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  })
  if (!user) throw ApiError.notFound('User not found')

  const [wallet, txGroups, holdingsAgg, recentTransactions, blockers] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId: user.id },
      select: { balance: true, currency: true, updatedAt: true },
    }),
    prisma.transaction.groupBy({
      by: ['type', 'status'],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.holding.aggregate({
      where: { userId: user.id },
      _sum: { investedAmount: true, currentValue: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: TX_SELECT,
    }),
    deletionBlockers(prisma, user.id),
  ])

  res.json({
    user,
    wallet,
    summary: {
      deposits: txSummary(txGroups, 'deposit'),
      withdrawals: txSummary(txGroups, 'withdrawal'),
      holdings: {
        positions: holdingsAgg._count._all,
        invested: holdingsAgg._sum.investedAmount ?? 0,
        currentValue: holdingsAgg._sum.currentValue ?? 0,
      },
    },
    recentTransactions,
    deletion: { allowed: blockers.length === 0, blockers },
  })
})

// GET /api/admin/users/:id/transactions?type=&page=&pageSize=
export const listUserTransactions = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query, { defaultSize: 20 })
  const type = (req.query.type || '').trim()

  if (type && !['deposit', 'withdrawal'].includes(type)) {
    throw ApiError.badRequest('Invalid type filter')
  }

  const exists = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  })
  if (!exists) throw ApiError.notFound('User not found')

  const where = { userId: req.params.id, ...(type ? { type } : {}) }
  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: TX_SELECT,
    }),
  ])

  res.json({ transactions, total, page, pageSize })
})

// PATCH /api/admin/users/:id — { status: active | suspended, reason }
// Suspension never touches financial rows; the reason is recorded with the
// admin actor in the audit trail.
export const updateUserStatus = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { status, reason } = req.body

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) throw ApiError.notFound('User not found')

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status },
    select: { id: true, email: true, name: true, status: true, updatedAt: true },
  })

  await writeAuditLog({
    action: 'admin.user_status_update',
    actor: req.auth.email,
    actorRole: req.auth.role,
    entityType: 'user',
    entityId: user.id,
    details: { from: user.status, to: status, reason },
    ip: req.ip,
  })

  res.json({ user: updated })
})

// DELETE /api/admin/users/:id — { reason }
// Safe-by-design policy: only accounts with zero financial footprint can be
// removed; anything else gets 409 with the blocker list. Prefer suspension.
export const deleteUser = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { reason } = req.body

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true },
  })
  if (!user) throw ApiError.notFound('User not found')

  const blockers = await deletionBlockers(prisma, user.id)
  if (blockers.length > 0) {
    throw ApiError.conflict('User cannot be permanently deleted — suspend instead', blockers)
  }

  // Wallet (if any) cascades with the user; no transactions/holdings exist.
  await prisma.user.delete({ where: { id: user.id } })

  await writeAuditLog({
    action: 'admin.user_delete',
    actor: req.auth.email,
    actorRole: req.auth.role,
    entityType: 'user',
    entityId: user.id,
    details: { email: user.email, name: user.name, reason },
    ip: req.ip,
  })

  res.json({ deleted: true, id: user.id })
})
// GET /api/admin/markets — full asset universe with last cached price,
// quote currency and live provider health (forex/crypto) for the panel.
// Prices come from the DB cache only; a market without cached data reports
// lastPrice null and the UI renders '—' — never an invented value.
export const listMarkets = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const [markets, status] = await Promise.all([
    prisma.market.findMany({
      orderBy: [{ provider: 'asc' }, { symbol: 'asc' }],
    }),
    getStatus(),
  ])

  const data = await Promise.all(
    markets.map(async (market) => {
      const latest = await prisma.marketPrice.findFirst({
        where: { marketId: market.id },
        orderBy: { fetchedAt: 'desc' },
        select: { price: true, fetchedAt: true },
      })
      return {
        ...market,
        // Type + quote currency for the admin table (INR-only universe;
        // fall back to parsing the pair display string).
        type: market.category,
        quote: market.pair?.includes('/') ? market.pair.split('/')[1] : 'INR',
        lastPrice: latest?.price ?? null,
        lastPriceAt: latest?.fetchedAt ?? null,
      }
    }),
  )

  res.json({
    markets: data,
    total: data.length,
    // Provider/quote health: configured flag + status + last success/error.
    // Secrets (API keys, URLs) are never included — status.service only
    // exposes operational fields.
    providers: {
      forex: status.providers.forex,
      crypto: status.providers.crypto,
    },
    lastMarketUpdate: status.lastMarketUpdate,
  })
})

// PATCH /api/admin/markets/:id — { active: boolean }
export const updateMarket = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { active } = req.body

  const market = await prisma.market.findUnique({ where: { id: req.params.id } })
  if (!market) throw ApiError.notFound('Market not found')

  const updated = await prisma.market.update({
    where: { id: market.id },
    data: { active },
  })

  await writeAuditLog({
    action: 'admin.market_update',
    actor: req.auth.email,
    actorRole: 'admin',
    entityType: 'market',
    entityId: market.id,
    details: { symbol: market.symbol, active },
    ip: req.ip,
  })

  res.json({ market: updated })
})

// POST /api/admin/markets/forex/refresh — trigger ONE provider fetch now.
export const refreshForex = asyncHandler(async (req, res) => {
  const result = await runForexFetch()

  await writeAuditLog({
    action: 'admin.forex_refresh',
    actor: req.auth.email,
    actorRole: 'admin',
    entityType: 'market',
    details: result,
    ip: req.ip,
  })

  res.json({ result })
})

// GET /api/admin/api-usage?provider=&page=&pageSize=
export const listApiUsage = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query, { defaultSize: 50 })
  const provider = (req.query.provider || '').trim()
  const where = provider ? { provider } : {}

  const [total, usage, forexSummary, todayRequests, monthlyRequests] = await Promise.all([
    prisma.apiUsage.count({ where }),
    prisma.apiUsage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    getUsageSummary('ibrlive'),
    getTodayUsage('ibrlive'),
    getMonthlyUsage('ibrlive'),
  ])

  res.json({
    usage,
    total,
    page,
    pageSize,
    summary: {
      forex: forexSummary,
      todayRequests,
      monthlyRequests,
      monthlyLimit: env.forex.monthlyRequestLimit,
    },
  })
})

// GET /api/admin/system-logs?level=&source=&page=&pageSize=
export const listSystemLogs = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query, { defaultSize: 50 })

  const where = {}
  if (req.query.level) where.level = req.query.level
  if (req.query.source) where.source = req.query.source

  const [total, logs] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
  ])

  res.json({ logs, total, page, pageSize })
})

// GET /api/admin/audit-logs?action=&actor=&page=&pageSize=
// Read-only by design: there are NO routes to edit or delete audit history
// anywhere in the API — the trail is append-only (writeAuditLog) and only
// requireAdmin-gated reads exist.
export const listAuditLogs = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { page, pageSize, skip, take } = getPagination(req.query, { defaultSize: 50 })
  const where = {}
  const action = (req.query.action || '').trim()
  const actor = (req.query.actor || '').trim()
  if (action) where.action = { contains: action }
  if (actor) where.actor = { contains: actor, mode: 'insensitive' }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
  ])

  res.json({ logs, total, page, pageSize })
})

// GET /api/admin/activity — admin-scoped operational activity feed for the
// Notifications page. Composes ONLY admin-owned data: pending finance work
// (deposit/withdrawal counts by status), recent audit entries, and current
// provider warnings. It never touches user-owned notification rows (none
// exist) and never fabricates alerts. Announcements are NOT included: XPO
// has no delivery workflow (no push/email/SMS), so nothing is offered here
// that could not actually be sent.
export const getActivity = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const [txGroups, recentAudit, status] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type', 'status'],
      where: { status: { in: ['pending', 'processing'] } },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        actor: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
    getStatus(),
  ])

  // Pending finance work — the only "action needed" queue in XPO.
  const pending = { deposits: 0, withdrawals: 0 }
  for (const row of txGroups) {
    if (row.type === 'deposit') pending.deposits += row._count._all
    if (row.type === 'withdrawal') pending.withdrawals += row._count._all
  }

  // Provider warnings — derived from live provider health, never invented.
  const warnings = []
  const forex = status.providers.forex
  const crypto = status.providers.crypto
  if (!forex.configured) {
    warnings.push({ level: 'warn', message: 'Forex provider (IBRLive) is not configured — no forex prices are fetched.' })
  } else if (forex.status === 'degraded') {
    warnings.push({
      level: 'error',
      message: `Forex provider degraded${forex.lastError ? `: ${forex.lastError}` : ''}`,
    })
  }
  if (crypto.configured && crypto.status === 'degraded') {
    warnings.push({
      level: 'error',
      message: `Crypto provider degraded${crypto.lastError ? `: ${crypto.lastError}` : ''}`,
    })
  }
  if (!crypto.configured) {
    warnings.push({
      level: 'info',
      message: 'Crypto provider is not configured — /api/markets/crypto returns 503 (no fake prices).',
    })
  }

  res.json({
    pending,
    recentAudit,
    warnings,
    lastMarketUpdate: status.lastMarketUpdate,
  })
})

// GET /api/admin/settings — non-secret configuration only (never API keys).
export const getSettings = asyncHandler(async (req, res) => {
  const status = await getStatus()

  res.json({
    server: { environment: env.nodeEnv, uptimeSeconds: status.backend.uptimeSeconds },
    database: status.database,
    forex: {
      provider: 'IBRLive',
      configured: status.providers.forex.configured,
      symbols: env.ibrlive.symbols,
      refreshIntervalSeconds: env.forex.refreshIntervalSeconds,
      monthlyRequestLimit: env.forex.monthlyRequestLimit,
      warningThreshold: env.forex.warningThreshold,
      estimatedMonthlyRequests: Math.round(
        (30 * 24 * 3600) / env.forex.refreshIntervalSeconds,
      ),
    },
    crypto: {
      configured: status.providers.crypto.configured,
      refreshIntervalSeconds: env.cryptoProvider.refreshIntervalSeconds,
    },
    security: {
      jwtExpiresIn: env.jwtExpiresIn,
      corsOrigins: env.corsOrigins,
    },
  })
})

// GET /api/admin/health — backend/database/provider detail for the panel.
export const getAdminHealth = asyncHandler(async (req, res) => {
  const status = await getStatus()
  res.json({ ...status, scheduler: getSchedulerStatus() })
})
