const { Router } = require('express');
const { body } = require('express-validator');
const { list, getOne, create, update, remove } = require('../controllers/bankAccountController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

const rules = [
  body('bankName').trim().notEmpty().withMessage('Bank name is required.'),
  body('accountTitle').trim().notEmpty().withMessage('Account title is required.'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required.'),
  body('openingBalance').optional().isDecimal().withMessage('Opening balance must be a valid number.'),
];

router.get('/', list);
router.get('/:id', getOne);
router.post('/', rules, create);
router.put('/:id', rules, update);
router.delete('/:id', remove);

module.exports = router;
