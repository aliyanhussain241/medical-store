// ─────────────────────────────────────────────────────────────
// src/controllers/productController.js
// Product/Inventory CRUD + low-stock + expiry alerts
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');

// ── GET /api/products ─────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search = '', category, lowStock, nearExpiry, inStockOnly, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const today = new Date();
    const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    const where = {
      userId: req.user.id,
      ...(search && {
        OR: [
          { productName: { contains: search, mode: 'insensitive' } },
          { batchNo: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category }),
      // Only in-stock products (stockQty > 0)
      ...(inStockOnly === 'true' && { stockQty: { gt: 0 } }),
      // Low stock: stockQty <= minStockAlert
      ...(lowStock === 'true' && {
        stockQty: { lte: prisma.product.fields.minStockAlert },
      }),
      // Near expiry: expiryDate within 60 days
      ...(nearExpiry === 'true' && {
        expiryDate: { lte: in60Days, gte: today },
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { productName: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    // Annotate each product with alert flags
    const data = products.map((p) => ({
      ...p,
      isLowStock: parseFloat(p.stockQty) <= parseFloat(p.minStockAlert),
      isNearExpiry: p.expiryDate && p.expiryDate <= in60Days,
      isExpired: p.expiryDate && p.expiryDate < today,
    }));

    res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/products/categories ──────────────────────────────
async function categories(req, res, next) {
  try {
    const cats = await prisma.product.findMany({
      where: { userId: req.user.id, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    res.json({ success: true, data: cats.map((c) => c.category).filter(Boolean) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/products/alerts ───────────────────────────────────
async function alerts(req, res, next) {
  try {
    const today = new Date();
    const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Raw query for low stock (stockQty < minStockAlert)
    const lowStockItems = await prisma.$queryRaw`
      SELECT id, product_name, category, stock_qty, min_stock_alert, expiry_date, batch_no
      FROM products
      WHERE user_id = ${req.user.id}
        AND stock_qty <= min_stock_alert
      ORDER BY stock_qty ASC
      LIMIT 50
    `;

    const nearExpiryItems = await prisma.product.findMany({
      where: {
        userId: req.user.id,
        expiryDate: { lte: in60Days },
      },
      orderBy: { expiryDate: 'asc' },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        lowStock: lowStockItems,
        nearExpiry: nearExpiryItems.map((p) => ({
          ...p,
          daysToExpiry: Math.ceil((new Date(p.expiryDate) - today) / (1000 * 60 * 60 * 24)),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/products/:id ─────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/products ────────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
      productName, category, unit, batchNo, expiryDate,
      purchasePrice, tradePrice, salePrice, stockQty, minStockAlert,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        userId: req.user.id,
        productName,
        category,
        unit: unit || 'strip',
        batchNo,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchasePrice,
        tradePrice: tradePrice !== undefined && tradePrice !== '' ? tradePrice : purchasePrice,
        salePrice,
        stockQty: stockQty || 0,
        minStockAlert: minStockAlert || 10,
      },
    });

    res.status(201).json({ success: true, message: 'Product added successfully.', data: product });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/products/:id ─────────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    const {
      productName, category, unit, batchNo, expiryDate,
      purchasePrice, tradePrice, salePrice, minStockAlert,
    } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        productName, category, unit, batchNo,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchasePrice,
        tradePrice: tradePrice !== undefined && tradePrice !== '' ? tradePrice : (existing.tradePrice || purchasePrice),
        salePrice, minStockAlert,
      },
    });

    res.json({ success: true, message: 'Product updated.', data: product });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/products/:id/adjust-stock ─────────────────────
async function adjustStock(req, res, next) {
  try {
    const { qty, notes } = req.body;
    if (qty === undefined) {
      return res.status(400).json({ success: false, message: 'qty is required.' });
    }

    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    const newQty = parseFloat(existing.stockQty) + parseFloat(qty);
    if (newQty < 0) {
      return res.status(400).json({ success: false, message: 'Stock cannot go below zero.' });
    }

    const [product] = await prisma.$transaction([
      prisma.product.update({ where: { id: req.params.id }, data: { stockQty: newQty } }),
      prisma.stockMovement.create({
        data: {
          userId: req.user.id,
          productId: req.params.id,
          movementType: 'ADJUSTMENT',
          qty: parseFloat(qty),
          movementDate: new Date(),
          notes,
        },
      }),
    ]);

    res.json({ success: true, message: 'Stock adjusted.', data: product });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/products/:id ──────────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    const usedInInvoice = await prisma.invoiceItem.count({ where: { productId: req.params.id } });
    const usedInPurchase = await prisma.purchaseItem.count({ where: { productId: req.params.id } });
    if (usedInInvoice + usedInPurchase > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete — product is used in existing invoices or purchases.',
      });
    }

    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, categories, alerts, create, update, adjustStock, remove };
