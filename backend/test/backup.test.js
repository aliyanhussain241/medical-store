const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function harness(ok) {
  const calls = [];
  const fakeFs = {
    existsSync: () => true, renameSync: (...args) => calls.push(['rename', ...args]), readdirSync: () => [], unlinkSync: (...args) => calls.push(['remove', ...args]),
  };
  class Verification {
    async $queryRawUnsafe(sql) { calls.push([sql]); return sql === 'PRAGMA integrity_check' ? [{ integrity_check: ok ? 'ok' : 'corrupt' }] : []; }
    async $disconnect() { calls.push(['disconnect']); }
  }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/utils/sqliteBackup.js'), 'utf8'), { module, require: (id) => id === 'fs' ? fakeFs : require(id), Date });
  return { calls, run: () => module.exports.backupSqlite({ prisma: { $executeRawUnsafe: async (...args) => calls.push(args) }, PrismaClient: Verification, backupDir: path.join(__dirname, 'in-memory-only') }) };
}
test('D01: backup uses a bound VACUUM snapshot; verifies integrity before publishing', async () => {
  const f = harness(true); await f.run();
  assert.equal(f.calls[0][0], 'VACUUM INTO ?');
  const verify = f.calls.findIndex((c) => c[0] === 'PRAGMA integrity_check'), publish = f.calls.findIndex((c) => c[0] === 'rename');
  assert.ok(verify > 0 && publish > verify);
});
test('D01: failed integrity check never publishes or rotates existing backups', async () => {
  const f = harness(false); await assert.rejects(f.run(), /integrity/);
  assert.equal(f.calls.some((c) => c[0] === 'rename'), false);
  assert.ok(f.calls.filter((c) => c[0] === 'remove').every((c) => path.basename(c[1]).startsWith('.pending-')));
});

test('P01/F03: desktop startup refuses missing metadata without schema mutation', async () => {
  const { ensureSqlitePostingSchema } = require('../src/utils/sqlitePostingSchema');
  const calls = [];
  const db = { $queryRawUnsafe: async (sql) => sql.startsWith('PRAGMA') ? [{ name: 'id' }] : [], $executeRawUnsafe: async (sql) => calls.push(sql) };
  db.$transaction = async (work) => { calls.push('TRANSACTION'); return work(db); };
  await assert.rejects(ensureSqlitePostingSchema({ prisma: db }), /upgrade required/);
  assert.equal(calls.length, 0);
});
