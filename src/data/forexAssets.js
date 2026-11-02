// Static metadata for the forex pairs tracked by the Markets page.
// This file contains NO live values (price, change, volume, ...) — those are
// fetched at runtime by src/api/marketApi.js and merged in the Markets page.
//
// INR-only universe: every pair is quoted against the Indian Rupee. The old
// USD-quoted "major" pairs (EUR/USD, USD/JPY, ...) were removed — a pair not
// quoted in INR does not belong in this app.

export const indianForexAssets = [
  { name: 'US Dollar / Indian Rupee', symbol: 'USD/INR', category: 'Forex', apiSymbol: 'USDINR', baseCurrency: 'USD', quoteCurrency: 'INR', icon: 'usd' },
  { name: 'Euro / Indian Rupee', symbol: 'EUR/INR', category: 'Forex', apiSymbol: 'EURINR', baseCurrency: 'EUR', quoteCurrency: 'INR', icon: 'eur' },
  { name: 'British Pound / Indian Rupee', symbol: 'GBP/INR', category: 'Forex', apiSymbol: 'GBPINR', baseCurrency: 'GBP', quoteCurrency: 'INR', icon: 'gbp' },
  { name: 'Japanese Yen / Indian Rupee', symbol: 'JPY/INR', category: 'Forex', apiSymbol: 'JPYINR', baseCurrency: 'JPY', quoteCurrency: 'INR', icon: 'jpy' },
  { name: 'Australian Dollar / Indian Rupee', symbol: 'AUD/INR', category: 'Forex', apiSymbol: 'AUDINR', baseCurrency: 'AUD', quoteCurrency: 'INR', icon: 'aud' },
  { name: 'Canadian Dollar / Indian Rupee', symbol: 'CAD/INR', category: 'Forex', apiSymbol: 'CADINR', baseCurrency: 'CAD', quoteCurrency: 'INR', icon: 'cad' },
  { name: 'Swiss Franc / Indian Rupee', symbol: 'CHF/INR', category: 'Forex', apiSymbol: 'CHFINR', baseCurrency: 'CHF', quoteCurrency: 'INR', icon: 'chf' },
  { name: 'Singapore Dollar / Indian Rupee', symbol: 'SGD/INR', category: 'Forex', apiSymbol: 'SGDINR', baseCurrency: 'SGD', quoteCurrency: 'INR', icon: 'sgd' },
  { name: 'UAE Dirham / Indian Rupee', symbol: 'AED/INR', category: 'Forex', apiSymbol: 'AEDINR', baseCurrency: 'AED', quoteCurrency: 'INR', icon: 'aed' },
  { name: 'New Zealand Dollar / Indian Rupee', symbol: 'NZD/INR', category: 'Forex', apiSymbol: 'NZDINR', baseCurrency: 'NZD', quoteCurrency: 'INR', icon: 'nzd' },
]

// Combined forex universe used by the Markets page (INR crosses only).
export const forexAssets = [...indianForexAssets]