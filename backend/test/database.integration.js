// Run only via scripts/test-database.js after the owner supplies a target.
const { requireTestDatabase } = require('./databaseTarget');
if (process.env.DATABASE_URL !== requireTestDatabase()) throw new Error('Integration database does not match the approved test target.');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
process.env.JWT_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
const jwt = require('jsonwebtoken');
const prisma = require('../src/utils/prismaClient');
const app = require('../src/app');

test('Neon integration: tenant ownership, atomic oversell, concurrent settlement, idempotency and revisions', async () => {
  const owner = await prisma.user.create({ data: { businessName: 'Disposable audit fixture', ownerName: 'Fixture', email: `${randomUUID()}@test.invalid`, passwordHash: 'not-a-login-hash' } });
  const foreign = await prisma.user.create({ data: { businessName: 'Foreign fixture', ownerName: 'Fixture', email: `${randomUUID()}@test.invalid`, passwordHash: 'not-a-login-hash' } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign({ userId: owner.id, role: 'OWNER' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  async function post(route, body, key = randomUUID(), method = 'POST') {
    const response = await fetch(url + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    const customer = await post('/customers', { customerName: 'Fixture', openingBalance: 0 });
    assert.equal(customer.status, 201);
    const product = await post('/products', { productName: 'Fixture', purchasePrice: '10.00', salePrice: '20.00', stockQty: 10 });
    assert.equal(product.status, 201);
    const otherProduct = await prisma.product.create({ data: { userId: foreign.id, productName: 'Foreign', unit: 'Pack', purchasePrice: 10, salePrice: 20, stockQty: 100 } });
    const payload = { customerId: customer.body.data.id, paidAmount: 0, items: [{ productId: product.body.data.id, qty: 8, unitPrice: 20 }] };
    const blocked = await post('/invoices', { ...payload, items: [{ productId: otherProduct.id, qty: 1, unitPrice: 20 }] });
    assert.equal(blocked.status, 400);
    const attempts = await Promise.all([post('/invoices', payload), post('/invoices', payload)]);
    assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 400]);
    assert.equal(Number((await prisma.product.findUnique({ where: { id: product.body.data.id } })).stockQty), 2);
    const invoice = attempts.find((r) => r.status === 201).body.data;
    const payments = await Promise.all([post(`/invoices/${invoice.id}/payment`, { amount: 100 }, undefined, 'PATCH'), post(`/invoices/${invoice.id}/payment`, { amount: 100 }, undefined, 'PATCH')]);
    assert.deepEqual(payments.map((r) => r.status).sort(), [200, 400]);
    const key = randomUUID();
    const paid = await post(`/invoices/${invoice.id}/payment`, { amount: 10 }, key, 'PATCH');
    const retried = await post(`/invoices/${invoice.id}/payment`, { amount: 10 }, key, 'PATCH');
    assert.equal(paid.status, 200); assert.deepEqual(retried, paid);
    const edit = await post(`/invoices/${invoice.id}`, { ...payload, paidAmount: 110, items: [{ productId: product.body.data.id, qty: 9, unitPrice: 20 }] }, undefined, 'PUT');
    assert.equal(edit.status, 200); assert.equal(Number(edit.body.data.paidAmount), 110);
    assert.equal(await prisma.ledgerTransaction.count({ where: { userId: owner.id, referenceId: invoice.id, referenceType: 'INVOICE_PAYMENT' } }), 2);
    assert.equal(await prisma.auditEvent.count({ where: { userId: owner.id, action: 'INVOICE_EDIT' } }), 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const user of [owner, foreign]) {
      await prisma.auditEvent.deleteMany({ where: { userId: user.id } });
      await prisma.idempotencyRecord.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect(); await prisma.pool.end();
  }
});
