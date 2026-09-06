const { Router } = require('express');
const { body } = require('express-validator');
const { list, getOne, create, update, remove } = require('../controllers/companyController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

const rules = [
  body('companyName').trim().notEmpty().withMessage('Company name is required.'),
  body('openingBalance').optional().isDecimal().withMessage('Opening balance must be a valid number.'),
];

router.get('/', list);
router.get('/:id', getOne);
router.post('/', rules, create);
router.put('/:id', rules, update);
router.delete('/:id', remove);

module.exports = router;
