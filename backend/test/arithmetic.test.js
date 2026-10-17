const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { calculateLine } = require('../src/utils/numberUtils');

test('F14: browser integer previews match Decimal server rounding for fractional packs/discounts', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/lineMath.js'), 'utf8').replaceAll('export ', '');
  const context = { module: { exports: {} } };
  vm.runInNewContext(source + '\nmodule.exports = { lineMoney, invoiceMoney };', context);
  const { lineMoney, invoiceMoney } = context.module.exports;
  for (const qty of ['0.001', '0.333', '1', '1.005', '99.999']) for (const price of ['0.01', '9.99', '100.05']) for (const discount of ['0', '5', '12.75', '100']) {
    const server = calculateLine(qty, price, discount), client = lineMoney(qty, price, discount);
    assert.equal(client.gross.toFixed(2), server.grossTotal); assert.equal(client.discount.toFixed(2), server.discountAmt); assert.equal(client.total.toFixed(2), server.total);
  }
  assert.equal(invoiceMoney([{ qty: 1, unitPrice: '0.10' }, { qty: 1, unitPrice: '0.20' }]), 0.3);
});
