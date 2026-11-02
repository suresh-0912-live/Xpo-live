// Static metadata for the crypto assets tracked by the Markets page.
// This file contains NO live values (price, change, volume, ...) — those are
// fetched at runtime by src/api/marketApi.js and merged in the Markets page.
//
// 25 symbols, matching the Part 4 target universe (XMR added; the earlier
// 24-symbol spec did not enumerate it). Keep in sync with the backend seed
// (backend/prisma/seed.js MARKETS) and CRYPTO_SYMBOLS in backend/.env.example.

export const cryptoAssets = [
  { name: 'Bitcoin', symbol: 'BTC', category: 'Crypto', apiSymbol: 'BTC', baseCurrency: 'BTC', quoteCurrency: 'INR', icon: 'btc' },
  { name: 'Ethereum', symbol: 'ETH', category: 'Crypto', apiSymbol: 'ETH', baseCurrency: 'ETH', quoteCurrency: 'INR', icon: 'eth' },
  { name: 'Tether', symbol: 'USDT', category: 'Crypto', apiSymbol: 'USDT', baseCurrency: 'USDT', quoteCurrency: 'INR', icon: 'usdt' },
  { name: 'BNB', symbol: 'BNB', category: 'Crypto', apiSymbol: 'BNB', baseCurrency: 'BNB', quoteCurrency: 'INR', icon: 'bnb' },
  { name: 'XRP', symbol: 'XRP', category: 'Crypto', apiSymbol: 'XRP', baseCurrency: 'XRP', quoteCurrency: 'INR', icon: 'xrp' },
  { name: 'USD Coin', symbol: 'USDC', category: 'Crypto', apiSymbol: 'USDC', baseCurrency: 'USDC', quoteCurrency: 'INR', icon: 'usdc' },
  { name: 'Solana', symbol: 'SOL', category: 'Crypto', apiSymbol: 'SOL', baseCurrency: 'SOL', quoteCurrency: 'INR', icon: 'sol' },
  { name: 'TRON', symbol: 'TRX', category: 'Crypto', apiSymbol: 'TRX', baseCurrency: 'TRX', quoteCurrency: 'INR', icon: 'trx' },
  { name: 'Figure Heloc', symbol: 'FIGR_HELOC', category: 'Crypto', apiSymbol: 'FIGR_HELOC', baseCurrency: 'FIGR_HELOC', quoteCurrency: 'INR', icon: 'figr' },
  { name: 'Zcash', symbol: 'ZEC', category: 'Crypto', apiSymbol: 'ZEC', baseCurrency: 'ZEC', quoteCurrency: 'INR', icon: 'zec' },
  { name: 'Hyperliquid', symbol: 'HYPE', category: 'Crypto', apiSymbol: 'HYPE', baseCurrency: 'HYPE', quoteCurrency: 'INR', icon: 'hype' },
  { name: 'Dogecoin', symbol: 'DOGE', category: 'Crypto', apiSymbol: 'DOGE', baseCurrency: 'DOGE', quoteCurrency: 'INR', icon: 'doge' },
  { name: 'Monero', symbol: 'XMR', category: 'Crypto', apiSymbol: 'XMR', baseCurrency: 'XMR', quoteCurrency: 'INR', icon: 'xmr' },
  { name: 'USDS', symbol: 'USDS', category: 'Crypto', apiSymbol: 'USDS', baseCurrency: 'USDS', quoteCurrency: 'INR', icon: 'usds' },
  { name: 'Chainlink', symbol: 'LINK', category: 'Crypto', apiSymbol: 'LINK', baseCurrency: 'LINK', quoteCurrency: 'INR', icon: 'link' },
  { name: 'Cardano', symbol: 'ADA', category: 'Crypto', apiSymbol: 'ADA', baseCurrency: 'ADA', quoteCurrency: 'INR', icon: 'ada' },
  { name: 'Avalanche', symbol: 'AVAX', category: 'Crypto', apiSymbol: 'AVAX', baseCurrency: 'AVAX', quoteCurrency: 'INR', icon: 'avax' },
  { name: 'Stellar', symbol: 'XLM', category: 'Crypto', apiSymbol: 'XLM', baseCurrency: 'XLM', quoteCurrency: 'INR', icon: 'xlm' },
  { name: 'Sui', symbol: 'SUI', category: 'Crypto', apiSymbol: 'SUI', baseCurrency: 'SUI', quoteCurrency: 'INR', icon: 'sui' },
  { name: 'Hedera', symbol: 'HBAR', category: 'Crypto', apiSymbol: 'HBAR', baseCurrency: 'HBAR', quoteCurrency: 'INR', icon: 'hbar' },
  { name: 'Toncoin', symbol: 'TON', category: 'Crypto', apiSymbol: 'TON', baseCurrency: 'TON', quoteCurrency: 'INR', icon: 'ton' },
  { name: 'Shiba Inu', symbol: 'SHIB', category: 'Crypto', apiSymbol: 'SHIB', baseCurrency: 'SHIB', quoteCurrency: 'INR', icon: 'shib' },
  { name: 'Litecoin', symbol: 'LTC', category: 'Crypto', apiSymbol: 'LTC', baseCurrency: 'LTC', quoteCurrency: 'INR', icon: 'ltc' },
  { name: 'Bitcoin Cash', symbol: 'BCH', category: 'Crypto', apiSymbol: 'BCH', baseCurrency: 'BCH', quoteCurrency: 'INR', icon: 'bch' },
  { name: 'Polkadot', symbol: 'DOT', category: 'Crypto', apiSymbol: 'DOT', baseCurrency: 'DOT', quoteCurrency: 'INR', icon: 'dot' },
]