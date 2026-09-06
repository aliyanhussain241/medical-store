const { Router } = require('express');
const { list, create } = require('../controllers/bankBookController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/', list);
router.post('/', create);

module.exports = router;
