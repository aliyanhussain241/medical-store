// Read-only release verification: execute the actual minified request interceptor
// with a fake transport. No requests, database access or artifact writes occur.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.join(__dirname, '../..');
const publicDir = path.join(root, 'backend/public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map((match) => match[1]);
assert.ok(assets.length);
for (const asset of assets) assert.ok(fs.existsSync(path.join(publicDir, asset)), `Missing ${asset}`);
const entry = assets.find((asset) => /\/index-[^/]+\.js$/.test(asset));
assert.ok(entry, 'Missing production entry');
const bundle = fs.readFileSync(path.join(publicDir, entry), 'utf8');
const marker = /[\w$]+\.interceptors\.request\.use\(/.exec(bundle);
assert.ok(marker, 'Missing compiled request interceptor');
const starts = [...bundle.slice(0, marker.index).matchAll(/[,;]([\w$]+)=0,[\w$]+=\(\)=>\1;/g)];
assert.ok(starts.length, 'Cannot locate compiled session boundary; review verifier for new bundler output');
const start = starts.at(-1).index + 1;
const responseMarker = /[\w$]+\.interceptors\.response\.use\(/.exec(bundle.slice(marker.index));
assert.ok(responseMarker, 'Missing response boundary');
const end = marker.index + responseMarker.index;
const compiled = 'var ' + bundle.slice(start, end);
const axiosName = /=([\w$]+)\.create\(/.exec(compiled)?.[1];
assert.ok(axiosName);
let intercept;
const writes = [];
const api = { interceptors: { request: { use: (fn) => { intercept = fn; } } }, get: () => ({}) };
for (const method of ['post', 'put', 'patch', 'delete']) api[method] = (url, data, config = {}) => {
  if (method === 'delete') config = data || {};
  const request = intercept({ method, url, data, ...config, headers: config.headers || {} });
  assert.equal(typeof request.headers['Idempotency-Key'], 'string', `${method} ${url}`);
  assert.ok(request.headers['Idempotency-Key'].length);
  writes.push(`${method} ${url}`);
  return request;
};
vm.runInNewContext(compiled, {
  [axiosName]: { create: () => api, CanceledError: Error },
  crypto: require('crypto'), localStorage: { getItem: () => null, removeItem() {} }, FormData,
});
const serviceSource = fs.readFileSync(path.join(root, 'frontend/src/api/services.js'), 'utf8');
const names = [...serviceSource.matchAll(/export const (\w+)/g)].map((match) => match[1]);
const moduleFixture = { exports: {} };
vm.runInNewContext(serviceSource.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + `\nmodule.exports = {${names.join(',')}};`, { api, FormData, module: moduleFixture });
for (const group of Object.values(moduleFixture.exports)) for (const method of Object.values(group)) method();
assert.ok(writes.length > 30, 'Expected coverage of all business save services');
assert.equal(intercept({ method: 'POST', url: '/fixture', data: {}, headers: { 'Idempotency-Key': 'explicit-key' } }).headers['Idempotency-Key'], 'explicit-key');
console.log(`PASS: ${assets.length} HTML asset references exist; actual compiled interceptor adds Idempotency-Key to all ${writes.length} mutating service calls and preserves explicit keys.`);
console.log(`Production entry: ${entry}`);
