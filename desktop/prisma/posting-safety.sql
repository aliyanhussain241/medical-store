-- Explicit SQLite migration for the pre-Batch-1 schema. Run once, offline.
-- Additive only; no historical financial values are repaired or removed.
BEGIN IMMEDIATE;
ALTER TABLE invoices ADD COLUMN initial_paid_amount NUMERIC;
ALTER TABLE invoices ADD COLUMN recorded_cost NUMERIC;
ALTER TABLE invoice_items ADD COLUMN unit_cost NUMERIC;
ALTER TABLE stock_movements ADD COLUMN value_delta NUMERIC;
ALTER TABLE cash_book ADD COLUMN account_category TEXT;
ALTER TABLE cash_book ADD COLUMN account_head_name TEXT;
ALTER TABLE bank_book ADD COLUMN account_category TEXT;
ALTER TABLE bank_book ADD COLUMN account_head_name TEXT;
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, "before" TEXT NOT NULL, "after" TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_events_user_id_entity_id_idx ON audit_events(user_id, entity_id);
CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, "key" TEXT NOT NULL,
  operation TEXT NOT NULL, fingerprint TEXT NOT NULL, status INTEGER NOT NULL,
  response TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idempotency_records_user_id_key_key ON idempotency_records(user_id, "key");
COMMIT;
