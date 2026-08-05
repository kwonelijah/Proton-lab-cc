// config/shipping.js
// Shipping zones and rates for Stripe Checkout. This file is the single place
// to change delivery prices — edit the amounts below (in minor units), commit,
// push, and Vercel redeploys automatically. No Stripe dashboard changes needed.
//
// Each option is passed to Stripe as inline `shipping_rate_data`. The
// `evri_service` metadata survives onto the shipping rate Stripe creates, and
// the webhook reads it back so order emails and the Evri export know which
// service to book ('standard' | 'next-day' | 'international').
//
// A Stripe session is single-currency: EUR line items need EUR shipping rates,
// so every rate exists in both currencies. Irish customers pay EUR but keep
// UK & Ireland services, hence EUR amounts on the uk zone too.

// Orders with a subtotal at or above this (minor units of the session
// currency, before any discount code) get free standard delivery in the
// UK & Ireland and Europe zones. The frontend nudge in
// components/ui/CartDrawer.tsx mirrors these — update together.
export const FREE_SHIPPING_THRESHOLD = 11000; // £110.00 (GBP sessions)
export const FREE_SHIPPING_THRESHOLD_EUR = 15000; // €150.00 (EUR sessions)

const THRESHOLDS = { gbp: FREE_SHIPPING_THRESHOLD, eur: FREE_SHIPPING_THRESHOLD_EUR };
const THRESHOLD_LABEL = { gbp: '£110', eur: '€150' };

// Rate amounts in minor units per currency.
const AMOUNTS = {
  ukStandard: { gbp: 299, eur: 349 },
  ukNextDay: { gbp: 499, eur: 599 },
  europe: { gbp: 599, eur: 699 },
};
const EUROPE_RATE_LABEL = { gbp: '£5.99', eur: '€6.99' };

function rate(displayName, amount, currency, evriService, minDays, maxDays) {
  return {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount, currency },
      display_name: displayName,
      delivery_estimate: {
        minimum: { unit: 'business_day', value: minDays },
        maximum: { unit: 'business_day', value: maxDays },
      },
      metadata: { evri_service: evriService },
    },
  };
}

// EU/EEA + nearby European countries Stripe Checkout can collect addresses for.
const EUROPE_COUNTRIES = [
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

export const ZONES = {
  uk: {
    label: 'UK & Ireland',
    allowedCountries: ['GB', 'IE'],
    optionsFor: (subtotal, currency = 'gbp') => [
      subtotal >= THRESHOLDS[currency]
        ? rate('Free Standard Delivery', 0, currency, 'standard', 2, 4)
        : rate('Standard Delivery', AMOUNTS.ukStandard[currency], currency, 'standard', 2, 4),
      rate('Next-Day Delivery', AMOUNTS.ukNextDay[currency], currency, 'next-day', 1, 1),
    ],
    customText: (subtotal, currency = 'gbp') =>
      subtotal >= THRESHOLDS[currency]
        ? 'You qualify for free standard delivery.'
        : `Free standard UK & Ireland delivery on orders over ${THRESHOLD_LABEL[currency]}.`,
  },
  europe: {
    label: 'Europe',
    allowedCountries: EUROPE_COUNTRIES,
    optionsFor: (subtotal, currency = 'gbp') => [
      subtotal >= THRESHOLDS[currency]
        ? rate('Free European Delivery', 0, currency, 'international', 5, 10)
        : rate('European Delivery', AMOUNTS.europe[currency], currency, 'international', 5, 10),
    ],
    customText: (subtotal, currency = 'gbp') =>
      (subtotal >= THRESHOLDS[currency]
        ? 'You qualify for free European delivery.'
        : `European delivery — ${EUROPE_RATE_LABEL[currency]}, 5–10 working days. Free on orders over ${THRESHOLD_LABEL[currency]}.`) +
      ' Please note: customs charges and import duties are not covered — EU orders may incur local VAT or duties on arrival.',
  },
};

// Normalise whatever the frontend sends into a known zone key.
export function resolveZone(region) {
  const key = typeof region === 'string' ? region.trim().toLowerCase() : '';
  return ZONES[key] ? key : 'uk';
}

// Normalise whatever the frontend sends into a supported session currency.
export function resolveCurrency(currency) {
  return typeof currency === 'string' && currency.trim().toLowerCase() === 'eur' ? 'eur' : 'gbp';
}
