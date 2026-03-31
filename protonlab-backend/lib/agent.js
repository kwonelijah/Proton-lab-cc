// lib/agent.js
// Claude-powered agent that reads new orders and decides how to handle them
// It can flag suspicious orders, detect duplicates, and write status updates back to the sheet

import Anthropic from '@anthropic-ai/sdk';
import { getAllOrders, updateOrderStatus } from './sheets.js';

const client = new Anthropic(); // automatically uses ANTHROPIC_API_KEY from env

// ─── Process a batch of new orders ─────────────────────────────────────────

export async function processNewOrders(newOrders) {
  // Pull all existing orders so the agent can check for duplicates
  const allOrders = await getAllOrders();

  const prompt = `
You are an order management agent for ProtonLab (protonlab.cc), a product/lab business.

Here are ALL existing orders in the system:
${JSON.stringify(allOrders, null, 2)}

Here are the NEW orders that just came in and need processing:
${JSON.stringify(newOrders, null, 2)}

For each new order, do the following:
1. Check if it looks like a duplicate (same email + same product within 10 minutes)
2. Flag any suspicious activity (e.g. unusually large amount, missing name/email)
3. Assign a status: "Confirmed", "Flagged - Duplicate", "Flagged - Suspicious", or "Review Needed"
4. Write a short note explaining your decision (1 sentence max)

Respond with ONLY a valid JSON array, no extra text. Format:
[
  {
    "id": "order_id_here",
    "status": "Confirmed",
    "notes": "Looks good, new customer."
  }
]
`;

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    console.error('Claude API error:', err);
    return;
  }

  // Parse the agent's JSON response
  let updates;
  try {
    const text = response.content[0].text.trim();
    updates = JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse agent response:', response.content[0].text);
    return;
  }

  // Write each status update back to the Google Sheet
  for (const update of updates) {
    try {
      await updateOrderStatus(update.id, update.status, update.notes);
      console.log(`Updated order ${update.id}: ${update.status}`);
    } catch (err) {
      console.error(`Failed to update order ${update.id}:`, err);
    }
  }
}

// ─── Optional: run a daily summary (call this on a cron or manual trigger) ──

export async function getDailySummary() {
  const allOrders = await getAllOrders();
  const today = new Date().toISOString().split('T')[0];
  const todaysOrders = allOrders.filter((o) => o.date?.startsWith(today));

  if (todaysOrders.length === 0) return 'No orders today.';

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarize today's orders for ProtonLab in 3-4 sentences.
      Include total revenue, number of orders, any flags. Orders: ${JSON.stringify(todaysOrders)}`,
    }],
  });

  return response.content[0].text;
}
