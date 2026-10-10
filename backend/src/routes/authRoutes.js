const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { signup, login, refresh, logout, me, updateProfile, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 10,                   // 10 attempts per window per IP
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1-minute window
  max: 5,                    // 5 refresh attempts per minute per IP
  message: { success: false, message: 'Too many refresh attempts. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authLimiter, [
  body('businessName').trim().notEmpty().withMessage('Business name is required.'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], signup);

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], login);

router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', authenticate, logout);

router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
], changePassword);

module.exports = router;

