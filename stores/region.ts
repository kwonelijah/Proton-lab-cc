import { create } from 'zustand'
import { CURRENCY_COOKIE, isCurrency, type Currency } from '@/lib/currency'

function readCurrencyCookie(): Currency {
  if (typeof document === 'undefined') return 'GBP'
  const match = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]+)`))
  return match && isCurrency(match[1]) ? match[1] : 'GBP'
}

interface CurrencyStore {
  currency: Currency
}

// Read-only client mirror of the geo-set pl-currency cookie (middleware
// re-asserts it every request; there is no user-facing switcher — charged
// currency is bound to the delivery region at checkout). Components rendering
// currency-dependent text on the server pass must gate on mount to avoid
// hydration mismatches.
export const useCurrencyStore = create<CurrencyStore>(() => ({
  currency: readCurrencyCookie(),
}))
