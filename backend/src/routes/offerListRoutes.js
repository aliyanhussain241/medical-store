const { Router } = require('express');
const {
  list,
  getActiveOffers,
  getOne,
  create,
  update,
  toggleActive,
  remove,
} = require('../controllers/offerListController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

router.get('/', list);
router.get('/active-offers', getActiveOffers);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/toggle-active', toggleActive);
router.delete('/:id', remove);

module.exports = router;
