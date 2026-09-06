// ─────────────────────────────────────────────────────────────
// src/utils/numberUtils.js
// Decimal-safe arithmetic helpers (avoids floating point errors)
// All monetary calculations use Decimal.js via Prisma's Decimal type
// ─────────────────────────────────────────────────────────────
const { Decimal } = require('@prisma/client/runtime/library');

/**
 * Calculate line item total:
 *   total = qty * unitPrice * (1 - discount/100)
 * Returns Prisma-compatible Decimal string
 */
function calcLineTotal(qty, unitPrice, discountPct = 0) {
  const q = new Decimal(qty.toString());
  const p = new Decimal(unitPrice.toString());
  const d = new Decimal(discountPct.toString());
  const multiplier = new Decimal(1).minus(d.div(100));
  return q.mul(p).mul(multiplier).toDecimalPlaces(2).toString();
}

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

module.exports = { calcLineTotal, sumDecimals, formatPKR };
