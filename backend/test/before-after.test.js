const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { fixture, trading } = require('./financial.fixture');
const { buildFinancialData, trialBalanceData, balanceSheetData } = require('../src/services/financialReportService');
const { statement, openingFallback } = require('../src/services/statementService');

function baseline(file, db) {
  const source = execFileSync('git', ['show', `176b6e3775e0619a11cba576aa1fe252bf693ddc:backend/src/${file}`], { encoding: 'utf8' });
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: () => db, Date, console });
  return module.exports;
}
function aggregate(rows, keys) { return { _sum: Object.fromEntries(keys.map((k) => [k, rows.reduce((s, r) => s + Number(r[k] || 0), 0)])) }; }
function groups(rows, by, keys) { return [...new Set(rows.map((r) => r[by]))].map((id) => ({ [by]: id, ...aggregate(rows.filter((r) => r[by] === id), keys) })); }

test('Approved fixture: before/after key report numbers use the audited baseline code', async () => {
  const f = fixture();
  const legacy = f.ledger.map((r) => r.partyType === 'COMPANY' ? { ...r, debit: r.credit, credit: r.debit } : r);
  const db = {
    cashBookEntry: { aggregate: async () => aggregate(f.cash, ['cashIn', 'cashOut']), groupBy: async () => [] },
    bankAccount: { findMany: async () => f.banks, findFirst: async () => f.banks[0] },
    bankBookEntry: { groupBy: async () => groups(f.bank, 'bankAccountId', ['debit', 'credit']), findMany: async () => f.bank, count: async () => f.bank.length },
    ledgerTransaction: { groupBy: async ({ where }) => groups(legacy.filter((r) => r.partyType === where.partyType), 'partyId', ['debit', 'credit']), findMany: async ({ where }) => legacy.filter((r) => r.partyType === where.partyType && (!where.transactionDate || r.transactionDate >= where.transactionDate.gte)) },
    customer: { findMany: async () => f.customers, findFirst: async () => f.customers[0] }, company: { findMany: async () => f.companies, findFirst: async () => f.companies[0] },
    accountHead: { findMany: async () => [] }, product: { findMany: async () => f.products },
  };
  const old = baseline('controllers/reportController.js', db);
  const call = async (handler, req) => { let result; await handler(req, { json: (v) => { result = v.data || v; } }, (e) => { throw e; }); return result; };
  const req = { user: { id: 'fixture' }, query: { asOn: trading } };
  const beforeTB = await call(old.trialBalance, req), beforeBS = await call(old.balanceSheet, req);
  const beforeBank = await call(baseline('controllers/bankBookController.js', db).list, { user: req.user, query: { bankAccountId: 'b' } });
  const beforeCustomer = await call(baseline('controllers/ledgerController.js', db).customerLedger, { user: req.user, query: { from: trading }, params: { customerId: 'c' } });
  const beforeSupplier = await call(baseline('controllers/ledgerController.js', db).companyLedger, { user: req.user, query: { from: trading }, params: { companyId: 's' } });
  const fd = buildFinancialData(f, trading), afterTB = trialBalanceData(fd), afterBS = balanceSheetData(fd);
  const afterBank = statement(f.bank, { opening: openingFallback(f.banks[0], f.bank) });
  const afterCustomer = statement(f.ledger.filter((r) => r.partyType === 'CUSTOMER'), { from: trading, partyType: 'CUSTOMER' });
  const afterSupplier = statement(f.ledger.filter((r) => r.partyType === 'COMPANY'), { from: trading, partyType: 'COMPANY' });
  assert.equal(beforeTB.totalDebit, 615); assert.equal(beforeTB.totalCredit, 0);
  assert.equal(beforeBS.totalLiabilities, -170); assert.equal(beforeBS.totalEquity, 615);
  assert.equal(beforeBank.summary.closingBalance, '190.00'); assert.equal(beforeCustomer.summary.closingBalance, '60.00'); assert.equal(beforeSupplier.summary.closingBalance, '150.00');
  console.table([
    { report: 'Trial Balance debit / credit', before: `${beforeTB.totalDebit} / ${beforeTB.totalCredit}`, after: `${afterTB.totalDebit} / ${afterTB.totalCredit}` },
    { report: 'Balance Sheet assets / liabilities / equity', before: `${beforeBS.totalAssets} / ${beforeBS.totalLiabilities} / ${beforeBS.totalEquity}`, after: `${afterBS.totalAssets} / ${afterBS.totalLiabilities} / ${afterBS.totalEquity}` },
    { report: 'Filtered customer closing (DR)', before: beforeCustomer.summary.closingBalance, after: afterCustomer.summary.closingBalance },
    { report: 'Filtered supplier closing (DR positive / CR negative)', before: beforeSupplier.summary.closingBalance, after: afterSupplier.summary.closingBalance },
    { report: 'Bank book closing', before: beforeBank.summary.closingBalance, after: afterBank.summary.closingBalance },
  ]);
});
