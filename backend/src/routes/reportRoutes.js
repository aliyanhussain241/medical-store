const { Router } = require('express');
const { profitReport, partyBalanceReport, trialBalance, balanceSheet } = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/profit', profitReport);
router.get('/party-balance', partyBalanceReport);
router.get('/trial-balance', trialBalance);
router.get('/balance-sheet', balanceSheet);

module.exports = router;
