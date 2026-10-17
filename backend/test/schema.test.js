const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('F03/F05/F07: generated PostgreSQL enum supports every new ledger posting reference', () => {
  const { ReferenceType } = require('@prisma/client');
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/posting-safety.sql'), 'utf8');
  for (const name of ['OPENING_BALANCE_V2', 'PURCHASE_V2', 'SUPPLIER_PAYMENT_V2', 'INVOICE_INITIAL_PAYMENT', 'INVOICE_PAYMENT', 'INVOICE_REVERSAL']) {
    assert.equal(ReferenceType[name], name, `Regenerate the Prisma client: missing ${name}`);
    assert.ok(sql.includes(`ADD VALUE IF NOT EXISTS '${name}'`));
  }
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /\b(DROP|TRUNCATE|DELETE|UPDATE)\b/i);
});
