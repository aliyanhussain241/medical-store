const { Decimal } = require('@prisma/client/runtime/library');
const { businessDay } = require('./businessDate');

function bad(message) { throw Object.assign(new Error(message), { statusCode: 400 }); }
function number(value, name, { min = 0, max = '9999999999999.99', optional = false, scale = 2 } = {}) {
  if (scale === 3 && max === '9999999999999.99') max = '999999999999.999';
  if (optional && (value === undefined || value === null || value === '')) return new Decimal(0);
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') bad(`${name} must be a number.`);
  let result;
  try { result = new Decimal(value); } catch { bad(`${name} must be a finite number.`); }
  if (!result.isFinite() || result.lt(min) || result.gt(max) || result.decimalPlaces() > scale) bad(`${name} is out of range (maximum ${scale} decimal places).`);
  return result;
}
function text(value, name, { optional = false, max = 1000 } = {}) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) bad(`${name} is required and must be at most ${max} characters.`);
  return value.trim();
}
function enumeration(value, choices, name, fallback) {
  const result = value === undefined ? fallback : value;
  if (typeof result !== 'string' || !choices.includes(result.toUpperCase())) bad(`Invalid ${name}.`);
  return result.toUpperCase();
}
function paging(query) {
  for (const [name, fallback] of [['page', 1], ['limit', 50]]) {
    const value = query[name] ?? fallback;
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > (name === 'limit' ? 1000 : 1000000)) bad(`Invalid ${name}.`);
  }
  return { page: Number(query.page || 1), limit: Number(query.limit || 50) };
}
function validateQuery(req, _res, next) {
  try {
    paging(req.query);
    for (const key of ['from', 'to', 'asOn']) if (req.query[key]) {
      if (typeof req.query[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.query[key])) bad(`Invalid ${key}.`);
      businessDay(req.query[key]);
    }
    if (req.query.from && req.query.to && req.query.from > req.query.to) bad('From date must not exceed to date.');
    if (req.query.status && !['PAID', 'PENDING', 'PARTIAL', 'OVERDUE'].includes(req.query.status)) bad('Invalid payment status.');
    next();
  } catch (error) { next(error); }
}
module.exports = { bad, number, text, enumeration, paging, validateQuery };
