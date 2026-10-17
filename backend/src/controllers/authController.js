// ─────────────────────────────────────────────────────────────
// src/controllers/authController.js
// Handles: signup, login, refresh token, logout, password reset
// ─────────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../utils/db');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is required');
  return process.env.JWT_SECRET;
};
const getRefreshSecret = () => {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required');
  return process.env.JWT_REFRESH_SECRET;
};

// ── Token helpers ─────────────────────────────────────────────
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    getRefreshSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', jwtid: randomUUID() }
  );
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return { ...safe, businessType: 'PHARMACY' };
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

    getJwtSecret();
    getRefreshSecret();
    const passwordHash = await bcrypt.hash(password, 12);
    const issued = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { businessName, ownerName, email, passwordHash, phone, address, businessType: 'PHARMACY' } });
      const accessToken = generateAccessToken(user), refreshTokenStr = generateRefreshToken(user);
      await tx.refreshToken.create({ data: { token: refreshTokenStr, userId: user.id, expiresAt: new Date(jwt.decode(refreshTokenStr).exp * 1000) } });
      return { user, accessToken, refreshTokenStr };
    });
    const { user, accessToken, refreshTokenStr } = issued;

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
    const expiresAt = new Date(jwt.decode(refreshTokenStr).exp * 1000);

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
      decoded = jwt.verify(refreshToken, getRefreshSecret());
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token. Please log in again.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { token: refreshToken } });
      if (!stored || stored.userId !== decoded.userId || stored.expiresAt <= new Date()) {
        throw Object.assign(new Error('Session expired. Please log in again.'), { statusCode: 401 });
      }
      const consumed = await tx.refreshToken.deleteMany({ where: { id: stored.id, token: refreshToken, userId: decoded.userId } });
      if (consumed.count !== 1) throw Object.assign(new Error('Session already refreshed. Please log in again.'), { statusCode: 401 });
      const user = await tx.user.findUnique({ where: { id: decoded.userId } });
      if (!user) throw Object.assign(new Error('Session expired.'), { statusCode: 401 });
      const accessToken = generateAccessToken(user);
      const token = generateRefreshToken(user);
      await tx.refreshToken.create({ data: { token, userId: user.id, expiresAt: new Date(jwt.decode(token).exp * 1000) } });
      return { accessToken, refreshToken: token };
    });

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
async function logout(req, res, next) {
  try {
    if (req.query.all === 'true') {
      // Logout everywhere: invalidate ALL refresh tokens for this user
      await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });
    } else {
      // Logout this device: invalidate only the provided refresh token (scoped to user)
      const { refreshToken } = req.body;
      if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId: req.user.id } });
      } else {
        // No token provided — invalidate all as a safe fallback
        await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } });
      }
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: req.user.id, passwordHash: user.passwordHash }, data: { passwordHash } });
      if (changed.count !== 1) throw Object.assign(new Error('Password changed. Please log in again.'), { statusCode: 409 });
      await tx.refreshToken.deleteMany({ where: { userId: req.user.id } });
    });
    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, me, updateProfile, changePassword };
