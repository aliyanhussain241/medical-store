const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fixture } = require('./financial.fixture');

test('F03/F05 step 7: discrepancy scan is SELECT-only and never proposes or applies repairs', async () => {
  const f = fixture(), queries = [], printed = [];
  const snake = (row) => Object.fromEntries(Object.entries(row).map(([k,v]) => [k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()), v]));
  const tables = {
    customers: f.customers.map((r) => ({ ...r, userId: 'owner', currentBalance: 60 })),
    companies: f.companies.map((r) => ({ ...r, userId: 'owner', currentBalance: 170 })),
    bank_accounts: f.banks.map((r) => ({ ...r, userId: 'owner', currentBalance: 190 })),
    ledger_transactions: f.ledger.map((r) => ({ ...r, userId: 'owner' })), bank_book: f.bank.map((r) => ({ ...r, userId: 'owner' })),
    products: f.products.map((r) => ({ ...r, userId: 'owner' })), stock_movements: f.movements.map((r) => ({ ...r, userId: 'owner' })),
  };
  class Pool {
    async connect() { return { query: async (sql) => { queries.push(sql); return { rows: /^SELECT \* FROM /.test(sql) ? tables[sql.slice(14)].map(snake) : [] }; }, release() {} }; }
    async end() {}
  }
  const source = fs.readFileSync(path.join(__dirname, '../scripts/discrepancies.js'), 'utf8');
  await vm.runInNewContext(source, { URL, process: { env: {}, argv: [] }, require: (name) => {
    if (name.includes('databaseTarget')) return { requireTestDatabase: () => 'postgresql://unused.test/disposable' };
    if (name === 'pg') return { Pool };
    return require('../src/services/statementService');
  }, console: { log: (value) => printed.push(JSON.parse(value)), error: (e) => { throw Error(e); } } });
  assert.equal(queries[0], 'BEGIN TRANSACTION READ ONLY'); assert.equal(queries.at(-1), 'ROLLBACK');
  assert.ok(queries.every((q) => /^(SELECT|BEGIN TRANSACTION READ ONLY|ROLLBACK)/.test(q)));
  assert.equal(printed[0].historicalRepair, false);
  assert.equal(printed[0].differences.find((r) => r.type === 'CUSTOMER').computed, '110.00');
  assert.equal(printed[0].differences.find((r) => r.type === 'BANK').computed, '90.00');
  assert.equal(tables.customers[0].currentBalance, 60); assert.equal(tables.bank_accounts[0].currentBalance, 190);
});
