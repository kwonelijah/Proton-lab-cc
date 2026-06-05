// api/test-email.js
// TEMPORARY preview endpoint — fires the order emails with a sample order so the
// team can see what they look like. Key-guarded and fixed-recipient.
// DELETE THIS FILE after the preview is sent.

import { sendOrderConfirmation, sendInternalNotification } from '../lib/email.js';

const TEST_KEY = 'pl-preview-7f3a2c';

export default async function handler(req, res) {
  if (req.query.key !== TEST_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const order = {
    id: 'pi_TEST_preview_0001',
    amount: '170.00',
    currency: 'GBP',
    email: 'elijah.kwon@icloud.com', // customer confirmation copy goes here
    name: 'Elijah Kwon',
    club: 'Edinburgh Bike Fitting Club',
    product: 'SS Race Jersey, Race Bib Shorts',
    shipping: {
      name: 'Elijah Kwon',
      phone: '+44 7478 055443',
      address: {
        line1: '12 Bruntsfield Place',
        line2: '',
        city: 'Edinburgh',
        state: '',
        postal_code: 'EH10 4HN',
        country: 'GB',
      },
    },
    date: new Date().toISOString(),
  };

  const [internal, customer] = await Promise.all([
    sendInternalNotification(order), // → info@protonlab.cc
    sendOrderConfirmation(order),    // → elijah.kwon@icloud.com
  ]);

  res.status(200).json({
    resendKeyPresent: Boolean(process.env.Resend_Backend_Key),
    internalTo: 'info@protonlab.cc',
    internal,
    customerTo: order.email,
    customer,
  });
}
