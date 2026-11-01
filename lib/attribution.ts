// Marketing attribution for the order dashboard's Analytics tab.
//
// On every page load (AttributionCapture in app/layout.tsx) we look at the URL
// for utm_source / utm_medium / utm_campaign and the ad click ids (fbclid,
// gclid), plus document.referrer. The result is kept in localStorage for 30
// days and sent with the checkout request, where the backend stamps it onto
// the PaymentIntent (utm_source / utm_medium / utm_campaign / referrer /
// attributed). Rules:
//   • a visit that carries UTM parameters or an ad click id REPLACES what is
//     stored — the latest campaign click wins, the way the ad platforms count
//   • a visit without any keeps what is stored; if nothing is stored yet, the
//     referrer host and landing path are recorded as the first touch
//   • fbclid without UTMs is recorded as facebook / paid-social (and gclid as
//     google / cpc), flagged `inferred`, so a Meta ad click still attributes
// Nothing personal is stored — hosts, paths and campaign names only.

export interface Attribution {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  referrer: string // referrer host of the first/last-attributed visit ('' = direct)
  landing: string // landing path of that visit
  inferred?: 'fbclid' | 'gclid'
  capturedAt: string // ISO
}

const KEY = 'pl_attribution_v1'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const OWN_HOSTS = ['protonlab.cc', 'www.protonlab.cc', 'localhost', '127.0.0.1']

const clean = (v: string | null | undefined, max = 100) =>
  String(v ?? '')
    .trim()
    .slice(0, max)

function read(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as Attribution
    if (!a || !a.capturedAt || Date.now() - Date.parse(a.capturedAt) > TTL_MS) return null
    return a
  } catch {
    return null
  }
}

function write(a: Attribution): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    /* private mode / quota — attribution is best-effort */
  }
}

function referrerHost(): string {
  try {
    if (!document.referrer) return ''
    const host = new URL(document.referrer).hostname.toLowerCase()
    return OWN_HOSTS.includes(host) ? '' : host
  } catch {
    return ''
  }
}

/** Record this page view's attribution (idempotent; safe to call on every route change). */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const source = clean(params.get('utm_source')).toLowerCase()
  const medium = clean(params.get('utm_medium')).toLowerCase()
  const campaign = clean(params.get('utm_campaign'))
  const fbclid = params.get('fbclid')
  const gclid = params.get('gclid')
  const stored = read()

  if (source || fbclid || gclid) {
    const inferred: Attribution['inferred'] | undefined = source ? undefined : fbclid ? 'fbclid' : 'gclid'
    write({
      utm_source: source || (fbclid ? 'facebook' : 'google'),
      utm_medium: medium || (source ? '' : fbclid ? 'paid-social' : 'cpc'),
      utm_campaign: campaign,
      referrer: referrerHost(),
      landing: clean(window.location.pathname, 200),
      ...(inferred ? { inferred } : {}),
      capturedAt: new Date().toISOString(),
    })
    return
  }
  if (stored) return
  // First touch with no campaign data: remember where they came from.
  const host = referrerHost()
  if (!host && window.sessionStorage.getItem(KEY + ':seen')) return // same session, nothing new
  try {
    window.sessionStorage.setItem(KEY + ':seen', '1')
  } catch {
    /* ignore */
  }
  write({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    referrer: host,
    landing: clean(window.location.pathname, 200),
    capturedAt: new Date().toISOString(),
  })
}

/** What the checkout request sends; null when nothing was ever captured. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null
  return read()
}
