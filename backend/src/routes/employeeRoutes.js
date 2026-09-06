const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { list, getOne, create, update, remove, paySalary, salaryHistory } = require('../controllers/employeeController');

const router = Router();
router.use(authenticate);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/:id/pay-salary', paySalary);
router.get('/:id/salary-history', salaryHistory);

module.exports = router;
