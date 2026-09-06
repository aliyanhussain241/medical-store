const { Router } = require('express');
const { body } = require('express-validator');
const { list, getAreas, getOne, create, update, remove } = require('../controllers/customerController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

const rules = [
  body('customerName').trim().notEmpty().withMessage('Customer name is required.'),
];

router.get('/', list);
router.get('/areas', getAreas);
router.get('/:id', getOne);
router.post('/', rules, create);
router.put('/:id', rules, update);
router.delete('/:id', remove);

module.exports = router;
