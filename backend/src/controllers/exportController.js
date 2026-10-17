// ─────────────────────────────────────────────────────────────
// src/controllers/exportController.js
// Handles all PDF + Excel export routes (single controller)
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/db');
const { generateInvoicePDF, generateLedgerPDF, generateCashBookPDF, generateProfitPDF, generateOfferListPDF, generatePartyBalancePDF, generateTrialBalancePDF, generateBalanceSheetPDF } = require('../services/pdfService');
const { generateInvoiceExcel, generateLedgerExcel, generateCashBookExcel, generateProfitExcel, generateOfferListExcel, generatePartyBalanceExcel, generateTrialBalanceExcel, generateBalanceSheetExcel } = require('../services/excelService');
const { getPartyBalanceData, getFinancialData, getProfitData } = require('./reportController');
const { partyStatement, bankStatement, cashStatement } = require('../services/statementService');
const { trialBalanceData, balanceSheetData } = require('../services/financialReportService');

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
  const data = await partyStatement(prisma, req.user.id, 'CUSTOMER', req.params.id, req.query);
  const buffer = await generateLedgerPDF(data, await getUser(req.user.id), 'customer');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="customer-ledger.pdf"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

async function customerLedgerExcel(req, res, next) {
 try {
  const data = await partyStatement(prisma, req.user.id, 'CUSTOMER', req.params.id, req.query);
  const buffer = await generateLedgerExcel(data, await getUser(req.user.id), 'customer');
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="customer-ledger.xlsx"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

async function companyLedgerPDF(req, res, next) {
 try {
  const data = await partyStatement(prisma, req.user.id, 'COMPANY', req.params.id, req.query);
  const buffer = await generateLedgerPDF(data, await getUser(req.user.id), 'company');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="company-ledger.pdf"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

async function companyLedgerExcel(req, res, next) {
 try {
  const data = await partyStatement(prisma, req.user.id, 'COMPANY', req.params.id, req.query);
  const buffer = await generateLedgerExcel(data, await getUser(req.user.id), 'company');
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="company-ledger.xlsx"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

async function cashBookPDF(req, res, next) {
 try {
  const data = await cashStatement(prisma, req.user.id, { from: req.query.from, to: req.query.to });
  const buffer = await generateCashBookPDF({ ...data, data: data.entries }, await getUser(req.user.id), req.query);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cash-book.pdf"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function cashBookExcel(req, res, next) {
 try {
  const data = await cashStatement(prisma, req.user.id, { from: req.query.from, to: req.query.to });
  const buffer = await generateCashBookExcel({ ...data, data: data.entries }, await getUser(req.user.id), req.query);
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="cash-book.xlsx"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function profitPDF(req, res, next) {
 try {
  const data = await getProfitData(req.user.id, req.query.from, req.query.to);
  const buffer = await generateProfitPDF(data, await getUser(req.user.id), req.query.from && req.query.to ? req.query : null);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="gross-profit.pdf"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function profitExcel(req, res, next) {
 try {
  const data = await getProfitData(req.user.id, req.query.from, req.query.to);
  const buffer = await generateProfitExcel(data, await getUser(req.user.id), req.query.from && req.query.to ? req.query : null);
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="gross-profit.xlsx"' }); res.send(buffer);
 } catch (error) { next(error); }
}

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
  const data = await bankStatement(prisma, req.user.id, req.params.id, req.query);
  const buffer = await generateLedgerPDF(data, await getUser(req.user.id), 'bank');
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="bank-ledger.pdf"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

async function bankLedgerExcel(req, res, next) {
 try {
  const data = await bankStatement(prisma, req.user.id, req.params.id, req.query);
  const buffer = await generateLedgerExcel(data, await getUser(req.user.id), 'bank');
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="bank-ledger.xlsx"' });
  res.send(buffer);
 } catch (error) { next(error); }
}

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

// ── GET /api/export/trial-balance/pdf ─────────────────────────
async function trialBalancePDF(req, res, next) {
 try {
  const data = trialBalanceData(await getFinancialData(req.user.id, req.query.asOn));
  const buffer = await generateTrialBalancePDF(data, await getUser(req.user.id));
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="trialBalance.pdf"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function trialBalanceExcel(req, res, next) {
 try {
  const data = trialBalanceData(await getFinancialData(req.user.id, req.query.asOn));
  const buffer = await generateTrialBalanceExcel(data, await getUser(req.user.id));
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="trialBalance.xlsx"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function balanceSheetPDF(req, res, next) {
 try {
  const data = balanceSheetData(await getFinancialData(req.user.id, req.query.asOn));
  const buffer = await generateBalanceSheetPDF(data, await getUser(req.user.id));
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="balanceSheet.pdf"' }); res.send(buffer);
 } catch (error) { next(error); }
}

async function balanceSheetExcel(req, res, next) {
 try {
  const data = balanceSheetData(await getFinancialData(req.user.id, req.query.asOn));
  const buffer = await generateBalanceSheetExcel(data, await getUser(req.user.id));
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="balanceSheet.xlsx"' }); res.send(buffer);
 } catch (error) { next(error); }
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
  trialBalancePDF, trialBalanceExcel,
  balanceSheetPDF, balanceSheetExcel,
};
