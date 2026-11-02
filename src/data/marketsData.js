import { markets as homeMarkets, navItems } from './dashboardData.js'

// The Markets page asset universe (static metadata only, no live prices) lives
// in ./cryptoAssets.js and ./forexAssets.js; live quotes come from
// src/api/marketApi.js.

// Featured cards reuse the dashboard's existing market entries (BTC, ETH, Gold).
export const featuredMarkets = homeMarkets.filter((market) =>
  ['BTC', 'ETH', 'Gold'].includes(market.symbol),
)

export const marketsNavItems = navItems.map((item) => ({
  ...item,
  active: item.id === 'markets',
}))