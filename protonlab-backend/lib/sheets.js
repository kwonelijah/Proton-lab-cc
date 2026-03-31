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

// ─── Write a new order row to the sheet ────────────────────────────────────

export async function appendOrder(order) {
  const auth = await getAuth();
  const sheets = getSheetsClient(auth);

  const row = [
    order.id,
    order.amount,
    order.currency,
    order.email,
    order.name,
    order.product,
    order.date,
    order.status,
    order.notes,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Orders!A:I',         // sheet tab named "Orders", columns A through I
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
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
