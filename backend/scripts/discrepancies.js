// SELECT-only reconciliation. No suggested repair or mutation is performed.
const { requireTestDatabase } = require('../test/databaseTarget');
const target = requireTestDatabase(process.env, { writes: false });
const { Pool } = require('pg');
const { statement, openingFallback, D } = require('../src/services/statementService');

async function run() {
  const verified = new URL(target);
  verified.searchParams.delete('sslmode');
  const pool = new Pool({ connectionString: verified.toString(), ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 60000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const names = ['customers', 'companies', 'bank_accounts', 'ledger_transactions', 'bank_book', 'products', 'stock_movements'];
    const tables = {};
    for (const name of names) {
      const result = await client.query(`SELECT * FROM ${name}`);
      tables[name] = result.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])));
    }
    const differences = [];
    for (const [table, type] of [['customers', 'CUSTOMER'], ['companies', 'COMPANY']]) for (const entity of tables[table]) {
      const rows = tables.ledger_transactions.filter((r) => r.userId === entity.userId && r.partyType === type && r.partyId === entity.id);
      const closing = D(statement(rows, { partyType: type, opening: D(openingFallback(entity, rows)).mul(type === 'COMPANY' ? -1 : 1) }).summary.closingBalance).mul(type === 'COMPANY' ? -1 : 1);
      if (!closing.eq(entity.currentBalance)) differences.push({ type, id: entity.id, stored: String(entity.currentBalance), computed: closing.toFixed(2) });
    }
    for (const entity of tables.bank_accounts) {
      const rows = tables.bank_book.filter((r) => r.userId === entity.userId && r.bankAccountId === entity.id);
      const closing = statement(rows, { opening: openingFallback(entity, rows) }).summary.closingBalance;
      if (!D(closing).eq(entity.currentBalance)) differences.push({ type: 'BANK', id: entity.id, stored: String(entity.currentBalance), computed: closing });
    }
    for (const product of tables.products) {
      const rows = tables.stock_movements.filter((r) => r.userId === product.userId && r.productId === product.id);
      const qty = rows.reduce((sum, r) => sum.plus(r.qty), D(0));
      if (!rows.some((r) => r.notes === 'INITIAL_INVENTORY')) differences.push({ type: 'INVENTORY_EVIDENCE', id: product.id, status: 'Unverified: opening snapshot unavailable' });
      else if (!qty.eq(product.stockQty)) differences.push({ type: 'STOCK', id: product.id, stored: String(product.stockQty), computed: qty.toString() });
    }
    await client.query('ROLLBACK');
    const summary = process.argv.includes('--summary') ? {
      counts: differences.reduce((counts, row) => { counts[row.type] = (counts[row.type] || 0) + 1; return counts; }, {}),
      differences: differences.filter((row) => row.type !== 'INVENTORY_EVIDENCE'),
    } : { differences };
    console.log(JSON.stringify({ readOnly: true, historicalRepair: false, ...summary }, null, 2));
  } finally { client.release(); await pool.end(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
