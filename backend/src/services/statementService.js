const { Decimal } = require('@prisma/client/runtime/library');
const { businessDay, dateRange } = require('../utils/businessDate');

const D = (value = 0) => new Decimal(value || 0);

// Legacy supplier writes used debit for purchases. Normalize on READ only;
// historical rows are never rewritten. New posting references are explicit.
function ledgerAmounts(row, partyType) {
  const legacySupplier = partyType === 'COMPANY' && ['PURCHASE', 'PAYMENT', 'OPENING_BALANCE'].includes(row.referenceType);
  return legacySupplier ? { debit: D(row.credit), credit: D(row.debit) } : { debit: D(row.debit), credit: D(row.credit) };
}

function statement(rows, { opening = 0, from, to, page = 1, limit, kind = 'ledger', partyType } = {}) {
  dateRange(from, to);
  const sorted = [...rows].sort((a, b) => businessDay(a.transactionDate).localeCompare(businessDay(b.transactionDate)) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
  let balance = D(opening), openingBalance = D(opening), debit = D(0), credit = D(0);
  const transactions = [];
  for (const row of sorted) {
    const day = businessDay(row.transactionDate);
    if (to && day > to) continue;
    const amounts = kind === 'cash' ? { debit: D(row.cashIn), credit: D(row.cashOut) } : ledgerAmounts(row, partyType);
    balance = balance.plus(amounts.debit).minus(amounts.credit);
    if (from && day < from) { openingBalance = balance; continue; }
    debit = debit.plus(amounts.debit); credit = credit.plus(amounts.credit);
    transactions.push({ ...row, ...(kind !== 'cash' && { debit: amounts.debit.toFixed(2), credit: amounts.credit.toFixed(2) }), runningBalance: balance.toFixed(2) });
  }
  const start = limit ? (page - 1) * limit : 0;
  const entries = (limit ? transactions.slice(start, start + limit) : transactions).map((row, i) => ({ ...row, seq: start + i + 1 }));
  return {
    entries, transactions: entries, total: transactions.length,
    openingBalance: openingBalance.toFixed(2),
    pageOpeningBalance: (start > 0 ? D(transactions[Math.min(start, transactions.length) - 1]?.runningBalance ?? openingBalance) : openingBalance).toFixed(2),
    summary: { totalDebit: debit.toFixed(2), totalCredit: credit.toFixed(2), totalIn: debit.toFixed(2), totalOut: credit.toFixed(2), net: debit.minus(credit).toFixed(2), closingBalance: balance.toFixed(2) },
  };
}

function openingFallback(entity, rows) {
  // Persisted opening entries already contain this amount.
  return rows.some((r) => ['OPENING_BALANCE', 'OPENING_BALANCE_V2'].includes(r.referenceType)) ? 0 : entity.openingBalance;
}

async function partyStatement(db, userId, partyType, id, options = {}) {
  const entity = await db[partyType === 'CUSTOMER' ? 'customer' : 'company'].findFirst({ where: { id, userId } });
  if (!entity) throw Object.assign(new Error('Party not found.'), { statusCode: 404 });
  const rows = await db.ledgerTransaction.findMany({ where: { userId, partyType, partyId: id } });
  const fallback = options.to && businessDay(entity.createdAt) > options.to ? 0 : openingFallback(entity, rows);
  const opening = partyType === 'COMPANY' ? D(fallback).negated() : fallback;
  return { [partyType === 'CUSTOMER' ? 'customer' : 'company']: entity, ...statement(rows, { ...options, opening, partyType }) };
}

async function bankStatement(db, userId, id, options = {}) {
  const bankAccount = await db.bankAccount.findFirst({ where: { id, userId } });
  if (!bankAccount) throw Object.assign(new Error('Bank account not found.'), { statusCode: 404 });
  const rows = await db.bankBookEntry.findMany({ where: { userId, bankAccountId: id } });
  const opening = options.to && businessDay(bankAccount.createdAt) > options.to ? 0 : openingFallback(bankAccount, rows);
  return { bankAccount, ...statement(rows, { ...options, opening }) };
}

async function cashStatement(db, userId, options = {}) {
  return statement(await db.cashBookEntry.findMany({ where: { userId } }), { ...options, kind: 'cash' });
}

module.exports = { D, ledgerAmounts, statement, openingFallback, partyStatement, bankStatement, cashStatement };
