// ─────────────────────────────────────────────────────────────
// src/controllers/productImportController.js
//
// GET  /api/products/import/template  → download Excel template
// POST /api/products/import           → upload & parse Excel, bulk insert
//
// Smart column detection — works with:
//   1. Our template  (Product Name, Purchase Price, Sale Price …)
//   2. Pakistan medicines format (medicine name, company, pack_size, sale_price, mrp)
//   3. Any reasonable variation (case-insensitive header matching)
// ─────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');
const prisma = require('../utils/prismaClient');

// ── Template column definitions ───────────────────────────────
const TEMPLATE_COLUMNS = [
  { header: 'Product Name *',           key: 'productName',   width: 30 },
  { header: 'Category / Company',       key: 'category',      width: 22 },
  { header: 'Unit / Pack Size',         key: 'unit',          width: 18 },
  { header: 'Batch No',                 key: 'batchNo',       width: 15 },
  { header: 'Expiry Date (YYYY-MM-DD)', key: 'expiryDate',    width: 24 },
  { header: 'Purchase Price *',         key: 'purchasePrice', width: 18 },
  { header: 'Sale Price *',             key: 'salePrice',     width: 15 },
  { header: 'MRP',                      key: 'mrp',           width: 12 },
  { header: 'Stock Qty',                key: 'stockQty',      width: 12 },
  { header: 'Min Stock Alert',          key: 'minStockAlert', width: 18 },
];

const VALID_UNITS = ['strip', 'tablet', 'capsule', 'bottle', 'bag', 'vial', 'box', 'sachet', 'ampule', 'syrup', 'injection', 'cream', 'ointment', 'drops'];

// ── Smart header → field mapping ──────────────────────────────
// Maps any common column name (lowercase, trimmed) to our internal field name
const HEADER_MAP = {
  // Product name variations
  'product name':         'productName',
  'product name *':       'productName',
  'medicine name':        'productName',
  'medicine':             'productName',
  'drug name':            'productName',
  'name':                 'productName',
  'item name':            'productName',
  'product':              'productName',

  // Category / company
  'category / company':   'category',
  'category':             'category',
  'company':              'category',
  'manufacturer':         'category',
  'brand':                'category',
  'type':                 'category',

  // Unit / pack size
  'unit / pack size':     'unit',
  'unit':                 'unit',
  'pack size':            'unit',
  'pack_size':            'unit',
  'packing':              'unit',
  'pack':                 'unit',

  // Batch
  'batch no':             'batchNo',
  'batch':                'batchNo',
  'lot no':               'batchNo',
  'lot':                  'batchNo',

  // Expiry
  'expiry date (yyyy-mm-dd)': 'expiryDate',
  'expiry date':          'expiryDate',
  'expiry':               'expiryDate',
  'exp date':             'expiryDate',
  'exp':                  'expiryDate',

  // Purchase price
  'purchase price *':     'purchasePrice',
  'purchase price':       'purchasePrice',
  'cost price':           'purchasePrice',
  'buying price':         'purchasePrice',
  'trade price':          'purchasePrice',
  'tp':                   'purchasePrice',
  'cost':                 'purchasePrice',

  // Sale price
  'sale price *':         'salePrice',
  'sale price':           'salePrice',
  'selling price':        'salePrice',
  'price':                'salePrice',
  'sale_price':           'salePrice',
  'rate':                 'salePrice',

  // MRP
  'mrp':                  'mrp',
  'max retail price':     'mrp',
  'retail price':         'mrp',
  'retail':               'mrp',

  // Stock
  'stock qty':            'stockQty',
  'stock':                'stockQty',
  'quantity':             'stockQty',
  'qty':                  'stockQty',
  'opening stock':        'stockQty',

  // Alert
  'min stock alert':      'minStockAlert',
  'min stock':            'minStockAlert',
  'reorder level':        'minStockAlert',
  'reorder':              'minStockAlert',
};

function detectColumns(headerRow) {
  const map = {}; // colNumber → fieldName
  headerRow.eachCell((cell, colNumber) => {
    const hdr = String(cell.value || '').toLowerCase().trim();
    if (HEADER_MAP[hdr]) {
      map[colNumber] = HEADER_MAP[hdr];
    }
  });
  return map;
}

// ── GET /api/products/import/template ────────────────────────
async function downloadTemplate(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rahmat Medical Wholesale';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = TEMPLATE_COLUMNS;

    // Header row styling
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4B40' } };
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    headerRow.height = 32;

    // Sample row
    sheet.addRow([
      'Amoxicillin 250mg Capsules',
      'Abbott Laboratories',
      '1x10\'s',
      'AMX-2024-B',
      '2026-12-31',
      '65',
      '90',
      '100',
      '283',
      '30',
    ]);
    const sampleRow = sheet.getRow(2);
    sampleRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      cell.font = { italic: true, color: { argb: 'FF555555' } };
    });

    // Instructions sheet
    const instrSheet = workbook.addWorksheet('Instructions');
    const instrLines = [
      ['Rahmat Medical Wholesale — Products Import Template'],
      [],
      ['INSTRUCTIONS:'],
      ['1. Fill in the "Products" sheet starting from row 3 (row 2 is an example — you can delete it).'],
      ['2. Columns marked * are required. Rows missing these will be skipped.'],
      ['3. Expiry Date format: YYYY-MM-DD (e.g. 2026-12-31). Leave blank if no expiry.'],
      ['4. Purchase Price * = your buying/trade price. Sale Price * = price you charge retailers.'],
      ['5. MRP = Maximum Retail Price printed on the box (optional).'],
      ['6. If Purchase Price is missing, MRP will be used as fallback. If both missing, defaults to 0.'],
      ['7. Stock Qty and Min Stock Alert are optional (default: 0 and 10).'],
      [],
      ['COMPATIBLE WITH EXISTING SHEETS:'],
      ['This importer also accepts the Pakistan medicines CSV format with columns:'],
      ['  medicine name | company | pack_size | sale_price | mrp'],
      ['Column names are matched automatically — no renaming needed!'],
      [],
      ['COLUMN REFERENCE:'],
      ...TEMPLATE_COLUMNS.map((col) => [col.header]),
    ];
    instrLines.forEach((line) => instrSheet.addRow(line));
    instrSheet.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1B4B40' } };
    instrSheet.getRow(3).font = { bold: true };
    instrSheet.getRow(13).font = { bold: true };
    instrSheet.getRow(18).font = { bold: true };
    instrSheet.getColumn(1).width = 80;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="products-import-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// ── POST /api/products/import ─────────────────────────────────
async function importProducts(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Please attach an Excel (.xlsx) file.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    // Try to find the data worksheet — prefer "Products" tab, else first sheet
    const sheet = workbook.getWorksheet('Products')
      || workbook.getWorksheet('pakistan_medicines')
      || workbook.getWorksheet('Sheet1')
      || workbook.worksheets[0];

    if (!sheet) {
      return res.status(400).json({ success: false, message: 'No worksheet found in the uploaded file.' });
    }

    // ── Detect columns from header row ────────────────────────
    let colMap = null;
    let headerRowNum = 1;

    // Try rows 1–3 to find the header (some sheets have metadata before headers)
    for (let r = 1; r <= 3; r++) {
      const candidate = detectColumns(sheet.getRow(r));
      if (candidate && Object.values(candidate).includes('productName')) {
        colMap = candidate;
        headerRowNum = r;
        break;
      }
    }

    if (!colMap || !Object.keys(colMap).length) {
      return res.status(400).json({
        success: false,
        message: 'Could not detect column headers. Make sure your sheet has a header row with at least "Product Name" (or "medicine name"), "Sale Price" (or "sale_price").',
      });
    }

    const hasProductName  = Object.values(colMap).includes('productName');
    const hasSalePrice    = Object.values(colMap).includes('salePrice');
    const hasMRP          = Object.values(colMap).includes('mrp');
    const hasPurchasePrice = Object.values(colMap).includes('purchasePrice');

    if (!hasProductName) {
      return res.status(400).json({ success: false, message: 'Could not find a "Product Name" or "medicine name" column.' });
    }
    if (!hasSalePrice && !hasMRP) {
      return res.status(400).json({ success: false, message: 'Could not find a "Sale Price" or "MRP" column.' });
    }

    // ── Parse rows ────────────────────────────────────────────
    const results = { added: 0, skipped: 0, errors: [] };
    const toCreate = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNum) return; // skip headers

      // Extract values using detected column map
      const get = (fieldName) => {
        for (const [colNum, field] of Object.entries(colMap)) {
          if (field === fieldName) {
            const cell = row.getCell(parseInt(colNum));
            const v = cell.value;
            if (v === null || v === undefined) return '';
            if (v instanceof Date) return v;
            if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('').trim();
            if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim(); // formula cell
            return String(v).trim();
          }
        }
        return '';
      };

      const productName   = get('productName');
      const category      = get('category');
      const rawUnit       = get('unit');
      const batchNo       = get('batchNo');
      const expiryRaw     = get('expiryDate');
      const purchasePriceRaw = get('purchasePrice');
      const salePriceRaw  = get('salePrice');
      const mrpRaw        = get('mrp');
      const stockQtyRaw   = get('stockQty');
      const minAlertRaw   = get('minStockAlert');

      // Skip completely empty rows
      if (!productName && !salePriceRaw && !mrpRaw) return;

      // Required: product name
      if (!productName) {
        results.errors.push({ row: rowNumber, message: 'Product Name is empty — row skipped.' });
        results.skipped++;
        return;
      }

      // Sale price — fall back to MRP if no sale price column
      const effectiveSalePrice = salePriceRaw || mrpRaw;
      if (!effectiveSalePrice || isNaN(parseFloat(effectiveSalePrice))) {
        results.errors.push({ row: rowNumber, product: productName, message: 'Sale Price / MRP is missing or not a number — row skipped.' });
        results.skipped++;
        return;
      }

      // Purchase price — fall back to MRP, then to 0
      let effectivePurchasePrice = purchasePriceRaw || mrpRaw || '0';
      if (isNaN(parseFloat(effectivePurchasePrice))) effectivePurchasePrice = '0';

      // Expiry date
      let expiryDate = null;
      if (expiryRaw instanceof Date) {
        expiryDate = expiryRaw;
      } else if (expiryRaw) {
        const parsed = new Date(expiryRaw);
        if (!isNaN(parsed.getTime())) expiryDate = parsed;
      }

      // Unit — store pack_size as-is (e.g. "2x10's", "120ml", "10's")
      // It's more useful to keep the original pack size than force a category
      const unitValue = rawUnit || 'strip';

      toCreate.push({
        userId:        req.user.id,
        productName,
        category:      category || null,
        unit:          unitValue,
        batchNo:       batchNo || null,
        expiryDate,
        purchasePrice: effectivePurchasePrice.toString(),
        salePrice:     effectiveSalePrice.toString(),
        stockQty:      stockQtyRaw ? stockQtyRaw.toString() : '0',
        minStockAlert: minAlertRaw ? parseInt(minAlertRaw) || 10 : 10,
      });
    });

    if (toCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid product rows found. Please check the file.',
        errors: results.errors,
      });
    }

    // Bulk insert in batches of 100
    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await prisma.product.createMany({
        data: toCreate.slice(i, i + BATCH),
        skipDuplicates: false,
      });
    }

    results.added = toCreate.length;

    // Summary of detected columns for the response
    const detectedFields = [...new Set(Object.values(colMap))];

    res.status(201).json({
      success: true,
      message: `Import complete. ${results.added} products added${results.skipped > 0 ? `, ${results.skipped} rows skipped` : ''}.`,
      data: { ...results, detectedColumns: detectedFields },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { downloadTemplate, importProducts };
