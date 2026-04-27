#!/usr/bin/env node
// QuickBooks CDC Sync — runs on sigmadb with local DB access.
// No Prisma, no build — just pg + fetch.
//
// Setup: mkdir -p /opt/carreirahub && npm install pg
// Cron:  0 0,6,12,18 * * * /usr/bin/node /opt/carreirahub/qb-sync.mjs >> /var/log/qb-sync.log 2>&1
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';

// Load .env if present
const envPath = new URL('.env', import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const DB_URL = process.env.DATABASE_URL || 'postgresql://carreirausa@localhost:5432/carreirahub';
const QB_BASE = 'https://quickbooks.api.intuit.com';

const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });

async function query(sql, params = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function getQbTokens() {
  const r = await query('SELECT * FROM system_config WHERE id = $1', ['system']);
  if (!r.rows[0]) throw new Error('No system config found');
  const cfg = r.rows[0];
  return {
    accessToken: cfg.quickbooks_access_token,
    refreshToken: cfg.quickbooks_refresh_token,
    companyId: cfg.quickbooks_company_id,
    clientId: process.env.QUICKBOOKS_CLIENT_ID,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
  };
}

async function refreshToken(tokens) {
  const auth = Buffer.from(`${tokens.clientId}:${tokens.clientSecret}`).toString('base64');
  const r = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${tokens.refreshToken}`,
  });
  if (!r.ok) throw new Error(`Token refresh failed: ${await r.text()}`);
  const data = await r.json();

  await query(
    `UPDATE system_config SET quickbooks_access_token = $1, quickbooks_refresh_token = $2, quickbooks_token_expires_at = $3 WHERE id = 'system'`,
    [data.access_token, data.refresh_token, new Date(Date.now() + data.expires_in * 1000)]
  );

  return data.access_token;
}

async function qbRequest(accessToken, companyId, endpoint) {
  const url = `${QB_BASE}/v3/company/${companyId}${endpoint}`;
  let r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });

  if (r.status === 401) {
    const tokens = await getQbTokens();
    accessToken = await refreshToken(tokens);
    r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  }

  if (!r.ok) throw new Error(`QB API ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  const started = Date.now();
  console.log(`[${new Date().toISOString()}] QB CDC Sync starting...`);

  const tokens = await getQbTokens();
  let accessToken = tokens.accessToken;

  // Get last successful sync date
  const lastSync = await query(
    `SELECT "createdAt" FROM integration_logs WHERE service = 'QUICKBOOKS' AND action = 'SYNC' AND status = 'SUCCESS' ORDER BY "createdAt" DESC LIMIT 1`
  );

  const maxPast = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  let sinceDate = lastSync.rows[0]?.createdAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (sinceDate < maxPast) sinceDate = maxPast;

  console.log(`  CDC since: ${sinceDate.toISOString()}`);

  // Fetch CDC
  const cdcData = await qbRequest(accessToken, tokens.companyId,
    `/cdc?entities=Customer,Invoice,Payment&changedSince=${sinceDate.toISOString()}`
  );

  let changedInvoices = [], deletedInvoices = [], changedPayments = [], changedCustomers = [];

  for (const resp of cdcData?.CDCResponse || []) {
    for (const qr of resp.QueryResponse || []) {
      if (qr.Customer) {
        const all = Array.isArray(qr.Customer) ? qr.Customer : [qr.Customer];
        changedCustomers = all.filter(e => e.status !== 'Deleted');
      }
      if (qr.Invoice) {
        const all = Array.isArray(qr.Invoice) ? qr.Invoice : [qr.Invoice];
        changedInvoices = all.filter(e => e.status !== 'Deleted');
        deletedInvoices = all.filter(e => e.status === 'Deleted');
      }
      if (qr.Payment) {
        const all = Array.isArray(qr.Payment) ? qr.Payment : [qr.Payment];
        changedPayments = all.filter(e => e.status !== 'Deleted');
      }
    }
  }

  console.log(`  Changes: ${changedCustomers.length} customers, ${changedInvoices.length} invoices, ${changedPayments.length} payments`);
  console.log(`  Deletions: ${deletedInvoices.length} invoices`);

  let stats = { custUpdated: 0, invUpdated: 0, invSkipped: 0, invVoided: 0, payUpdated: 0, errors: 0 };

  // --- Customers: update balance ---
  for (const c of changedCustomers) {
    try {
      await query(
        `UPDATE customers SET "qbBalance" = $1, "lastQbBalanceSync" = NOW(), "lastQuickbooksSyncAt" = NOW() WHERE quickbooks_id = $2`,
        [c.Balance || 0, c.Id]
      );
      stats.custUpdated++;
    } catch { stats.errors++; }
  }

  // --- Invoices: update status if changed ---
  for (const inv of changedInvoices) {
    try {
      const total = inv.TotalAmt || 0;
      const balance = inv.Balance ?? total;
      const newStatus = balance === 0 ? 'PAID' : balance === total ? 'SENT' : 'OVERDUE';
      const amountPaid = balance === 0 ? total : total - balance;

      const existing = await query(
        `SELECT id, status FROM invoices WHERE quickbooks_invoice_id = $1`, [inv.Id]
      );
      if (!existing.rows[0]) continue;
      if (existing.rows[0].status === newStatus) { stats.invSkipped++; continue; }

      await query(
        `UPDATE invoices SET status = $1, amount = $2, "amountPaid" = $3, "paidAt" = $4, "updatedAt" = NOW()
         WHERE quickbooks_invoice_id = $5`,
        [newStatus, total, amountPaid, amountPaid > 0 ? new Date() : null, inv.Id]
      );
      stats.invUpdated++;
    } catch { stats.errors++; }
  }

  // --- Deleted invoices: void ---
  for (const del of deletedInvoices) {
    try {
      const r = await query(
        `UPDATE invoices SET status = 'VOID', "updatedAt" = NOW() WHERE quickbooks_invoice_id = $1 AND status != 'VOID' RETURNING id`, [del.Id]
      );
      if (r.rowCount > 0) stats.invVoided++;
    } catch { stats.errors++; }
  }

  // --- Payments ---
  for (const pay of changedPayments) {
    try {
      let invoiceRef;
      for (const line of pay.Line || []) {
        const txn = (line.LinkedTxn || []).find(t => t.TxnType === 'Invoice');
        if (txn?.TxnId) { invoiceRef = txn.TxnId; break; }
      }
      if (!invoiceRef) continue;

      const inv = await query(`SELECT id, "customerId" FROM invoices WHERE quickbooks_invoice_id = $1`, [invoiceRef]);
      if (!inv.rows[0]) continue;

      const existing = await query(`SELECT id FROM payments WHERE quickbooks_payment_id = $1`, [pay.Id]);

      if (existing.rows[0]) {
        await query(
          `UPDATE payments SET amount = $1, "paymentDate" = $2, "updatedAt" = NOW() WHERE quickbooks_payment_id = $3`,
          [pay.TotalAmt || 0, pay.TxnDate ? new Date(pay.TxnDate) : new Date(), pay.Id]
        );
      } else {
        await query(
          `INSERT INTO payments (id, amount, currency, "paymentDate", "paymentMethod", quickbooks_payment_id, "invoiceId", "customerId", "syncedFromQb", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'USD', $2, 'QuickBooks', $3, $4, $5, true, NOW(), NOW())`,
          [pay.TotalAmt || 0, pay.TxnDate ? new Date(pay.TxnDate) : new Date(), pay.Id, inv.rows[0].id, inv.rows[0].customerId]
        );
      }
      stats.payUpdated++;
    } catch { stats.errors++; }
  }

  // Log success
  const duration = Date.now() - started;
  await query(
    `INSERT INTO integration_logs (id, service, action, status, payload, "createdAt")
     VALUES (gen_random_uuid(), 'QUICKBOOKS', 'SYNC', 'SUCCESS', $1, NOW())`,
    [JSON.stringify({ source: 'sigmadb-cron', duration, ...stats })]
  );

  console.log(`  Done in ${duration}ms:`, stats);
  await pool.end();
}

main().catch(async (e) => {
  console.error(`[${new Date().toISOString()}] FATAL:`, e.message);
  try {
    await query(
      `INSERT INTO integration_logs (id, service, action, status, error, "createdAt")
       VALUES (gen_random_uuid(), 'QUICKBOOKS', 'SYNC', 'ERROR', $1, NOW())`,
      [e.message]
    );
  } catch {}
  await pool.end();
  process.exit(1);
});
