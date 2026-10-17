// Real PostgreSQL fixture; the original report code and fixed code read the
// same tenant. This compares report calculations, not legacy posting behavior.
const { requireTestDatabase } = require('./databaseTarget');
if (process.env.DATABASE_URL !== requireTestDatabase()) throw new Error('Wrong report fixture target.');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');
process.env.JWT_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
const jwt = require('jsonwebtoken');
const db = require('../src/utils/prismaClient');
const app = require('../src/app');
const { businessDay, dateOnly } = require('../src/utils/businessDate');
const { financialData, trialBalanceData, balanceSheetData } = require('../src/services/financialReportService');
const { partyStatement, bankStatement } = require('../src/services/statementService');

function oldController(name) {
  const source = execFileSync('git', ['show', `176b6e3775e0619a11cba576aa1fe252bf693ddc:backend/src/controllers/${name}.js`], { encoding: 'utf8' });
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: () => db, Date, console });
  return module.exports;
}
async function call(handler, req) {
  let result;
  await handler(req, { json: (value) => { result = value.data || value; } }, (error) => { throw error; });
  return result;
}

test('F01/F07-F11/G01: live report and Dashboard before/after comparison', { timeout: 240000 }, async () => {
  let owner, server;
  try {
    owner = await db.user.create({ data: { businessName: 'Audit report fixture', ownerName: 'Fixture', email: `${randomUUID()}@test.invalid`, passwordHash: 'not-a-login-hash' } });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = jwt.sign({ userId: owner.id, role: 'OWNER' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    async function post(route, body, method = 'POST') {
      const response = await fetch(base + route, { method, headers: { ...headers, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      const value = await response.json();
      assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(value)}`);
      return value.data;
    }
    const customer = await post('/customers', { customerName: 'Report customer', openingBalance: 50 });
    const supplier = await post('/companies', { companyName: 'Report supplier', openingBalance: 20 });
    const bank = await post('/bank-accounts', { bankName: 'Fixture Bank', accountTitle: 'Fixture', accountNumber: randomUUID(), openingBalance: 100 });
    const product = await post('/products', { productName: 'Report product', purchasePrice: 10, salePrice: 30, stockQty: 10 });
    const day = businessDay(), prior = new Date(dateOnly(day).getTime() - 86400000);
    // Move only this newly-created fixture's opening rows into the prior day.
    for (const model of ['customer', 'company', 'bankAccount', 'product']) await db[model].updateMany({ where: { userId: owner.id }, data: { createdAt: prior } });
    await db.ledgerTransaction.updateMany({ where: { userId: owner.id }, data: { transactionDate: prior } });
    await db.bankBookEntry.updateMany({ where: { userId: owner.id }, data: { transactionDate: prior } });
    await db.stockMovement.updateMany({ where: { userId: owner.id }, data: { movementDate: prior } });
    await post('/purchases', { companyId: supplier.id, paidAmount: 50, paymentMethod: 'BANK', bankAccountId: bank.id, items: [{ productId: product.id, qty: 10, unitPrice: 20 }] });
    const invoice = await post('/invoices', { customerId: customer.id, paidAmount: 40, paymentMethod: 'BANK', bankAccountId: bank.id, items: [{ productId: product.id, qty: 4, freePcs: 1, unitPrice: 30 }] });
    await post(`/invoices/${invoice.id}/payment`, { amount: 20, paymentMethod: 'CASH' }, 'PATCH');
    const req = { user: { id: owner.id }, query: { asOn: day } };
    const original = oldController('reportController');
    const beforeTB = await call(original.trialBalance, req), beforeBS = await call(original.balanceSheet, req);
    const beforeCustomer = await call(oldController('ledgerController').customerLedger, { ...req, query: { from: day }, params: { customerId: customer.id } });
    const beforeSupplier = await call(oldController('ledgerController').companyLedger, { ...req, query: { from: day }, params: { companyId: supplier.id } });
    const beforeBank = await call(oldController('bankBookController').list, { ...req, query: { bankAccountId: bank.id } });
    let beforeDashboard;
    try { beforeDashboard = await call(oldController('dashboardController').stats, req); } catch (error) { beforeDashboard = { failed: true, reason: error.message }; }
    assert.equal(beforeDashboard.failed, true);
    const fd = await financialData(db, owner.id, day), tb = trialBalanceData(fd), bs = balanceSheetData(fd);
    const customerLedger = await partyStatement(db, owner.id, 'CUSTOMER', customer.id, { from: day });
    const supplierLedger = await partyStatement(db, owner.id, 'COMPANY', supplier.id, { from: day });
    const bankBook = await bankStatement(db, owner.id, bank.id);
    const response = await fetch(base + '/dashboard/stats', { headers, signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200);
    const dashboard = (await response.json()).data;
    assert.equal(tb.totalDebit, 445); assert.equal(tb.totalCredit, 445); assert.equal(tb.isBalanced, true);
    assert.equal(bs.totalAssets, 445); assert.equal(bs.totalLiabilities, 170); assert.equal(bs.totalEquity, 275);
    assert.equal(customerLedger.summary.closingBalance, '110.00'); assert.equal(supplierLedger.summary.closingBalance, '-170.00'); assert.equal(bankBook.summary.closingBalance, '90.00');
    for (const [name, value] of Object.entries({ todaySales: '120.00', todayCOGS: '75.00', todayProfit: '45.00', todayPurchases: '200.00', totalReceivables: '110.00', totalPayables: '170.00', cashInHand: '20.00', combinedLiquidity: '110.00' })) assert.equal(dashboard[name], value, name);
    console.log(JSON.stringify({ liveTestFixture: true, comparison: 'original and fixed report code against identical new fixture rows', before: { trialBalance: [beforeTB.totalDebit, beforeTB.totalCredit], balanceSheet: [beforeBS.totalAssets, beforeBS.totalLiabilities, beforeBS.totalEquity], customerLedger: beforeCustomer.summary.closingBalance, supplierLedger: beforeSupplier.summary.closingBalance, bankBook: beforeBank.summary.closingBalance, dashboard: beforeDashboard }, after: { trialBalance: [tb.totalDebit, tb.totalCredit], balanceSheet: [bs.totalAssets, bs.totalLiabilities, bs.totalEquity], customerLedger: customerLedger.summary.closingBalance, supplierLedger: supplierLedger.summary.closingBalance, bankBook: bankBook.summary.closingBalance, dashboard: Object.fromEntries(['todaySales', 'todayCOGS', 'todayProfit', 'todayPurchases', 'totalReceivables', 'totalPayables', 'cashInHand', 'combinedLiquidity', 'complete'].map((key) => [key, dashboard[key]])) } }, null, 2));
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      if (owner) {
        // Remove dependent fixture purchases first: product FKs use RESTRICT.
        await db.purchase.deleteMany({ where: { userId: owner.id } });
        await db.auditEvent.deleteMany({ where: { userId: owner.id } });
        await db.idempotencyRecord.deleteMany({ where: { userId: owner.id } });
        await db.user.delete({ where: { id: owner.id } });
      }
    } finally { await db.$disconnect(); await db.pool.end(); }
  }
});
