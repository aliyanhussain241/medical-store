// ─────────────────────────────────────────────────────────────
// src/utils/numberUtils.js
// Decimal-safe arithmetic helpers (avoids floating point errors)
// All monetary calculations use Decimal.js via Prisma's Decimal type
// ─────────────────────────────────────────────────────────────
const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Calculate line item total:
 *   gross = round(qty * unitPrice, 2)
 *   total = gross - round(gross * discount/100, 2), half-up
 * Returns Prisma-compatible Decimal string
 */
function calculateLine(qty, unitPrice, discountPct = 0) {
  const q = new Decimal(qty.toString());
  const p = new Decimal(unitPrice.toString());
  const d = new Decimal(discountPct.toString());
  const grossTotal = q.mul(p).toDecimalPlaces(2);
  const discountAmt = grossTotal.mul(d).div(100).toDecimalPlaces(2);
  return { grossTotal: grossTotal.toFixed(2), discountAmt: discountAmt.toFixed(2), total: grossTotal.minus(discountAmt).toFixed(2) };
}
function calcLineTotal(qty, unitPrice, discountPct = 0) { return calculateLine(qty, unitPrice, discountPct).total; }

/**
 * Sum an array of Decimal-compatible values safely
 */
function sumDecimals(values) {
  return values
    .reduce((acc, v) => acc.plus(new Decimal(v.toString())), new Decimal(0))
    .toDecimalPlaces(2)
    .toString();
}

/**
 * Format a Decimal or number as a Pakistani Rupees string
 */
function formatPKR(value) {
  const num = parseFloat(value.toString());
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
  }).format(num);
}

module.exports = { calculateLine, calcLineTotal, sumDecimals, formatPKR };
