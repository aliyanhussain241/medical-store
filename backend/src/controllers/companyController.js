// ─────────────────────────────────────────────────────────────
// src/controllers/companyController.js
// Suppliers / Distributors CRUD (scoped strictly to req.user.id)
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');

// ── GET /api/companies ────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, skip, take: parseInt(limit), orderBy: { companyName: 'asc' } }),
      prisma.company.count({ where }),
    ]);

    res.json({ success: true, data: companies, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/companies/:id ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/companies ───────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { companyName, contactPerson, phone, address, openingBalance, town, sector, cnic } = req.body;

    const company = await prisma.company.create({
      data: {
        userId: req.user.id,
        companyName,
        contactPerson,
        phone,
        address,
        town: town ? town.trim() : null,
        sector: sector ? sector.trim() : null,
        cnic: cnic ? cnic.trim() : null,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
      },
    });

    // Create opening balance ledger entry if non-zero
    if (parseFloat(openingBalance || 0) !== 0) {
      await prisma.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'COMPANY',
          partyId: company.id,
          transactionDate: new Date(),
          description: 'Opening Balance',
          referenceType: 'OPENING_BALANCE',
          referenceId: company.id,
          debit: parseFloat(openingBalance) > 0 ? Math.abs(parseFloat(openingBalance)) : 0,
          credit: parseFloat(openingBalance) < 0 ? Math.abs(parseFloat(openingBalance)) : 0,
          runningBalance: parseFloat(openingBalance),
        },
      });
    }

    res.status(201).json({ success: true, message: 'Company added successfully.', data: company });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/companies/:id ────────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const existing = await prisma.company.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found.' });

    const { companyName, contactPerson, phone, address, town, sector, cnic } = req.body;
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(town !== undefined && { town: town ? town.trim() : null }),
        ...(sector !== undefined && { sector: sector ? sector.trim() : null }),
        ...(cnic !== undefined && { cnic: cnic ? cnic.trim() : null }),
      },
    });

    res.json({ success: true, message: 'Company updated successfully.', data: company });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/companies/:id ─────────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.company.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found.' });

    // Check for linked purchases
    const purchaseCount = await prisma.purchase.count({ where: { companyId: req.params.id } });
    if (purchaseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this company has ${purchaseCount} purchase(s) linked to it. Archive it instead.`,
      });
    }

    await prisma.company.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Company deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
