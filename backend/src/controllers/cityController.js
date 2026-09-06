// ─────────────────────────────────────────────────────────────
// src/controllers/cityController.js
// Managed Cities/Areas list — used for Customer area assignment
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

// ── GET /api/cities ───────────────────────────────────────────
async function list(req, res, next) {
  try {
    const cities = await prisma.city.findMany({
      where: { userId: req.user.id },
      orderBy: { cityName: 'asc' },
    });
    res.json({ success: true, data: cities });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/cities ──────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { cityName } = req.body;
    if (!cityName || !cityName.trim()) {
      return res.status(400).json({ success: false, message: 'City name is required.' });
    }

    // Prevent duplicates (case-insensitive)
    const existing = await prisma.city.findFirst({
      where: {
        userId: req.user.id,
        cityName: { equals: cityName.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `City "${cityName.trim()}" already exists.` });
    }

    const city = await prisma.city.create({
      data: {
        userId: req.user.id,
        cityName: cityName.trim().toUpperCase(),
      },
    });

    res.status(201).json({ success: true, message: 'City added.', data: city });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/cities/:id ───────────────────────────────────────
async function update(req, res, next) {
  try {
    const { cityName } = req.body;
    if (!cityName || !cityName.trim()) {
      return res.status(400).json({ success: false, message: 'City name is required.' });
    }

    const existing = await prisma.city.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'City not found.' });

    const city = await prisma.city.update({
      where: { id: req.params.id },
      data: { cityName: cityName.trim().toUpperCase() },
    });

    res.json({ success: true, message: 'City updated.', data: city });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/cities/:id ────────────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.city.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'City not found.' });

    await prisma.city.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'City deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
