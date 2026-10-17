const bcrypt = require('bcryptjs');
const prisma = require('../utils/db');
const { D } = require('../services/statementService');
const { postParty, postMoney, invoiceLines, invoiceTotals, moveInvoiceStock, profit } = require('../services/postingService');
const { businessDay, dateOnly } = require('../utils/businessDate');
const { bad, number, enumeration } = require('../utils/input');
const { owned } = require('../utils/validatePosting');
const { transactionalController } = require('../utils/transactionalController');

async function nextInvoiceNo(userId) {
  const rows = await prisma.invoice.findMany({ where: { userId }, select: { invoiceNo: true } });
  const max = rows.reduce((n, row) => Math.max(n, Number(/^INV-(\d+)$/.exec(row.invoiceNo)?.[1] || 0)), 0);
  return 'INV-' + String(max + 1).padStart(5, '0');
}

async function list(req, res, next) {
  try {
    const { search, customerId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(customerId && { customerId }),
      ...(status && { paymentStatus: status }),
      ...((from || to) && {
        invoiceDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { customer: { customerName: { contains: search, mode: 'insensitive' } } },
          { customer: { shopName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { customerName: true, shopName: true } },
          items: { include: { product: { select: { productName: true, unit: true } } } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ success: true, data: invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/invoices/:id ─────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/invoices/:id/print ────────────────────────────
async function markPrinted(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { printCount: { increment: 1 } },
    });

    res.json({
      success: true,
      printCount: updated.printCount,
      status: updated.printCount > 1 ? 'COPY' : 'ORIGINAL',
    });
  } catch (err) {
    next(err);
  }
}


function status(total, paid) { return paid.gte(total) ? 'PAID' : paid.isZero() ? 'PENDING' : 'PARTIAL'; }
async function checkedBank(userId, method, id) { if (method === 'BANK') await owned('bankAccount', id, userId, 'Bank account'); }
async function load(userId, id) {
  const invoice = await prisma.invoice.findFirst({ where: { id, userId }, include: { customer: true, items: { include: { product: true } } } });
  if (!invoice) throw Object.assign(new Error('Invoice not found.'), { statusCode: 404 });
  return invoice;
}

async function initialEffects(invoice, lines, cost) {
  const { userId, id, customerId, invoiceDate, invoiceNo, paymentMethod, bankAccountId } = invoice;
  await moveInvoiceStock(userId, id, invoiceDate, lines);
  await postParty(userId, 'CUSTOMER', customerId, invoiceDate, 'Invoice — ' + invoiceNo, invoice.totalAmount, 0, 'INVOICE', id);
  const paid = D(invoice.initialPaidAmount);
  if (paid.gt(0)) {
    await postParty(userId, 'CUSTOMER', customerId, invoiceDate, 'Initial payment — ' + invoiceNo, 0, paid, 'INVOICE_INITIAL_PAYMENT', id);
    await postMoney({ userId, method: paymentMethod, bankAccountId, date: invoiceDate, amount: paid, description: 'Initial receipt — ' + invoiceNo, referenceType: 'INVOICE_INITIAL', referenceId: id });
  }
  await profit(userId, invoiceDate, invoice.totalAmount, cost);
}

async function create(req, res, next) {
  try {
    const b = req.body, userId = req.user.id;
    await owned('customer', b.customerId, userId, 'Customer');
    if (!Array.isArray(b.items) || !b.items.length) bad('At least one item is required.');
    const method = enumeration(b.paymentMethod, ['CASH', 'BANK'], 'payment method', 'CASH');
    const type = enumeration(b.invoiceType, ['CASH', 'CREDIT'], 'invoice type', 'CREDIT');
    await require('../services/postingService').requireAppendableStockDate(userId, b.items.map((i) => i.productId).filter(Boolean), b.invoiceDate);
    const lines = await invoiceLines(userId, b.items), { total, cost } = invoiceTotals(lines);
    const paid = number(b.paidAmount, 'paid amount', { optional: true });
    if (paid.gt(total)) bad('Payment exceeds invoice total.');
    if (type === 'CASH' && !paid.eq(total)) bad('Cash invoices must be paid in full.');
    if (method === 'BANK' && paid.gt(0)) await checkedBank(userId, method, b.bankAccountId);
    const invoice = await prisma.invoice.create({ data: {
      userId, customerId: b.customerId, invoiceNo: await nextInvoiceNo(userId), invoiceDate: dateOnly(b.invoiceDate), totalAmount: total.toFixed(2), recordedCost: cost.toFixed(2), paidAmount: paid.toFixed(2), initialPaidAmount: paid.toFixed(2), balanceAmount: total.minus(paid).toFixed(2), paymentStatus: status(total, paid), paymentMethod: method, bankAccountId: method === 'BANK' && paid.gt(0) ? b.bankAccountId : null, invoiceType: type, narration: b.narration || null, salesman: b.salesman || null, notes: b.notes || null,
      prvBalance: (await require('../services/statementService').partyStatement(prisma, userId, 'CUSTOMER', b.customerId, { to: businessDay(b.invoiceDate) })).summary.closingBalance,
      items: { create: lines },
    } });
    await initialEffects(invoice, lines, cost);
    await prisma.customer.updateMany({ where: { id: b.customerId, userId }, data: { currentBalance: { increment: total.minus(paid).toFixed(2) } } });
    const full = await load(userId, invoice.id);
    await prisma.auditEvent.create({ data: { userId, entityId: invoice.id, action: 'INVOICE_CREATE', before: 'null', after: JSON.stringify(full) } });
    res.status(201).json({ success: true, message: 'Invoice ' + invoice.invoiceNo + ' created successfully.', data: full });
  } catch (error) { next(error); }
}

async function recordPayment(req, res, next) {
  try {
    const invoice = await load(req.user.id, req.params.id), b = req.body;
    const amount = number(b.amount, 'payment amount', { min: '0.01' });
    const method = enumeration(b.paymentMethod, ['CASH', 'BANK'], 'payment method', 'CASH');
    if (amount.gt(invoice.balanceAmount)) bad('Payment exceeds balance due.');
    await checkedBank(req.user.id, method, b.bankAccountId);
    const paid = D(invoice.paidAmount).plus(amount), balance = D(invoice.balanceAmount).minus(amount);
    const changed = await prisma.invoice.updateMany({ where: { id: invoice.id, userId: req.user.id, paidAmount: invoice.paidAmount, balanceAmount: { gte: amount.toFixed(2) } }, data: { paidAmount: paid.toFixed(2), balanceAmount: balance.toFixed(2), paymentStatus: status(D(invoice.totalAmount), paid) } });
    if (changed.count !== 1) throw Object.assign(new Error('Invoice changed. Reload and retry.'), { statusCode: 409 });
    await postParty(req.user.id, 'CUSTOMER', invoice.customerId, b.paymentDate, 'Later payment — ' + invoice.invoiceNo, 0, amount, 'INVOICE_PAYMENT', invoice.id);
    await postMoney({ userId: req.user.id, method, bankAccountId: b.bankAccountId, date: b.paymentDate, amount, description: 'Later receipt — ' + invoice.invoiceNo, referenceType: 'INVOICE_PAYMENT', referenceId: invoice.id });
    await prisma.customer.updateMany({ where: { id: invoice.customerId, userId: req.user.id }, data: { currentBalance: { decrement: amount.toFixed(2) } } });
    await prisma.auditEvent.create({ data: { userId: req.user.id, entityId: invoice.id, action: 'INVOICE_PAYMENT', before: JSON.stringify({ paid: invoice.paidAmount, balance: invoice.balanceAmount }), after: JSON.stringify({ paid, balance, amount, method, bankAccountId: b.bankAccountId || null, date: businessDay(b.paymentDate) }) } });
    res.json({ success: true, message: 'Payment recorded.' });
  } catch (error) { next(error); }
}

async function reverseInitial(invoice) {
  const userId = invoice.userId;
  const ledger = await prisma.ledgerTransaction.findMany({ where: { userId, referenceId: invoice.id, referenceType: { in: ['INVOICE', 'INVOICE_INITIAL_PAYMENT'] } } });
  for (const row of ledger) {
    if (await prisma.ledgerTransaction.findFirst({ where: { userId, referenceId: row.id, referenceType: 'INVOICE_REVERSAL' } })) continue;
    await postParty(userId, 'CUSTOMER', invoice.customerId, row.transactionDate, 'Revision reversal — ' + invoice.invoiceNo, row.credit, row.debit, 'INVOICE_REVERSAL', row.id);
  }
  for (const [model, method] of [['cashBookEntry', 'CASH'], ['bankBookEntry', 'BANK']]) {
    const entries = await prisma[model].findMany({ where: { userId, referenceId: invoice.id, referenceType: 'INVOICE_INITIAL' } });
    for (const row of entries) {
      if (await prisma[model].findFirst({ where: { userId, referenceId: row.id, referenceType: 'INVOICE_REVERSAL' } })) continue;
      const amount = method === 'CASH' ? D(row.cashOut).minus(row.cashIn) : D(row.credit).minus(row.debit);
      await postMoney({ userId, method, bankAccountId: row.bankAccountId, date: row.transactionDate, amount, description: 'Revision reversal — ' + invoice.invoiceNo, referenceType: 'INVOICE_REVERSAL', referenceId: row.id });
    }
  }
  await moveInvoiceStock(userId, invoice.id, invoice.invoiceDate, invoice.items, true);
  await profit(userId, invoice.invoiceDate, D(invoice.totalAmount).negated(), D(invoice.recordedCost).negated());
}

async function update(req, res, next) {
  try {
    const original = await load(req.user.id, req.params.id), b = req.body;
    if (businessDay(original.invoiceDate) !== businessDay()) {
      const owner = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (typeof b.adminPassword !== 'string' || !(await bcrypt.compare(b.adminPassword, owner.passwordHash))) throw Object.assign(new Error('Store owner password is required to edit past-dated invoices.'), { statusCode: 401 });
    }
    if (original.initialPaidAmount === null || original.initialPaidAmount === undefined || original.recordedCost === null || original.recordedCost === undefined || original.items.some((i) => i.unitCost === null || i.unitCost === undefined)) {
      throw Object.assign(new Error('This legacy invoice lacks reliable payment/cost snapshots. Editing requires a separately reviewed migration; no records were changed.'), { statusCode: 409 });
    }
    const later = D(original.paidAmount).minus(original.initialPaidAmount);
    const customerId = b.customerId || original.customerId;
    if (later.gt(0) && customerId !== original.customerId) bad('An invoice with later payments cannot be moved to another customer.');
    await owned('customer', customerId, req.user.id, 'Customer');
    const lines = await invoiceLines(req.user.id, b.items || original.items, original.items), { total, cost } = invoiceTotals(lines);
    const paid = number(b.paidAmount ?? original.paidAmount, 'paid amount');
    const initial = paid.minus(later);
    if (initial.lt(0) || paid.gt(total)) bad('Revised total/payment must preserve all later payments without overpayment.');
    const method = enumeration(b.paymentMethod ?? original.paymentMethod, ['CASH', 'BANK'], 'payment method');
    const bankAccountId = b.bankAccountId ?? original.bankAccountId;
    if (initial.gt(0)) await checkedBank(req.user.id, method, bankAccountId);
    const type = enumeration(b.invoiceType ?? original.invoiceType, ['CASH', 'CREDIT'], 'invoice type');
    if (type === 'CASH' && !paid.eq(total)) bad('Cash invoices must be paid in full.');
    await reverseInitial(original);
    await prisma.customer.updateMany({ where: { id: original.customerId, userId: req.user.id }, data: { currentBalance: { decrement: D(original.balanceAmount).toFixed(2) } } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: original.id } });
    const previousBalance = customerId === original.customerId ? original.prvBalance
      : (await require('../services/statementService').partyStatement(prisma, req.user.id, 'CUSTOMER', customerId, { to: businessDay(b.invoiceDate || original.invoiceDate) })).summary.closingBalance;
    const invoice = await prisma.invoice.update({ where: { id: original.id, userId: req.user.id }, data: { customerId, prvBalance: previousBalance, invoiceDate: dateOnly(b.invoiceDate || original.invoiceDate), totalAmount: total.toFixed(2), recordedCost: cost.toFixed(2), paidAmount: paid.toFixed(2), initialPaidAmount: initial.toFixed(2), balanceAmount: total.minus(paid).toFixed(2), paymentStatus: status(total, paid), paymentMethod: method, bankAccountId: method === 'BANK' && initial.gt(0) ? bankAccountId : null, invoiceType: type, narration: b.narration ?? original.narration, salesman: b.salesman ?? original.salesman, notes: b.notes ?? original.notes, items: { create: lines } } });
    await initialEffects(invoice, lines, cost);
    await prisma.customer.updateMany({ where: { id: customerId, userId: req.user.id }, data: { currentBalance: { increment: total.minus(paid).toFixed(2) } } });
    const full = await load(req.user.id, invoice.id);
    await prisma.auditEvent.create({ data: { userId: req.user.id, entityId: invoice.id, action: 'INVOICE_EDIT', before: JSON.stringify(original), after: JSON.stringify(full) } });
    res.json({ success: true, message: 'Invoice updated; later payments retained.', data: full });
  } catch (error) { next(error); }
}
module.exports = { list, getOne, markPrinted, create: transactionalController(create), update: transactionalController(update), recordPayment: transactionalController(recordPayment) };
