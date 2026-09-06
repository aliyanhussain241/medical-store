// ─────────────────────────────────────────────────────────────
// src/controllers/cashBookController.js
// Cash book — MCR/MCP numbering, opening balance, party names
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ── Helper: next sequential entry number for MCR / MCP ────────
async function getNextEntryNo(userId, entryType) {
  const last = await prisma.cashBookEntry.findFirst({
    where: { userId, entryType },
    orderBy: { entryNo: 'desc' },
    select: { entryNo: true },
  });
  return (last?.entryNo || 0) + 1;
}

// ── GET /api/cash-book ────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { from, to, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const dateFilter = (from || to) ? {
      transactionDate: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {};

    const where = { userId: req.user.id, ...dateFilter };

    // Opening balance = sum of all entries BEFORE the `from` date
    let openingBalance = 0;
    if (from) {
      const beforeEntries = await prisma.cashBookEntry.findFirst({
        where: {
          userId: req.user.id,
          transactionDate: { lt: new Date(from) },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        select: { runningBalance: true },
      });
      openingBalance = parseFloat(beforeEntries?.runningBalance || 0);
    }

    const [entries, total] = await Promise.all([
      prisma.cashBookEntry.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.cashBookEntry.count({ where }),
    ]);

    const totalIn = entries.reduce((s, e) => s + parseFloat(e.cashIn), 0);
    const totalOut = entries.reduce((s, e) => s + parseFloat(e.cashOut), 0);

    // Assign a display sequence number (1, 2, 3...) for each entry in the result
    let seq = 0;
    const enrichedEntries = entries.map((e) => ({
      ...e,
      seq: ++seq,
    }));

    res.json({
      success: true,
      data: enrichedEntries,
      total,
      openingBalance: openingBalance.toFixed(2),
      summary: {
        totalIn: totalIn.toFixed(2),
        totalOut: totalOut.toFixed(2),
        net: (totalIn - totalOut).toFixed(2),
      },
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/cash-book — manual entry ────────────────────────
async function create(req, res, next) {
  try {
    const { description, cashIn, cashOut, transactionDate, partyName, category, accountHeadId } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Description is required.' });
    if (!cashIn && !cashOut) return res.status(400).json({ success: false, message: 'Either Cash In or Cash Out amount is required.' });

    const inAmt = parseFloat(cashIn || 0);
    const outAmt = parseFloat(cashOut || 0);

    // Determine entry type
    let entryType;
    if (category === 'EXPENSE') {
      entryType = 'EXPENSE';
    } else if (inAmt > 0) {
      entryType = 'MCR';
    } else {
      entryType = 'MCP';
    }

    // Get next entry number
    const entryNo = await getNextEntryNo(req.user.id, entryType);

    // Running balance
    const last = await prisma.cashBookEntry.findFirst({
      where: { userId: req.user.id },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    });
    const prevBalance = parseFloat(last?.runningBalance || 0);
    const newBalance = prevBalance + inAmt - outAmt;

    // Build description with reference
    const prefix = entryType === 'MCR' ? `MCR# ${entryNo}, ` : entryType === 'MCP' ? `MCP# ${entryNo}, ` : '';
    const fullDescription = `${prefix}${description}`;

    const entry = await prisma.cashBookEntry.create({
      data: {
        userId: req.user.id,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        description: fullDescription,
        cashIn: inAmt,
        cashOut: outAmt,
        runningBalance: newBalance,
        referenceType: category === 'EXPENSE' ? 'EXPENSE' : 'ADJUSTMENT',
        entryType,
        entryNo,
        accountHeadId: accountHeadId || null,
        partyName: partyName ? partyName.toUpperCase() : (category === 'EXPENSE' ? (description || 'CASH EXPENSE').toUpperCase() : 'COUNTER'),
      },
    });

    res.status(201).json({ success: true, message: 'Cash entry added.', data: entry });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getNextEntryNo };
