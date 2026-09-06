// ─────────────────────────────────────────────────────────────
// src/services/pdfService.js
// Generates clean, minimal accounting PDFs using PDFKit
// All documents: business header, party details, itemized table, totals
// ─────────────────────────────────────────────────────────────
const PDFDocument = require('pdfkit');

// ── Color constants matching the app palette ─────────────────
const COLORS = {
  brand: '#0F6E4F',
  text: '#1C1F1E',
  border: '#DADFDB',
  headerBg: '#F7F8F6',
  accent: '#1B4B91',
  alert: '#B4372B',
  paid: '#166534',
  pending: '#92400E',
};

function formatPKR(val) {
  return `Rs ${parseFloat(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Draw a simple table ───────────────────────────────────────
function drawTable(doc, headers, rows, startY, colWidths) {
  const rowHeight = 20;
  const tableX = 40;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.rect(tableX, startY, tableWidth, rowHeight).fill(COLORS.brand);
  let x = tableX;
  headers.forEach((h, i) => {
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
      .text(h, x + 4, startY + 6, { width: colWidths[i] - 8, align: i > 1 ? 'right' : 'left' });
    x += colWidths[i];
  });

  // Data rows
  let y = startY + rowHeight;
  rows.forEach((row, rowIdx) => {
    const bg = rowIdx % 2 === 0 ? '#FFFFFF' : '#F7F8F6';
    doc.rect(tableX, y, tableWidth, rowHeight).fill(bg);
    // Bottom border
    doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight)
      .strokeColor(COLORS.border).lineWidth(0.5).stroke();

    let cx = tableX;
    row.forEach((cell, i) => {
      doc.fillColor(COLORS.text).fontSize(8).font('Helvetica')
        .text(String(cell), cx + 4, y + 6, { width: colWidths[i] - 8, align: i > 1 ? 'right' : 'left' });
      cx += colWidths[i];
    });
    y += rowHeight;
  });

  return y; // return final Y position
}

// ── Business header block ─────────────────────────────────────
function drawHeader(doc, user, title, subtitle) {
  // Brand bar
  doc.rect(0, 0, doc.page.width, 48).fill(COLORS.brand);
  doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
    .text(user.businessName, 40, 14);
  doc.fontSize(9).font('Helvetica')
    .text(title, 40, 32);

  // Right side: date + subtitle
  doc.fontSize(9).text(subtitle || `Generated: ${formatDate(new Date())}`, 0, 20, { align: 'right', width: doc.page.width - 40 });

  doc.moveDown(3);
}

// ── Helper: Day name and time format ─────────────────────────
function getDayName(d) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dt = d ? new Date(d) : new Date();
  return days[dt.getDay()];
}

function formatTime(d) {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(d) {
  const dt = d ? new Date(d) : new Date();
  return `${formatDate(dt)} ${formatTime(dt)}`;
}

// ─────────────────────────────────────────────────────────────
// INVOICE PDF (Matching Client Reference Format)
// ─────────────────────────────────────────────────────────────
function generateInvoicePDF(invoice, user) {
  return new Promise((resolve, reject) => {
    // 20pt margins for A4 landscape or portrait (595.28 x 841.89 pt)
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const marginL = 20;
    const tableW = 555;

    // Header: Business Name & City
    const bizName = (user.businessName || 'RAHMAT MEDICAL WHOLESALE').toUpperCase();
    const bizCity = (user.city || 'BHIRYA CITY').toUpperCase();
    const bizAddr = user.address || 'Main Bazar, Bhirya City';

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
      .text(`${bizName}, ${bizCity}`, marginL, 20, { align: 'center', width: tableW });
    doc.fontSize(8.5).font('Helvetica').fillColor('#444444')
      .text(bizAddr, marginL, 36, { align: 'center', width: tableW });

    doc.moveTo(marginL, 48).lineTo(marginL + tableW, 48).strokeColor('#333333').lineWidth(1).stroke();

    // Meta Block
    const metaY = 54;
    // Row 1: Est# | INVOICE | Page#
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000')
      .text(`Est# ${invoice.invoiceNo}`, marginL, metaY);
    doc.fontSize(12).font('Helvetica-Bold')
      .text('INVOICE', marginL, metaY - 2, { align: 'center', width: tableW });
    doc.fontSize(8.5).font('Helvetica').fillColor('#555555')
      .text('Page# 1 of 1', marginL, metaY, { align: 'right', width: tableW });

    // Row 2: Party & Area
    const partyCode = invoice.customer?.customerCode || '0';
    const partyName = (invoice.customer?.customerName || 'COUNTER').toUpperCase();
    const partyArea = (invoice.customer?.area || 'UNASSIGNED').toUpperCase();

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
      .text(`Party: ${partyCode} ${partyName}`, marginL, metaY + 14);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e40af')
      .text(`Area: ${partyArea}`, marginL, metaY + 14, { align: 'right', width: tableW });

    // Row 3: Date, Day, Made At, Salesman
    const invDateStr = formatDate(invoice.invoiceDate);
    const dayName = getDayName(invoice.invoiceDate);
    const madeAtStr = formatTime(invoice.createdAt);
    const salesmanStr = invoice.salesman ? `Salesman: ${invoice.salesman}` : '';

    doc.fontSize(8).font('Helvetica').fillColor('#333333')
      .text(`Date: ${invDateStr}    Day: ${dayName}    Made At: ${madeAtStr}`, marginL, metaY + 28);
    if (salesmanStr) {
      doc.text(salesmanStr, marginL, metaY + 28, { align: 'right', width: tableW });
    }

    // Row 4: User, Status, Printed At
    const userName = (user.ownerName || 'ADMIN').toUpperCase();
    const statusStr = invoice.printCount > 0 ? 'COPY' : 'ORIGINAL';
    const printedAtStr = formatDateTime(new Date());

    doc.fontSize(8).font('Helvetica').fillColor('#333333')
      .text(`User: ${userName}        Status: ${statusStr}`, marginL, metaY + 40);
    doc.text(`Printed At: ${printedAtStr}`, marginL, metaY + 40, { align: 'right', width: tableW });

    let currentY = metaY + 54;
    if (invoice.notes) {
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#555555')
        .text(`Note: ${invoice.notes}`, marginL, currentY);
      currentY += 12;
    }

    // Table Column Definitions (13 columns, total = 555pt)
    const cols = [
      { key: 'seq', label: 'S#', w: 20, align: 'center' },
      { key: 'qty', label: 'PKT', w: 30, align: 'center' },
      { key: 'price', label: 'PRICE', w: 46, align: 'right' },
      { key: 'item', label: 'ITEM', w: 115, align: 'left' },
      { key: 'packing', label: 'PACKING', w: 38, align: 'left' },
      { key: 'disc', label: 'DIS%', w: 30, align: 'center' },
      { key: 'discAmt', label: 'DIS AMT', w: 42, align: 'right' },
      { key: 'stu', label: 'ST/U', w: 28, align: 'center' },
      { key: 'st', label: 'ST', w: 36, align: 'right' },
      { key: 'net', label: 'NET', w: 50, align: 'right' },
      { key: 'pcs', label: 'PCS', w: 26, align: 'center' },
      { key: 'batch', label: 'BATCH', w: 44, align: 'left' },
      { key: 'gross', label: 'GROSS', w: 50, align: 'right' },
    ];

    // Compute column X coordinates
    let cumX = marginL;
    cols.forEach((col) => {
      col.x = cumX;
      cumX += col.w;
    });

    // Table Header Row
    const thHeight = 16;
    doc.rect(marginL, currentY, tableW, thHeight).fill('#1e293b');
    cols.forEach((col) => {
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
        .text(col.label, col.x + 2, currentY + 4, { width: col.w - 4, align: col.align });
    });
    currentY += thHeight;

    // Line Items
    let totalDiscountAmt = 0;
    let totalGrossAmt = 0;
    let totalSchemeAmt = 0;
    let totalNetAmt = 0;

    const rowH = 15;
    invoice.items.forEach((item, idx) => {
      // Check page overflow
      if (currentY + rowH > doc.page.height - 70) {
        doc.addPage();
        currentY = 25;
      }

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

      totalGrossAmt += gross;
      totalDiscountAmt += discAmt;
      totalSchemeAmt += st;
      totalNetAmt += net;

      // Alternating row background
      if (idx % 2 === 1) {
        doc.rect(marginL, currentY, tableW, rowH).fill('#f8fafc');
      }

      doc.fillColor('#000000').fontSize(7.5).font('Helvetica');

      // Draw each cell
      cols.forEach((col) => {
        let val = '';
        if (col.key === 'seq') val = String(idx + 1);
        else if (col.key === 'qty') val = String(qty);
        else if (col.key === 'price') val = unitPriceStr;
        else if (col.key === 'item') val = (item.product?.productName || '—').toUpperCase();
        else if (col.key === 'packing') val = item.packing || item.product?.unit || '—';
        else if (col.key === 'disc') val = parseFloat(item.discount || 0) > 0 ? `${parseFloat(item.discount)}%` : '0%';
        else if (col.key === 'discAmt') val = discAmt > 0 ? discAmt.toFixed(0) : '0';
        else if (col.key === 'stu') val = stu > 0 ? String(stu) : '0';
        else if (col.key === 'st') val = st > 0 ? st.toFixed(0) : '0';
        else if (col.key === 'net') val = net.toFixed(0);
        else if (col.key === 'pcs') val = pcs > 0 ? String(pcs) : '0';
        else if (col.key === 'batch') val = item.batchNo || item.product?.batchNo || '—';
        else if (col.key === 'gross') val = gross.toFixed(0);

        doc.text(val, col.x + 2, currentY + 3.5, {
          width: col.w - 4,
          align: col.align,
          ellipsis: true,
        });
      });

      // Subtle bottom line
      doc.moveTo(marginL, currentY + rowH).lineTo(marginL + tableW, currentY + rowH)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      currentY += rowH;
    });

    // Table Footer Separator
    doc.moveTo(marginL, currentY).lineTo(marginL + tableW, currentY)
      .strokeColor('#0f172a').lineWidth(1).stroke();
    currentY += 4;

    // << TOTAL >> Row
    doc.rect(marginL, currentY, tableW, 18).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text('<< TOTAL >>', marginL + 8, currentY + 4);

    const totalsStr = `Dis Amt: ${totalDiscountAmt.toFixed(0)}     Gross: ${totalGrossAmt.toFixed(0)}     Scheme: ${totalSchemeAmt.toFixed(0)}     Net: ${totalNetAmt.toFixed(0)}`;
    doc.text(totalsStr, marginL, currentY + 4, { align: 'right', width: tableW - 8 });
    currentY += 24;

    // Balance Summary Box
    const prvBalance = parseFloat(invoice.prvBalance || 0);
    const invTotal = parseFloat(invoice.totalAmount || totalNetAmt);
    const paidAmt = parseFloat(invoice.paidAmount || 0);
    const newBalance = prvBalance + invTotal - paidAmt;

    const summaryY = currentY;
    doc.rect(marginL, summaryY, tableW, 26).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text(`Inv Total: Rs ${invTotal.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`, marginL + 12, summaryY + 8);
    doc.text(`Prv: Rs ${prvBalance.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`, marginL + 180, summaryY + 8);
    if (paidAmt > 0) {
      doc.text(`Paid: Rs ${paidAmt.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`, marginL + 320, summaryY + 8);
    }
    doc.fillColor('#1e40af').text(`Balance: Rs ${newBalance.toLocaleString('en-PK', { minimumFractionDigits: 0 })}`, marginL, summaryY + 8, { align: 'right', width: tableW - 12 });

    // Footer note
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Oblique')
      .text('Thank you for your business. Computer generated invoice.', marginL, doc.page.height - 20, { align: 'center', width: tableW });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────
// LEDGER PDF  (works for both customer and company)
// ─────────────────────────────────────────────────────────────
function generateLedgerPDF(ledgerData, user, partyType) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const party = partyType === 'customer' ? ledgerData.customer : ledgerData.company;
    const partyName = partyType === 'customer'
      ? `${party.customerName}${party.shopName ? ' — ' + party.shopName : ''}`
      : party.companyName;

    drawHeader(doc, user, `${partyType.toUpperCase()} LEDGER STATEMENT`, formatDate(new Date()));

    const y = 68;
    doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold').text('Party:', 40, y);
    doc.font('Helvetica').text(partyName, 40, y + 12);
    if (party.phone) doc.text(`Phone: ${party.phone}`, 40, y + 22);

    const headers = ['Date', 'Description', 'Ref Type', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
    const colWidths = [55, 175, 65, 70, 70, 80];
    const rows = ledgerData.transactions.map((t) => [
      formatDate(t.transactionDate),
      t.description,
      t.referenceType,
      parseFloat(t.debit) > 0 ? formatPKR(t.debit) : '—',
      parseFloat(t.credit) > 0 ? formatPKR(t.credit) : '—',
      formatPKR(t.runningBalance),
    ]);

    const tableY = y + 58;
    const afterTable = drawTable(doc, headers, rows, tableY, colWidths);

    // Summary
    let sy = afterTable + 16;
    const { totalDebit, totalCredit, closingBalance } = ledgerData.summary;
    const summaryRows = [
      ['Total Debit:', formatPKR(totalDebit)],
      ['Total Credit:', formatPKR(totalCredit)],
      ['Closing Balance:', formatPKR(closingBalance)],
    ];
    doc.rect(350, sy - 6, doc.page.width - 390, summaryRows.length * 18 + 12).fill(COLORS.headerBg);
    summaryRows.forEach(([label, value], i) => {
      const isLast = i === summaryRows.length - 1;
      doc.fillColor(isLast && parseFloat(closingBalance) > 0 ? COLORS.alert : COLORS.text)
        .font(isLast ? 'Helvetica-Bold' : 'Helvetica').fontSize(isLast ? 10 : 8)
        .text(label, 360, sy).text(value, 360, sy, { align: 'right', width: doc.page.width - 400 });
      sy += 18;
    });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────
// CASH BOOK PDF — Client reference format
// ─────────────────────────────────────────────────────────────
function generateCashBookPDF(cashData, user, dateRange) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const marginL = 36;
    const marginR = 36;
    const tableW = pageW - marginL - marginR;

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
      .text(`${user.businessName}${user.address ? ', ' + user.address : ''}`, marginL, 36, { align: 'center', width: tableW });
    doc.fontSize(12).font('Helvetica-Bold')
      .text('CASHBOOK', marginL, 54, { align: 'center', width: tableW });

    // Date range + printed on
    const fromStr = dateRange?.from ? formatDate(dateRange.from) : '—';
    const toStr = dateRange?.to ? formatDate(dateRange.to) : '—';
    doc.fontSize(8).font('Helvetica').fillColor('#444444')
      .text(`From: ${fromStr}  To: ${toStr}`, marginL, 72)
      .text(`Printed On: ${formatDate(new Date())}`, marginL, 72, { align: 'right', width: tableW });

    // ── Column widths ───────────────────────────────────────
    const colW = [58, 245, 75, 75, 82]; // DATE, DETAIL, RECEIPTS, PAYMENTS, BALANCE
    const colX = [marginL];
    for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);

    // ── Table header ────────────────────────────────────────
    let y = 90;
    const rowH = 18;
    const headerLabels = ['DATE', 'DETAIL', 'RECEIPTS', 'PAYMENTS', 'BALANCE'];

    // Header row background
    doc.rect(marginL, y, tableW, rowH).fill('#222222');
    headerLabels.forEach((label, i) => {
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
        .text(label, colX[i] + 4, y + 5, { width: colW[i] - 8, align: i >= 2 ? 'right' : 'left' });
    });
    y += rowH;

    // ── Opening Balance row ─────────────────────────────────
    const openBal = parseFloat(cashData.openingBalance || 0);
    doc.rect(marginL, y, tableW, rowH).fill('#F5F5F5');
    doc.moveTo(marginL, y + rowH).lineTo(marginL + tableW, y + rowH).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
      .text(dateRange?.from ? formatDate(dateRange.from) : '—', colX[0] + 4, y + 5, { width: colW[0] - 8 })
      .text('Opening Balance', colX[1] + 4, y + 5, { width: colW[1] - 8 })
      .text(formatPKR(openBal), colX[4] + 4, y + 5, { width: colW[4] - 8, align: 'right' });
    y += rowH;

    // ── Data rows (2-line detail) ───────────────────────────
    const entries = cashData.data || [];
    const dataRowH = 28; // taller for 2-line detail

    entries.forEach((e, idx) => {
      // Page break check
      if (y + dataRowH > doc.page.height - 60) {
        doc.addPage();
        y = 36;
      }

      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
      doc.rect(marginL, y, tableW, dataRowH).fill(bg);
      doc.moveTo(marginL, y + dataRowH).lineTo(marginL + tableW, y + dataRowH).strokeColor('#DDDDDD').lineWidth(0.3).stroke();

      // DATE
      doc.fillColor('#000000').fontSize(8).font('Helvetica')
        .text(formatDate(e.transactionDate), colX[0] + 4, y + 4, { width: colW[0] - 8 });

      // DETAIL — line 1: description (reference text)
      doc.fontSize(7.5).font('Helvetica')
        .text(e.description || '—', colX[1] + 4, y + 3, { width: colW[1] - 8, lineBreak: false });
      // DETAIL — line 2: sequence + party name
      const seqStr = e.seq ? `${e.seq}` : '';
      const partyStr = e.partyName || '';
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#333333')
        .text(`${seqStr} ${partyStr}`.trim(), colX[1] + 4, y + 15, { width: colW[1] - 8, lineBreak: false });

      // RECEIPTS (cashIn)
      const cashIn = parseFloat(e.cashIn);
      if (cashIn > 0) {
        doc.fillColor('#000000').fontSize(8).font('Helvetica')
          .text(formatPKR(cashIn), colX[2] + 4, y + 8, { width: colW[2] - 8, align: 'right' });
      }

      // PAYMENTS (cashOut)
      const cashOut = parseFloat(e.cashOut);
      if (cashOut > 0) {
        doc.fillColor('#000000').fontSize(8).font('Helvetica')
          .text(formatPKR(cashOut), colX[3] + 4, y + 8, { width: colW[3] - 8, align: 'right' });
      }

      // BALANCE
      doc.fillColor('#000000').fontSize(8).font('Helvetica')
        .text(formatPKR(e.runningBalance), colX[4] + 4, y + 8, { width: colW[4] - 8, align: 'right' });

      y += dataRowH;
    });

    // ── Totals row ──────────────────────────────────────────
    if (y + rowH > doc.page.height - 40) { doc.addPage(); y = 36; }
    doc.rect(marginL, y, tableW, rowH + 2).fill('#222222');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
      .text('TOTAL', colX[1] + 4, y + 5, { width: colW[1] - 8 })
      .text(formatPKR(cashData.summary.totalIn), colX[2] + 4, y + 5, { width: colW[2] - 8, align: 'right' })
      .text(formatPKR(cashData.summary.totalOut), colX[3] + 4, y + 5, { width: colW[3] - 8, align: 'right' });

    // Closing balance
    const closingBal = openBal + parseFloat(cashData.summary.totalIn) - parseFloat(cashData.summary.totalOut);
    doc.text(formatPKR(closingBal), colX[4] + 4, y + 5, { width: colW[4] - 8, align: 'right' });

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────
// PROFIT REPORT PDF
// ─────────────────────────────────────────────────────────────
function generateProfitPDF(profitData, user, dateRange) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const subtitle = dateRange ? `Period: ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}` : '';
    drawHeader(doc, user, 'DAILY PROFIT & LOSS REPORT', subtitle);

    const headers = ['Date', 'Total Sales', 'Total Cost', 'Gross Profit', 'Margin %'];
    const colWidths = [75, 120, 110, 110, 100];
    const rows = profitData.data.map((r) => {
      const margin = parseFloat(r.totalSales) > 0
        ? ((parseFloat(r.totalProfit) / parseFloat(r.totalSales)) * 100).toFixed(1)
        : '0.0';
      return [
        formatDate(r.reportDate),
        formatPKR(r.totalSales),
        formatPKR(r.totalCost),
        formatPKR(r.totalProfit),
        `${margin}%`,
      ];
    });

    const tableY = 90;
    const afterTable = drawTable(doc, headers, rows, tableY, colWidths);

    let sy = afterTable + 16;
    const { summary } = profitData;
    const summaryRows = [
      ['Total Sales:', formatPKR(summary.totalSales)],
      ['Total Cost:', formatPKR(summary.totalCost)],
      ['Gross Profit:', formatPKR(summary.totalProfit)],
      [`Profit Margin: ${summary.profitMargin}%`, ''],
    ];
    doc.rect(310, sy - 6, doc.page.width - 350, summaryRows.length * 18 + 12).fill(COLORS.headerBg);
    summaryRows.forEach(([label, value], i) => {
      const isLast = i >= summaryRows.length - 1;
      doc.fillColor(isLast ? COLORS.brand : COLORS.text)
        .font(isLast ? 'Helvetica-Bold' : 'Helvetica').fontSize(isLast ? 10 : 8)
        .text(label, 320, sy);
      if (value) doc.text(value, 320, sy, { align: 'right', width: doc.page.width - 360 });
      sy += 18;
    });

    doc.end();
  });
}

function generateOfferListPDF(offerListData, user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const marginL = 36;
    const marginR = 36;
    const tableW = pageW - marginL - marginR;

    const colW = [260, 110, 153];
    const colX = [marginL, marginL + colW[0], marginL + colW[0] + colW[1]];

    function renderHeader() {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
        .text(user.businessName, marginL, 36, { align: 'center', width: tableW });
      doc.fontSize(12).font('Helvetica-Bold')
        .text('OFFER LIST', marginL, 54, { align: 'center', width: tableW });

      const listNoStr = `List # ${offerListData.listNumber}    List Date: ${formatDate(offerListData.listDate)}`;
      const printedStr = `Printed On: ${formatDate(new Date())}`;

      doc.fontSize(8.5).font('Helvetica').fillColor('#444444')
        .text(listNoStr, marginL, 72)
        .text(printedStr, marginL, 72, { align: 'right', width: tableW });

      // Table Header
      const headerY = 90;
      doc.rect(marginL, headerY, tableW, 20).fill('#222222');
      const headers = ['ITEM', 'OFFER', 'REMARKS'];
      headers.forEach((h, i) => {
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
          .text(h, colX[i] + 8, headerY + 6, { width: colW[i] - 16, align: i === 1 ? 'center' : 'left' });
      });

      return 110;
    }

    let y = renderHeader();
    const companyGroups = offerListData.companyGroups || [];

    companyGroups.forEach((group) => {
      // Check space for company header + at least 1 item
      if (y + 45 > doc.page.height - 40) {
        doc.addPage();
        y = renderHeader();
      }

      // Company Group Header
      const compHeaderH = 22;
      doc.rect(marginL, y, tableW, compHeaderH).fill('#E8EBE9');
      doc.moveTo(marginL, y + compHeaderH).lineTo(marginL + tableW, y + compHeaderH).strokeColor('#CCD2CE').lineWidth(0.5).stroke();
      doc.fillColor('#0F6E4F').fontSize(9.5).font('Helvetica-Bold')
        .text(`${group.companyName.toUpperCase()} (${group.items.length})`, marginL + 8, y + 6, { width: tableW - 16 });
      y += compHeaderH;

      // Products under this company
      const rowH = 19;
      group.items.forEach((item, idx) => {
        if (y + rowH > doc.page.height - 40) {
          doc.addPage();
          y = renderHeader();
          doc.rect(marginL, y, tableW, compHeaderH).fill('#E8EBE9');
          doc.fillColor('#0F6E4F').fontSize(9.5).font('Helvetica-Bold')
            .text(`${group.companyName.toUpperCase()} (cont.)`, marginL + 8, y + 6, { width: tableW - 16 });
          y += compHeaderH;
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : '#FBFBFB';
        doc.rect(marginL, y, tableW, rowH).fill(bg);
        doc.moveTo(marginL, y + rowH).lineTo(marginL + tableW, y + rowH).strokeColor('#EEEEEE').lineWidth(0.3).stroke();

        // ITEM (Indented)
        doc.fillColor('#1C1F1E').fontSize(8.5).font('Helvetica')
          .text(`  ${item.productName}`, colX[0] + 6, y + 5, { width: colW[0] - 12, lineBreak: false });

        // OFFER
        doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold')
          .text(item.offerLabel || '—', colX[1] + 6, y + 5, { width: colW[1] - 12, align: 'center', lineBreak: false });

        // REMARKS
        doc.fillColor('#666666').fontSize(8).font('Helvetica')
          .text(item.remarks || '—', colX[2] + 6, y + 5, { width: colW[2] - 12, lineBreak: false });

        y += rowH;
      });

      y += 6; // Space after group
    });

    doc.end();
  });
}

function generatePartyBalancePDF(reportData, user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const marginL = 36;
    const marginR = 36;
    const tableW = pageW - marginL - marginR;

    const colW = [35, 45, 85, 358];
    const colX = [marginL, marginL + colW[0], marginL + colW[0] + colW[1], marginL + colW[0] + colW[1] + colW[2]];

    function renderHeader() {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
        .text(`${user.businessName}${user.address ? ', ' + user.address : ''}`, marginL, 36, { align: 'center', width: tableW });
      doc.fontSize(11).font('Helvetica-Bold')
        .text('Party Wise Balance Report', marginL, 52, { align: 'center', width: tableW });

      const asOnStr = `As On: ${formatDate(reportData.asOnDate)}    Filter: ${reportData.filterLabel}`;
      const printedStr = `Printed On: ${formatDate(new Date())}`;

      doc.fontSize(8.5).font('Helvetica').fillColor('#444444')
        .text(asOnStr, marginL, 68)
        .text(printedStr, marginL, 68, { align: 'right', width: tableW });

      const headerY = 84;
      doc.rect(marginL, headerY, tableW, 18).fill('#222222');
      const headers = ['S#', 'CODE', 'CLOSING', 'PARTY'];
      headers.forEach((h, i) => {
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
          .text(h, colX[i] + 4, headerY + 5, { width: colW[i] - 8, align: i === 2 ? 'right' : 'left' });
      });

      return 102;
    }

    let y = renderHeader();
    const areaGroups = reportData.areaGroups || [];

    areaGroups.forEach((group) => {
      if (y + 55 > doc.page.height - 40) {
        doc.addPage();
        y = renderHeader();
      }

      const areaH = 18;
      doc.rect(marginL, y, tableW, areaH).fill('#EAEAEA');
      doc.fillColor('#0F6E4F').fontSize(9).font('Helvetica-Bold')
        .text(`Area ${group.area}`, marginL + 8, y + 4, { width: tableW - 16 });
      y += areaH;

      const rowH = 16;
      group.customers.forEach((c, idx) => {
        if (y + rowH > doc.page.height - 40) {
          doc.addPage();
          y = renderHeader();
          doc.rect(marginL, y, tableW, areaH).fill('#EAEAEA');
          doc.fillColor('#0F6E4F').fontSize(9).font('Helvetica-Bold')
            .text(`Area ${group.area} (cont.)`, marginL + 8, y + 4, { width: tableW - 16 });
          y += areaH;
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : '#FBFBFB';
        doc.rect(marginL, y, tableW, rowH).fill(bg);
        doc.moveTo(marginL, y + rowH).lineTo(marginL + tableW, y + rowH).strokeColor('#EEEEEE').lineWidth(0.3).stroke();

        doc.fillColor('#444444').fontSize(7.5).font('Helvetica')
          .text(String(c.seq), colX[0] + 4, y + 4, { width: colW[0] - 8 });

        doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold')
          .text(String(c.code || '0'), colX[1] + 4, y + 4, { width: colW[1] - 8 });

        doc.fillColor('#000000').fontSize(8).font('Helvetica')
          .text(formatPKR(c.closing), colX[2] + 4, y + 4, { width: colW[2] - 8, align: 'right' });

        doc.fillColor('#1C1F1E').fontSize(8).font('Helvetica')
          .text(c.customerName, colX[3] + 4, y + 4, { width: colW[3] - 40, lineBreak: false });
        doc.fillColor(c.balanceType === 'DR' ? '#166534' : '#B4372B').fontSize(8).font('Helvetica-Bold')
          .text(c.balanceType, colX[3] + colW[3] - 34, y + 4, { width: 30, align: 'right' });

        y += rowH;
      });

      const subtotalH = 17;
      doc.rect(marginL, y, tableW, subtotalH).fill('#F2F4F2');
      doc.moveTo(marginL, y + subtotalH).lineTo(marginL + tableW, y + subtotalH).strokeColor('#CCD2CE').lineWidth(0.5).stroke();
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold')
        .text(`TOTAL Area ${group.area}`, colX[1] + 4, y + 4, { width: 220 })
        .text(formatPKR(group.subtotal), colX[2] + 4, y + 4, { width: colW[2] - 8, align: 'right' });
      y += subtotalH + 4;
    });

    if (y + 24 > doc.page.height - 40) {
      doc.addPage();
      y = renderHeader();
    }
    const grandH = 22;
    doc.rect(marginL, y, tableW, grandH).fill('#222222');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
      .text('GRAND TOTAL', marginL + 12, y + 6, { width: 200 })
      .text(formatPKR(reportData.grandTotal), colX[2] + 4, y + 6, { width: colW[2] - 8, align: 'right' });

    doc.end();
  });
}

module.exports = {
  generateInvoicePDF,
  generateLedgerPDF,
  generateCashBookPDF,
  generateProfitPDF,
  generateOfferListPDF,
  generatePartyBalancePDF,
};
