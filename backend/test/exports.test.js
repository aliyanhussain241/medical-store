const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { fixture, trading } = require('./financial.fixture');
const { memoryDatabase, loadWithDatabase } = require('./controllerHarness');
const { buildFinancialData, trialBalanceData, balanceSheetData } = require('../src/services/financialReportService');

test('G01/F07/F10: API and PDF/Excel controllers receive identical report/statement data', async () => {
  const { db, tables } = memoryDatabase(), f = fixture();
  for (const [key, table] of Object.entries({ banks: 'bankAccount', customers: 'customer', companies: 'company', products: 'product', cash: 'cashBookEntry', bank: 'bankBookEntry', ledger: 'ledgerTransaction', movements: 'stockMovement', heads: 'accountHead' })) tables[table].push(...f[key].map((r) => ({ ...r, userId: 'owner' })));
  tables.user.push({ id: 'owner', businessName: 'Fixture', ownerName: 'Fixture' });
  const generators = new Proxy({}, { get: () => async (data) => Buffer.from(JSON.stringify(data)) });
  const overrides = Object.fromEntries(['pdfService', 'excelService'].map((name) => [path.resolve(__dirname, '../src/services/' + name + '.js'), generators]));
  const exports = loadWithDatabase(path.join(__dirname, '../src/controllers/exportController.js'), db, overrides);
  async function call(name, id) {
    let data;
    await exports[name]({ user: { id: 'owner' }, params: { id }, query: { asOn: trading, from: trading } }, { set() {}, send: (value) => { data = JSON.parse(value); } }, (e) => { throw e; });
    return data;
  }
  const fd = buildFinancialData(f, trading);
  for (const format of ['PDF', 'Excel']) {
    assert.deepEqual(await call('trialBalance' + format), trialBalanceData(fd));
    assert.deepEqual(await call('balanceSheet' + format), balanceSheetData(fd));
    assert.equal((await call('customerLedger' + format, 'c')).summary.closingBalance, '110.00');
    assert.equal((await call('companyLedger' + format, 's')).summary.closingBalance, '-170.00');
    assert.equal((await call('bankLedger' + format, 'b')).summary.closingBalance, '90.00');
    assert.equal((await call('cashBook' + format)).data.length, 1);
  }
});

test('G01: actual financial PDF/XLSX renderers produce buffers without writing artifacts', async () => {
  const pdf = require('../src/services/pdfService'), excel = require('../src/services/excelService');
  const fd = buildFinancialData(fixture(), trading), user = { businessName: 'Fixture Medical', ownerName: 'Fixture', phone: '000', address: 'Test only' };
  for (const [name, data] of [['TrialBalance', trialBalanceData(fd)], ['BalanceSheet', balanceSheetData(fd)]]) {
    const pdfBuffer = await pdf['generate' + name + 'PDF'](data, user);
    assert.equal(pdfBuffer.subarray(0, 5).toString(), '%PDF-');
    const buffer = await excel['generate' + name + 'Excel'](data, user);
    const wb = new (require('exceljs').Workbook)(); await wb.xlsx.load(buffer);
    assert.ok(wb.worksheets[0].rowCount > 5);
  }
});
