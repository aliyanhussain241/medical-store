// ─────────────────────────────────────────────────────────────
// src/controllers/ledgerController.js
// Customer & Company ledger statements with date filters
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ── GET /api/ledger/customer/:customerId ──────────────────────
async function customerLedger(req, res, next) {
  try {
    const { customerId } = req.params;
    const { from, to } = req.query;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: req.user.id },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const where = {
      userId: req.user.id,
      partyType: 'CUSTOMER',
      partyId: customerId,
      ...((from || to) && {
        transactionDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const transactions = await prisma.ledgerTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });

    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const closingBalance = totalDebit - totalCredit;

    res.json({
      success: true,
      data: {
        customer,
        transactions,
        summary: {
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          closingBalance: closingBalance.toFixed(2),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/ledger/company/:companyId ────────────────────────
async function companyLedger(req, res, next) {
  try {
    const { companyId } = req.params;
    const { from, to } = req.query;

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: req.user.id },
    });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const where = {
      userId: req.user.id,
      partyType: 'COMPANY',
      partyId: companyId,
      ...((from || to) && {
        transactionDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const transactions = await prisma.ledgerTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });

    const totalDebit = transactions.reduce((s, t) => s + parseFloat(t.debit), 0);
    const totalCredit = transactions.reduce((s, t) => s + parseFloat(t.credit), 0);
    const closingBalance = totalDebit - totalCredit;

    res.json({
      success: true,
      data: {
        company,
        transactions,
        summary: {
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          closingBalance: closingBalance.toFixed(2),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/ledger/bank/:bankAccountId ───────────────────────
async function bankLedger(req, res, next) {
  try {
    const { bankAccountId } = req.params;
    const { from, to } = req.query;

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: req.user.id },
    });
    if (!bankAccount) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    const where = {
      userId: req.user.id,
      bankAccountId,
      ...((from || to) && {
        transactionDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const entries = await prisma.bankBookEntry.findMany({
      where,
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });

    const totalDebit = entries.reduce((s, e) => s + parseFloat(e.debit), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit), 0);
    const closingBalance = totalDebit - totalCredit;

    res.json({
      success: true,
      data: {
        bankAccount,
        transactions: entries,
        summary: {
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          closingBalance: closingBalance.toFixed(2),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { customerLedger, companyLedger, bankLedger };
