// ─────────────────────────────────────────────────────────────
// src/controllers/authController.js
// Handles: signup, login, refresh token, logout, password reset
// ─────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');

// ── Token helpers ─────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── POST /api/auth/signup ─────────────────────────────────────
async function signup(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { businessName, ownerName, email, password, phone, address } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { businessName, ownerName, email, passwordHash, phone, address },
    });

    // Issue tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenStr = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.refreshToken.create({
      data: { token: refreshTokenStr, userId: user.id, expiresAt },
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      accessToken,
      refreshToken: refreshTokenStr,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenStr = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: refreshTokenStr, userId: user.id, expiresAt },
    });

    res.json({
      success: true,
      message: 'Login successful.',
      accessToken,
      refreshToken: refreshTokenStr,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token. Please log in again.' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // Rotate: delete old token, issue new pair
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: user.id, expiresAt },
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/auth/profile ─────────────────────────────────────
async function updateProfile(req, res, next) {
  try {
    const { businessName, ownerName, phone, address } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { businessName, ownerName, phone, address },
    });
    res.json({ success: true, message: 'Profile updated.', user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/auth/change-password ────────────────────────────
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, me, updateProfile, changePassword };
