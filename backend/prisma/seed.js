import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

// Market rows are configuration, not prices — no fake price data is seeded.
// INR-only universe: every pair is quoted against the Indian Rupee.
// Full Part 4 target universe (keep in sync with src/data/cryptoAssets.js and
// src/data/forexAssets.js in the mobile app): 10 INR forex pairs + 25 cryptos.
const MARKETS = [
  { symbol: 'USDINR', pair: 'USD/INR', name: 'US Dollar / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'EURINR', pair: 'EUR/INR', name: 'Euro / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'GBPINR', pair: 'GBP/INR', name: 'British Pound / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'JPYINR', pair: 'JPY/INR', name: 'Japanese Yen / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'AUDINR', pair: 'AUD/INR', name: 'Australian Dollar / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'CADINR', pair: 'CAD/INR', name: 'Canadian Dollar / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'CHFINR', pair: 'CHF/INR', name: 'Swiss Franc / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'SGDINR', pair: 'SGD/INR', name: 'Singapore Dollar / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'AEDINR', pair: 'AED/INR', name: 'UAE Dirham / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'NZDINR', pair: 'NZD/INR', name: 'New Zealand Dollar / Indian Rupee', provider: 'forex', category: 'Forex' },
  { symbol: 'BTC', pair: 'BTC/INR', name: 'Bitcoin', provider: 'crypto', category: 'Crypto' },
  { symbol: 'ETH', pair: 'ETH/INR', name: 'Ethereum', provider: 'crypto', category: 'Crypto' },
  { symbol: 'USDT', pair: 'USDT/INR', name: 'Tether', provider: 'crypto', category: 'Crypto' },
  { symbol: 'BNB', pair: 'BNB/INR', name: 'BNB', provider: 'crypto', category: 'Crypto' },
  { symbol: 'XRP', pair: 'XRP/INR', name: 'XRP', provider: 'crypto', category: 'Crypto' },
  { symbol: 'USDC', pair: 'USDC/INR', name: 'USD Coin', provider: 'crypto', category: 'Crypto' },
  { symbol: 'SOL', pair: 'SOL/INR', name: 'Solana', provider: 'crypto', category: 'Crypto' },
  { symbol: 'TRX', pair: 'TRX/INR', name: 'TRON', provider: 'crypto', category: 'Crypto' },
  { symbol: 'FIGR_HELOC', pair: 'FIGR_HELOC/INR', name: 'Figure Heloc', provider: 'crypto', category: 'Crypto' },
  { symbol: 'ZEC', pair: 'ZEC/INR', name: 'Zcash', provider: 'crypto', category: 'Crypto' },
  { symbol: 'HYPE', pair: 'HYPE/INR', name: 'Hyperliquid', provider: 'crypto', category: 'Crypto' },
  { symbol: 'DOGE', pair: 'DOGE/INR', name: 'Dogecoin', provider: 'crypto', category: 'Crypto' },
  { symbol: 'XMR', pair: 'XMR/INR', name: 'Monero', provider: 'crypto', category: 'Crypto' },
  { symbol: 'USDS', pair: 'USDS/INR', name: 'USDS', provider: 'crypto', category: 'Crypto' },
  { symbol: 'LINK', pair: 'LINK/INR', name: 'Chainlink', provider: 'crypto', category: 'Crypto' },
  { symbol: 'ADA', pair: 'ADA/INR', name: 'Cardano', provider: 'crypto', category: 'Crypto' },
  { symbol: 'AVAX', pair: 'AVAX/INR', name: 'Avalanche', provider: 'crypto', category: 'Crypto' },
  { symbol: 'XLM', pair: 'XLM/INR', name: 'Stellar', provider: 'crypto', category: 'Crypto' },
  { symbol: 'SUI', pair: 'SUI/INR', name: 'Sui', provider: 'crypto', category: 'Crypto' },
  { symbol: 'HBAR', pair: 'HBAR/INR', name: 'Hedera', provider: 'crypto', category: 'Crypto' },
  { symbol: 'TON', pair: 'TON/INR', name: 'Toncoin', provider: 'crypto', category: 'Crypto' },
  { symbol: 'SHIB', pair: 'SHIB/INR', name: 'Shiba Inu', provider: 'crypto', category: 'Crypto' },
  { symbol: 'LTC', pair: 'LTC/INR', name: 'Litecoin', provider: 'crypto', category: 'Crypto' },
  { symbol: 'BCH', pair: 'BCH/INR', name: 'Bitcoin Cash', provider: 'crypto', category: 'Crypto' },
  { symbol: 'DOT', pair: 'DOT/INR', name: 'Polkadot', provider: 'crypto', category: 'Crypto' },
]

// Legacy USD-quoted rows from earlier seeds — removed so the DB only ever
// holds INR pairs.
const LEGACY_SYMBOLS = [
  { provider: 'forex', symbol: 'EURUSD' },
  { provider: 'forex', symbol: 'GBPUSD' },
  { provider: 'forex', symbol: 'USDJPY' },
]

async function seedMarkets() {
  for (const market of MARKETS) {
    await prisma.market.upsert({
      where: { provider_symbol: { provider: market.provider, symbol: market.symbol } },
      update: { pair: market.pair, name: market.name, category: market.category },
      create: market,
    })
  }
  for (const legacy of LEGACY_SYMBOLS) {
    await prisma.market.deleteMany({ where: { provider: legacy.provider, symbol: legacy.symbol } })
  }
  console.log(`[seed] ${MARKETS.length} markets ready (no prices seeded)`)
}

async function seedUser() {
  const user = {
    email: 'wps.xpo@proton.me',
    password: 'Xpo#2026User', // dev-only; must be >= 8 chars
    name: 'WPS XPO',
    phone: '+16722206808',
    whatsapp: '+16722206808',
  }

  const existing = await prisma.user.findUnique({ where: { email: user.email } })
  if (existing) {
    console.log(`[seed] user already exists: ${user.email}`)
    return
  }

  const passwordHash = await bcrypt.hash(user.password, 10)
  await prisma.user.create({
    data: {
      email: user.email,
      password: passwordHash,
      name: user.name,
      phone: user.phone,
      whatsapp: user.whatsapp,
      status: 'active',
    },
  })
  console.log(`[seed] user ready: ${user.email}`)
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      '[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin creation.',
    )
    return
  }
  if (password.length < 8) {
    throw new Error('[seed] SEED_ADMIN_PASSWORD must be at least 8 characters.')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.admin.upsert({
    where: { email },
    update: { password: passwordHash },
    create: { email, password: passwordHash, name: 'Administrator', role: 'superadmin' },
  })
  console.log(`[seed] admin ready: ${email}`)
}

async function main() {
  await seedMarkets()
  await seedAdmin()
  await seedUser()
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
