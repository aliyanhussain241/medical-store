// ─────────────────────────────────────────────────────────────
// src/controllers/cashBookController.js
// Cash book — MCR/MCP numbering, opening balance, party names
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/db');

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
    const { cashStatement } = require('../services/statementService');
    const { paging } = require('../utils/input');
    const options = { ...req.query, ...paging(req.query) };
    const result = await cashStatement(prisma, req.user.id, options);
    res.json({ success: true, data: result.entries, total: result.total, openingBalance: result.openingBalance, pageOpeningBalance: result.pageOpeningBalance, summary: result.summary, ...paging(req.query) });
  } catch (error) { next(error); }
}

// ── POST /api/cash-book — manual entry ────────────────────────
async function create(req, res, next) {
 try {
  const { D } = require('../services/statementService');
  const { postMoney } = require('../services/postingService');
  const b = req.body;
  if (!b.description?.trim()) throw Object.assign(new Error('Description is required.'), { statusCode: 400 });
  const amount = D(b.cashIn || 0).minus(b.cashOut || 0);
  await postMoney({ userId: req.user.id, method: 'CASH', bankAccountId: b.bankAccountId, date: b.transactionDate, amount, description: b.description.trim(), referenceType: b.category === 'EXPENSE' ? 'EXPENSE' : 'ADJUSTMENT', referenceId: null, partyName: b.partyName?.toUpperCase() || 'COUNTER', accountHeadId: b.accountHeadId || null });
  res.status(201).json({ success: true, message: 'Cash entry added.' });
 } catch (error) { next(error); }
}

module.exports = { list, create, getNextEntryNo };

// F04/F05/F06: lock before reads and buffer responses until commit.
const { transactionalController } = require("../utils/transactionalController");
for (const name of ["create", "update", "remove", "recordPayment", "adjustStock", "paySalary", "toggleActive"]) {
  if (module.exports[name]) module.exports[name] = transactionalController(module.exports[name]);
}
