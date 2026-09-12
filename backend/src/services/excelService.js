// ─────────────────────────────────────────────────────────────
// src/services/excelService.js
// Generates Excel (.xlsx) exports using ExcelJS
// ─────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');

// ── Brand colors ─────────────────────────────────────────────
const BRAND_GREEN = '0F6E4F';
const ACCENT_BLUE = '1B4B91';
const ALERT_RED = 'B4372B';
const BG_LIGHT = 'F7F8F6';
const TEXT_DARK = '1C1F1E';
const BORDER_COLOR = 'DADFDB';

function pkrFormat(val) {
  return parseFloat(val || 0).toFixed(2);
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-PK');
}

function applyHeaderStyle(cell, bgColor = BRAND_GREEN) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = {
    bottom: { style: 'thin', color: { argb: 'FF' + BORDER_COLOR } },
  };
}

function applyDataStyle(cell, isNumber = false, isAlert = false) {
  cell.font = { size: 9, color: { argb: isAlert ? 'FF' + ALERT_RED : 'FF' + TEXT_DARK } };
  cell.alignment = { vertical: 'middle', horizontal: isNumber ? 'right' : 'left' };
  if (isNumber) {
    cell.numFmt = '#,##0.00';
  }
}

function addBusinessHeader(sheet, user, title, colCount) {
  // Row 1: Business name
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = user.businessName;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND_GREEN } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // Row 2: Document title
  sheet.mergeCells(2, 1, 2, colCount);
  const subCell = sheet.getCell(2, 1);
  subCell.value = title;
  subCell.font = { bold: true, size: 10, color: { argb: 'FF' + ACCENT_BLUE } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BG_LIGHT } };
  sheet.getRow(2).height = 18;

  // Row 3: blank spacer
  sheet.addRow([]);
}

// ─────────────────────────────────────────────────────────────
// INVOICE EXCEL (Matching Client Reference Format)
// ─────────────────────────────────────────────────────────────
async function generateInvoiceExcel(invoice, user) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet(`Invoice-${invoice.invoiceNo}`);

  const cols = [
    { key: 'seq', width: 6 },
    { key: 'pkt', width: 8 },
    { key: 'price', width: 14 },
    { key: 'item', width: 30 },
    { key: 'packing', width: 12 },
    { key: 'disc', width: 8 },
    { key: 'discAmt', width: 12 },
    { key: 'stu', width: 8 },
    { key: 'st', width: 10 },
    { key: 'net', width: 14 },
    { key: 'pcs', width: 8 },
    { key: 'batch', width: 12 },
    { key: 'gross', width: 14 },
  ];
  sheet.columns = cols;

  const bizName = (user.businessName || 'RAHMAT MEDICAL WHOLESALE').toUpperCase();
  const bizCity = (user.city || 'BHIRYA CITY').toUpperCase();
  const bizAddr = user.address || 'Main Bazar, Bhirya City';

  // Row 1: Business name & city
  sheet.mergeCells(1, 1, 1, 13);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${bizName}, ${bizCity}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  // Row 2: Address
  sheet.mergeCells(2, 1, 2, 13);
  const addrCell = sheet.getCell(2, 1);
  addrCell.value = bizAddr;
  addrCell.font = { size: 9, color: { argb: 'FF555555' } };
  addrCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Est# | INVOICE | Page#
  sheet.mergeCells(3, 1, 3, 4);
  sheet.getCell(3, 1).value = `Est# ${invoice.invoiceNo}`;
  sheet.getCell(3, 1).font = { bold: true, size: 11 };

  sheet.mergeCells(3, 5, 3, 9);
  const invLabelCell = sheet.getCell(3, 5);
  invLabelCell.value = 'INVOICE';
  invLabelCell.font = { bold: true, size: 13 };
  invLabelCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(3, 10, 3, 13);
  const pageCell = sheet.getCell(3, 10);
  pageCell.value = 'Page# 1 of 1';
  pageCell.font = { size: 9 };
  pageCell.alignment = { horizontal: 'right' };

  // Row 4: Party & Area
  const partyCode = invoice.customer?.customerCode || '0';
  const partyName = (invoice.customer?.customerName || 'COUNTER').toUpperCase();
  const partyArea = (invoice.customer?.area || 'UNASSIGNED').toUpperCase();

  sheet.mergeCells(4, 1, 4, 8);
  sheet.getCell(4, 1).value = `Party: ${partyCode} ${partyName}`;
  sheet.getCell(4, 1).font = { bold: true, size: 10 };

  sheet.mergeCells(4, 9, 4, 13);
  const areaCell = sheet.getCell(4, 9);
  areaCell.value = `Area: ${partyArea}`;
  areaCell.font = { bold: true, size: 10, color: { argb: 'FF1E40AF' } };
  areaCell.alignment = { horizontal: 'right' };

  // Row 5: Date, Day, Made At, Salesman
  const invDateStr = fmtDate(invoice.invoiceDate);
  const dayName = new Date(invoice.invoiceDate).toLocaleDateString('en-PK', { weekday: 'long' });
  const madeAtStr = new Date(invoice.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

  sheet.mergeCells(5, 1, 5, 8);
  sheet.getCell(5, 1).value = `Date: ${invDateStr}    Day: ${dayName}    Made At: ${madeAtStr}`;
  sheet.getCell(5, 1).font = { size: 9 };

  sheet.mergeCells(5, 9, 5, 13);
  const smCell = sheet.getCell(5, 9);
  smCell.value = invoice.salesman ? `Salesman: ${invoice.salesman}` : '';
  smCell.font = { size: 9 };
  smCell.alignment = { horizontal: 'right' };

  // Row 6: User, Status, Printed At
  const userName = (user.ownerName || 'ADMIN').toUpperCase();
  const statusStr = invoice.printCount > 0 ? 'COPY' : 'ORIGINAL';
  const printedAtStr = new Date().toLocaleString('en-PK');

  sheet.mergeCells(6, 1, 6, 8);
  sheet.getCell(6, 1).value = `User: ${userName}        Status: ${statusStr}`;
  sheet.getCell(6, 1).font = { size: 9 };

  sheet.mergeCells(6, 9, 6, 13);
  const printCell = sheet.getCell(6, 9);
  printCell.value = `Printed At: ${printedAtStr}`;
  printCell.font = { size: 9 };
  printCell.alignment = { horizontal: 'right' };

  // Row 7: Spacer
  sheet.addRow([]);

  // Row 8: Table Header
  const headers = ['S#', 'PKT', 'PRICE', 'ITEM', 'PACKING', 'DIS%', 'DIS AMT', 'ST/U', 'ST', 'NET', 'PCS', 'BATCH', 'GROSS'];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum === 4 || colNum === 5 || colNum === 12 ? 'left' : colNum === 3 || colNum === 7 || colNum === 9 || colNum === 10 || colNum === 13 ? 'right' : 'center',
    };
  });
  headerRow.height = 20;

  const startRow = sheet.rowCount + 1;

  // Data rows
  invoice.items.forEach((item, i) => {
    const mode = item.pricingMode || 'TP';
    const suffix = mode === 'TP' ? 'T' : mode === 'RETAIL' ? 'R' : 'N';
    const unitPriceStr = `${parseFloat(item.unitPrice).toFixed(0)} ${suffix}`;
    const qty = parseFloat(item.qty);
    const gross = parseFloat(item.grossTotal || (qty * parseFloat(item.unitPrice)));
    const discAmt = parseFloat(item.discountAmt || (gross * (parseFloat(item.discount || 0) / 100)));
    const net = parseFloat(item.total);
    const st = parseFloat(item.schemeTotal || 0);
    const stu = parseFloat(item.schemeUnits || 0);
    const pcs = parseFloat(item.freePcs || 0);

    const row = sheet.addRow([
      i + 1,
      qty,
      unitPriceStr,
      (item.product?.productName || item.customName || '—').toUpperCase(),
      item.packing || item.product?.unit || '—',
      parseFloat(item.discount || 0),
      discAmt,
      stu,
      st,
      net,
      pcs,
      item.batchNo || item.product?.batchNo || '—',
      gross,
    ]);

    row.eachCell((cell, colNum) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum === 4 || colNum === 5 || colNum === 12 ? 'left' : colNum === 3 || colNum === 7 || colNum === 9 || colNum === 10 || colNum === 13 ? 'right' : 'center',
      };
      if (colNum === 7 || colNum === 9 || colNum === 10 || colNum === 13) {
        cell.numFmt = '#,##0.00';
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } };
    });
    row.height = 18;
  });

  const endRow = sheet.rowCount;

  // Total Row: << TOTAL >>
  const totalRow = sheet.addRow([
    '<< TOTAL >>', null, null, null, null, null,
    { formula: `SUM(G${startRow}:G${endRow})` },
    null,
    { formula: `SUM(I${startRow}:I${endRow})` },
    { formula: `SUM(J${startRow}:J${endRow})` },
    null, null,
    { formula: `SUM(M${startRow}:M${endRow})` },
  ]);
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 6);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  totalRow.height = 20;

  sheet.addRow([]); // spacer

  // Balance block
  const prvBal = parseFloat(invoice.prvBalance || 0);
  const invTot = parseFloat(invoice.totalAmount);
  const paid = parseFloat(invoice.paidAmount || 0);
  const bal = prvBal + invTot - paid;

  sheet.addRow(['Inv Total:', invTot, '', 'Prv Balance:', prvBal, '', 'Paid:', paid, '', 'New Balance:', bal]);
  const lastRow = sheet.lastRow;
  lastRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10 };
    if (colNum === 2 || colNum === 5 || colNum === 8 || colNum === 11) {
      cell.numFmt = '#,##0.00';
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────────────────────
// LEDGER EXCEL
// ─────────────────────────────────────────────────────────────
async function generateLedgerExcel(ledgerData, user, partyType) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet('Ledger');

  const isBank = partyType === 'bank';
  const party = isBank
    ? (ledgerData.bankAccount || {})
    : (partyType === 'customer' ? ledgerData.customer : ledgerData.company);
  const partyName = isBank
    ? `${party.bankName || 'Bank'} — ${party.accountTitle || ''} (${party.accountNumber || ''})`
    : (partyType === 'customer'
      ? `${party.customerName || ''}${party.shopName ? ' — ' + party.shopName : ''}`
      : (party.companyName || ''));

  const cols = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'desc', width: 38 },
    { header: 'Ref Type', key: 'ref', width: 14 },
    { header: 'Debit (Dr)', key: 'dr', width: 15 },
    { header: 'Credit (Cr)', key: 'cr', width: 15 },
    { header: 'Running Balance', key: 'bal', width: 18 },
  ];
  sheet.columns = cols;

  addBusinessHeader(sheet, user, `${partyType.toUpperCase()} LEDGER — ${partyName}`, cols.length);

  sheet.addRow([isBank ? 'Bank Account:' : 'Party:', partyName]);
  if (party.phone) sheet.addRow(['Phone:', party.phone]);
  if (isBank && party.branch) sheet.addRow(['Branch:', party.branch]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(cols.map((c) => c.header));
  headerRow.eachCell((cell) => applyHeaderStyle(cell));
  headerRow.height = 20;

  ledgerData.transactions.forEach((t, i) => {
    const row = sheet.addRow([
      fmtDate(t.transactionDate),
      t.description,
      t.referenceType,
      parseFloat(t.debit) > 0 ? parseFloat(t.debit) : null,
      parseFloat(t.credit) > 0 ? parseFloat(t.credit) : null,
      parseFloat(t.runningBalance),
    ]);
    row.eachCell((cell, colNum) => {
      const isNum = colNum >= 4;
      applyDataStyle(cell, isNum);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF7F8F6' } };
    });
    row.height = 16;
  });

  // Summary
  sheet.addRow([]);
  const { totalDebit, totalCredit, closingBalance } = ledgerData.summary;
  [
    ['', 'Total Debit', '', parseFloat(totalDebit), '', ''],
    ['', 'Total Credit', '', '', parseFloat(totalCredit), ''],
    ['', 'Closing Balance', '', '', '', parseFloat(closingBalance)],
  ].forEach(([, label, , dr, cr, bal], i) => {
    const row = sheet.addRow(['', label, '', dr || null, cr || null, bal || null]);
    row.eachCell((cell, colNum) => {
      if (colNum > 1) applyDataStyle(cell, colNum >= 4, i === 2 && parseFloat(closingBalance) > 0);
      if (i === 2) cell.font = { bold: true, size: 10 };
    });
    row.height = 16;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────────────────────
// CASH BOOK EXCEL — Client reference format
// ─────────────────────────────────────────────────────────────
async function generateCashBookExcel(cashData, user, dateRange) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet('Cash Book');

  // Column widths
  sheet.columns = [
    { key: 'date', width: 14 },
    { key: 'detail', width: 48 },
    { key: 'receipts', width: 16 },
    { key: 'payments', width: 16 },
    { key: 'balance', width: 16 },
  ];

  // Row 1: Business name
  sheet.mergeCells(1, 1, 1, 5);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${user.businessName}${user.address ? ', ' + user.address : ''}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 26;

  // Row 2: CASHBOOK
  sheet.mergeCells(2, 1, 2, 5);
  const cbCell = sheet.getCell(2, 1);
  cbCell.value = 'CASHBOOK';
  cbCell.font = { bold: true, size: 12 };
  cbCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Row 3: Date range + printed on
  const fromStr = dateRange?.from ? fmtDate(dateRange.from) : '—';
  const toStr = dateRange?.to ? fmtDate(dateRange.to) : '—';
  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = `From: ${fromStr}  To: ${toStr}`;
  sheet.getCell(3, 1).font = { size: 9, color: { argb: 'FF666666' } };
  sheet.mergeCells(3, 4, 3, 5);
  sheet.getCell(3, 4).value = `Printed On: ${fmtDate(new Date())}`;
  sheet.getCell(3, 4).font = { size: 9, color: { argb: 'FF666666' } };
  sheet.getCell(3, 4).alignment = { horizontal: 'right' };

  // Row 4: blank spacer
  sheet.addRow([]);

  // Row 5: Column headers
  const headerRow = sheet.addRow(['DATE', 'DETAIL', 'RECEIPTS', 'PAYMENTS', 'BALANCE']);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
  });
  headerRow.height = 20;

  // Row 6: Opening Balance
  const openBal = parseFloat(cashData.openingBalance || 0);
  const obRow = sheet.addRow([
    dateRange?.from ? fmtDate(dateRange.from) : '',
    'Opening Balance',
    null,
    null,
    openBal,
  ]);
  obRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    if (colNum >= 3) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    }
  });
  obRow.height = 18;

  // Data rows
  const dataStartRow = sheet.rowCount + 1;
  const entries = cashData.data || [];
  entries.forEach((e, i) => {
    const cashIn = parseFloat(e.cashIn);
    const cashOut = parseFloat(e.cashOut);

    // Build 2-line detail text
    const line1 = e.description || '—';
    const seqStr = e.seq ? `${e.seq}` : '';
    const partyStr = e.partyName || '';
    const line2 = `${seqStr} ${partyStr}`.trim();
    const detailText = line2 ? `${line1}\n${line2}` : line1;

    const row = sheet.addRow([
      fmtDate(e.transactionDate),
      detailText,
      cashIn > 0 ? cashIn : null,
      cashOut > 0 ? cashOut : null,
      parseFloat(e.runningBalance),
    ]);

    row.eachCell((cell, colNum) => {
      applyDataStyle(cell, colNum >= 3);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF9F9F9' } };
    });

    // Enable text wrap for the detail column
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.height = line2 ? 28 : 16;
  });
  const dataEndRow = sheet.rowCount;

  // Totals row with SUM formulas
  sheet.addRow([]);
  const totalsRow = sheet.addRow([
    '',
    'TOTAL',
    { formula: `SUM(C${dataStartRow}:C${dataEndRow})` },
    { formula: `SUM(D${dataStartRow}:D${dataEndRow})` },
    null,
  ]);
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.numFmt = '#,##0.00';
  });
  totalsRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  totalsRow.height = 20;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────────────────────
// PROFIT REPORT EXCEL
// ─────────────────────────────────────────────────────────────
async function generateProfitExcel(profitData, user) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet('Profit Report');

  const cols = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Total Sales (Rs)', key: 'sales', width: 18 },
    { header: 'Total Cost (Rs)', key: 'cost', width: 18 },
    { header: 'Gross Profit (Rs)', key: 'profit', width: 18 },
    { header: 'Margin %', key: 'margin', width: 12 },
  ];
  sheet.columns = cols;

  addBusinessHeader(sheet, user, 'DAILY PROFIT & LOSS REPORT', cols.length);
  sheet.addRow([]);

  const headerRow = sheet.addRow(cols.map((c) => c.header));
  headerRow.eachCell((cell) => applyHeaderStyle(cell));
  headerRow.height = 20;

  profitData.data.forEach((r, i) => {
    const margin = parseFloat(r.totalSales) > 0
      ? ((parseFloat(r.totalProfit) / parseFloat(r.totalSales)) * 100).toFixed(1)
      : '0.0';
    const row = sheet.addRow([
      fmtDate(r.reportDate),
      parseFloat(r.totalSales),
      parseFloat(r.totalCost),
      parseFloat(r.totalProfit),
      parseFloat(margin),
    ]);
    row.eachCell((cell, colNum) => {
      applyDataStyle(cell, colNum >= 2);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF7F8F6' } };
      if (colNum === 5) cell.numFmt = '0.0"%"';
    });
    row.height = 16;
  });

  sheet.addRow([]);
  const { summary } = profitData;
  const summaryRows = [
    ['Total Sales:', parseFloat(summary.totalSales), null, null, null],
    ['Total Cost:', null, parseFloat(summary.totalCost), null, null],
    ['Gross Profit:', null, null, parseFloat(summary.totalProfit), null],
    [`Profit Margin: ${summary.profitMargin}%`, null, null, null, null],
  ];
  summaryRows.forEach(([label, sales, cost, profit], i) => {
    const row = sheet.addRow(['', label, sales, cost, profit]);
    row.eachCell((cell, colNum) => {
      if (colNum > 1) applyDataStyle(cell, colNum >= 3);
      if (i === summaryRows.length - 1) cell.font = { bold: true, size: 10, color: { argb: 'FF' + BRAND_GREEN } };
    });
    row.height = 16;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

async function generateOfferListExcel(offerListData, user) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet('Offer List');

  sheet.columns = [
    { key: 'item', width: 44 },
    { key: 'offer', width: 22 },
    { key: 'remarks', width: 34 },
  ];

  // Row 1: Business name
  sheet.mergeCells(1, 1, 1, 3);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = user.businessName;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 26;

  // Row 2: OFFER LIST
  sheet.mergeCells(2, 1, 2, 3);
  const subCell = sheet.getCell(2, 1);
  subCell.value = 'OFFER LIST';
  subCell.font = { bold: true, size: 12 };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Row 3: Meta
  const listDateStr = offerListData.listDate ? fmtDate(offerListData.listDate) : '—';
  sheet.mergeCells(3, 1, 3, 2);
  sheet.getCell(3, 1).value = `List # ${offerListData.listNumber}    List Date: ${listDateStr}`;
  sheet.getCell(3, 1).font = { size: 9, color: { argb: 'FF666666' } };

  sheet.getCell(3, 3).value = `Printed On: ${fmtDate(new Date())}`;
  sheet.getCell(3, 3).font = { size: 9, color: { argb: 'FF666666' } };
  sheet.getCell(3, 3).alignment = { horizontal: 'right' };

  // Row 4: Spacer
  sheet.addRow([]);

  // Row 5: Column Headers
  const headerRow = sheet.addRow(['ITEM', 'OFFER', 'REMARKS']);
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'center' : 'left' };
  });
  headerRow.height = 22;

  // Company Groups
  const companyGroups = offerListData.companyGroups || [];
  companyGroups.forEach((group) => {
    // Company Header Row
    const compRow = sheet.addRow([`${group.companyName.toUpperCase()} (${group.items.length})`, null, null]);
    sheet.mergeCells(compRow.number, 1, compRow.number, 3);
    const compCell = compRow.getCell(1);
    compCell.font = { bold: true, size: 10, color: { argb: 'FF' + BRAND_GREEN } };
    compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EBE9' } };
    compCell.alignment = { vertical: 'middle' };
    compRow.height = 20;

    // Items
    group.items.forEach((item) => {
      const row = sheet.addRow([
        `   ${item.productName}`,
        item.offerLabel || '—',
        item.remarks || '',
      ]);
      row.getCell(1).font = { size: 9.5 };
      row.getCell(2).font = { bold: true, size: 9.5 };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).font = { size: 9, color: { argb: 'FF666666' } };
      row.height = 18;
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

async function generatePartyBalanceExcel(reportData, user) {
  const wb = new ExcelJS.Workbook();
  wb.creator = user.businessName;
  const sheet = wb.addWorksheet('Party Balance');

  sheet.columns = [
    { key: 'seq', width: 8 },
    { key: 'code', width: 12 },
    { key: 'party', width: 44 },
    { key: 'closing', width: 18 },
    { key: 'type', width: 10 },
  ];

  // Row 1: Business name
  sheet.mergeCells(1, 1, 1, 5);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${user.businessName}${user.address ? ', ' + user.address : ''}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 26;

  // Row 2: Title
  sheet.mergeCells(2, 1, 2, 5);
  const subCell = sheet.getCell(2, 1);
  subCell.value = 'Party Wise Balance Report';
  subCell.font = { bold: true, size: 12 };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Row 3: Meta
  const asOnStr = reportData.asOnDate ? fmtDate(reportData.asOnDate) : '—';
  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = `As On: ${asOnStr}    Filter: ${reportData.filterLabel}`;
  sheet.getCell(3, 1).font = { size: 9, color: { argb: 'FF666666' } };

  sheet.mergeCells(3, 4, 3, 5);
  sheet.getCell(3, 4).value = `Printed On: ${fmtDate(new Date())}`;
  sheet.getCell(3, 4).font = { size: 9, color: { argb: 'FF666666' } };
  sheet.getCell(3, 4).alignment = { horizontal: 'right' };

  // Row 4: Spacer
  sheet.addRow([]);

  // Row 5: Column Headers
  const headerRow = sheet.addRow(['S#', 'CODE', 'PARTY', 'CLOSING', 'TYPE']);
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 4 ? 'right' : colNum === 1 || colNum === 2 || colNum === 5 ? 'center' : 'left' };
  });
  headerRow.height = 22;

  // Area Groups
  const areaGroups = reportData.areaGroups || [];
  areaGroups.forEach((group) => {
    // Area Header Row
    const areaRow = sheet.addRow([`Area ${group.area}`, null, null, null, null]);
    sheet.mergeCells(areaRow.number, 1, areaRow.number, 5);
    const areaCell = areaRow.getCell(1);
    areaCell.font = { bold: true, size: 10, color: { argb: 'FF' + BRAND_GREEN } };
    areaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
    areaCell.alignment = { vertical: 'middle' };
    areaRow.height = 20;

    const groupStartRow = sheet.rowCount + 1;

    group.customers.forEach((c) => {
      const row = sheet.addRow([
        c.seq,
        c.code || '0',
        `   ${c.customerName}`,
        c.closing,
        c.balanceType,
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(5).font = { bold: true, color: { argb: c.balanceType === 'DR' ? 'FF166534' : 'FFB4372B' } };
      row.height = 18;
    });

    const groupEndRow = sheet.rowCount;

    // Area Subtotal Row
    const subRow = sheet.addRow([
      null,
      null,
      `TOTAL Area ${group.area}`,
      { formula: `SUM(D${groupStartRow}:D${groupEndRow})`, result: group.subtotal },
      null,
    ]);
    subRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F2' } };
      if (colNum === 4) {
        cell.alignment = { horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });
    subRow.height = 19;
  });

  // Grand Total Row
  sheet.addRow([]);
  const grandRow = sheet.addRow(['', '', 'GRAND TOTAL', reportData.grandTotal, '']);
  grandRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
    if (colNum === 4) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0.00';
    }
  });
  grandRow.height = 24;

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────────────────────
// TRIAL BALANCE EXCEL
// ─────────────────────────────────────────────────────────────
async function generateTrialBalanceExcel(data, user) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Trial Balance');
  sheet.columns = [
    { width: 40 },
    { width: 20 },
    { width: 20 },
  ];

  addBusinessHeader(sheet, user, `Trial Balance — As on: ${data.asOnDate}`, 3);

  // Header row
  const headerRow = sheet.addRow(['Account Name', 'Debit (Rs)', 'Credit (Rs)']);
  headerRow.eachCell((cell) => applyHeaderStyle(cell));
  headerRow.height = 22;

  let currentSection = '';
  for (const row of data.rows) {
    if (row.section !== currentSection) {
      currentSection = row.section;
      const secRow = sheet.addRow([currentSection, '', '']);
      secRow.eachCell((cell) => {
        cell.font = { bold: true, size: 9, color: { argb: 'FF' + BRAND_GREEN } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0EB' } };
      });
      secRow.height = 20;
    }

    const dr = sheet.addRow([
      row.name,
      row.debit > 0 ? parseFloat(row.debit.toFixed(2)) : '',
      row.credit > 0 ? parseFloat(row.credit.toFixed(2)) : '',
    ]);
    dr.eachCell((cell, colNum) => {
      applyDataStyle(cell, colNum > 1);
    });
  }

  // Totals row
  const totalRow = sheet.addRow(['TOTAL', parseFloat(data.totalDebit.toFixed(2)), parseFloat(data.totalCredit.toFixed(2))]);
  totalRow.eachCell((cell) => applyHeaderStyle(cell));
  totalRow.height = 24;

  // Balance check row
  const statusText = data.isBalanced
    ? '✓ Trial Balance is BALANCED'
    : `⚠ NOT BALANCED — Difference: Rs ${data.difference.toFixed(2)}`;
  sheet.addRow([]);
  const statusRow = sheet.addRow([statusText, '', '']);
  sheet.mergeCells(statusRow.number, 1, statusRow.number, 3);
  const statusCell = statusRow.getCell(1);
  statusCell.font = { bold: true, size: 11, color: { argb: data.isBalanced ? 'FF166534' : 'FFB4372B' } };
  statusCell.alignment = { horizontal: 'center' };

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

// ─────────────────────────────────────────────────────────────
// BALANCE SHEET EXCEL
// ─────────────────────────────────────────────────────────────
async function generateBalanceSheetExcel(data, user) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Balance Sheet');
  sheet.columns = [
    { width: 45 },
    { width: 22 },
  ];

  addBusinessHeader(sheet, user, `Balance Sheet — As on: ${data.asOnDate}`, 2);

  function sectionHeader(label) {
    const row = sheet.addRow([label, '']);
    row.eachCell((cell) => applyHeaderStyle(cell));
    row.height = 22;
  }

  function dataRow(name, amount, bold) {
    const row = sheet.addRow([name, parseFloat(amount.toFixed(2))]);
    row.eachCell((cell, colNum) => {
      applyDataStyle(cell, colNum === 2);
      if (bold) cell.font = { ...cell.font, bold: true };
    });
  }

  function totalRow(label, amount, color) {
    const row = sheet.addRow([label, parseFloat(amount.toFixed(2))]);
    row.eachCell((cell) => applyHeaderStyle(cell, color || BRAND_GREEN));
    row.height = 24;
  }

  // Assets
  sectionHeader('ASSETS');
  for (const item of data.assets) {
    dataRow(item.name, item.amount, false);
  }
  totalRow('Total Assets', data.totalAssets);
  sheet.addRow([]);

  // Liabilities
  sectionHeader('LIABILITIES');
  for (const item of data.liabilities) {
    dataRow(item.name, item.amount, false);
  }
  totalRow('Total Liabilities', data.totalLiabilities);
  sheet.addRow([]);

  // Equity
  sectionHeader('EQUITY');
  for (const item of data.equity) {
    dataRow(item.name, item.amount, true);
  }
  totalRow('Total Equity', data.totalEquity);
  sheet.addRow([]);

  // Final total
  totalRow('Total Liabilities + Equity', data.totalLiabilitiesAndEquity);

  // Balance check
  sheet.addRow([]);
  const statusText = data.isBalanced
    ? '✓ Balance Sheet is BALANCED — Assets = Liabilities + Equity'
    : `⚠ NOT BALANCED — Difference: Rs ${data.difference.toFixed(2)}`;
  const statusRow = sheet.addRow([statusText, '']);
  sheet.mergeCells(statusRow.number, 1, statusRow.number, 2);
  const statusCell = statusRow.getCell(1);
  statusCell.font = { bold: true, size: 11, color: { argb: data.isBalanced ? 'FF166534' : 'FFB4372B' } };
  statusCell.alignment = { horizontal: 'center' };

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateInvoiceExcel,
  generateLedgerExcel,
  generateCashBookExcel,
  generateProfitExcel,
  generateOfferListExcel,
  generatePartyBalanceExcel,
  generateTrialBalanceExcel,
  generateBalanceSheetExcel,
};

