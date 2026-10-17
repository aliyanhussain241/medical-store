// In-memory controller tracing only: every application database import is
// intercepted before loading PrismaClient. This never loads dotenv or a URL.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { D } = require('../src/services/statementService');

function memoryDatabase() {
  const tables = Object.fromEntries(['invoice', 'invoiceItem', 'purchase', 'purchaseItem', 'product', 'customer', 'company', 'bankAccount', 'cashBookEntry', 'bankBookEntry', 'ledgerTransaction', 'stockMovement', 'dailyProfit', 'auditEvent', 'idempotencyRecord', 'accountHead', 'salaryPayment', 'employee', 'refreshToken', 'user'].map((n) => [n, []]));
  let seq = 0;
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === 'OR') return value.some((v) => matches(row, v));
      if (key === 'AND') return value.every((v) => matches(row, v));
      if (key.includes('_') && !(key in row)) return matches(row, value);
      if (value instanceof Date) return new Date(row[key]).getTime() === value.getTime();
      if (value && typeof value === 'object' && !D.isDecimal?.(value)) {
        if ('in' in value && !value.in.includes(row[key])) return false;
        if ('gte' in value && D(row[key]).lt(value.gte)) return false;
        if ('gt' in value && D(row[key]).lte(value.gt)) return false;
        if ('lte' in value && D(row[key]).gt(value.lte)) return false;
        if ('not' in value && row[key] === value.not) return false;
        return true;
      }
      return String(row[key]) === String(value);
    });
  }
  const db = {};
  function findRows(name, options = {}) {
    const rows = tables[name].filter((r) => matches(r, options.where));
    const order = options.orderBy ? (Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]) : [];
    rows.sort((a, b) => {
      for (const item of order) for (const [key, direction] of Object.entries(item)) {
        const left = a[key] instanceof Date ? a[key].getTime() : a[key], right = b[key] instanceof Date ? b[key].getTime() : b[key];
        const result = left < right ? -1 : left > right ? 1 : 0;
        if (result) return direction === 'desc' ? -result : result;
      }
      return 0;
    });
    return rows.slice(options.skip || 0, options.take ? (options.skip || 0) + options.take : undefined);
  }
  function withRelations(name, row, options = {}) {
    if (!row) return null;
    const result = { ...row };
    if (options.select) return Object.fromEntries(Object.keys(options.select).map((key) => [key, result[key]]));
    if (options.include?.items && ['invoice', 'purchase'].includes(name)) result.items = tables[name + 'Item'].filter((i) => i[name + 'Id'] === row.id).map((i) => ({ ...i, product: tables.product.find((p) => p.id === i.productId) || null }));
    if (options.include?.customer) result.customer = tables.customer.find((c) => c.id === row.customerId);
    if (options.include?.company) result.company = tables.company.find((c) => c.id === row.companyId);
    return result;
  }
  for (const name of Object.keys(tables)) {
    db[name] = {
      findMany: async (opts = {}) => findRows(name, opts).map((r) => withRelations(name, r, opts)),
      findFirst: async (opts = {}) => withRelations(name, findRows(name, opts)[0], opts),
      findUnique: async (opts) => withRelations(name, tables[name].find((r) => matches(r, opts.where)), opts),
      count: async (opts = {}) => tables[name].filter((r) => matches(r, opts.where)).length,
      create: async ({ data, ...opts }) => {
        const record = { id: String(++seq), createdAt: new Date(), ...data };
        delete record.items;
        tables[name].push(record);
        if (data.items) for (const item of data.items.create) await db[name + 'Item'].create({ data: { ...item, [name + 'Id']: record.id } });
        return withRelations(name, record, opts);
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of tables[name].filter((r) => matches(r, where))) {
          count++;
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && ('increment' in value || 'decrement' in value)) r[key] = D(r[key]).plus(value.increment || 0).minus(value.decrement || 0).toString();
            else r[key] = value;
          }
        }
        return { count };
      },
      update: async ({ where, data, ...opts }) => {
        const row = tables[name].find((r) => matches(r, where)); if (!row) throw Error('Missing ' + name);
        const items = data.items;
        const scalar = { ...data }; delete scalar.items;
        await db[name].updateMany({ where, data: scalar });
        if (items) for (const item of items.create) await db[name + 'Item'].create({ data: { ...item, [name + 'Id']: row.id } });
        return withRelations(name, row, opts);
      },
      deleteMany: async ({ where }) => { const old = tables[name].length; tables[name] = tables[name].filter((r) => !matches(r, where)); return { count: old - tables[name].length }; },
      upsert: async ({ where, create, update }) => (await db[name].findUnique({ where })) ? db[name].update({ where, data: update }) : db[name].create({ data: create }),
    };
  }
  db.$transaction = async (work) => {
    const before = structuredClone(tables);
    try { return typeof work === 'function' ? await work(db) : await Promise.all(work); }
    catch (error) { for (const name of Object.keys(tables)) tables[name] = before[name]; throw error; }
  };
  db.$queryRaw = async () => [{ locked: 1 }];
  return { db, tables };
}

function loadWithDatabase(file, db, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    const absolute = path.resolve(filename), realRequire = createRequire(absolute);
    if (absolute.endsWith(path.join('utils', 'db.js'))) return db;
    if (overrides[absolute]) return overrides[absolute];
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const requireStub = (id) => {
      if (!id.startsWith('.')) return realRequire(id);
      const resolved = realRequire.resolve(id);
      return resolved.includes(path.join('backend', 'src')) ? load(resolved) : realRequire(id);
    };
    vm.runInThisContext('(function(require,module,exports,__filename,__dirname){' + fs.readFileSync(absolute, 'utf8') + '\n})', { filename: absolute })(requireStub, module, module.exports, absolute, path.dirname(absolute));
    return module.exports;
  }
  return load(file);
}

async function invoke(handler, body, { userId = 'owner', id, key = require('crypto').randomUUID(), url = '/api/invoices', method = 'POST', file } = {}) {
  let response, status = 200, failure;
  await handler({ body, user: { id: userId }, params: { id }, method, originalUrl: url, get: (name) => name === 'Idempotency-Key' ? key : undefined, file }, { status(code) { status = code; return this; }, json(value) { response = value; } }, (error) => { failure = error; });
  if (failure) throw failure;
  return { status, ...response };
}
module.exports = { memoryDatabase, loadWithDatabase, invoke };
