const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ExcelJS = require('exceljs');
const { memoryDatabase, loadWithDatabase, invoke } = require('./controllerHarness');

async function workbook(rows) {
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('Products');
  sheet.addRow(['Product Name', 'Purchase Price', 'Sale Price', 'Stock Qty']);
  for (const row of rows) sheet.addRow(row);
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}
function setup() {
  const memory = memoryDatabase();
  return { ...memory, controller: loadWithDatabase(path.join(__dirname, '../src/controllers/productImportController.js'), memory.db) };
}
test('F15: import rejects all rows on invalid cost and rejects catalog duplicates without partial additions', async () => {
  const { tables, controller } = setup();
  await assert.rejects(invoke(controller.importProducts, {}, { url: '/api/products/import', file: await workbook([['Valid', 10, 20, 5], ['Unknown cost', '', 20, 2]]) }), /Import rejected/);
  assert.equal(tables.product.length, 0); assert.equal(tables.stockMovement.length, 0);
  const file = await workbook([['Valid', 10, 20, 5]]);
  await invoke(controller.importProducts, {}, { url: '/api/products/import', file });
  assert.equal(tables.product.length, 1); assert.equal(tables.stockMovement[0].valueDelta, '50.00');
  await assert.rejects(invoke(controller.importProducts, {}, { url: '/api/products/import', file }), /Duplicate product/);
  assert.equal(tables.product.length, 1);
});
test('F15: mid-import database failure rolls the entire file back', async () => {
  const { db, tables, controller } = setup();
  const create = db.product.create;
  db.product.create = async (args) => { if (args.data.productName === 'Fail') throw Error('simulated insert failure'); return create(args); };
  await assert.rejects(invoke(controller.importProducts, {}, { url: '/api/products/import', file: await workbook([['First', 10, 20, 5], ['Fail', 10, 20, 5]]) }), /simulated insert/);
  assert.equal(tables.product.length, 0); assert.equal(tables.stockMovement.length, 0); assert.equal(tables.idempotencyRecord.length, 0);
});
