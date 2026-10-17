const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, trading, row } = require('./financial.fixture');
const { buildFinancialData, trialBalanceData, balanceSheetData } = require('../src/services/financialReportService');
const { statement, openingFallback } = require('../src/services/statementService');
const { businessDay } = require('../src/utils/businessDate');
const { number } = require('../src/utils/input');
const { requireTestDatabase } = require('./databaseTarget');

test('F07/F08: independently reconciled trial balance and balance sheet', () => {
  const fd = buildFinancialData(fixture(), trading), tb = trialBalanceData(fd), bs = balanceSheetData(fd);
  assert.equal(fd.grossProfit, 45); assert.equal(fd.totalCost, 75); assert.equal(fd.inventoryValue, 225);
  assert.equal(tb.totalDebit, 445); assert.equal(tb.totalCredit, 445); assert.equal(tb.isBalanced, true);
  assert.equal(bs.totalAssets, 445); assert.equal(bs.totalLiabilities, 170); assert.equal(bs.totalEquity, 275); assert.equal(bs.isBalanced, true);
  const broken = fixture(); broken.cash.push(row('unexplained', trading, { cashIn: 10, cashOut: 0 }));
  assert.equal(balanceSheetData(buildFinancialData(broken, trading)).isBalanced, false);
});

test('F09/F10/F11: openings counted once, full totals independent of pagination', () => {
  const f = fixture(); const bank = statement(f.bank, { opening: openingFallback(f.banks[0], f.bank), from: trading, to: trading, page: 2, limit: 1 });
  assert.equal(bank.openingBalance, '100.00'); assert.equal(bank.summary.closingBalance, '90.00'); assert.equal(bank.total, 2);
  assert.equal(bank.entries.length, 1); assert.equal(bank.pageOpeningBalance, '50.00');
  const customer = statement(f.ledger.filter((r) => r.partyType === 'CUSTOMER'), { from: trading, partyType: 'CUSTOMER' });
  assert.equal(customer.openingBalance, '50.00'); assert.equal(customer.summary.closingBalance, '110.00');
  const supplier = statement(f.ledger.filter((r) => r.partyType === 'COMPANY'), { from: trading, partyType: 'COMPANY' });
  assert.equal(supplier.openingBalance, '-20.00'); assert.equal(supplier.summary.closingBalance, '-170.00');
});

test('F08: as-of values exclude future parties and stock; missing evidence is unverified', () => {
  const f = fixture(), old = buildFinancialData(f, '2026-10-10');
  assert.equal(old.inventoryValue, 100); assert.equal(old.grossProfit, 0); assert.equal(old.totalPayableCr, 20);
  f.movements[0].valueDelta = null;
  const incomplete = balanceSheetData(buildFinancialData(f, trading));
  assert.equal(incomplete.complete, false); assert.equal(incomplete.isBalanced, false); assert.ok(incomplete.warnings.length);
});

test('F07: known legacy supplier signs normalize only in returned statements', () => {
  const rows = [{ ...row('legacy', trading, { debit: 100, credit: 0, referenceType: 'PURCHASE' }) }];
  assert.equal(statement(rows, { partyType: 'COMPANY' }).summary.closingBalance, '-100.00');
  assert.equal(rows[0].debit, 100);
});

test('F06/F14: strict finite decimal validation and Karachi calendar boundaries', () => {
  for (const input of ['12garbage', '-1', 'Infinity', '', NaN, null, {}, true]) assert.throws(() => number(input, 'amount'));
  assert.throws(() => number('101', 'discount', { max: 100 }));
  assert.equal(businessDay('2026-10-16T20:30:00Z'), '2026-10-17');
  assert.throws(() => businessDay('2026-02-30'));
});

test('P01: database harness fails closed without approved disposable target', () => {
  assert.throws(() => requireTestDatabase({ DATABASE_URL: 'postgresql://production/real' }), /TEST_DATABASE_URL/);
  assert.throws(() => requireTestDatabase({ TEST_DATABASE_URL: 'postgresql://u:p@unknown/db', ALLOW_TEST_DATABASE_WRITES: 'yes' }), /not the owner-approved/);
  for (const query of ['host=production', 'database=production', 'user=production', 'options=endpoint%3Dproduction', 'sslmode=disable']) {
    assert.throws(() => requireTestDatabase({ TEST_DATABASE_URL: 'postgresql://u:p@unknown/db?' + query, ALLOW_TEST_DATABASE_WRITES: 'yes' }), /unsupported URL/);
  }
});
