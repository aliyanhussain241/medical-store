// ─────────────────────────────────────────────────────────────
// src/controllers/reportController.js
// Daily Profit, Party Wise Balance, Trial Balance & Balance Sheet
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ═══════════════════════════════════════════════════════════════
// HELPER: Aggregate all financial data as of a given date
// Used by both Trial Balance and Balance Sheet
// ═══════════════════════════════════════════════════════════════
async function getFinancialData(userId, asOn) {
  const asOnDate = asOn ? new Date(asOn) : new Date();
  asOnDate.setHours(23, 59, 59, 999);
  const dateFilter = { lte: asOnDate };

  // ── 1. Cash in Hand (from Cash Book) ──────────────────────
  const cashAgg = await prisma.cashBookEntry.aggregate({
    where: { userId, transactionDate: dateFilter },
    _sum: { cashIn: true, cashOut: true },
  });
  const cashBalance = parseFloat(cashAgg._sum.cashIn || 0) - parseFloat(cashAgg._sum.cashOut || 0);

  // ── 2. Bank Account balances (from Bank Book) ─────────────
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { userId },
    select: { id: true, bankName: true, accountTitle: true, accountNumber: true, openingBalance: true },
  });

  const bankAgg = await prisma.bankBookEntry.groupBy({
    by: ['bankAccountId'],
    where: { userId, transactionDate: dateFilter },
    _sum: { debit: true, credit: true },
  });
  const bankMap = {};
  for (const row of bankAgg) {
    bankMap[row.bankAccountId] = parseFloat(row._sum.debit || 0) - parseFloat(row._sum.credit || 0);
  }

  const bankBalances = bankAccounts.map((ba) => ({
    id: ba.id,
    name: `${ba.bankName} — ${ba.accountTitle}`,
    accountNumber: ba.accountNumber,
    balance: bankMap[ba.id] !== undefined
      ? bankMap[ba.id]
      : parseFloat(ba.openingBalance || 0),
  }));
  const totalBankBalance = bankBalances.reduce((s, b) => s + b.balance, 0);

  // ── 3. Accounts Receivable (Customer balances from Ledger) ─
  const customerLedger = await prisma.ledgerTransaction.groupBy({
    by: ['partyId'],
    where: { userId, partyType: 'CUSTOMER', transactionDate: dateFilter },
    _sum: { debit: true, credit: true },
  });

  // Also need opening balances for customers with no ledger txns
  const allCustomers = await prisma.customer.findMany({
    where: { userId },
    select: { id: true, openingBalance: true },
  });
  const customerLedgerMap = {};
  for (const row of customerLedger) {
    customerLedgerMap[row.partyId] = parseFloat(row._sum.debit || 0) - parseFloat(row._sum.credit || 0);
  }

  let totalReceivableDr = 0;
  let totalReceivableCr = 0;
  for (const c of allCustomers) {
    const bal = customerLedgerMap[c.id] !== undefined
      ? customerLedgerMap[c.id]
      : parseFloat(c.openingBalance || 0);
    if (bal > 0.005) totalReceivableDr += bal;
    else if (bal < -0.005) totalReceivableCr += Math.abs(bal);
  }

  // ── 4. Accounts Payable (Company balances from Ledger) ─────
  const companyLedger = await prisma.ledgerTransaction.groupBy({
    by: ['partyId'],
    where: { userId, partyType: 'COMPANY', transactionDate: dateFilter },
    _sum: { debit: true, credit: true },
  });

  const allCompanies = await prisma.company.findMany({
    where: { userId },
    select: { id: true, openingBalance: true },
  });
  const companyLedgerMap = {};
  for (const row of companyLedger) {
    companyLedgerMap[row.partyId] = parseFloat(row._sum.debit || 0) - parseFloat(row._sum.credit || 0);
  }

  let totalPayableDr = 0;
  let totalPayableCr = 0;
  for (const co of allCompanies) {
    const bal = companyLedgerMap[co.id] !== undefined
      ? companyLedgerMap[co.id]
      : parseFloat(co.openingBalance || 0);
    // Company balance: positive = we owe them (credit/liability)
    // In our ledger: debit = payment to company, credit = purchase from company
    // So net = debit - credit; negative means we owe them
    if (bal > 0.005) totalPayableDr += bal;
    else if (bal < -0.005) totalPayableCr += Math.abs(bal);
  }

  // ── 5. Chart of Accounts heads (from Cash Book + Bank Book entries) ──
  const accountHeads = await prisma.accountHead.findMany({
    where: { userId, isActive: true },
    select: { id: true, name: true, category: true },
    orderBy: { name: 'asc' },
  });

  // Cash book entries by account head
  const cashByHead = await prisma.cashBookEntry.groupBy({
    by: ['accountHeadId'],
    where: { userId, transactionDate: dateFilter, accountHeadId: { not: null } },
    _sum: { cashIn: true, cashOut: true },
  });
  const cashHeadMap = {};
  for (const row of cashByHead) {
    cashHeadMap[row.accountHeadId] = {
      cashIn: parseFloat(row._sum.cashIn || 0),
      cashOut: parseFloat(row._sum.cashOut || 0),
    };
  }

  // Bank book entries by account head
  const bankByHead = await prisma.bankBookEntry.groupBy({
    by: ['accountHeadId'],
    where: { userId, transactionDate: dateFilter, accountHeadId: { not: null } },
    _sum: { debit: true, credit: true },
  });
  const bankHeadMap = {};
  for (const row of bankByHead) {
    bankHeadMap[row.accountHeadId] = {
      debit: parseFloat(row._sum.debit || 0),
      credit: parseFloat(row._sum.credit || 0),
    };
  }

  const headBalances = accountHeads.map((h) => {
    const cash = cashHeadMap[h.id] || { cashIn: 0, cashOut: 0 };
    const bank = bankHeadMap[h.id] || { debit: 0, credit: 0 };
    // For EXPENSE: cashOut + bank credit = debit side (money spent)
    // For INCOME: cashIn + bank debit = credit side (money earned)
    // For LIABILITY: net credit balance
    let netAmount = 0;
    if (h.category === 'EXPENSE') {
      netAmount = (cash.cashOut + bank.credit) - (cash.cashIn + bank.debit);
    } else if (h.category === 'INCOME') {
      netAmount = (cash.cashIn + bank.debit) - (cash.cashOut + bank.credit);
    } else if (h.category === 'LIABILITY') {
      netAmount = (cash.cashIn + bank.debit) - (cash.cashOut + bank.credit);
    }
    return {
      id: h.id,
      name: h.name,
      category: h.category,
      balance: netAmount,
    };
  }).filter((h) => Math.abs(h.balance) > 0.005);

  // ── 6. Inventory at cost ──────────────────────────────────
  const products = await prisma.product.findMany({
    where: { userId },
    select: { stockQty: true, purchasePrice: true },
  });
  const inventoryValue = products.reduce((s, p) => {
    return s + parseFloat(p.stockQty || 0) * parseFloat(p.purchasePrice || 0);
  }, 0);

  return {
    asOnDate: (asOn ? new Date(asOn) : new Date()).toISOString().split('T')[0],
    cashBalance,
    bankBalances,
    totalBankBalance,
    totalReceivableDr,
    totalReceivableCr,
    totalPayableDr,
    totalPayableCr,
    headBalances,
    inventoryValue,
  };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/reports/trial-balance?asOn=YYYY-MM-DD
// ═══════════════════════════════════════════════════════════════
async function trialBalance(req, res, next) {
  try {
    const { asOn } = req.query;
    const fd = await getFinancialData(req.user.id, asOn);

    // Build rows grouped by section
    const rows = [];
    let totalDebit = 0;
    let totalCredit = 0;

    function addRow(section, name, debit, credit) {
      rows.push({ section, name, debit: Math.abs(debit), credit: Math.abs(credit) });
      totalDebit += Math.abs(debit);
      totalCredit += Math.abs(credit);
    }

    // ── Assets: Cash & Bank ──
    if (Math.abs(fd.cashBalance) > 0.005) {
      if (fd.cashBalance > 0) addRow('Assets — Cash & Bank', 'Cash in Hand', fd.cashBalance, 0);
      else addRow('Assets — Cash & Bank', 'Cash in Hand', 0, Math.abs(fd.cashBalance));
    }
    for (const ba of fd.bankBalances) {
      if (Math.abs(ba.balance) > 0.005) {
        if (ba.balance > 0) addRow('Assets — Cash & Bank', ba.name, ba.balance, 0);
        else addRow('Assets — Cash & Bank', ba.name, 0, Math.abs(ba.balance));
      }
    }

    // ── Assets: Inventory ──
    if (fd.inventoryValue > 0.005) {
      addRow('Assets — Inventory', 'Inventory (at cost)', fd.inventoryValue, 0);
    }

    // ── Receivables ──
    if (fd.totalReceivableDr > 0.005) {
      addRow('Receivables', 'Accounts Receivable (Customers — DR)', fd.totalReceivableDr, 0);
    }
    if (fd.totalReceivableCr > 0.005) {
      addRow('Receivables', 'Accounts Receivable (Customers — CR)', 0, fd.totalReceivableCr);
    }

    // ── Payables ──
    if (fd.totalPayableCr > 0.005) {
      addRow('Payables', 'Accounts Payable (Companies — CR)', 0, fd.totalPayableCr);
    }
    if (fd.totalPayableDr > 0.005) {
      addRow('Payables', 'Accounts Payable (Companies — DR)', fd.totalPayableDr, 0);
    }

    // ── Account Heads by category ──
    const incomeHeads = fd.headBalances.filter((h) => h.category === 'INCOME');
    const expenseHeads = fd.headBalances.filter((h) => h.category === 'EXPENSE');
    const liabilityHeads = fd.headBalances.filter((h) => h.category === 'LIABILITY');

    for (const h of liabilityHeads) {
      if (h.balance > 0) addRow('Liabilities', h.name, 0, h.balance);
      else addRow('Liabilities', h.name, Math.abs(h.balance), 0);
    }
    for (const h of incomeHeads) {
      if (h.balance > 0) addRow('Income', h.name, 0, h.balance);
      else addRow('Income', h.name, Math.abs(h.balance), 0);
    }
    for (const h of expenseHeads) {
      if (h.balance > 0) addRow('Expenses', h.name, h.balance, 0);
      else addRow('Expenses', h.name, 0, Math.abs(h.balance));
    }

    const diff = Math.abs(totalDebit - totalCredit);
    const isBalanced = diff < 0.01;

    res.json({
      success: true,
      data: {
        asOnDate: fd.asOnDate,
        rows,
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCredit.toFixed(2)),
        difference: parseFloat(diff.toFixed(2)),
        isBalanced,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/reports/balance-sheet?asOn=YYYY-MM-DD
// ═══════════════════════════════════════════════════════════════
async function balanceSheet(req, res, next) {
  try {
    const { asOn } = req.query;
    const fd = await getFinancialData(req.user.id, asOn);

    // ── Assets ──
    const assets = [];
    assets.push({ name: 'Cash in Hand', amount: fd.cashBalance });
    for (const ba of fd.bankBalances) {
      assets.push({ name: ba.name, amount: ba.balance });
    }
    assets.push({ name: 'Accounts Receivable (Customers)', amount: fd.totalReceivableDr - fd.totalReceivableCr });
    assets.push({ name: 'Inventory (at cost)', amount: fd.inventoryValue });
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

    // ── Liabilities ──
    const liabilities = [];
    liabilities.push({ name: 'Accounts Payable (Companies)', amount: fd.totalPayableCr - fd.totalPayableDr });

    const liabilityHeads = fd.headBalances.filter((h) => h.category === 'LIABILITY');
    for (const h of liabilityHeads) {
      liabilities.push({ name: h.name, amount: h.balance });
    }
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);

    // ── Equity (derived) ──
    const equity = totalAssets - totalLiabilities;
    const equityItems = [
      { name: "Owner's Equity (Derived)", amount: equity },
    ];

    const checkSum = totalLiabilities + equity;
    const diff = Math.abs(totalAssets - checkSum);
    const isBalanced = diff < 0.01;

    res.json({
      success: true,
      data: {
        asOnDate: fd.asOnDate,
        assets,
        totalAssets: parseFloat(totalAssets.toFixed(2)),
        liabilities,
        totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
        equity: equityItems,
        totalEquity: parseFloat(equity.toFixed(2)),
        totalLiabilitiesAndEquity: parseFloat(checkSum.toFixed(2)),
        difference: parseFloat(diff.toFixed(2)),
        isBalanced,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Helper: calculate party balance data grouped by area ───────
async function getPartyBalanceData(userId, asOn, filter = 'DR', areaFilter = '') {
  const asOnDate = asOn ? new Date(asOn) : new Date();
  asOnDate.setHours(23, 59, 59, 999);

  const whereCustomers = {
    userId,
    ...(areaFilter && { area: { equals: areaFilter, mode: 'insensitive' } }),
  };

  const customers = await prisma.customer.findMany({
    where: whereCustomers,
    orderBy: { customerName: 'asc' },
  });

  // Aggregate ledger transactions on or before asOnDate
  const ledgerSums = await prisma.ledgerTransaction.groupBy({
    by: ['partyId'],
    where: {
      userId,
      partyType: 'CUSTOMER',
      transactionDate: { lte: asOnDate },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const balanceMap = {};
  for (const row of ledgerSums) {
    const debit = parseFloat(row._sum.debit || 0);
    const credit = parseFloat(row._sum.credit || 0);
    balanceMap[row.partyId] = debit - credit;
  }

  // Calculate closing for each customer
  const enriched = [];
  for (const c of customers) {
    let closing = 0;
    if (balanceMap[c.id] !== undefined) {
      closing = balanceMap[c.id];
    } else {
      closing = parseFloat(c.openingBalance || 0);
    }

    let balanceType = 'ZERO';
    if (closing > 0.005) balanceType = 'DR';
    else if (closing < -0.005) balanceType = 'CR';

    // Apply DR / CR / ALL filter
    if (filter === 'DR' && balanceType !== 'DR') continue;
    if (filter === 'CR' && balanceType !== 'CR') continue;
    if (filter === 'ALL' && Math.abs(closing) <= 0.005) continue;

    enriched.push({
      id: c.id,
      code: c.customerCode || '0',
      customerName: c.customerName.toUpperCase(),
      shopName: c.shopName || '',
      phone: c.phone || '',
      area: c.area ? c.area.trim().toUpperCase() : 'UNASSIGNED',
      closing: Math.abs(closing),
      rawClosing: closing,
      balanceType: balanceType === 'ZERO' ? 'DR' : balanceType,
    });
  }

  // Group by area
  const areaGroupsMap = {};
  for (const item of enriched) {
    if (!areaGroupsMap[item.area]) {
      areaGroupsMap[item.area] = [];
    }
    areaGroupsMap[item.area].push(item);
  }

  // Sort areas alphabetically, putting UNASSIGNED last
  const sortedAreaNames = Object.keys(areaGroupsMap).sort((a, b) => {
    if (a === 'UNASSIGNED') return 1;
    if (b === 'UNASSIGNED') return -1;
    return a.localeCompare(b);
  });

  let seq = 0;
  let grandTotal = 0;
  const areaGroups = sortedAreaNames.map((areaName) => {
    const items = areaGroupsMap[areaName].sort((a, b) => {
      const codeA = parseInt(a.code, 10);
      const codeB = parseInt(b.code, 10);
      if (!isNaN(codeA) && !isNaN(codeB)) return codeA - codeB;
      return a.customerName.localeCompare(b.customerName);
    });

    const enrichedItems = items.map((item) => ({
      ...item,
      seq: ++seq,
    }));

    const subtotal = enrichedItems.reduce((s, i) => s + i.closing, 0);
    grandTotal += subtotal;

    return {
      area: areaName,
      customers: enrichedItems,
      items: enrichedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      count: enrichedItems.length,
    };
  });

  const filterLabel =
    filter === 'DR'
      ? 'Parties With DR Balances'
      : filter === 'CR'
      ? 'Parties With CR Balances'
      : 'All Parties';

  return {
    asOnDate: (asOn ? new Date(asOn) : new Date()).toISOString().split('T')[0],
    filter,
    filterLabel,
    areaGroups,
    grandTotal: parseFloat(grandTotal.toFixed(2)),
    totalCustomers: seq,
    totalCount: seq,
    totalAreas: areaGroups.length,
    areaCount: areaGroups.length,
  };
}

// ── GET /api/reports/profit ───────────────────────────────────
async function profitReport(req, res, next) {
  try {
    const { from, to } = req.query;

    const where = {
      userId: req.user.id,
      ...((from || to) && {
        reportDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const records = await prisma.dailyProfit.findMany({
      where,
      orderBy: { reportDate: 'asc' },
    });

    const totalSales = records.reduce((s, r) => s + parseFloat(r.totalSales), 0);
    const totalCost = records.reduce((s, r) => s + parseFloat(r.totalCost), 0);
    const totalProfit = records.reduce((s, r) => s + parseFloat(r.totalProfit), 0);

    res.json({
      success: true,
      data: records,
      summary: {
        totalSales: totalSales.toFixed(2),
        totalCost: totalCost.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        profitMargin: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : '0.0',
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/party-balance ────────────────────────────
async function partyBalanceReport(req, res, next) {
  try {
    const { asOn, filter = 'DR', area } = req.query;
    const reportData = await getPartyBalanceData(req.user.id, asOn, filter, area);
    res.json({ success: true, data: reportData });
  } catch (err) {
    next(err);
  }
}

module.exports = { profitReport, partyBalanceReport, getPartyBalanceData, trialBalance, balanceSheet, getFinancialData };
