// config/shipping.js
// Shipping zones and rates for Stripe Checkout. This file is the single place
// to change delivery prices — edit the amounts below (in pence), commit, push,
// and Vercel redeploys automatically. No Stripe dashboard changes needed.
//
// Each option is passed to Stripe as inline `shipping_rate_data`. The
// `evri_service` metadata survives onto the shipping rate Stripe creates, and
// the webhook reads it back so order emails and the Evri export know which
// service to book ('standard' | 'next-day' | 'international').

// Orders with a subtotal at or above this (pence, before any discount code)
// get free standard delivery in the UK & Ireland zone.
export const FREE_SHIPPING_THRESHOLD = 10000; // £100.00

function rate(displayName, amount, evriService, minDays, maxDays) {
  return {
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount, currency: 'gbp' },
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

// Broad rest-of-world list (common destinations; extend as needed).
const WORLD_COUNTRIES = [
  'US', 'CA', 'AU', 'NZ', 'JP', 'SG', 'HK', 'KR', 'AE', 'SA', 'QA', 'ZA',
  'BR', 'MX', 'AR', 'CL', 'IN', 'MY', 'TH', 'TW', 'IL', 'TR',
];

export const ZONES = {
  uk: {
    label: 'UK & Ireland',
    allowedCountries: ['GB', 'IE'],
    optionsFor: (subtotal) => [
      subtotal >= FREE_SHIPPING_THRESHOLD
        ? rate('Free Standard Delivery', 0, 'standard', 2, 4)
        : rate('Standard Delivery', 299, 'standard', 2, 4),
      rate('Next-Day Delivery', 499, 'next-day', 1, 1),
    ],
    customText: (subtotal) =>
      subtotal >= FREE_SHIPPING_THRESHOLD
        ? 'You qualify for free standard delivery.'
        : 'Free standard UK & Ireland delivery on orders over £100.',
  },
  europe: {
    label: 'Europe',
    allowedCountries: EUROPE_COUNTRIES,
    optionsFor: () => [rate('European Delivery', 999, 'international', 5, 10)],
    customText: () => 'European delivery — £9.99, 5–10 working days.',
  },
  world: {
    label: 'Rest of world',
    allowedCountries: WORLD_COUNTRIES,
    optionsFor: () => [rate('International Delivery', 1499, 'international', 7, 14)],
    customText: () => 'International delivery — £14.99, 7–14 working days.',
  },
};

// Normalise whatever the frontend sends into a known zone key.
export function resolveZone(region) {
  const key = typeof region === 'string' ? region.trim().toLowerCase() : '';
  return ZONES[key] ? key : 'uk';
}
