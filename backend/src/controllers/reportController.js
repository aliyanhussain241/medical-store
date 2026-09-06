// ─────────────────────────────────────────────────────────────
// src/controllers/reportController.js
// Daily Profit & Party Wise Balance reports
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

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

module.exports = { profitReport, partyBalanceReport, getPartyBalanceData };
