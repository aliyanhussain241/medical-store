const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { memoryDatabase, loadWithDatabase, invoke } = require('./controllerHarness');

test('S06: simultaneous issued refresh tokens differ; rotation consumes old token once', async () => {
  const { db, tables } = memoryDatabase();
  process.env.JWT_SECRET = 'test-only-access-secret'; process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret';
  const bcrypt = require('bcryptjs');
  await db.user.create({ data: { id: 'owner', email: 'owner@test.invalid', passwordHash: await bcrypt.hash('valid-password', 4) } });
  const auth = loadWithDatabase(path.join(__dirname, '../src/controllers/authController.js'), db);
  const first = await invoke(auth.login, { email: 'owner@test.invalid', password: 'valid-password' });
  const second = await invoke(auth.login, { email: 'owner@test.invalid', password: 'valid-password' });
  assert.notEqual(first.refreshToken, second.refreshToken);
  const rotated = await invoke(auth.refresh, { refreshToken: first.refreshToken });
  assert.equal(rotated.success, true);
  await assert.rejects(invoke(auth.refresh, { refreshToken: first.refreshToken }), /Session expired/);
  assert.equal(tables.refreshToken.length, 2);
});

test('S03: password-change validation rejects short passwords without changing hash', async () => {
  const { db, tables } = memoryDatabase(), bcrypt = require('bcryptjs');
  await db.user.create({ data: { id: 'owner', passwordHash: await bcrypt.hash('valid-password', 4) } });
  const auth = loadWithDatabase(path.join(__dirname, '../src/controllers/authController.js'), db);
  const { body } = require('express-validator');
  const req = { user: { id: 'owner' }, body: { currentPassword: 'valid-password', newPassword: 'x' } };
  await body('newPassword').isLength({ min: 8 }).run(req);
  let status;
  await auth.changePassword(req, { status: (value) => { status = value; return { json() {} }; } }, (error) => { throw error; });
  assert.equal(status, 400); assert.equal(await bcrypt.compare('valid-password', tables.user[0].passwordHash), true);
});

function clientFixture() {
  const storage = new Map([['accessToken', 'old'], ['refreshToken', 'old-refresh'], ['unrelated', 'keep']]);
  const hooks = {}, api = { interceptors: { request: { use: (fn) => { hooks.request = fn; } }, response: { use: (success, error) => { hooks.success = success; hooks.error = error; } } } };
  const axios = { create: () => api, CanceledError: class extends Error {}, post: () => {} };
  const localStorage = { getItem: (k) => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: (k) => storage.delete(k) };
  const session = fs.readFileSync(path.join(__dirname, '../../frontend/src/api/session.js'), 'utf8').replaceAll('export ', '');
  const client = fs.readFileSync(path.join(__dirname, '../../frontend/src/api/client.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace("import.meta.env.VITE_API_URL || '/api'", "'/api'").replace('export default api;', '');
  const context = { axios, localStorage, crypto: require('crypto'), window: { location: {} }, module: { exports: {} } };
  vm.runInNewContext(session + '\n' + client + '\nmodule.exports = { clearSession, sessionEpoch };', context);
  return { storage, hooks, axios, ...context.module.exports };
}

test('F16: old responses cannot enter a new session; only owned storage keys are removed', () => {
  const f = clientFixture(), config = f.hooks.request({ method: 'get', headers: {} });
  f.clearSession();
  assert.equal(f.storage.get('unrelated'), 'keep');
  assert.throws(() => f.hooks.success({ config }), /Session changed/);
});

test('F16: an old refresh completion cannot overwrite or clear a later session', async () => {
  const f = clientFixture(), config = f.hooks.request({ method: 'get', headers: {} });
  let resolve;
  f.axios.post = () => new Promise((done) => { resolve = done; });
  const pending = f.hooks.error({ config, response: { status: 401, data: { code: 'TOKEN_EXPIRED' } } });
  f.clearSession(); f.storage.set('accessToken', 'new-user'); f.storage.set('refreshToken', 'new-user-refresh');
  resolve({ data: { accessToken: 'old-result', refreshToken: 'old-refresh-result' } });
  await assert.rejects(pending, /Session changed/);
  assert.equal(f.storage.get('accessToken'), 'new-user'); assert.equal(f.storage.get('refreshToken'), 'new-user-refresh');
});

test('F05: concurrent duplicate writes and retries after unknown network outcomes reuse one key', async () => {
  const f = clientFixture();
  const request = () => f.hooks.request({ method: 'post', url: '/purchases', data: { amount: 10 }, headers: {} });
  const first = request(), second = request();
  assert.equal(first.headers['Idempotency-Key'], second.headers['Idempotency-Key']);
  await assert.rejects(f.hooks.error({ config: first }), /./);
  assert.equal(request().headers['Idempotency-Key'], first.headers['Idempotency-Key']);
  f.hooks.success({ config: second });
  assert.notEqual(request().headers['Idempotency-Key'], first.headers['Idempotency-Key']);
});
