// lib/sheets.js
// Google Sheets integration using the Sheets API v4
// Reads and writes order data to your ProtonLab orders spreadsheet

import { google } from 'googleapis';

// Column order in your sheet — must match the header row exactly
const COLUMNS = ['ID', 'Amount', 'Currency', 'Email', 'Name', 'Product', 'Date', 'Status', 'Notes'];

// Authenticate using a Google Service Account
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

// ─── Generic row append ────────────────────────────────────────────────────

async function appendRow(range, row) {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// ─── Write a new order row to the sheet ────────────────────────────────────

export async function appendOrder(order) {
  await appendRow('Orders!A:I', [
    order.id,
    order.amount,
    order.currency,
    order.email,
    order.name,
    order.product,
    order.date,
    order.status,
    order.notes,
  ]);
}


// ─── Women's kit survey tab ────────────────────────────────────────────────
// Survey submissions land on their own tab, created automatically (with its
// header row) the first time a submission arrives.

const WOMENS_TAB = 'WomensSurvey';
const WOMENS_HEADERS = [
  'Date', 'Email', 'Riding', 'Womens kit', 'Bib length', 'Bib custom',
  'Straps ranked', 'Sleeve', 'Sleeve %', 'Frustrations', 'Favourites',
  'Updates opt-in', 'Code',
];

async function ensureWomensTab(sheets) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
  });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties && s.properties.title === WOMENS_TAB
  );
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: WOMENS_TAB } } }] },
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${WOMENS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [WOMENS_HEADERS] },
  });
}

export async function appendWomensSurveyRow(row) {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);
  await ensureWomensTab(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${WOMENS_TAB}!A:M`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Emails of everyone who already submitted — used to stop code farming.
export async function womensSurveyEmails() {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);
  await ensureWomensTab(sheets);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${WOMENS_TAB}!B2:B`,
  });
  return (response.data.values || []).map((r) => (r[0] || '').toLowerCase()).filter(Boolean);
}

// ─── Read all orders from the sheet ────────────────────────────────────────

export async function getAllOrders() {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Orders!A2:I',        // skip header row
  });

  const rows = response.data.values || [];
  return rows.map((row) =>
    Object.fromEntries(COLUMNS.map((col, i) => [col.toLowerCase(), row[i] || '']))
  );
}

// ─── Update the status or notes of a specific order ────────────────────────

export async function updateOrderStatus(orderId, status, notes = '') {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);

  // Find the row number for this order ID
  const all = await getAllOrders();
  const rowIndex = all.findIndex((o) => o.id === orderId);
  if (rowIndex === -1) {
    console.warn(`Order ${orderId} not found in sheet`);
    return;
  }

  const sheetRow = rowIndex + 2; // +2 because sheet rows are 1-indexed and row 1 is header

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Orders!H${sheetRow}`, values: [[status]] },  // Status column
        { range: `Orders!I${sheetRow}`, values: [[notes]] },   // Notes column
      ],
    },
  });
}
