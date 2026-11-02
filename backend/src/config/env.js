import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load backend/.env regardless of the process working directory.
config({ path: path.resolve(__dirname, '../../.env') })

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigins: list(
    process.env.CORS_ORIGIN ||
      'http://localhost:5173,http://localhost:5174,http://localhost:5300',
  ),

  ibrlive: {
    apiKey: process.env.IBRLIVE_API_KEY || '',
    baseUrl: (process.env.IBRLIVE_BASE_URL || 'https://api.ibrlive.com').replace(
      /\/+$/,
      '',
    ),
    symbols: list(process.env.FOREX_SYMBOLS || 'USDINR,EURINR,GBPINR'),
  },

  forex: {
    refreshIntervalSeconds: num(process.env.FOREX_REFRESH_INTERVAL_SECONDS, 80),
    monthlyRequestLimit: num(process.env.FOREX_MONTHLY_REQUEST_LIMIT, 35000),
    warningThreshold: num(process.env.FOREX_WARNING_THRESHOLD, 30000),
  },

  cryptoProvider: {
    url: (process.env.CRYPTO_PROVIDER_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.CRYPTO_API_KEY || '',
    refreshIntervalSeconds: num(process.env.CRYPTO_REFRESH_INTERVAL_SECONDS, 60),
    // Part 4 target universe (25 symbols) — matches the seeded crypto markets
    // and the mobile app dataset (src/data/cryptoAssets.js).
    symbols: list(
      process.env.CRYPTO_SYMBOLS ||
        'BTC,ETH,USDT,BNB,XRP,USDC,SOL,TRX,FIGR_HELOC,ZEC,HYPE,DOGE,XMR,USDS,LINK,ADA,AVAX,XLM,SUI,HBAR,TON,SHIB,LTC,BCH,DOT',
    ),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || '',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || '',
  },
}

env.isTest = env.nodeEnv === 'test'
env.isProd = env.nodeEnv === 'production'
env.isForexConfigured = Boolean(env.ibrlive.apiKey)
env.isCryptoConfigured = Boolean(env.cryptoProvider.url)

if (!env.isProd) {
  let localDatabase = false
  try {
    const database = new URL(env.databaseUrl)
    const hostname = database.hostname.replace(/^\[|\]$/g, '')
    localDatabase =
      ['localhost', '127.0.0.1', '::1'].includes(hostname) &&
      decodeURIComponent(database.pathname.slice(1)) === 'xpo_dev'
  } catch {
    localDatabase = false
  }
  if (!localDatabase) {
    console.error('[env] FATAL: development and test runs require loopback PostgreSQL database xpo_dev.')
    process.exit(1)
  }
}

if (env.isProd && env.jwtSecret === 'dev-only-change-me-secret') {
  console.error('[env] FATAL: JWT_SECRET must be set in production.')
  process.exit(1)
}
if (env.isProd && !env.databaseUrl) {
  console.error('[env] FATAL: DATABASE_URL must be set in production.')
  process.exit(1)
}

export default env
