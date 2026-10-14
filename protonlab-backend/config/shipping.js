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
export const EUROPE_COUNTRIES = [
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

// Club shops come in three delivery modes, decided per club when its shop is
// set up (ask the club). Each list below must match the flag on the club in
// the website's data/clubs.ts — the site only uses the flag for display, this
// file is what checkout actually trusts (scripts/stripe-audit.mjs checks the
// two agree). A club appears in at most one list; a club in neither posts
// every order at the normal zone rates.
//
// CLUB_DELIVERY_CLUBS (`centralDelivery: true`): every order goes to the
// club's own distributor in one consignment and a committee member hands it
// out. Checkout charges no delivery and collects no address; the
// PaymentIntent is stamped `delivery: 'club'` and the webhook records
// `shipping_method: 'club'`, which the emails, admin feed, dashboard and Evri
// export (where such orders are skipped) all understand.
export const CLUB_DELIVERY_CLUBS = new Set([
  'ucl-cycling',
  'university-of-bristol-cycling-club',
  'university-of-bath-cycling-club',
]);

// COLLECTION_OPTION_CLUBS (`collectionOption: true`): the member chooses in
// the cart between standard posted delivery (address + normal zone rates) and
// free collection from the club committee. A collection order follows the
// club-delivery path at checkout (no address, no charge) but is stamped
// `delivery: 'collection'` → `shipping_method: 'collection'`, labelled
// COLLECTION_LABEL everywhere it is shown.
export const COLLECTION_OPTION_CLUBS = new Set([
  'swansea-university-road-team',
]);
export const COLLECTION_LABEL = 'Collection from committee';

function everyLineFrom(set, clubHandles) {
  const handles = Array.isArray(clubHandles) ? clubHandles : [];
  return handles.length > 0 && handles.every((h) => set.has(h));
}

// True when every line in the cart belongs to a club-delivery shop. A mixed
// cart (club kit plus retail, or two clubs where one posts) still ships as a
// parcel and pays the normal zone rates.
export function isClubDelivery(clubHandles) {
  return everyLineFrom(CLUB_DELIVERY_CLUBS, clubHandles);
}

// True when every line in the cart belongs to a shop that offers collection —
// only then may the client's `delivery: 'collection'` request be honoured.
export function isCollectionOption(clubHandles) {
  return everyLineFrom(COLLECTION_OPTION_CLUBS, clubHandles);
}

// Each zone carries the currency its customers are CHARGED in — the charged
// currency is a function of where the order ships, never a client choice
// (paying GBP requires a GB delivery address). The `currency` param on
// optionsFor/customText only serves the club/coverage fallback, where a
// session drops to GBP regardless of zone.
export const ZONES = {
  uk: {
    label: 'United Kingdom',
    currency: 'gbp',
    allowedCountries: ['GB'],
    optionsFor: (subtotal, currency = 'gbp') => [
      subtotal >= THRESHOLDS[currency]
        ? rate('Free Standard Delivery', 0, currency, 'standard', 2, 4)
        : rate('Standard Delivery', AMOUNTS.ukStandard[currency], currency, 'standard', 2, 4),
      rate('Next-Day Delivery', AMOUNTS.ukNextDay[currency], currency, 'next-day', 1, 1),
    ],
    customText: (subtotal, currency = 'gbp') =>
      subtotal >= THRESHOLDS[currency]
        ? 'You qualify for free standard delivery.'
        : `Free standard UK delivery on orders over ${THRESHOLD_LABEL[currency]}.`,
  },
  // Ireland: same services and timings as the UK, charged in EUR.
  ireland: {
    label: 'Ireland',
    currency: 'eur',
    allowedCountries: ['IE'],
    optionsFor: (subtotal, currency = 'eur') => [
      subtotal >= THRESHOLDS[currency]
        ? rate('Free Standard Delivery', 0, currency, 'standard', 2, 4)
        : rate('Standard Delivery', AMOUNTS.ukStandard[currency], currency, 'standard', 2, 4),
      rate('Next-Day Delivery', AMOUNTS.ukNextDay[currency], currency, 'next-day', 1, 1),
    ],
    customText: (subtotal, currency = 'eur') =>
      subtotal >= THRESHOLDS[currency]
        ? 'You qualify for free standard delivery.'
        : `Free standard delivery to Ireland on orders over ${THRESHOLD_LABEL[currency]}.`,
  },
  europe: {
    label: 'Europe',
    currency: 'eur',
    allowedCountries: EUROPE_COUNTRIES,
    optionsFor: (subtotal, currency = 'eur') => [
      subtotal >= THRESHOLDS[currency]
        ? rate('Free European Delivery', 0, currency, 'international', 5, 10)
        : rate('European Delivery', AMOUNTS.europe[currency], currency, 'international', 5, 10),
    ],
    customText: (subtotal, currency = 'eur') =>
      (subtotal >= THRESHOLDS[currency]
        ? 'You qualify for free European delivery.'
        : `European delivery — ${EUROPE_RATE_LABEL[currency]}, 5–10 working days. Free on orders over ${THRESHOLD_LABEL[currency]}.`) +
      ' Customs charges and import duties are covered by Proton Lab — nothing extra to pay on arrival.',
  },
};

// Normalise whatever the frontend sends into a known zone key.
export function resolveZone(region) {
  const key = typeof region === 'string' ? region.trim().toLowerCase() : '';
  return ZONES[key] ? key : 'uk';
}
