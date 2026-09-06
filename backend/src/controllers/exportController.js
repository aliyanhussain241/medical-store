// ─────────────────────────────────────────────────────────────
// src/controllers/exportController.js
// Handles all PDF + Excel export routes (single controller)
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');
const { generateInvoicePDF, generateLedgerPDF, generateCashBookPDF, generateProfitPDF, generateOfferListPDF, generatePartyBalancePDF } = require('../services/pdfService');
const { generateInvoiceExcel, generateLedgerExcel, generateCashBookExcel, generateProfitExcel, generateOfferListExcel, generatePartyBalanceExcel } = require('../services/excelService');
const { getPartyBalanceData } = require('./reportController');

async function getUser(userId) {
  return prisma.user.findUnique({ where: { id: userId } });
}

// ── GET /api/export/invoice/:id/pdf ───────────────────────────
async function invoicePDF(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const user = await getUser(req.user.id);
    const buffer = await generateInvoicePDF(invoice, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNo}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/invoice/:id/excel ─────────────────────────
async function invoiceExcel(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const user = await getUser(req.user.id);
    const buffer = await generateInvoiceExcel(invoice, user);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNo}.xlsx"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/customer/:id/pdf ───────────────────
async function customerLedgerPDF(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const customer = await prisma.customer.findFirst({ where: { id, userId: req.user.id } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const where = {
      userId: req.user.id, partyType: 'CUSTOMER', partyId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const transactions = await prisma.ledgerTransaction.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const ledgerData = { customer, transactions, summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) } };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerPDF(ledgerData, user, 'customer');

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="CustomerLedger-${customer.customerName}.pdf"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/customer/:id/excel ─────────────────
async function customerLedgerExcel(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const customer = await prisma.customer.findFirst({ where: { id, userId: req.user.id } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const where = {
      userId: req.user.id, partyType: 'CUSTOMER', partyId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const transactions = await prisma.ledgerTransaction.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const ledgerData = { customer, transactions, summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) } };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerExcel(ledgerData, user, 'customer');

    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="CustomerLedger-${customer.customerName}.xlsx"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/company/:id/pdf ────────────────────
async function companyLedgerPDF(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const company = await prisma.company.findFirst({ where: { id, userId: req.user.id } });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const where = {
      userId: req.user.id, partyType: 'COMPANY', partyId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const transactions = await prisma.ledgerTransaction.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const ledgerData = { company, transactions, summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) } };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerPDF(ledgerData, user, 'company');

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="CompanyLedger-${company.companyName}.pdf"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/company/:id/excel ──────────────────
async function companyLedgerExcel(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const company = await prisma.company.findFirst({ where: { id, userId: req.user.id } });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const where = {
      userId: req.user.id, partyType: 'COMPANY', partyId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const transactions = await prisma.ledgerTransaction.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const ledgerData = { company, transactions, summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) } };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerExcel(ledgerData, user, 'company');

    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="CompanyLedger-${company.companyName}.xlsx"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/cash-book/pdf ─────────────────────────────
async function cashBookPDF(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = {
      userId: req.user.id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const entries = await prisma.cashBookEntry.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });

    // Opening balance
    let openingBalance = 0;
    if (from) {
      const beforeEntry = await prisma.cashBookEntry.findFirst({
        where: { userId: req.user.id, transactionDate: { lt: new Date(from) } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        select: { runningBalance: true },
      });
      openingBalance = parseFloat(beforeEntry?.runningBalance || 0);
    }

    const totalIn = entries.reduce((s, e) => s + parseFloat(e.cashIn), 0);
    const totalOut = entries.reduce((s, e) => s + parseFloat(e.cashOut), 0);

    // Add sequence numbers
    let seq = 0;
    const enrichedEntries = entries.map((e) => ({ ...e, seq: ++seq }));

    const cashData = {
      data: enrichedEntries,
      openingBalance: openingBalance.toFixed(2),
      summary: { totalIn: totalIn.toFixed(2), totalOut: totalOut.toFixed(2), net: (totalIn - totalOut).toFixed(2) },
    };

    const user = await getUser(req.user.id);
    const buffer = await generateCashBookPDF(cashData, user, from && to ? { from, to } : null);

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="CashBook.pdf"' });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/cash-book/excel ───────────────────────────
async function cashBookExcel(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = {
      userId: req.user.id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const entries = await prisma.cashBookEntry.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });

    // Opening balance
    let openingBalance = 0;
    if (from) {
      const beforeEntry = await prisma.cashBookEntry.findFirst({
        where: { userId: req.user.id, transactionDate: { lt: new Date(from) } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        select: { runningBalance: true },
      });
      openingBalance = parseFloat(beforeEntry?.runningBalance || 0);
    }

    const totalIn = entries.reduce((s, e) => s + parseFloat(e.cashIn), 0);
    const totalOut = entries.reduce((s, e) => s + parseFloat(e.cashOut), 0);

    // Add sequence numbers
    let seq = 0;
    const enrichedEntries = entries.map((e) => ({ ...e, seq: ++seq }));

    const cashData = {
      data: enrichedEntries,
      openingBalance: openingBalance.toFixed(2),
      summary: { totalIn: totalIn.toFixed(2), totalOut: totalOut.toFixed(2), net: (totalIn - totalOut).toFixed(2) },
    };

    const user = await getUser(req.user.id);
    const buffer = await generateCashBookExcel(cashData, user, from && to ? { from, to } : null);

    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="CashBook.xlsx"' });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/profit/pdf ────────────────────────────────
async function profitPDF(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = {
      userId: req.user.id,
      ...((from || to) && { reportDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const records = await prisma.dailyProfit.findMany({ where, orderBy: { reportDate: 'asc' } });
    const totalSales = records.reduce((s, r) => s + parseFloat(r.totalSales), 0);
    const totalCost = records.reduce((s, r) => s + parseFloat(r.totalCost), 0);
    const totalProfit = records.reduce((s, r) => s + parseFloat(r.totalProfit), 0);
    const profitData = { data: records, summary: { totalSales: totalSales.toFixed(2), totalCost: totalCost.toFixed(2), totalProfit: totalProfit.toFixed(2), profitMargin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0.0' } };

    const user = await getUser(req.user.id);
    const buffer = await generateProfitPDF(profitData, user, from && to ? { from, to } : null);

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="ProfitReport.pdf"' });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/profit/excel ──────────────────────────────
async function profitExcel(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = {
      userId: req.user.id,
      ...((from || to) && { reportDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const records = await prisma.dailyProfit.findMany({ where, orderBy: { reportDate: 'asc' } });
    const totalSales = records.reduce((s, r) => s + parseFloat(r.totalSales), 0);
    const totalCost = records.reduce((s, r) => s + parseFloat(r.totalCost), 0);
    const totalProfit = records.reduce((s, r) => s + parseFloat(r.totalProfit), 0);
    const profitData = { data: records, summary: { totalSales: totalSales.toFixed(2), totalCost: totalCost.toFixed(2), totalProfit: totalProfit.toFixed(2), profitMargin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0.0' } };

    const user = await getUser(req.user.id);
    const buffer = await generateProfitExcel(profitData, user);

    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="ProfitReport.xlsx"' });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── Helper: get formatted offer list data for export ───────────
async function getOfferListData(id, userId) {
  const list = await prisma.offerList.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          company: { select: { id: true, companyName: true } },
          product: { select: { id: true, productName: true, salePrice: true, unit: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
      },
    },
  });
  if (!list) return null;

  const { formatOfferLabel } = require('./offerListController');
  const companyGroupsMap = {};
  for (const item of list.items) {
    const cId = item.companyId;
    const cName = item.company?.companyName || 'UNKNOWN COMPANY';
    if (!companyGroupsMap[cId]) {
      companyGroupsMap[cId] = {
        companyId: cId,
        companyName: cName,
        items: [],
      };
    }
    companyGroupsMap[cId].items.push({
      id: item.id,
      productName: item.product?.productName || 'Unknown Product',
      offerLabel: formatOfferLabel(item.offerType, item.offerValue, item.bonusBuyQty, item.bonusFreeQty),
      remarks: item.remarks || '',
    });
  }

  const companyGroups = Object.values(companyGroupsMap).sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );

  return { ...list, companyGroups };
}

// ── GET /api/export/offer-list/:id/pdf ────────────────────────
async function offerListPDF(req, res, next) {
  try {
    const offerListData = await getOfferListData(req.params.id, req.user.id);
    if (!offerListData) return res.status(404).json({ success: false, message: 'Offer list not found.' });

    const user = await getUser(req.user.id);
    const buffer = await generateOfferListPDF(offerListData, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="OfferList-${offerListData.listNumber}.pdf"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/offer-list/:id/excel ──────────────────────
async function offerListExcel(req, res, next) {
  try {
    const offerListData = await getOfferListData(req.params.id, req.user.id);
    if (!offerListData) return res.status(404).json({ success: false, message: 'Offer list not found.' });

    const user = await getUser(req.user.id);
    const buffer = await generateOfferListExcel(offerListData, user);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="OfferList-${offerListData.listNumber}.xlsx"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/bank/:id/pdf ────────────────────────
async function bankLedgerPDF(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const bankAccount = await prisma.bankAccount.findFirst({ where: { id, userId: req.user.id } });
    if (!bankAccount) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    const where = {
      userId: req.user.id, bankAccountId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const entries = await prisma.bankBookEntry.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = entries.reduce((s, e) => s + parseFloat(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit), 0);
    const ledgerData = {
      bankAccount,
      transactions: entries,
      summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) },
    };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerPDF(ledgerData, user, 'bank');

    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="BankLedger-${bankAccount.bankName}.pdf"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/ledger/bank/:id/excel ─────────────────────
async function bankLedgerExcel(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const bankAccount = await prisma.bankAccount.findFirst({ where: { id, userId: req.user.id } });
    if (!bankAccount) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    const where = {
      userId: req.user.id, bankAccountId: id,
      ...((from || to) && { transactionDate: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const entries = await prisma.bankBookEntry.findMany({ where, orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }] });
    const totalDebit = entries.reduce((s, e) => s + parseFloat(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit), 0);
    const ledgerData = {
      bankAccount,
      transactions: entries,
      summary: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), closingBalance: (totalDebit - totalCredit).toFixed(2) },
    };

    const user = await getUser(req.user.id);
    const buffer = await generateLedgerExcel(ledgerData, user, 'bank');

    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="BankLedger-${bankAccount.bankName}.xlsx"` });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/party-balance/pdf ─────────────────────────
async function partyBalancePDF(req, res, next) {
  try {
    const { asOn, filter = 'DR', area } = req.query;
    const reportData = await getPartyBalanceData(req.user.id, asOn, filter, area);
    const user = await getUser(req.user.id);
    const buffer = await generatePartyBalancePDF(reportData, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="PartyBalance-${reportData.asOnDate}.pdf"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

// ── GET /api/export/party-balance/excel ───────────────────────
async function partyBalanceExcel(req, res, next) {
  try {
    const { asOn, filter = 'DR', area } = req.query;
    const reportData = await getPartyBalanceData(req.user.id, asOn, filter, area);
    const user = await getUser(req.user.id);
    const buffer = await generatePartyBalanceExcel(reportData, user);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PartyBalance-${reportData.asOnDate}.xlsx"`,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = {
  invoicePDF, invoiceExcel,
  customerLedgerPDF, customerLedgerExcel,
  companyLedgerPDF, companyLedgerExcel,
  bankLedgerPDF, bankLedgerExcel,
  cashBookPDF, cashBookExcel,
  profitPDF, profitExcel,
  offerListPDF, offerListExcel,
  partyBalancePDF, partyBalanceExcel,
};
