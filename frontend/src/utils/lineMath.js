// F14: integer minor-unit arithmetic mirrors the server's documented rule:
// round gross to cents, round the discount to cents, then subtract.
function scaled(value, places) {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(String(value || 0));
  if (!match || (match[2] || '').length > places) return 0n;
  return BigInt(match[1]) * (10n ** BigInt(places)) + BigInt((match[2] || '').padEnd(places, '0') || '0');
}
const rounded = (value, divisor) => (value + divisor / 2n) / divisor;
export function lineMoney(qty, price, discount = 0) {
  const gross = rounded(scaled(qty, 3) * scaled(price, 2), 1000n);
  const reduction = rounded(gross * scaled(discount, 2), 10000n);
  return { gross: Number(gross) / 100, discount: Number(reduction) / 100, total: Number(gross - reduction) / 100, cents: gross - reduction };
}
export function invoiceMoney(items) {
  return Number(items.reduce((sum, item) => sum + lineMoney(item.qty, item.unitPrice, item.discount).cents, 0n)) / 100;
}
