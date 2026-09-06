const { Router } = require('express');
const { body } = require('express-validator');
const { list, getOne, create, recordPayment } = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', [
  body('companyId').notEmpty().withMessage('Company is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').notEmpty().withMessage('Product is required for each line item.'),
  body('items.*.qty').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0.'),
  body('items.*.unitPrice').isFloat({ gt: 0 }).withMessage('Unit price must be greater than 0.'),
], create);
router.patch('/:id/payment', [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0.'),
], recordPayment);

module.exports = router;
