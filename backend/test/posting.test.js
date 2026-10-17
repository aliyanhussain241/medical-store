const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { memoryDatabase, loadWithDatabase, invoke } = require('./controllerHarness');
const { businessDay, dateOnly } = require('../src/utils/businessDate');

async function setup() {
  const memory = memoryDatabase(), db = memory.db, date = dateOnly();
  await db.customer.create({ data: { id: 'c', userId: 'owner', openingBalance: 0, currentBalance: 0 } });
  await db.bankAccount.create({ data: { id: 'b', userId: 'owner', openingBalance: 0, currentBalance: 0 } });
  await db.product.create({ data: { id: 'p', userId: 'owner', stockQty: 10, purchasePrice: 10, unit: 'Pack' } });
  await db.stockMovement.create({ data: { userId: 'owner', productId: 'p', movementType: 'ADJUSTMENT', qty: 10, valueDelta: 100, notes: 'INITIAL_INVENTORY', movementDate: date } });
  const invoice = loadWithDatabase(path.join(__dirname, '../src/controllers/invoiceController.js'), db);
  const payload = { customerId: 'c', invoiceDate: businessDay(), paidAmount: 20, paymentMethod: 'BANK', bankAccountId: 'b', items: [{ productId: 'p', qty: 2, unitPrice: 30, freePcs: 1 }] };
  return { ...memory, invoice, payload };
}

test('S01/S02: foreign products and account heads are rejected before posting', async () => {
  const { db, invoice, payload, tables } = await setup();
  await db.product.create({ data: { id: 'foreign', userId: 'other', stockQty: 100, purchasePrice: 1 } });
  await assert.rejects(invoke(invoice.create, { ...payload, items: [{ productId: 'foreign', qty: 1, unitPrice: 20 }] }), /business/);
  assert.equal(tables.invoice.length, 0); assert.equal(tables.product.find((p) => p.id === 'foreign').stockQty, 100);
  const valid = await invoke(invoice.create, payload);
  await assert.rejects(invoke(invoice.update, { ...payload, items: [{ productId: 'foreign', qty: 1, unitPrice: 20 }] }, { id: valid.data.id, method: 'PUT' }), /business/);
  assert.equal(tables.product.find((p) => p.id === 'foreign').stockQty, 100);
  const cash = loadWithDatabase(path.join(__dirname, '../src/controllers/cashBookController.js'), db);
  await db.accountHead.create({ data: { id: 'head', userId: 'other', name: 'Other', category: 'EXPENSE' } });
  await assert.rejects(invoke(cash.create, { description: 'No access', cashOut: 10, accountHeadId: 'head' }, { url: '/api/cash-book' }), /business/);
});

test('F02/F03/F14: editing retains later bank/cash payments and immutable audit snapshots', async () => {
  const { db, invoice, payload, tables } = await setup();
  const created = await invoke(invoice.create, payload);
  assert.equal(created.data.recordedCost, '30.00'); assert.equal(tables.product[0].stockQty, '7');
  await invoke(invoice.recordPayment, { amount: 10, paymentMethod: 'CASH' }, { id: created.data.id, url: '/api/invoices/' + created.data.id + '/payment', method: 'PATCH' });
  const laterCash = tables.cashBookEntry.filter((r) => r.referenceType === 'INVOICE_PAYMENT');
  const edited = await invoke(invoice.update, { ...payload, paidAmount: 30, items: [{ productId: 'p', qty: 3, unitPrice: 30, freePcs: 1 }] }, { id: created.data.id, url: '/api/invoices/' + created.data.id, method: 'PUT' });
  assert.equal(edited.data.totalAmount, '90.00'); assert.equal(edited.data.initialPaidAmount, '20.00'); assert.equal(edited.data.paidAmount, '30.00'); assert.equal(edited.data.balanceAmount, '60.00');
  assert.equal(tables.product[0].stockQty, '6'); assert.equal(tables.dailyProfit[0].totalSales, '90'); assert.equal(tables.dailyProfit[0].totalCost, '40'); assert.equal(tables.dailyProfit[0].totalProfit, '50');
  assert.deepEqual(tables.cashBookEntry.filter((r) => r.referenceType === 'INVOICE_PAYMENT'), laterCash);
  assert.equal(tables.bankAccount[0].currentBalance, '20'); assert.equal(tables.customer[0].currentBalance, '60');
  assert.equal(tables.auditEvent.filter((r) => r.action === 'INVOICE_EDIT').length, 1);
  assert.ok(tables.ledgerTransaction.some((r) => r.referenceType === 'INVOICE_REVERSAL'));
  assert.equal((await db.invoiceItem.findMany({ where: { invoiceId: created.data.id } })).length, 1);
});

test('F04/F05/F06: duplicate-line oversell rolls back, keyed retry returns original, invalid edits roll back', async () => {
  const { invoice, payload, tables } = await setup();
  const key = 'stable-request';
  const first = await invoke(invoice.create, payload, { key });
  const retry = await invoke(invoice.create, payload, { key });
  assert.equal(first.data.id, retry.data.id); assert.equal(tables.invoice.length, 1);
  await assert.rejects(invoke(invoice.create, { ...payload, paidAmount: 21 }, { key }), /another request/);
  const before = structuredClone(tables);
  await assert.rejects(invoke(invoice.create, { ...payload, items: [{ productId: 'p', qty: 4, unitPrice: 30 }, { productId: 'p', qty: 4, unitPrice: 30 }] }), /Insufficient stock/);
  assert.deepEqual(tables, before);
  await assert.rejects(invoke(invoice.update, { ...payload, items: [{ productId: 'p', qty: -5, unitPrice: 30 }] }, { id: first.data.id, method: 'PUT' }), /range/);
  assert.deepEqual(tables, before);
});

test('F03: legacy invoices fail closed without inventing cost/payment history', async () => {
  const { db, invoice } = await setup();
  await db.invoice.create({ data: { id: 'old', userId: 'owner', customerId: 'c', invoiceDate: dateOnly(), items: { create: [{ productId: 'p', qty: 1, unitPrice: 10 }] } } });
  await assert.rejects(invoke(invoice.update, {}, { id: 'old', method: 'PUT' }), /lacks reliable payment\/cost snapshots/);
});

test('F03: Karachi past-day edits remain password-gated; later payments prevent customer reassignment', async () => {
  const { db, invoice, payload, tables } = await setup();
  const bcrypt = require('bcryptjs');
  await db.user.create({ data: { id: 'owner', passwordHash: await bcrypt.hash('owner-password', 4) } });
  const prior = new Date(dateOnly().getTime() - 86400000).toISOString().slice(0, 10);
  tables.stockMovement[0].movementDate = dateOnly(prior);
  const created = await invoke(invoice.create, { ...payload, invoiceDate: prior });
  await assert.rejects(invoke(invoice.update, { ...payload }, { id: created.data.id, method: 'PUT' }), /owner password/);
  await assert.rejects(invoke(invoice.update, { ...payload, adminPassword: 'wrong' }, { id: created.data.id, method: 'PUT' }), /owner password/);
  const edited = await invoke(invoice.update, { ...payload, invoiceDate: prior, adminPassword: 'owner-password' }, { id: created.data.id, method: 'PUT' });
  assert.equal(edited.success, true);
  await invoke(invoice.recordPayment, { amount: 10 }, { id: created.data.id, method: 'PATCH' });
  await db.customer.create({ data: { id: 'second', userId: 'owner', openingBalance: 0, currentBalance: 0 } });
  await assert.rejects(invoke(invoice.update, { ...payload, customerId: 'second', adminPassword: 'owner-password', paidAmount: 30 }, { id: created.data.id, method: 'PUT' }), /later payments/);
});

test('F07/F14: purchases establish moving weighted average; bonus units consume that cost', async () => {
  const { db, invoice, payload, tables } = await setup();
  await db.company.create({ data: { id: 'supplier', userId: 'owner', openingBalance: 0, currentBalance: 0 } });
  const purchases = loadWithDatabase(path.join(__dirname, '../src/controllers/purchaseController.js'), db);
  await invoke(purchases.create, { companyId: 'supplier', paidAmount: 50, items: [{ productId: 'p', qty: 10, unitPrice: 20 }] }, { url: '/api/purchases' });
  assert.equal(tables.product[0].purchasePrice, '15.00'); assert.equal(tables.product[0].stockQty, '20');
  const created = await invoke(invoice.create, { ...payload, paidAmount: 0, items: [{ productId: 'p', qty: 4, freePcs: 1, unitPrice: 30 }] });
  assert.equal(created.data.recordedCost, '75.00'); assert.equal(tables.product[0].stockQty, '15');
  assert.equal(tables.company[0].currentBalance, '150');
  assert.ok(tables.ledgerTransaction.some((row) => row.referenceType === 'PURCHASE_V2' && row.credit === '200.00'));
});
