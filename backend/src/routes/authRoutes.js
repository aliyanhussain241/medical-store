const { Router } = require('express');
const { body } = require('express-validator');
const { signup, login, refresh, logout, me, updateProfile, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();

router.post('/signup', [
  body('businessName').trim().notEmpty().withMessage('Business name is required.'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
], signup);

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], login);

router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
], changePassword);

module.exports = router;
