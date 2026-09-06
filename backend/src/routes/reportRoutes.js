const { Router } = require('express');
const { profitReport, partyBalanceReport } = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/profit', profitReport);
router.get('/party-balance', partyBalanceReport);

module.exports = router;
