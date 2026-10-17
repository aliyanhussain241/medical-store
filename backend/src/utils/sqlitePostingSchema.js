// Narrow additive desktop upgrade for the approved posting metadata. This is
// not a provider adapter and never changes existing financial values.
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
async function ensureSqlitePostingSchema({ prisma, beforeUpgrade }) {
  const state = await missingColumns(prisma);
  if (!state.missing.length && !state.metadataMissing) return;
  // Caller must produce a verified consistent backup before schema changes.
  if (typeof beforeUpgrade !== 'function') throw new Error('Verified backup callback is required before upgrading.');
  await beforeUpgrade();
  await prisma.$transaction(async (tx) => {
    for (const { table, name, type } of state.missing) await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`);
    await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, "before" TEXT NOT NULL, "after" TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS audit_events_user_id_entity_id_idx ON audit_events(user_id, entity_id)');
    await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS idempotency_records (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, "key" TEXT NOT NULL, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, status INTEGER NOT NULL, response TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS idempotency_records_user_id_key_key ON idempotency_records(user_id, "key")');
  });
}
module.exports = { ensureSqlitePostingSchema };
