// emails/bank-transfer-received.js
// "Your order is received — here's how to pay" — sent by
// api/bank-transfer-order.js the moment a member of a bank-transfer club shop
// places an order. Carries Proton Lab's account details (order.bank, from the
// environment) and the order's unique payment reference (order.payRef): the
// transfer is matched to the order by that reference, so it is the one thing
// the email asks the customer to copy exactly. Payment is due by order.payBy.

import {
  layout,
  heading,
  detailTable,
  bodyStyle,
  formatShipping,
  formatItems,
  firstName,
  formatDate,
  currencySymbol,
} from './theme.js';

// What happens after payment, by delivery mode — mirrors order-confirmation.js.
export function nextStepLine(order, club) {
  return order.shippingMethod === 'club'
    ? `Your kit will be delivered to ${club || 'your club'} with the rest of the club's order, and the club will hand it out — there's nothing to post.`
    : order.shippingMethod === 'collection'
      ? `Your kit will go to the ${club || 'club'} committee for you to collect — there's nothing to post, and they'll let you know when it's ready.`
      : "We'll be in touch once your kit ships.";
}

export function render(order) {
  const greeting = firstName(order);
  const club = order.club && order.club !== 'N/A' ? order.club : null;
  const orderRef = order.ref || order.id;
  const sym = currencySymbol(order.currency);
  const total = `${sym}${parseFloat(order.amount).toFixed(2)}`;
  const shipping = formatShipping(order.shipping);
  const items = formatItems(order);
  const date = formatDate(order.date);
  const payBy = order.payBy ? formatDate(order.payBy) : null;
  const bank = order.bank || {};
  const shippingCost = parseFloat(order.shippingAmount || '0');
  const delivery = order.shippingLabel
    ? `${order.shippingLabel} — ${shippingCost > 0 ? `${sym}${shippingCost.toFixed(2)}` : 'Free'}`
    : null;
  const customsNote = order.shippingMethod === 'international'
    ? "Customs charges and import duties are covered by Proton Lab — there's nothing extra to pay on arrival."
    : null;
  const transferKind = bank.iban ? 'bank transfer' : 'UK bank transfer';

  const html = layout(`
      ${heading('Your order is received')}

      <p style="${bodyStyle}margin:0 0 8px 0;">Hi ${greeting},</p>
      <p style="${bodyStyle}margin:0 0 16px 0;">
        Thank you for your order at ${club || 'Proton Lab'}. To confirm it, please pay
        <strong>${total}</strong> by ${transferKind}${payBy ? ` by <strong>${payBy}</strong>` : ''}
        using the payment reference below. We match payments to orders by that reference,
        so please copy it exactly.
      </p>

      ${detailTable([
        { label: 'Payment reference', value: order.payRef || orderRef, bold: true },
        { label: 'Amount', value: total, bold: true },
        { label: 'Account name', value: bank.accountName || '—' },
        { label: 'Sort code', value: bank.sortCode || '—' },
        { label: 'Account number', value: bank.accountNumber || '—' },
        bank.iban && { label: 'IBAN', value: bank.iban },
        bank.bic && { label: 'BIC', value: bank.bic },
        payBy && { label: 'Pay by', value: payBy },
      ])}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Once your payment arrives we'll email you to confirm, and your kit joins the club's
        production run. ${nextStepLine(order, club)}
        ${payBy ? ` Orders still unpaid after ${payBy} may be cancelled.` : ''}
      </p>

      ${detailTable([
        { label: 'Order', value: orderRef },
        { label: 'Items', value: items.html },
        delivery && { label: 'Delivery', value: delivery },
        { label: 'Total', value: total, bold: true },
        shipping && { label: 'Delivery Address', value: shipping.html },
        { label: 'Date', value: date },
      ])}

      ${customsNote ? `<p style="${bodyStyle}margin:0 0 32px 0;">${customsNote}</p>` : ''}

      <p style="${bodyStyle}margin:0 0 32px 0;">
        Questions? Reply to this email and we'll get back to you.
      </p>
`);

  const text = `Hi ${greeting},

Thank you for your order at ${club || 'Proton Lab'}. To confirm it, please pay ${total} by ${transferKind}${payBy ? ` by ${payBy}` : ''} using the payment reference below. We match payments to orders by that reference, so please copy it exactly.

Payment reference: ${order.payRef || orderRef}
Amount: ${total}
Account name: ${bank.accountName || '—'}
Sort code: ${bank.sortCode || '—'}
Account number: ${bank.accountNumber || '—'}
${bank.iban ? `IBAN: ${bank.iban}\n` : ''}${bank.bic ? `BIC: ${bank.bic}\n` : ''}${payBy ? `Pay by: ${payBy}\n` : ''}
Once your payment arrives we'll email you to confirm, and your kit joins the club's production run. ${nextStepLine(order, club)}${payBy ? ` Orders still unpaid after ${payBy} may be cancelled.` : ''}

Order: ${orderRef}
Items:
${items.text}
${delivery ? `Delivery: ${delivery}\n` : ''}Total: ${total}
${shipping ? `Delivery Address:\n${shipping.text}\n` : ''}Date: ${date}
${customsNote ? `\n${customsNote}\n` : ''}
Questions? Reply to this email.

— Proton Lab CC
protonlab.cc · instagram.com/protonlabcc`;

  return {
    subject: `Order received${club ? ` — ${club}` : ''} — pay by bank transfer (${order.payRef || orderRef})`,
    html,
    text,
  };
}
