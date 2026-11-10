// config/bank.js
// Proton Lab's business account that bank-transfer customers pay INTO —
// printed in emails/bank-transfer-received.js and on the site's
// /order-received page, with the order's own payment reference (PL-NNNNN).
// Hard-coded by Elijah's choice (2026-11-10): every customer who orders is
// sent these anyway. Fill in sortCode and accountNumber exactly as the bank
// shows them; leave iban/bic '' unless non-UK members need them. The BANK_*
// environment variables (see .env.example) override these when set, so a
// preview deploy or a test can point elsewhere without touching this file.
// Bank-transfer ordering refuses orders (503) until all three are filled in.
export const BANK_DETAILS = {
  accountName: 'Proton Sports Management Ltd',
  sortCode: '60-84-64',
  accountNumber: '28670873',   // 8 digits
  iban: '',
  bic: '',
};
