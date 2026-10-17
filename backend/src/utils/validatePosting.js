const prisma = require('./db');
const { bad, number, enumeration, text } = require('./input');
const { businessDay } = require('./businessDate');

async function owned(model, id, userId, label) {
  if (typeof id !== 'string' || !(await prisma[model].findFirst({ where: { id, userId } }))) bad(`${label} not found in this business.`);
}

async function validatePosting(req) {
  const b = req.body || {};
  if ((req.originalUrl || '').includes('/cash-book') && b.category !== undefined && !['', 'EXPENSE'].includes(b.category)) bad('Invalid cash entry category.');
  for (const key of ['invoiceDate', 'purchaseDate', 'transactionDate', 'paymentDate', 'expiryDate', 'listDate']) {
    if (b[key] !== undefined && b[key] !== null && b[key] !== '') {
      if (typeof b[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b[key])) bad(`Invalid ${key}.`);
      businessDay(b[key]);
    }
  }
  for (const key of ['paidAmount', 'amount', 'purchasePrice', 'salePrice', 'tradePrice', 'salary', 'cashIn', 'cashOut', 'debit', 'credit', 'minStockAlert', 'stockQty']) {
    if (b[key] !== undefined && b[key] !== '') number(b[key], key, { scale: key === 'stockQty' ? 3 : 2 });
  }
  if (b.openingBalance !== undefined && b.openingBalance !== '') number(b.openingBalance, 'openingBalance', { min: '-9999999999999.99' });
  if (b.qty !== undefined) number(b.qty, 'qty', { min: '-9999999999999.999', scale: 3 });
  if (b.piecesPerPack !== undefined && b.piecesPerPack !== '') number(b.piecesPerPack, 'piecesPerPack', { min: 1, max: 1000000, scale: 0 });
  for (const key of ['description', 'employeeName', 'productName', 'customerName', 'companyName', 'name', 'listNumber', 'bankName', 'accountTitle', 'accountNumber']) {
    if (b[key] !== undefined) text(b[key], key);
  }
  for (const key of ['town', 'sector', 'cnic', 'phone', 'address', 'notes', 'narration', 'remarks', 'designation', 'packing', 'batchNo', 'category', 'salesman', 'area', 'shopName', 'contactPerson']) {
    if (b[key] !== undefined && b[key] !== null && (typeof b[key] !== 'string' || b[key].length > 4000)) bad(`Invalid ${key}.`);
  }
  if (b.isActive !== undefined && typeof b.isActive !== 'boolean') bad('isActive must be a boolean.');
  if (b.paymentMethod !== undefined) enumeration(b.paymentMethod, ['CASH', 'BANK'], 'payment method');
  if (b.invoiceType !== undefined) enumeration(b.invoiceType, ['CASH', 'CREDIT'], 'invoice type');
  if (b.amount !== undefined && !number(b.amount, 'amount').gt(0)) bad('Amount must be greater than zero.');
  for (const [left, right] of [['cashIn', 'cashOut'], ['debit', 'credit']]) {
    if (b[left] !== undefined || b[right] !== undefined) {
      const l = number(b[left], left, { optional: true }), r = number(b[right], right, { optional: true });
      if (l.gt(0) === r.gt(0)) bad(`Specify exactly one positive ${left} or ${right}.`);
    }
  }
  if (b.accountHeadId) await owned('accountHead', b.accountHeadId, req.user.id, 'Account head');
  if (b.items !== undefined) {
    if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 500) bad('Provide between 1 and 500 items.');
    const isOffer = (req.originalUrl || '').includes('/offer-lists');
    for (const item of b.items) {
      if (!item || typeof item !== 'object') bad('Invalid item.');
      if (item.productId) await owned('product', item.productId, req.user.id, 'Product');
      else if (!isOffer) text(item.customName, 'Manual item name');
      else bad('Offer product is required.');
      if (isOffer) {
        await owned('company', item.companyId, req.user.id, 'Company');
        const type = enumeration(item.offerType, ['PERCENTAGE', 'TP', 'NET', 'BONUS'], 'offer type', 'PERCENTAGE');
        if (type === 'PERCENTAGE') number(item.offerValue, 'offer percentage', { max: 100 });
        if (type === 'NET') number(item.offerValue, 'net price', { min: '0.01' });
        if (type === 'BONUS') { number(item.bonusBuyQty, 'buy quantity', { min: '0.001', scale: 3 }); number(item.bonusFreeQty, 'free quantity', { min: '0.001', scale: 3 }); }
      } else {
        number(item.qty, 'quantity', { min: '0.001', scale: 3 });
        number(item.unitPrice, 'unit price', { min: '0.01' });
        number(item.discount, 'discount', { max: 100, optional: true });
        for (const key of ['freePcs', 'schemeUnits', 'piecesQty']) number(item[key], key, { scale: 3, optional: true });
        number(item.schemeTotal, 'scheme total', { optional: true });
        if (item.pricingMode !== undefined) enumeration(item.pricingMode, ['RETAIL', 'TP', 'NET'], 'pricing mode');
        if (item.subUnit !== undefined) enumeration(item.subUnit, ['PACK', 'PIECE'], 'purchase unit');
        if (item.piecesPerPack !== undefined) number(item.piecesPerPack, 'pieces per pack', { min: 1, max: 1000000, scale: 0 });
      }
    }
  }
}
module.exports = { validatePosting, owned };
