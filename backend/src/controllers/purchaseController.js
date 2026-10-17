const prisma = require('../utils/db');
const { D } = require('../services/statementService');
const { postParty, postMoney } = require('../services/postingService');
const { dateOnly } = require('../utils/businessDate');
const { number, bad, enumeration } = require('../utils/input');
const { owned } = require('../utils/validatePosting');
const { transactionalController } = require('../utils/transactionalController');
async function list(req, res, next) {
  try {
    const { search, companyId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(companyId && { companyId }),
      ...(status && { paymentStatus: status }),
      ...(from || to) && {
        purchaseDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      },
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { company: { companyName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { purchaseDate: 'desc' },
        include: { company: { select: { companyName: true } }, items: { include: { product: { select: { productName: true, unit: true } } } } },
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({ success: true, data: purchases, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/purchases/:id ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        company: true,
        items: { include: { product: true } },
      },
    });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
}


function status(total, paid) { return paid.gte(total) ? 'PAID' : paid.isZero() ? 'PENDING' : 'PARTIAL'; }
async function create(req, res, next) {
 try {
  const b = req.body, userId = req.user.id;
  await owned('company', b.companyId, userId, 'Company');
  if (!Array.isArray(b.items) || !b.items.length) bad('At least one item is required.');
  const method = enumeration(b.paymentMethod, ['CASH', 'BANK'], 'payment method', 'CASH');
  const paid = number(b.paidAmount, 'paid amount', { optional: true });
  if (method === 'BANK' && paid.gt(0)) await owned('bankAccount', b.bankAccountId, userId, 'Bank account');
  await require('../services/postingService').requireAppendableStockDate(userId, b.items.map((i) => i.productId), b.purchaseDate);
  const lines = [];
  for (const item of b.items) {
   await owned('product', item.productId, userId, 'Product');
   const qty = number(item.qty, 'quantity', { min: '0.001', scale: 3 });
   const price = number(item.unitPrice, 'unit price', { min: '0.01' });
   const discount = number(item.discount, 'discount', { optional: true, max: 100 });
   lines.push({ productId: item.productId, qty: qty.toString(), unitPrice: price.toFixed(2), discount: discount.toString(), total: require('../utils/numberUtils').calculateLine(qty, price, discount).total, subUnit: item.subUnit || null, piecesQty: item.piecesQty == null ? null : String(item.piecesQty), piecesPerPack: item.piecesPerPack == null ? null : Number(item.piecesPerPack) });
  }
  const total = number(lines.reduce((v, line) => v.plus(line.total), D(0)).toFixed(2), 'purchase total');
  if (paid.gt(total)) bad('Payment exceeds purchase total.');
  const previous = await prisma.purchase.findMany({ where: { userId }, select: { invoiceNo: true } });
  const nextNo = previous.reduce((max, row) => Math.max(max, Number(/^PO-(\d+)$/.exec(row.invoiceNo)?.[1] || 0)), 0) + 1;
  const invoiceNo = 'PO-' + String(nextNo).padStart(5, '0'), date = dateOnly(b.purchaseDate);
  const purchase = await prisma.purchase.create({ data: { userId, companyId: b.companyId, invoiceNo, purchaseDate: date, totalAmount: total.toFixed(2), paidAmount: paid.toFixed(2), balanceAmount: total.minus(paid).toFixed(2), paymentStatus: status(total, paid), paymentMethod: method, bankAccountId: method === 'BANK' && paid.gt(0) ? b.bankAccountId : null, notes: b.notes || null, narration: b.narration || null, items: { create: lines } } });
  for (const line of lines) {
   const product = await prisma.product.findFirst({ where: { id: line.productId, userId } });
   const movements = await prisma.stockMovement.findMany({ where: { userId, productId: product.id } });
   // Missing historical costs are never backfilled. Use the entered current cost
   // for this prospective weighted-average update and expose legacy gaps in reports.
   const known = movements.length > 0 && movements.every((m) => m.valueDelta !== null);
   const oldValue = known ? movements.reduce((v, m) => v.plus(m.valueDelta), D(0)) : D(product.stockQty).mul(product.purchasePrice);
   const qty = D(product.stockQty).plus(line.qty);
   const average = oldValue.plus(line.total).div(qty).toDecimalPlaces(2);
   await prisma.product.updateMany({ where: { id: product.id, userId }, data: { stockQty: { increment: line.qty }, purchasePrice: average.toFixed(2) } });
   await prisma.stockMovement.create({ data: { userId, productId: product.id, movementType: 'PURCHASE', qty: line.qty, valueDelta: line.total, referenceId: purchase.id, movementDate: date } });
  }
  await prisma.company.updateMany({ where: { id: b.companyId, userId }, data: { currentBalance: { increment: total.minus(paid).toFixed(2) } } });
  await postParty(userId, 'COMPANY', b.companyId, date, 'Purchase — ' + invoiceNo, 0, total, 'PURCHASE_V2', purchase.id);
  if (paid.gt(0)) {
   await postParty(userId, 'COMPANY', b.companyId, date, 'Initial payment — ' + invoiceNo, paid, 0, 'SUPPLIER_PAYMENT_V2', purchase.id);
   await postMoney({ userId, method, bankAccountId: b.bankAccountId, date, amount: paid.negated(), description: 'Purchase payment — ' + invoiceNo, referenceType: 'PURCHASE', referenceId: purchase.id });
  }
  res.status(201).json({ success: true, message: 'Purchase recorded.', data: await prisma.purchase.findUnique({ where: { id: purchase.id }, include: { company: true, items: { include: { product: true } } } }) });
 } catch (error) { next(error); }
}
async function recordPayment(req, res, next) {
 try {
  const userId = req.user.id, b = req.body;
  const purchase = await prisma.purchase.findFirst({ where: { id: req.params.id, userId } });
  if (!purchase) throw Object.assign(new Error('Purchase not found.'), { statusCode: 404 });
  const amount = number(b.amount, 'payment amount', { min: '0.01' });
  const method = enumeration(b.paymentMethod, ['CASH', 'BANK'], 'payment method', 'CASH');
  if (amount.gt(purchase.balanceAmount)) bad('Payment exceeds balance due.');
  if (method === 'BANK') await owned('bankAccount', b.bankAccountId, userId, 'Bank account');
  const paid = D(purchase.paidAmount).plus(amount), balance = D(purchase.balanceAmount).minus(amount);
  const changed = await prisma.purchase.updateMany({ where: { id: purchase.id, userId, paidAmount: purchase.paidAmount, balanceAmount: { gte: amount.toFixed(2) } }, data: { paidAmount: paid.toFixed(2), balanceAmount: balance.toFixed(2), paymentStatus: status(D(purchase.totalAmount), paid) } });
  if (changed.count !== 1) throw Object.assign(new Error('Purchase changed. Reload and retry.'), { statusCode: 409 });
  await postParty(userId, 'COMPANY', purchase.companyId, b.paymentDate, 'Payment — ' + purchase.invoiceNo, amount, 0, 'SUPPLIER_PAYMENT_V2', purchase.id);
  await postMoney({ userId, method, bankAccountId: b.bankAccountId, date: b.paymentDate, amount: amount.negated(), description: 'Supplier payment — ' + purchase.invoiceNo, referenceType: 'PURCHASE_PAYMENT', referenceId: purchase.id });
  await prisma.company.updateMany({ where: { id: purchase.companyId, userId }, data: { currentBalance: { decrement: amount.toFixed(2) } } });
  res.json({ success: true, message: 'Payment recorded.' });
 } catch (error) { next(error); }
}
module.exports = { list, getOne, create: transactionalController(create), recordPayment: transactionalController(recordPayment) };
