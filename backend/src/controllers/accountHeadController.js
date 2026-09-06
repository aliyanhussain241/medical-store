// ─────────────────────────────────────────────────────────────
// src/controllers/accountHeadController.js
// Chart of Accounts — manage account heads (Expense/Income/Liability)
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

const VALID_CATEGORIES = ['INCOME', 'EXPENSE', 'LIABILITY'];

// ── GET /api/account-heads ────────────────────────────────────
async function list(req, res, next) {
  try {
    const { category } = req.query;

    const where = {
      userId: req.user.id,
      ...(category && VALID_CATEGORIES.includes(category) && { category }),
    };

    const heads = await prisma.accountHead.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group by category for UI convenience
    const grouped = {
      INCOME: [],
      EXPENSE: [],
      LIABILITY: [],
    };
    for (const h of heads) {
      grouped[h.category].push(h);
    }

    res.json({ success: true, data: heads, grouped });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/account-heads ───────────────────────────────────
async function create(req, res, next) {
  try {
    const { name, category, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Account head name is required.' });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Category must be INCOME, EXPENSE, or LIABILITY.' });
    }

    // Prevent duplicates within same category
    const existing = await prisma.accountHead.findFirst({
      where: {
        userId: req.user.id,
        category,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `Account head "${name.trim()}" already exists in ${category}.` });
    }

    const head = await prisma.accountHead.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        category,
        description: description ? description.trim() : null,
        isActive: true,
      },
    });

    res.status(201).json({ success: true, message: 'Account head created.', data: head });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/account-heads/:id ────────────────────────────────
async function update(req, res, next) {
  try {
    const { name, category, description, isActive } = req.body;

    const existing = await prisma.accountHead.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Account head not found.' });

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Category must be INCOME, EXPENSE, or LIABILITY.' });
    }

    const head = await prisma.accountHead.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json({ success: true, message: 'Account head updated.', data: head });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/account-heads/:id ────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.accountHead.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Account head not found.' });

    // Check if it's in use
    const cashUsage = await prisma.cashBookEntry.count({ where: { accountHeadId: req.params.id } });
    const bankUsage = await prisma.bankBookEntry.count({ where: { accountHeadId: req.params.id } });
    if (cashUsage + bankUsage > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this account head is used in ${cashUsage + bankUsage} transaction(s). Deactivate it instead.`,
      });
    }

    await prisma.accountHead.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Account head deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
