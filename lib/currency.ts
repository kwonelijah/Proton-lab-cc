// Shared display-currency constants. EUR pricing is deliberate per-market
// pricing (data/eur-prices.json → Stripe), not FX conversion.

export type Currency = 'GBP' | 'EUR'

export const CURRENCY_COOKIE = 'pl-currency'
export const COUNTRY_COOKIE = 'pl-country'

// Countries that see EUR pricing — mirrors EUROPE_COUNTRIES in
// protonlab-backend/config/shipping.js, plus IE (Eurozone customers pay EUR
// but ship under the UK & Ireland zone).
export const EUR_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT',
  'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
])

export const CURRENCY_SYMBOL: Record<Currency, string> = { GBP: '£', EUR: '€' }

// Major units — must match FREE_SHIPPING_THRESHOLD / _EUR in
// protonlab-backend/config/shipping.js.
export const FREE_SHIPPING_THRESHOLD: Record<Currency, number> = { GBP: 110, EUR: 150 }

export function isCurrency(value: unknown): value is Currency {
  return value === 'GBP' || value === 'EUR'
}

export function currencyForCountry(country: string | null | undefined): Currency {
  return country && EUR_COUNTRIES.has(country) ? 'EUR' : 'GBP'
}
