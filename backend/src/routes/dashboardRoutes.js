const { Router } = require('express');
const { stats } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/stats', stats);

module.exports = router;
