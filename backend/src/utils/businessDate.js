const ZONE = 'Asia/Karachi';

function businessDay(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Object.assign(new Error('Invalid business date.'), { statusCode: 400 });
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error('Invalid date.'), { statusCode: 400 });
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function dateOnly(value) {
  return new Date(`${businessDay(value)}T00:00:00.000Z`);
}

function dateRange(from, to) {
  if (from && to && businessDay(from) > businessDay(to)) throw Object.assign(new Error('From date must not exceed to date.'), { statusCode: 400 });
  return { ...(from && { gte: dateOnly(from) }), ...(to && { lte: dateOnly(to) }) };
}

module.exports = { businessDay, dateOnly, dateRange };
