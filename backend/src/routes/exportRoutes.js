const { Router } = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  invoicePDF, invoiceExcel,
  customerLedgerPDF, customerLedgerExcel,
  companyLedgerPDF, companyLedgerExcel,
  bankLedgerPDF, bankLedgerExcel,
  cashBookPDF, cashBookExcel,
  profitPDF, profitExcel,
  offerListPDF, offerListExcel,
  partyBalancePDF, partyBalanceExcel,
} = require('../controllers/exportController');

const router = Router();
router.use(authenticate);

// Invoice exports
router.get('/invoice/:id/pdf', invoicePDF);
router.get('/invoice/:id/excel', invoiceExcel);

// Customer ledger exports  (?from=2026-01-01&to=2026-12-31)
router.get('/ledger/customer/:id/pdf', customerLedgerPDF);
router.get('/ledger/customer/:id/excel', customerLedgerExcel);

// Company ledger exports
router.get('/ledger/company/:id/pdf', companyLedgerPDF);
router.get('/ledger/company/:id/excel', companyLedgerExcel);

// Bank ledger exports
router.get('/ledger/bank/:id/pdf', bankLedgerPDF);
router.get('/ledger/bank/:id/excel', bankLedgerExcel);

// Cash book exports
router.get('/cash-book/pdf', cashBookPDF);
router.get('/cash-book/excel', cashBookExcel);

// Profit report exports
router.get('/profit/pdf', profitPDF);
router.get('/profit/excel', profitExcel);

// Offer list exports
router.get('/offer-list/:id/pdf', offerListPDF);
router.get('/offer-list/:id/excel', offerListExcel);

// Party balance report exports
router.get('/party-balance/pdf', partyBalancePDF);
router.get('/party-balance/excel', partyBalanceExcel);

module.exports = router;
