// Read-only desktop startup preflight. Migrations are explicit release steps.
const columns = {
  invoices: { initial_paid_amount: 'NUMERIC', recorded_cost: 'NUMERIC' },
  invoice_items: { unit_cost: 'NUMERIC' },
  stock_movements: { value_delta: 'NUMERIC' },
  cash_book: { account_category: 'TEXT', account_head_name: 'TEXT' },
  bank_book: { account_category: 'TEXT', account_head_name: 'TEXT' },
};
async function missingColumns(prisma) {
  const missing = [];
  for (const [table, fields] of Object.entries(columns)) {
    const existing = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    if (!existing.length) throw new Error(`Cannot upgrade missing table ${table}; the original database is unchanged.`);
    for (const [name, type] of Object.entries(fields)) if (!existing.some((r) => r.name === name)) missing.push({ table, name, type });
  }
  const metadata = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('audit_events', 'idempotency_records')");
  return { missing, metadataMissing: metadata.length !== 2 };
}
async function ensureSqlitePostingSchema({ prisma }) {
  const state = await missingColumns(prisma);
  if (!state.missing.length && !state.metadataMissing) return;
  throw new Error('Database schema upgrade required. Apply the reviewed posting-safety SQLite migration explicitly before launching this version. Startup never alters the schema.');
}
module.exports = { ensureSqlitePostingSchema };
