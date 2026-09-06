const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { list, create, update, remove } = require('../controllers/cityController');

const router = Router();
router.use(authenticate);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
