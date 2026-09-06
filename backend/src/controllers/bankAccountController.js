// ─────────────────────────────────────────────────────────────
// src/controllers/bankAccountController.js
// Bank Accounts CRUD (scoped strictly to req.user.id)
// Mirrors companyController pattern with opening balance ledger
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');

// ── GET /api/bank-accounts ────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(search && {
        OR: [
          { bankName: { contains: search, mode: 'insensitive' } },
          { accountTitle: { contains: search, mode: 'insensitive' } },
          { accountNumber: { contains: search, mode: 'insensitive' } },
          { branch: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [accounts, total] = await Promise.all([
      prisma.bankAccount.findMany({ where, skip, take: parseInt(limit), orderBy: { bankName: 'asc' } }),
      prisma.bankAccount.count({ where }),
    ]);

    res.json({ success: true, data: accounts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/bank-accounts/:id ────────────────────────────────
async function getOne(req, res, next) {
  try {
    const account = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!account) return res.status(404).json({ success: false, message: 'Bank account not found.' });
    res.json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/bank-accounts ───────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { bankName, accountTitle, accountNumber, branch, openingBalance } = req.body;

    const account = await prisma.bankAccount.create({
      data: {
        userId: req.user.id,
        bankName,
        accountTitle,
        accountNumber,
        branch: branch || null,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
      },
    });

    // Create opening balance bank book entry if non-zero
    if (parseFloat(openingBalance || 0) !== 0) {
      const ob = parseFloat(openingBalance);
      await prisma.bankBookEntry.create({
        data: {
          userId: req.user.id,
          bankAccountId: account.id,
          transactionDate: new Date(),
          description: 'Opening Balance',
          debit: ob > 0 ? Math.abs(ob) : 0,
          credit: ob < 0 ? Math.abs(ob) : 0,
          runningBalance: ob,
          referenceType: 'OPENING_BALANCE',
          referenceId: account.id,
          partyName: bankName.toUpperCase(),
        },
      });
    }

    res.status(201).json({ success: true, message: 'Bank account added successfully.', data: account });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/bank-accounts/:id ────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const existing = await prisma.bankAccount.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    const { bankName, accountTitle, accountNumber, branch } = req.body;
    const account = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { bankName, accountTitle, accountNumber, branch: branch || null },
    });

    res.json({ success: true, message: 'Bank account updated successfully.', data: account });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/bank-accounts/:id ─────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.bankAccount.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    // Check for linked transactions
    const entryCount = await prisma.bankBookEntry.count({ where: { bankAccountId: req.params.id } });
    if (entryCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this bank account has ${entryCount} transaction(s) linked to it.`,
      });
    }

    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Bank account deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
