const { D, ledgerAmounts, statement, openingFallback } = require('./statementService');
const { businessDay } = require('../utils/businessDate');

function buildFinancialData(data, asOn) {
  const day = businessDay(asOn), warnings = [];
  const before = (date) => businessDay(date) <= day;
  const entities = (rows) => rows.filter((row) => before(row.createdAt));
  const ledger = data.ledger.filter((row) => before(row.transactionDate));
  const cash = data.cash.filter((row) => before(row.transactionDate));
  const bank = data.bank.filter((row) => before(row.transactionDate));
  const movements = data.movements.filter((row) => before(row.movementDate));
  const cashBalance = D(statement(cash, { kind: 'cash' }).summary.closingBalance);
  const bankBalances = entities(data.banks).map((account) => {
    const all = data.bank.filter((row) => row.bankAccountId === account.id);
    return { id: account.id, name: `${account.bankName} — ${account.accountTitle}`, accountNumber: account.accountNumber, balance: Number(statement(all, { to: day, opening: openingFallback(account, all) }).summary.closingBalance) };
  });
  let receivableDr = D(0), receivableCr = D(0), payableDr = D(0), payableCr = D(0), capital = D(0);
  for (const [type, rows] of [['CUSTOMER', entities(data.customers)], ['COMPANY', entities(data.companies)]]) {
    for (const entity of rows) {
      const all = data.ledger.filter((row) => row.partyType === type && row.partyId === entity.id);
      const fallback = D(openingFallback(entity, all)).mul(type === 'COMPANY' ? -1 : 1);
      const balance = D(statement(all, { to: day, opening: fallback, partyType: type }).summary.closingBalance);
      if (type === 'CUSTOMER') {
        if (balance.gte(0)) receivableDr = receivableDr.plus(balance); else receivableCr = receivableCr.minus(balance);
      } else {
        if (balance.gte(0)) payableDr = payableDr.plus(balance); else payableCr = payableCr.minus(balance);
      }
      const openings = ledger.filter((r) => r.partyType === type && r.partyId === entity.id && ['OPENING_BALANCE', 'OPENING_BALANCE_V2'].includes(r.referenceType));
      capital = capital.plus(openings.reduce((sum, r) => { const a = ledgerAmounts(r, type); return sum.plus(a.debit).minus(a.credit); }, fallback));
    }
  }
  for (const account of entities(data.banks)) {
    const all = data.bank.filter((r) => r.bankAccountId === account.id);
    capital = capital.plus(bank.filter((r) => r.bankAccountId === account.id && r.referenceType === 'OPENING_BALANCE').reduce((v, r) => v.plus(r.debit).minus(r.credit), D(openingFallback(account, all))));
  }
  let inventory = D(0), cost = D(0), inventoryAdjustments = D(0);
  for (const product of entities(data.products)) {
    if (!data.movements.some((m) => m.productId === product.id && m.notes === 'INITIAL_INVENTORY')) warnings.push(`Product ${product.id}: opening inventory snapshot unavailable.`);
  }
  for (const row of movements) {
    if (row.valueDelta === null || row.valueDelta === undefined) { warnings.push(`Movement ${row.id}: historical cost unavailable.`); continue; }
    const value = D(row.valueDelta);
    inventory = inventory.plus(value);
    if (row.movementType === 'SALE' || (row.movementType === 'RETURN' && row.notes === 'Invoice revision reversal')) cost = cost.minus(value);
    if (row.notes === 'INITIAL_INVENTORY') capital = capital.plus(value);
    else if (row.movementType === 'ADJUSTMENT') inventoryAdjustments = inventoryAdjustments.plus(value);
  }
  const byId = new Map(data.ledger.map((row) => [row.id, row]));
  const sales = ledger.filter((r) => r.partyType === 'CUSTOMER' && (r.referenceType === 'INVOICE' || (r.referenceType === 'INVOICE_REVERSAL' && byId.get(r.referenceId)?.referenceType === 'INVOICE'))).reduce((v, r) => v.plus(r.debit).minus(r.credit), D(0));
  const headTotals = new Map();
  for (const [rows, isCash] of [[cash, true], [bank, false]]) {
    for (const row of rows.filter((r) => r.accountHeadId)) {
      const head = data.heads.find((h) => h.id === row.accountHeadId);
      const category = row.accountCategory || head?.category;
      if (!row.accountCategory) warnings.push(`Entry ${row.id}: historical account classification was not snapshotted.`);
      if (!category) continue;
      const key = `${row.accountHeadId}:${category}:${row.accountHeadName || head.name}`;
      const total = headTotals.get(key) || { id: row.accountHeadId, name: row.accountHeadName || head.name, category, amount: D(0) };
      const incoming = isCash ? D(row.cashIn).minus(row.cashOut) : D(row.debit).minus(row.credit);
      total.amount = total.amount.plus(category === 'EXPENSE' ? incoming.negated() : incoming);
      headTotals.set(key, total);
    }
  }
  const headBalances = [...headTotals.values()].map((h) => ({ id: h.id, name: h.name, category: h.category, balance: h.amount.toNumber() }));
  return {
    asOnDate: day, cashBalance: cashBalance.toNumber(), bankBalances, totalBankBalance: bankBalances.reduce((v, r) => v + r.balance, 0),
    totalReceivableDr: receivableDr.toNumber(), totalReceivableCr: receivableCr.toNumber(), totalPayableDr: payableDr.toNumber(), totalPayableCr: payableCr.toNumber(),
    inventoryValue: inventory.toNumber(), openingCapital: capital.toNumber(), inventoryAdjustments: inventoryAdjustments.toNumber(), totalSales: sales.toNumber(), totalCost: cost.toNumber(), grossProfit: sales.minus(cost).toNumber(), headBalances,
    complete: warnings.length === 0, warnings: [...new Set(warnings)],
  };
}

function trialBalanceData(fd) {
  const rows = [];
  const add = (section, name, amount, credit = false) => {
    const value = D(amount); if (value.isZero()) return;
    const onCredit = credit ? value.gte(0) : value.lt(0);
    rows.push({ section, name, debit: onCredit ? 0 : value.abs().toNumber(), credit: onCredit ? value.abs().toNumber() : 0 });
  };
  add('Assets — Cash & Bank', 'Cash in Hand', fd.cashBalance);
  for (const bank of fd.bankBalances) add('Assets — Cash & Bank', bank.name, bank.balance);
  add('Assets — Inventory', 'Inventory (recorded cost)', fd.inventoryValue);
  add('Receivables', 'Accounts Receivable (DR)', fd.totalReceivableDr);
  add('Receivables', 'Customer advances (CR)', fd.totalReceivableCr, true);
  add('Payables', 'Supplier advances (DR)', fd.totalPayableDr);
  add('Payables', 'Accounts Payable (CR)', fd.totalPayableCr, true);
  add('Equity', 'Opening Capital', fd.openingCapital, true);
  add('Equity', 'Recorded Inventory Adjustments', fd.inventoryAdjustments, true);
  add('Trading', 'Gross Profit', fd.grossProfit, true);
  for (const head of fd.headBalances) add(head.category, head.name, head.balance, head.category !== 'EXPENSE');
  const debit = rows.reduce((v, r) => v.plus(r.debit), D(0)), credit = rows.reduce((v, r) => v.plus(r.credit), D(0));
  return { asOnDate: fd.asOnDate, rows, totalDebit: debit.toNumber(), totalCredit: credit.toNumber(), difference: debit.minus(credit).abs().toNumber(), isBalanced: fd.complete && debit.minus(credit).abs().lt('0.01'), complete: fd.complete, warnings: fd.warnings };
}

function balanceSheetData(fd) {
  const assets = [{ name: 'Cash in Hand', amount: fd.cashBalance }, ...fd.bankBalances.map((b) => ({ name: b.name, amount: b.balance })), { name: 'Accounts Receivable (Customers)', amount: fd.totalReceivableDr - fd.totalReceivableCr }, { name: 'Inventory (recorded cost)', amount: fd.inventoryValue }];
  const liabilities = [{ name: 'Accounts Payable (Companies)', amount: fd.totalPayableCr - fd.totalPayableDr }, ...fd.headBalances.filter((h) => h.category === 'LIABILITY').map((h) => ({ name: h.name, amount: h.balance }))];
  const otherResult = fd.headBalances.filter((h) => h.category !== 'LIABILITY').reduce((v, h) => v.plus(D(h.balance).mul(h.category === 'EXPENSE' ? -1 : 1)), D(0));
  const equity = [{ name: 'Opening Capital', amount: fd.openingCapital }, { name: 'Gross Profit', amount: fd.grossProfit }, { name: 'Recorded Inventory Adjustments', amount: fd.inventoryAdjustments }, { name: 'Other Recorded Income / Expenses', amount: otherResult.toNumber() }];
  const sum = (rows) => rows.reduce((v, r) => v.plus(r.amount), D(0));
  const totalAssets = sum(assets), totalLiabilities = sum(liabilities), totalEquity = sum(equity), right = totalLiabilities.plus(totalEquity), difference = totalAssets.minus(right).abs();
  return { asOnDate: fd.asOnDate, assets, liabilities, equity, totalAssets: totalAssets.toNumber(), totalLiabilities: totalLiabilities.toNumber(), totalEquity: totalEquity.toNumber(), totalLiabilitiesAndEquity: right.toNumber(), difference: difference.toNumber(), isBalanced: fd.complete && difference.lt('0.01'), complete: fd.complete, warnings: fd.warnings };
}

async function financialData(db, userId, asOn) {
  const names = { ledger: 'ledgerTransaction', cash: 'cashBookEntry', bank: 'bankBookEntry', banks: 'bankAccount', customers: 'customer', companies: 'company', products: 'product', movements: 'stockMovement', heads: 'accountHead' };
  const values = await Promise.all(Object.entries(names).map(async ([name, model]) => [name, await db[model].findMany({ where: { userId } })]));
  return buildFinancialData(Object.fromEntries(values), asOn);
}
module.exports = { financialData, buildFinancialData, trialBalanceData, balanceSheetData };
