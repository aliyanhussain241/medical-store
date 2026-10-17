// ─────────────────────────────────────────────────────────────
// src/controllers/bankBookController.js
// Bank book — listing and manual entries (deposits/withdrawals)
// Mirrors cashBookController pattern
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/db');

// ── GET /api/bank-book ────────────────────────────────────────
// Query params: bankAccountId (required), from, to, page, limit
async function list(req, res, next) {
  try {
    const { bankStatement } = require('../services/statementService');
    const { paging } = require('../utils/input');
    const options = { ...req.query, ...paging(req.query) };
    const result = await bankStatement(prisma, req.user.id, req.query.bankAccountId, options);
    res.json({ success: true, data: result, ...paging(req.query) });
  } catch (error) { next(error); }
}

// ── POST /api/bank-book — manual entry (deposit/withdrawal) ──
async function create(req, res, next) {
 try {
  const { D } = require('../services/statementService');
  const { postMoney } = require('../services/postingService');
  const b = req.body;
  if (!b.description?.trim()) throw Object.assign(new Error('Description is required.'), { statusCode: 400 });
  const amount = D(b.debit || 0).minus(b.credit || 0);
  await postMoney({ userId: req.user.id, method: 'BANK', bankAccountId: b.bankAccountId, date: b.transactionDate, amount, description: b.description.trim(), referenceType: b.category === 'EXPENSE' ? 'EXPENSE' : 'BANK_MANUAL', referenceId: null, partyName: b.partyName?.toUpperCase() || 'COUNTER', accountHeadId: b.accountHeadId || null });
  res.status(201).json({ success: true, message: 'Bank entry added.' });
 } catch (error) { next(error); }
}

module.exports = { list, create };

// F04/F05/F06: lock before reads and buffer responses until commit.
const { transactionalController } = require("../utils/transactionalController");
for (const name of ["create", "update", "remove", "recordPayment", "adjustStock", "paySalary", "toggleActive"]) {
  if (module.exports[name]) module.exports[name] = transactionalController(module.exports[name]);
}
