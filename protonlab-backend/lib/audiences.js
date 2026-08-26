// lib/audiences.js
// Resend audience IDs and the one shared contact-add helper. The account runs
// a layered model: General is everyone marketable; Customers and Women's line
// are subsets whose contacts are ALSO in General, so a broadcast to General
// reaches every subscriber exactly once and targeted sends use the subsets.
//
// IDs are stable non-secret identifiers, so they live here as constants (same
// convention the women's survey used). Raw HTTP throughout — the pinned
// resend SDK predates audience-scoped contact endpoints.

export const GENERAL_AUDIENCE_ID = 'ea328582-872e-4425-9d86-1d8533cf81ac';
export const CUSTOMERS_AUDIENCE_ID = '432695a4-650d-4580-ac1e-3d4759bf66ba';
export const WOMENS_AUDIENCE_ID = '838e4c6e-4f2d-45e7-8569-8a225ca4dc3f';
export const WAITLIST_AUDIENCE_ID = '3194a122-c49c-49b9-a15d-d6531c4a156f';

// Riding-type buckets fed by the popup's poll step — like every other
// audience here, subsets of General. Keys are the wire values the popup
// sends; subscribe.js validates against them.
export const RIDING_AUDIENCE_IDS = {
  road: '2c678ef8-a839-437c-9a77-4564c8727f95',
  gravel: '1b318fc0-fc7f-4d48-b4f9-b39b530d8f22',
  triathlon: '0eec67f3-42f1-4072-899d-34c2d00c4e21',
  other: '37e8ee9a-0291-46ea-b199-2b002fe439fd',
};

function resendHeaders() {
  const key = process.env.proton_resend_key || process.env.Resend_Backend_Key;
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// Adds a contact to one audience. "Already in the audience" counts as success.
// Never updates an existing contact — re-adding must not flip `unsubscribed`
// back on for someone who opted out. Failures are logged and non-fatal so a
// list problem can never break signup or order processing.
export async function addContactToAudience(email, audienceId, { firstName, lastName } = {}) {
  if (!audienceId) return { ok: false, skipped: 'no-audience' };
  try {
    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: resendHeaders(),
      body: JSON.stringify({
        email: email.toLowerCase(),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        unsubscribed: false,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    // Resend rejects duplicates rather than upserting — that's the outcome we
    // want (membership confirmed, unsubscribed flag untouched).
    if (res.status === 409 || /already exists/i.test(body)) return { ok: true, already: true };
    console.error(`Audience add failed for ${email} → ${audienceId} (continuing):`, body);
    return { ok: false };
  } catch (err) {
    console.error(`Audience add failed for ${email} → ${audienceId} (continuing):`, err);
    return { ok: false };
  }
}

// Membership check, used by the subscribe dedupe (one welcome code per
// address, ever). Errors read as "not found" — the worst case is a duplicate
// code, never a blocked signup.
export async function contactInAudience(email, audienceId) {
  if (!audienceId) return false;
  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts/${encodeURIComponent(email.toLowerCase())}`,
      { headers: resendHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}
