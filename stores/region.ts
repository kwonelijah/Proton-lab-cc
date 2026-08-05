import { create } from 'zustand'
import { CURRENCY_COOKIE, isCurrency, type Currency } from '@/lib/currency'

function readCurrencyCookie(): Currency {
  if (typeof document === 'undefined') return 'GBP'
  const match = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]+)`))
  return match && isCurrency(match[1]) ? match[1] : 'GBP'
}

interface CurrencyStore {
  currency: Currency
  setCurrency: (currency: Currency) => void
}

// Client mirror of the pl-currency cookie (middleware geo-defaults it, the
// £/€ toggle writes it). Components rendering currency-dependent text on the
// server pass must gate on mount to avoid hydration mismatches.
export const useCurrencyStore = create<CurrencyStore>(set => ({
  currency: readCurrencyCookie(),
  setCurrency: currency => {
    document.cookie = `${CURRENCY_COOKIE}=${currency}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    set({ currency })
  },
}))
