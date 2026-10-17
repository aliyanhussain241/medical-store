-- Additive schema ONLY. No backfill, financial repair, or automatic deployment.
-- Apply first to the owner-approved disposable database through the guarded runner.
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE_V2';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'PURCHASE_V2';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'SUPPLIER_PAYMENT_V2';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'INVOICE_INITIAL_PAYMENT';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'INVOICE_PAYMENT';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'INVOICE_REVERSAL';
BEGIN;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS initial_paid_amount DECIMAL(15,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recorded_cost DECIMAL(15,2);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(30,15);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS value_delta DECIMAL(15,2);
ALTER TABLE cash_book ADD COLUMN IF NOT EXISTS account_category TEXT;
ALTER TABLE cash_book ADD COLUMN IF NOT EXISTS account_head_name TEXT;
ALTER TABLE bank_book ADD COLUMN IF NOT EXISTS account_category TEXT;
ALTER TABLE bank_book ADD COLUMN IF NOT EXISTS account_head_name TEXT;
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, entity_id TEXT NOT NULL,
  action TEXT NOT NULL, "before" TEXT NOT NULL, "after" TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_events_user_id_entity_id_idx ON audit_events(user_id, entity_id);
CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, "key" TEXT NOT NULL,
  operation TEXT NOT NULL, fingerprint TEXT NOT NULL, status INTEGER NOT NULL,
  response TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_records_user_id_key_key ON idempotency_records(user_id, "key");
COMMIT;
