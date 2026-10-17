const prisma = require('../utils/db');
const { D, cashStatement, bankStatement, partyStatement } = require('./statementService');
const { dateOnly } = require('../utils/businessDate');
const { businessDay } = require('../utils/businessDate');
const { bad, number } = require('../utils/input');
const { calculateLine } = require('../utils/numberUtils');
const { getNextEntryNo } = require('../controllers/cashBookController');

async function postParty(userId, type, id, date, description, debit, credit, referenceType, referenceId) {
  const current = await partyStatement(prisma, userId, type, id, { to: dateOnly(date).toISOString().slice(0, 10) });
  await prisma.ledgerTransaction.create({ data: { userId, partyType: type, partyId: id, transactionDate: dateOnly(date), description, debit: D(debit).toFixed(2), credit: D(credit).toFixed(2), runningBalance: D(current.summary.closingBalance).plus(debit).minus(credit).toFixed(2), referenceType, referenceId } });
}

async function postMoney({ userId, method, bankAccountId, date, amount, description, referenceType, referenceId, partyName, accountHeadId }) {
  const value = D(amount);
  if (value.isZero()) return;
  const head = accountHeadId ? await prisma.accountHead.findFirst({ where: { id: accountHeadId, userId } }) : null;
  if (accountHeadId && !head) bad('Account head not found in this business.');
  const classification = head ? { accountCategory: head.category, accountHeadName: head.name } : {};
  const day = dateOnly(date).toISOString().slice(0, 10);
  if (method === 'BANK') {
    const result = await bankStatement(prisma, userId, bankAccountId, { to: day });
    await prisma.bankBookEntry.create({ data: { userId, bankAccountId, transactionDate: dateOnly(date), description, debit: value.gt(0) ? value.toFixed(2) : 0, credit: value.lt(0) ? value.negated().toFixed(2) : 0, runningBalance: D(result.summary.closingBalance).plus(value).toFixed(2), referenceType, referenceId, partyName, accountHeadId, ...classification } });
    await prisma.bankAccount.updateMany({ where: { id: bankAccountId, userId }, data: { currentBalance: { increment: value.toFixed(2) } } });
  } else {
    const result = await cashStatement(prisma, userId, { to: day });
    const entryType = value.gt(0) ? 'MCR' : 'MCP';
    await prisma.cashBookEntry.create({ data: { userId, transactionDate: dateOnly(date), description, cashIn: value.gt(0) ? value.toFixed(2) : 0, cashOut: value.lt(0) ? value.negated().toFixed(2) : 0, runningBalance: D(result.summary.closingBalance).plus(value).toFixed(2), entryType, entryNo: await getNextEntryNo(userId, entryType), referenceType, referenceId, partyName, accountHeadId, ...classification } });
  }
}

async function invoiceLines(userId, items, retainedItems = []) {
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = await prisma.product.findMany({ where: { userId, id: { in: ids } } });
  if (products.length !== ids.length) bad('One or more products do not belong to this business.');
  return Promise.all(items.map(async (item) => {
    const product = products.find((p) => p.id === item.productId);
    const qty = number(item.qty, 'quantity', { min: '0.001', scale: 3 });
    const unitPrice = number(item.unitPrice, 'unit price', { min: '0.01' });
    const discount = number(item.discount, 'discount', { max: 100, optional: true });
    const schemeUnits = number(item.schemeUnits, 'scheme units', { optional: true, scale: 3 });
    const freePcs = number(item.freePcs, 'free units', { optional: true, scale: 3 });
    const calculated = calculateLine(qty, unitPrice, discount);
    const grossTotal = D(calculated.grossTotal), discountAmt = D(calculated.discountAmt);
    number(calculated.total, 'line total');
    // A revision retains the original cost for an existing product line.
    const original = retainedItems.find((line) => line.productId === item.productId);
    let currentCost = D(product?.purchasePrice || 0);
    if (product && D(product.stockQty).gt(0)) {
      const movements = await prisma.stockMovement.findMany({ where: { userId, productId: product.id } });
      if (movements.some((m) => m.notes === 'INITIAL_INVENTORY') && movements.every((m) => m.valueDelta !== null)) currentCost = movements.reduce((v, m) => v.plus(m.valueDelta), D(0)).div(product.stockQty);
    }
    const unitCost = D(original?.unitCost ?? currentCost).toDecimalPlaces(15);
    return { productId: item.productId || null, customName: item.productId ? null : item.customName, qty: qty.toString(), unitPrice: unitPrice.toFixed(2), unitCost: unitCost.toFixed(15), discount: discount.toString(), discountAmt: discountAmt.toFixed(2), grossTotal: grossTotal.toFixed(2), total: grossTotal.minus(discountAmt).toFixed(2), pricingMode: item.pricingMode || 'RETAIL', batchNo: item.batchNo || product?.batchNo || null, packing: item.packing || product?.unit || null, schemeUnits: schemeUnits.toString(), freePcs: freePcs.toString(), schemeTotal: number(item.schemeTotal, 'scheme total', { optional: true }).toFixed(2) };
  }));
}

async function requireAppendableStockDate(userId, ids, date) {
  const day = businessDay(date);
  const rows = await prisma.stockMovement.findMany({ where: { userId, productId: { in: ids } } });
  if (rows.some((row) => businessDay(row.movementDate) > day)) {
    throw Object.assign(new Error('This stock date precedes later movements. Repricing historical weighted-average costs requires a separately reviewed operation; no records were changed.'), { statusCode: 409 });
  }
}

function lineUnits(line) { return D(line.qty).plus(line.schemeUnits || 0).plus(line.freePcs || 0); }
function invoiceTotals(lines) {
  return { total: number(lines.reduce((v, line) => v.plus(line.total), D(0)).toFixed(2), 'invoice total'), cost: number(lines.reduce((v, line) => v.plus(lineUnits(line).mul(line.unitCost).toDecimalPlaces(2)), D(0)).toFixed(2), 'invoice cost') };
}

async function moveInvoiceStock(userId, invoiceId, date, lines, reverse = false) {
  // Aggregate duplicate product lines before checking/decrementing stock.
  const grouped = new Map();
  for (const line of lines.filter((l) => l.productId)) {
    const prev = grouped.get(line.productId) || { qty: D(0), cost: D(0) };
    prev.qty = prev.qty.plus(lineUnits(line)); prev.cost = prev.cost.plus(lineUnits(line).mul(line.unitCost).toDecimalPlaces(2));
    grouped.set(line.productId, prev);
  }
  for (const [productId, totals] of grouped) {
    const changed = await prisma.product.updateMany({ where: { id: productId, userId, ...(!reverse && { stockQty: { gte: totals.qty.toString() } }) }, data: { stockQty: { increment: (reverse ? totals.qty : totals.qty.negated()).toString() } } });
    if (changed.count !== 1) bad('Insufficient stock or product not found in this business.');
    await prisma.stockMovement.create({ data: { userId, productId, movementType: reverse ? 'RETURN' : 'SALE', qty: (reverse ? totals.qty : totals.qty.negated()).toString(), valueDelta: (reverse ? totals.cost : totals.cost.negated()).toFixed(2), referenceId: invoiceId, movementDate: dateOnly(date), notes: reverse ? 'Invoice revision reversal' : null } });
  }
}

async function profit(userId, date, sales, cost) {
  await prisma.dailyProfit.upsert({ where: { userId_reportDate: { userId, reportDate: dateOnly(date) } }, create: { userId, reportDate: dateOnly(date), totalSales: D(sales).toFixed(2), totalCost: D(cost).toFixed(2), totalProfit: D(sales).minus(cost).toFixed(2) }, update: { totalSales: { increment: D(sales).toFixed(2) }, totalCost: { increment: D(cost).toFixed(2) }, totalProfit: { increment: D(sales).minus(cost).toFixed(2) } } });
}

module.exports = { postParty, postMoney, invoiceLines, invoiceTotals, lineUnits, moveInvoiceStock, profit, requireAppendableStockDate };
