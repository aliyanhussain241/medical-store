const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { list, getOne, categories, alerts, create, update, adjustStock, remove } = require('../controllers/productController');
const { downloadTemplate, importProducts } = require('../controllers/productImportController');
const { authenticate } = require('../middleware/authMiddleware');

const router = Router();
router.use(authenticate);

// Multer: store file in memory (buffer), 5MB limit, xlsx only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx Excel files are allowed.'));
    }
  },
});

const rules = [
  body('productName').trim().notEmpty().withMessage('Product name is required.'),
  body('purchasePrice').isDecimal({ decimal_digits: '0,2' }).withMessage('Purchase price must be a valid number.'),
  body('salePrice').isDecimal({ decimal_digits: '0,2' }).withMessage('Sale price must be a valid number.'),
];

// ── Import routes (BEFORE /:id to avoid clash) ────────────────
router.get('/import/template', downloadTemplate);
router.post('/import', upload.single('file'), importProducts);

// ── Standard CRUD routes ──────────────────────────────────────
router.get('/', list);
router.get('/categories', categories);
router.get('/alerts', alerts);
router.get('/:id', getOne);
router.post('/', rules, create);
router.put('/:id', rules, update);
router.patch('/:id/adjust-stock', adjustStock);
router.delete('/:id', remove);

module.exports = router;
