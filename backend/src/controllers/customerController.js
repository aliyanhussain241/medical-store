// ─────────────────────────────────────────────────────────────
// src/controllers/customerController.js
// Customer CRUD (scoped strictly to req.user.id)
// Includes customerCode, area territory, and ledger initialization
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');

// ── Helper: auto-generate next customer code ──────────────────
async function getNextCustomerCode(userId) {
  const customers = await prisma.customer.findMany({
    where: { userId, customerCode: { not: null } },
    select: { customerCode: true },
  });
  let max = 0;
  for (const c of customers) {
    const n = parseInt(c.customerCode, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

// ── GET /api/customers ────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search = '', page = 1, limit = 50, overdueOnly, area } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(area && { area: { equals: area, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: 'insensitive' } },
          { shopName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { customerCode: { contains: search, mode: 'insensitive' } },
          { area: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(overdueOnly === 'true' && { currentBalance: { gt: 0 } }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ customerName: 'asc' }],
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/customers/areas ──────────────────────────────────
async function getAreas(req, res, next) {
  try {
    const records = await prisma.customer.findMany({
      where: { userId: req.user.id, area: { not: null } },
      select: { area: true },
      distinct: ['area'],
      orderBy: { area: 'asc' },
    });
    const areas = records.map((r) => r.area).filter(Boolean);
    res.json({ success: true, data: areas });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/customers/:id ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/customers ───────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { customerName, shopName, phone, address, openingBalance, customerCode, area, town, sector, cnic } = req.body;

    // Use provided customer code or auto-suggest next numeric code
    let code = customerCode ? String(customerCode).trim() : '';
    if (!code) {
      code = await getNextCustomerCode(req.user.id);
    }

    const customer = await prisma.customer.create({
      data: {
        userId: req.user.id,
        customerCode: code,
        customerName: customerName.trim(),
        shopName: shopName ? shopName.trim() : null,
        phone: phone ? phone.trim() : null,
        address: address ? address.trim() : null,
        area: area ? area.trim().toUpperCase() : null,
        town: town ? town.trim() : null,
        sector: sector ? sector.trim() : null,
        cnic: cnic ? cnic.trim() : null,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
      },
    });

    if (parseFloat(openingBalance || 0) !== 0) {
      await prisma.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'CUSTOMER',
          partyId: customer.id,
          transactionDate: new Date(),
          description: 'Opening Balance',
          referenceType: 'OPENING_BALANCE',
          referenceId: customer.id,
          debit: parseFloat(openingBalance) > 0 ? Math.abs(parseFloat(openingBalance)) : 0,
          credit: parseFloat(openingBalance) < 0 ? Math.abs(parseFloat(openingBalance)) : 0,
          runningBalance: parseFloat(openingBalance),
        },
      });
    }

    res.status(201).json({ success: true, message: 'Customer added successfully.', data: customer });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/customers/:id ────────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { customerName, shopName, phone, address, customerCode, area, town, sector, cnic } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(customerName !== undefined && { customerName: customerName.trim() }),
        ...(shopName !== undefined && { shopName: shopName ? shopName.trim() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(address !== undefined && { address: address ? address.trim() : null }),
        ...(customerCode !== undefined && { customerCode: customerCode ? String(customerCode).trim() : null }),
        ...(area !== undefined && { area: area ? area.trim().toUpperCase() : null }),
        ...(town !== undefined && { town: town ? town.trim() : null }),
        ...(sector !== undefined && { sector: sector ? sector.trim() : null }),
        ...(cnic !== undefined && { cnic: cnic ? cnic.trim() : null }),
      },
    });

    res.json({ success: true, message: 'Customer updated successfully.', data: customer });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/customers/:id ─────────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const invoiceCount = await prisma.invoice.count({ where: { customerId: req.params.id } });
    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this customer has ${invoiceCount} invoice(s) linked to them.`,
      });
    }

    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getAreas, getOne, create, update, remove, getNextCustomerCode };
