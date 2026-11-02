// Static presentation data for the XPO home screen — metadata only.
// Account values (balances, P/L, transactions, holdings) come from the
// backend via src/api/finance.js at runtime; live market prices come from the
// quote layer (src/api/marketApi.js). Missing data renders as '—' — this file
// must never carry fabricated financial values for those sections.

export const user = {
  greeting: 'Good Morning,',
  name: 'Ankit Sharma', // replaced at runtime with the signed-in user's name
  subtitle: "Here's your portfolio overview",
  currency: 'INR',
  initials: 'AS',
  live: true,
}

// Top Markets card metadata — every pair is quoted against the Indian Rupee.
// The home screen overlays live quotes from the quote layer and shows '—'
// when none are available (see MarketSection.jsx). The legacy USD demo
// prices were removed rather than converted at an invented FX rate — a
// price this file cannot source must render as '—', never as a fabricated
// number (Markets page featured cards fall back to the same placeholders).
export const markets = [
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: 'btc',
    apiSymbol: 'BTC',
    category: 'Crypto',
    price: '—',
    change: '—',
    up: true,
    spark: [],
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'eth',
    apiSymbol: 'ETH',
    category: 'Crypto',
    price: '—',
    change: '—',
    up: true,
    spark: [],
  },
  {
    id: 'eurinr',
    symbol: 'EUR/INR',
    name: 'Euro / Indian Rupee',
    icon: 'eur',
    apiSymbol: 'EURINR',
    category: 'Forex',
    price: '—',
    change: '—',
    up: true,
    spark: [],
  },
  {
    id: 'gold',
    symbol: 'Gold',
    name: 'Gold Spot',
    icon: 'gold',
    apiSymbol: 'XAUINR',
    category: 'Commodity',
    price: '—',
    change: '—',
    up: true,
    spark: [],
  },
]

// Featured index metadata. No index-performance data source exists yet, so
// the return is '—' — never a fabricated percentage.
export const indexes = [
  {
    id: 'crypto',
    name: 'WPS Crypto Index',
    return: '—',
    risk: 'High Risk',
    riskLevel: 'high',
    icons: ['btc', 'eth', 'sol'],
  },
  {
    id: 'forex',
    name: 'WPS Forex Index',
    return: '—',
    risk: 'Medium Risk',
    riskLevel: 'medium',
    icons: ['flagUs', 'flagEu', 'flagJp'],
  },
  {
    id: 'commodity',
    name: 'WPS Commodity Index',
    return: '—',
    risk: 'Medium Risk',
    riskLevel: 'medium',
    icons: ['gold', 'oil', 'silver'],
  },
]

// The three quick actions wired on Home (src/App.jsx). Transfer was removed:
// there is no peer-transfer backend, and a dead button is not an action.
export const quickActions = [
  { id: 'deposit', label: 'Deposit', icon: 'download', primary: true },
  { id: 'withdraw', label: 'Withdraw', icon: 'upload' },
  { id: 'invest', label: 'Invest', icon: 'plus' },
]

export const navItems = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'markets', label: 'Markets', icon: 'candles' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'more', label: 'Account', icon: 'dots' },
]

// Shared nav items with `active` set for the given view id.
export function navItemsFor(activeId) {
  return navItems.map((item) => ({ ...item, active: item.id === activeId }))
}