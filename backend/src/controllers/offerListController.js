// ─────────────────────────────────────────────────────────────
// src/controllers/offerListController.js
// Offer lists — company discounts, TP, Net rates, bonus schemes
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ── Helper: Format offer label ────────────────────────────────
function formatOfferLabel(type, value, buyQty, freeQty) {
  switch (type) {
    case 'PERCENTAGE':
      return `${parseFloat(value || 0)}%`;
    case 'TP':
      return 'TP';
    case 'NET':
      return `${parseFloat(value || 0)} NET`;
    case 'BONUS':
      return `${parseFloat(buyQty || 0)}+${parseFloat(freeQty || 0)}`;
    default:
      return type || '—';
  }
}

// ── GET /api/offer-lists ──────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && {
        OR: [
          { listNumber: { contains: search, mode: 'insensitive' } },
          { remarks: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [lists, total] = await Promise.all([
      prisma.offerList.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          items: {
            select: { companyId: true, productId: true },
          },
        },
      }),
      prisma.offerList.count({ where }),
    ]);

    // Enrich with counts
    const enriched = lists.map((l) => {
      const uniqueCompanies = new Set(l.items.map((i) => i.companyId));
      return {
        id: l.id,
        listNumber: l.listNumber,
        listDate: l.listDate,
        isActive: l.isActive,
        remarks: l.remarks,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        itemCount: l.items.length,
        companyCount: uniqueCompanies.size,
      };
    });

    res.json({
      success: true,
      data: enriched,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/offer-lists/active-offers ────────────────────────
// Fast product lookup map for Invoicing POS
async function getActiveOffers(req, res, next) {
  try {
    // Find all active offer lists for this user, ordered newest first
    const activeLists = await prisma.offerList.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: [{ listDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: {
          include: {
            company: { select: { id: true, companyName: true } },
            product: { select: { id: true, productName: true, salePrice: true } },
          },
        },
      },
    });

    // Map: productId -> latest offer details
    const offersMap = {};
    for (const list of activeLists) {
      for (const item of list.items) {
        if (!offersMap[item.productId]) {
          offersMap[item.productId] = {
            offerListId: list.id,
            listNumber: list.listNumber,
            listDate: list.listDate,
            companyId: item.companyId,
            companyName: item.company?.companyName || '—',
            productId: item.productId,
            productName: item.product?.productName || '—',
            salePrice: parseFloat(item.product?.salePrice || 0),
            offerType: item.offerType,
            offerValue: item.offerValue !== null ? parseFloat(item.offerValue) : null,
            bonusBuyQty: item.bonusBuyQty !== null ? parseFloat(item.bonusBuyQty) : null,
            bonusFreeQty: item.bonusFreeQty !== null ? parseFloat(item.bonusFreeQty) : null,
            offerLabel: formatOfferLabel(item.offerType, item.offerValue, item.bonusBuyQty, item.bonusFreeQty),
            remarks: item.remarks || '',
          };
        }
      }
    }

    res.json({ success: true, data: offersMap });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/offer-lists/:id ──────────────────────────────────
async function getOne(req, res, next) {
  try {
    const list = await prisma.offerList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        items: {
          include: {
            company: { select: { id: true, companyName: true } },
            product: { select: { id: true, productName: true, salePrice: true, unit: true } },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!list) {
      return res.status(404).json({ success: false, message: 'Offer list not found.' });
    }

    // Group items by company for client reference display
    const companyGroupsMap = {};
    for (const item of list.items) {
      const cId = item.companyId;
      const cName = item.company?.companyName || 'UNKNOWN COMPANY';
      if (!companyGroupsMap[cId]) {
        companyGroupsMap[cId] = {
          companyId: cId,
          companyName: cName,
          items: [],
        };
      }
      companyGroupsMap[cId].items.push({
        id: item.id,
        productId: item.productId,
        productName: item.product?.productName || 'Unknown Product',
        salePrice: parseFloat(item.product?.salePrice || 0),
        unit: item.product?.unit || 'strip',
        offerType: item.offerType,
        offerValue: item.offerValue !== null ? parseFloat(item.offerValue) : null,
        bonusBuyQty: item.bonusBuyQty !== null ? parseFloat(item.bonusBuyQty) : null,
        bonusFreeQty: item.bonusFreeQty !== null ? parseFloat(item.bonusFreeQty) : null,
        offerLabel: formatOfferLabel(item.offerType, item.offerValue, item.bonusBuyQty, item.bonusFreeQty),
        remarks: item.remarks || '',
      });
    }

    const companyGroups = Object.values(companyGroupsMap).sort((a, b) =>
      a.companyName.localeCompare(b.companyName)
    );

    res.json({
      success: true,
      data: {
        ...list,
        itemCount: list.items.length,
        companyCount: companyGroups.length,
        companyGroups,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/offer-lists ─────────────────────────────────────
async function create(req, res, next) {
  try {
    const { listNumber, listDate, isActive = true, remarks, items = [] } = req.body;

    if (!listNumber) {
      return res.status(400).json({ success: false, message: 'List Number is required.' });
    }

    const createdList = await prisma.$transaction(async (tx) => {
      const list = await tx.offerList.create({
        data: {
          userId: req.user.id,
          listNumber: String(listNumber).trim(),
          listDate: listDate ? new Date(listDate) : new Date(),
          isActive: Boolean(isActive),
          remarks: remarks || null,
        },
      });

      if (items.length > 0) {
        await tx.offerListItem.createMany({
          data: items.map((i) => ({
            offerListId: list.id,
            companyId: i.companyId,
            productId: i.productId,
            offerType: i.offerType || 'PERCENTAGE',
            offerValue: i.offerValue !== undefined && i.offerValue !== '' ? parseFloat(i.offerValue) : null,
            bonusBuyQty: i.bonusBuyQty !== undefined && i.bonusBuyQty !== '' ? parseFloat(i.bonusBuyQty) : null,
            bonusFreeQty: i.bonusFreeQty !== undefined && i.bonusFreeQty !== '' ? parseFloat(i.bonusFreeQty) : null,
            remarks: i.remarks || null,
          })),
        });
      }

      return list;
    });

    res.status(201).json({
      success: true,
      message: `Offer list ${createdList.listNumber} created with ${items.length} items.`,
      data: createdList,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/offer-lists/:id ──────────────────────────────────
async function update(req, res, next) {
  try {
    const { listNumber, listDate, isActive, remarks, items } = req.body;

    const existing = await prisma.offerList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Offer list not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const list = await tx.offerList.update({
        where: { id: req.params.id },
        data: {
          ...(listNumber !== undefined && { listNumber: String(listNumber).trim() }),
          ...(listDate !== undefined && { listDate: new Date(listDate) }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          ...(remarks !== undefined && { remarks: remarks || null }),
        },
      });

      // If items array is provided, replace items
      if (Array.isArray(items)) {
        await tx.offerListItem.deleteMany({ where: { offerListId: list.id } });
        if (items.length > 0) {
          await tx.offerListItem.createMany({
            data: items.map((i) => ({
              offerListId: list.id,
              companyId: i.companyId,
              productId: i.productId,
              offerType: i.offerType || 'PERCENTAGE',
              offerValue: i.offerValue !== undefined && i.offerValue !== '' ? parseFloat(i.offerValue) : null,
              bonusBuyQty: i.bonusBuyQty !== undefined && i.bonusBuyQty !== '' ? parseFloat(i.bonusBuyQty) : null,
              bonusFreeQty: i.bonusFreeQty !== undefined && i.bonusFreeQty !== '' ? parseFloat(i.bonusFreeQty) : null,
              remarks: i.remarks || null,
            })),
          });
        }
      }

      return list;
    });

    res.json({
      success: true,
      message: `Offer list ${updated.listNumber} updated.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/offer-lists/:id/toggle-active ──────────────────
async function toggleActive(req, res, next) {
  try {
    const existing = await prisma.offerList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Offer list not found.' });
    }

    const updated = await prisma.offerList.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
    });

    res.json({
      success: true,
      message: `Offer list ${updated.listNumber} is now ${updated.isActive ? 'Active' : 'Inactive'}.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/offer-lists/:id ───────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.offerList.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Offer list not found.' });
    }

    await prisma.offerList.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: `Offer list ${existing.listNumber} deleted.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getActiveOffers,
  getOne,
  create,
  update,
  toggleActive,
  remove,
  formatOfferLabel,
};
