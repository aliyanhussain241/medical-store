// ─────────────────────────────────────────────────────────────
// src/controllers/bankBookController.js
// Bank book — listing and manual entries (deposits/withdrawals)
// Mirrors cashBookController pattern
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ── GET /api/bank-book ────────────────────────────────────────
// Query params: bankAccountId (required), from, to, page, limit
async function list(req, res, next) {
  try {
    const { bankAccountId, from, to, page = 1, limit = 100 } = req.query;
    if (!bankAccountId) {
      return res.status(400).json({ success: false, message: 'bankAccountId is required.' });
    }

    // Verify bank account belongs to user
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: req.user.id },
    });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: 'Bank account not found.' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const dateFilter = (from || to) ? {
      transactionDate: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    } : {};

    const where = { userId: req.user.id, bankAccountId, ...dateFilter };

    // Opening balance = running balance of last entry BEFORE the `from` date
    let openingBalance = parseFloat(bankAccount.openingBalance);
    if (from) {
      const beforeEntry = await prisma.bankBookEntry.findFirst({
        where: {
          userId: req.user.id,
          bankAccountId,
          transactionDate: { lt: new Date(from) },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        select: { runningBalance: true },
      });
      if (beforeEntry) {
        openingBalance = parseFloat(beforeEntry.runningBalance);
      }
    }

    const [entries, total] = await Promise.all([
      prisma.bankBookEntry.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.bankBookEntry.count({ where }),
    ]);

    const totalDebit = entries.reduce((s, e) => s + parseFloat(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit), 0);

    res.json({
      success: true,
      data: {
        bankAccount,
        entries,
        total,
        openingBalance: openingBalance.toFixed(2),
        summary: {
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          closingBalance: (openingBalance + totalDebit - totalCredit).toFixed(2),
        },
      },
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/bank-book — manual entry (deposit/withdrawal) ──
async function create(req, res, next) {
  try {
    const { bankAccountId, description, debit, credit, transactionDate, narration, partyName } = req.body;

    if (!bankAccountId) return res.status(400).json({ success: false, message: 'Bank account is required.' });
    if (!description) return res.status(400).json({ success: false, message: 'Description is required.' });
    if (!debit && !credit) return res.status(400).json({ success: false, message: 'Either Debit or Credit amount is required.' });

    // Verify bank account belongs to user
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: req.user.id },
    });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: 'Bank account not found.' });
    }

    const debitAmt = parseFloat(debit || 0);
    const creditAmt = parseFloat(credit || 0);

    // Get last running balance for this bank account
    const last = await prisma.bankBookEntry.findFirst({
      where: { userId: req.user.id, bankAccountId },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    });
    const prevBalance = parseFloat(last?.runningBalance ?? bankAccount.openingBalance);
    const newBalance = prevBalance + debitAmt - creditAmt;

    const txDate = transactionDate ? new Date(transactionDate) : new Date();

    // Atomic: create entry + update bank balance
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.bankBookEntry.create({
        data: {
          userId: req.user.id,
          bankAccountId,
          transactionDate: txDate,
          description,
          debit: debitAmt,
          credit: creditAmt,
          runningBalance: newBalance,
          referenceType: 'BANK_MANUAL',
          referenceId: null,
          narration: narration || null,
          partyName: partyName ? partyName.toUpperCase() : null,
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: newBalance },
      });

      return entry;
    });

    res.status(201).json({ success: true, message: 'Bank entry added.', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
