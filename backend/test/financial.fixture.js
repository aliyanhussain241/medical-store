const date = (day) => new Date(`${day}T00:00:00.000Z`);
const opening = '2026-10-01', trading = '2026-10-17';
const row = (id, day, extra) => ({ id, createdAt: date(day), transactionDate: date(day), ...extra });

function fixture() {
  return {
    banks: [{ id: 'b', bankName: 'Test Bank', accountTitle: 'Fixture', accountNumber: 'TEST', openingBalance: 100, createdAt: date(opening) }],
    customers: [{ id: 'c', openingBalance: 50, createdAt: date(opening) }],
    companies: [{ id: 's', openingBalance: 20, createdAt: date(opening) }],
    products: [{ id: 'p', stockQty: 15, purchasePrice: 15, createdAt: date(opening) }], heads: [],
    cash: [row('cash', trading, { cashIn: 20, cashOut: 0, referenceType: 'INVOICE_PAYMENT' })],
    bank: [row('bo', opening, { bankAccountId: 'b', debit: 100, credit: 0, referenceType: 'OPENING_BALANCE' }), row('bp', trading, { bankAccountId: 'b', debit: 0, credit: 50, referenceType: 'PURCHASE' }), row('bs', trading, { bankAccountId: 'b', debit: 40, credit: 0, referenceType: 'INVOICE_INITIAL' })],
    ledger: [
      row('co', opening, { partyType: 'CUSTOMER', partyId: 'c', debit: 50, credit: 0, referenceType: 'OPENING_BALANCE' }),
      row('so', opening, { partyType: 'COMPANY', partyId: 's', debit: 0, credit: 20, referenceType: 'OPENING_BALANCE_V2' }),
      row('sp', trading, { partyType: 'COMPANY', partyId: 's', debit: 0, credit: 200, referenceType: 'PURCHASE_V2' }),
      row('ss', trading, { partyType: 'COMPANY', partyId: 's', debit: 50, credit: 0, referenceType: 'SUPPLIER_PAYMENT_V2' }),
      row('ci', trading, { partyType: 'CUSTOMER', partyId: 'c', debit: 120, credit: 0, referenceType: 'INVOICE' }),
      row('cp', trading, { partyType: 'CUSTOMER', partyId: 'c', debit: 0, credit: 40, referenceType: 'INVOICE_INITIAL_PAYMENT' }),
      row('cl', trading, { partyType: 'CUSTOMER', partyId: 'c', debit: 0, credit: 20, referenceType: 'INVOICE_PAYMENT' }),
    ],
    movements: [
      { id: 'mo', productId: 'p', movementType: 'ADJUSTMENT', qty: 10, valueDelta: 100, notes: 'INITIAL_INVENTORY', movementDate: date(opening) },
      { id: 'mp', productId: 'p', movementType: 'PURCHASE', qty: 10, valueDelta: 200, movementDate: date(trading) },
      { id: 'ms', productId: 'p', movementType: 'SALE', qty: -5, valueDelta: -75, movementDate: date(trading) },
    ],
  };
}
module.exports = { fixture, date, opening, trading, row };
