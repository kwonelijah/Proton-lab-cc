// api/admin.js
// Key-protected dispatch admin page. Reads paid orders straight from Stripe
// (the system of record — no database), splits them into awaiting/dispatched,
// and lets the team mark a parcel dispatched with its Evri tracking number.
//
// Marking an order dispatched:
//   1. sends the customer the dispatch email (with tracking link),
//   2. schedules the post-delivery thank-you via Resend for +5 days,
//   3. stamps dispatched_at + tracking into the PaymentIntent metadata so the
//      order can't be double-sent and the state is visible in Stripe.
//
// Usage:
//   GET  /api/admin?key=<proton_export_key>&since=60   — the admin page
//   GET  /api/admin?key=<key>&format=json              — order data as JSON
//        (consumed by the local order dashboard's Web Shop tab)
//   POST /api/admin?key=<proton_export_key>            — {pi, tracking} action
//        (POSTed by the page's buttons and the dashboard)
//
// CORS is open (auth is the key param, not the origin) because the order
// dashboard runs from a local file:// page whose Origin is "null".

import Stripe from 'stripe';
import {
  sendOrderConfirmation,
  sendOrderDispatched,
  sendOrderDelivered,
  sendOrderInProduction,
} from '../lib/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Thank-you email lands this many days after dispatch.
const THANK_YOU_DELAY_DAYS = 5;

// Same deterministic order number used in the order emails (webhook.js).
function orderNumber(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 100000;
  }
  return String(h).padStart(5, '0');
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseLineItems(meta) {
  try {
    const items = JSON.parse(meta?.items || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function itemsSummary(meta) {
  const items = parseLineItems(meta);
  if (items.length) {
    return items
      .map((i) => `${i.name || i.handle}${i.size ? ` (${i.size})` : ''}${i.qty > 1 ? ` ×${i.qty}` : ''}`)
      .join(', ');
  }
  return meta?.product || '—';
}

// Builds the order object the email templates expect — same shape as
// webhook.js, including the checkout-session lookup for the email address
// the customer typed on the Stripe hosted page.
async function buildOrder(payment) {
  let customer = null;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: payment.id, limit: 1 });
    customer = sessions.data[0]?.customer_details || null;
  } catch (err) {
    console.error('Could not fetch checkout session for customer details:', err.message);
  }

  const meta = payment.metadata || {};
  const club = meta.club || 'N/A';
  const number = orderNumber(payment.id);
  const shipping = payment.shipping || null;

  return {
    id: payment.id,
    ref: club && club !== 'N/A' ? `${club} #${number}` : `Order #${number}`,
    number,
    amount: (payment.amount / 100).toFixed(2),
    currency: payment.currency.toUpperCase(),
    email: customer?.email || payment.receipt_email || meta.email || 'N/A',
    name: customer?.name || meta.name || shipping?.name || 'N/A',
    phone: customer?.phone || shipping?.phone || meta.phone || 'N/A',
    club,
    product: meta.product || 'N/A',
    lineItems: parseLineItems(meta),
    shipping,
    date: new Date(payment.created * 1000).toISOString(),
  };
}

// ─── Page rendering (exported for local preview/testing) ────────────────────

export function renderPage({ awaiting, dispatched, key, since }) {
  const row = (o, controls) => `
      <tr data-pi="${esc(o.id)}">
        <td><strong>${esc(o.ref)}</strong><br><span class="sub">${esc(o.date.slice(0, 10))}</span></td>
        <td>${esc(o.name)}<br><span class="sub">${esc(o.email)}</span></td>
        <td>${esc(o.items)}</td>
        <td>${esc(o.place)}</td>
        <td>£${esc(o.amount)}</td>
        <td>${controls}</td>
      </tr>`;

  const awaitingRows = awaiting
    .map((o) =>
      row(
        o,
        `<span class="controls"><input type="text" placeholder="Evri tracking no." aria-label="Tracking number for ${esc(o.ref)}">
         <button type="button" onclick="markDispatched(this)">Mark dispatched</button></span>
         <span class="status"></span>`
      )
    )
    .join('');

  const dispatchedRows = dispatched
    .map((o) =>
      row(o, `<span class="done">✓ ${esc(o.dispatchedAt.slice(0, 10))}</span><br><span class="sub">${esc(o.tracking || 'no tracking')}</span>`)
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proton Lab — Dispatch</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; background: #fafafa; color: #0a0a0a; margin: 0; padding: 32px 24px; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-family: Georgia, serif; font-weight: normal; font-size: 26px; margin: 0 0 4px 0; }
  .sub { color: #6b6b6b; font-size: 12px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b6b6b; border-top: 1px solid #e8e8e8; padding-top: 16px; margin: 40px 0 8px 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 10px 12px 10px 0; border-bottom: 1px solid #e8e8e8; vertical-align: top; }
  input[type=text] { border: 1px solid #c8c8c8; background: #fff; padding: 9px 10px; font-size: 12px; width: 170px; }
  input[type=text]:focus { outline: none; border-color: #0a0a0a; }
  button { background: #0a0a0a; color: #fafafa; border: 0; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .controls { display: inline-flex; gap: 8px; }
  .status { display: block; font-size: 12px; margin-top: 6px; }
  .status.ok { color: #0a0a0a; } .status.err { color: #dc2626; }
  .done { font-size: 13px; }
  .empty { color: #6b6b6b; font-size: 13px; padding: 14px 0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Dispatch</h1>
  <p class="sub">Orders from the last ${esc(since)} days, read live from Stripe. Marking a parcel dispatched emails the customer their tracking link and schedules the thank-you email for ${THANK_YOU_DELAY_DAYS} days later.</p>

  <h2>Awaiting dispatch (${awaiting.length})</h2>
  <table>${awaitingRows || ''}</table>
  ${awaitingRows ? '' : '<p class="empty">Nothing waiting — all caught up.</p>'}

  <h2>Dispatched (${dispatched.length})</h2>
  <table>${dispatchedRows || ''}</table>
  ${dispatchedRows ? '' : '<p class="empty">No dispatched orders in this window.</p>'}
</div>
<script>
  async function markDispatched(btn) {
    const tr = btn.closest('tr');
    const status = tr.querySelector('.status');
    const tracking = tr.querySelector('input').value.trim();
    if (!tracking && !confirm('No tracking number entered — send the dispatch email without a tracking link?')) return;
    btn.disabled = true;
    status.textContent = 'Sending…';
    status.className = 'status';
    try {
      const res = await fetch(location.pathname + '?key=' + encodeURIComponent(${JSON.stringify(key)}), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pi: tr.dataset.pi, tracking }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
      status.textContent = '✓ Dispatch email sent, thank-you scheduled';
      status.className = 'status ok';
      tr.querySelector('.controls').remove();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'status err';
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const expected = process.env.proton_export_key;
  if (!expected) {
    return res.status(500).json({ error: 'EXPORT_KEY_MISSING: set proton_export_key in the environment' });
  }
  if (req.query.key !== expected) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'POST') {
    // ── Club-wide production notification ─────────────────────────────────
    // {action:'production', club} — emails every succeeded order of that club
    // that hasn't been production-notified or dispatched yet. Idempotent:
    // notified orders are stamped and skipped on re-runs.
    if (req.body?.action === 'production') {
      const clubName = (req.body.club || '').trim();
      if (!clubName) {
        return res.status(400).json({ error: 'Missing club name' });
      }
      let payments;
      try {
        const sinceTs = Math.floor(Date.now() / 1000) - 365 * 86400;
        payments = await stripe.paymentIntents
          .list({ created: { gte: sinceTs }, limit: 100 })
          .autoPagingToArray({ limit: 1000 });
      } catch (err) {
        console.error('Stripe list error:', err);
        return res.status(502).json({ error: 'Failed to read orders from Stripe' });
      }
      const targets = payments.filter(
        (p) =>
          p.status === 'succeeded' &&
          (p.metadata?.club || '') === clubName &&
          !p.metadata?.production_notified_at &&
          !p.metadata?.dispatched_at
      );
      let sent = 0;
      let failed = 0;
      for (const p of targets) {
        const order = await buildOrder(p);
        const r = await sendOrderInProduction(order);
        if (!r.ok) {
          console.error('Production email failed for', p.id, r);
          failed++;
          continue;
        }
        try {
          await stripe.paymentIntents.update(p.id, {
            metadata: { production_notified_at: new Date().toISOString() },
          });
        } catch (err) {
          console.error('Failed to stamp production metadata on', p.id, err.message);
        }
        sent++;
      }
      return res.status(200).json({ ok: true, sent, failed, matched: targets.length });
    }

    // ── Manual-order emails ───────────────────────────────────────────────
    // {action:'send', kind, order, tracking?} — sends a lifecycle email for an
    // order that doesn't exist in Stripe (added manually on the dashboard,
    // e.g. paid by bank transfer or at a special price). The dashboard owns
    // the order record and its state; this endpoint only renders and sends.
    if (req.body?.action === 'send') {
      const { kind, order, tracking: manualTracking } = req.body;
      if (!['confirmation', 'production', 'dispatch'].includes(kind)) {
        return res.status(400).json({ error: 'Unknown email kind' });
      }
      if (!order || !order.email || !order.name) {
        return res.status(400).json({ error: 'Order needs at least a name and an email' });
      }
      const o = {
        id: order.id || 'manual',
        ref: order.ref || (order.club ? `${order.club} (manual)` : 'Manual order'),
        amount: order.amount || '0.00',
        currency: 'GBP',
        email: order.email,
        name: order.name,
        phone: order.phone || 'N/A',
        club: order.club || 'N/A',
        product: order.product || 'your order',
        lineItems: Array.isArray(order.lineItems) ? order.lineItems : [],
        shipping: order.shipping || null,
        date: order.date || new Date().toISOString(),
      };
      let result;
      if (kind === 'confirmation') {
        result = await sendOrderConfirmation(o);
      } else if (kind === 'production') {
        result = await sendOrderInProduction(o);
      } else {
        const trackingNumber = (manualTracking || '').trim() || null;
        const dispatch = trackingNumber
          ? { trackingNumber, trackingUrl: `https://www.evri.com/track/parcel/${encodeURIComponent(trackingNumber)}` }
          : {};
        result = await sendOrderDispatched(o, dispatch);
        if (result.ok) {
          const scheduledAt = new Date(Date.now() + THANK_YOU_DELAY_DAYS * 86400000).toISOString();
          const thankYou = await sendOrderDelivered(o, { scheduledAt });
          if (!thankYou.ok) console.error('Thank-you scheduling failed for manual order', o.ref, thankYou);
        }
      }
      if (!result.ok) {
        return res.status(502).json({ error: `Email failed: ${result.error || result.skipped}` });
      }
      return res.status(200).json({ ok: true });
    }

    // ── Single-order dispatch ─────────────────────────────────────────────
    const { pi, tracking } = req.body || {};
    if (!pi || typeof pi !== 'string') {
      return res.status(400).json({ error: 'Missing payment id' });
    }

    let payment;
    try {
      payment = await stripe.paymentIntents.retrieve(pi);
    } catch {
      return res.status(404).json({ error: 'Order not found in Stripe' });
    }
    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment is not succeeded — cannot dispatch' });
    }
    if (payment.metadata?.dispatched_at) {
      return res.status(409).json({ error: `Already dispatched on ${payment.metadata.dispatched_at.slice(0, 10)}` });
    }

    const order = await buildOrder(payment);
    const trackingNumber = (tracking || '').trim() || null;
    const dispatch = trackingNumber
      ? { trackingNumber, trackingUrl: `https://www.evri.com/track/parcel/${encodeURIComponent(trackingNumber)}` }
      : {};

    const sent = await sendOrderDispatched(order, dispatch);
    if (!sent.ok) {
      return res.status(502).json({ error: `Dispatch email failed: ${sent.error || sent.skipped}` });
    }

    const scheduledAt = new Date(Date.now() + THANK_YOU_DELAY_DAYS * 86400000).toISOString();
    const thankYou = await sendOrderDelivered(order, { scheduledAt });
    if (!thankYou.ok) {
      // Dispatch email already went out — record that and surface the partial failure.
      console.error('Thank-you scheduling failed for', payment.id, thankYou);
    }

    try {
      await stripe.paymentIntents.update(payment.id, {
        metadata: {
          dispatched_at: new Date().toISOString(),
          tracking: trackingNumber || '',
          thank_you_scheduled: thankYou.ok ? scheduledAt : 'FAILED',
        },
      });
    } catch (err) {
      console.error('Failed to stamp dispatch metadata on', payment.id, err.message);
      return res.status(502).json({ error: 'Emails sent but Stripe metadata update failed — do not re-send' });
    }

    return res.status(200).json({ ok: true, thankYouScheduled: thankYou.ok });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const days = /^\d+$/.test(req.query.since || '') ? Number(req.query.since) : 60;
  const sinceTs = Math.floor(Date.now() / 1000) - days * 86400;

  let payments;
  try {
    payments = await stripe.paymentIntents
      .list({ created: { gte: sinceTs }, limit: 100 })
      .autoPagingToArray({ limit: 1000 });
  } catch (err) {
    console.error('Stripe list error:', err);
    return res.status(502).json({ error: 'Failed to read orders from Stripe' });
  }

  const awaiting = [];
  const dispatched = [];
  const needLookup = [];
  for (const p of payments) {
    if (p.status !== 'succeeded') continue;
    const meta = p.metadata || {};
    const club = meta.club || '';
    const number = orderNumber(p.id);
    const addr = p.shipping?.address || {};
    const entry = {
      id: p.id,
      club,
      ref: club ? `${club} #${number}` : `Order #${number}`,
      date: new Date(p.created * 1000).toISOString(),
      name: meta.customer_name || p.shipping?.name || meta.name || '—',
      email: meta.customer_email || p.receipt_email || meta.email || '',
      phone: meta.customer_phone || p.shipping?.phone || meta.phone || '',
      addr: {
        line1: addr.line1 || '',
        line2: addr.line2 || '',
        city: addr.city || '',
        state: addr.state || '',
        postal_code: addr.postal_code || '',
        country: addr.country || '',
      },
      address: [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
        .filter(Boolean)
        .join(', '),
      items: itemsSummary(meta),
      place: [addr.city, addr.postal_code].filter(Boolean).join(', ') || '—',
      amount: (p.amount / 100).toFixed(2),
      productionAt: meta.production_notified_at || null,
      dispatchedAt: meta.dispatched_at || null,
      tracking: meta.tracking || null,
    };
    if (!entry.email || !entry.phone) needLookup.push(entry);
    (meta.dispatched_at ? dispatched : awaiting).push(entry);
  }

  // The email/phone the customer types on the Stripe hosted page live on the
  // Checkout Session (customer_details), not the PaymentIntent — look them up
  // for entries still missing contact details. Batched to bound latency; the
  // webhook stamps customer_* metadata on new orders so this shrinks over time.
  for (let i = 0; i < needLookup.length; i += 8) {
    await Promise.all(
      needLookup.slice(i, i + 8).map(async (entry) => {
        try {
          const sessions = await stripe.checkout.sessions.list({ payment_intent: entry.id, limit: 1 });
          const cd = sessions.data[0]?.customer_details;
          if (!cd) return;
          if (!entry.email && cd.email) entry.email = cd.email;
          if (!entry.phone && cd.phone) entry.phone = cd.phone;
          if (entry.name === '—' && cd.name) entry.name = cd.name;
        } catch (err) {
          console.error('Session lookup failed for', entry.id, err.message);
        }
      })
    );
  }

  res.setHeader('Cache-Control', 'no-store');
  if (req.query.format === 'json') {
    return res.status(200).json({ awaiting, dispatched, since: days });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(renderPage({ awaiting, dispatched, key: req.query.key, since: days }));
}
