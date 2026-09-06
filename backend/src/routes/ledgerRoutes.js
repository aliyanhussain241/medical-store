const { Router } = require('express');
const { customerLedger, companyLedger, bankLedger } = require('../controllers/ledgerController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/customer/:customerId', customerLedger);
router.get('/company/:companyId', companyLedger);
router.get('/bank/:bankAccountId', bankLedger);

module.exports = router;
