// Deferred until the owner authorizes test execution by providing the disposable
// target. This test creates only temporary SQLite files, never the user's DB.
require('./databaseTarget').requireTestDatabase();
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PrismaClient } = require('../../desktop/generated/prisma-client');
const { backupSqlite } = require('../src/utils/sqliteBackup');

test('D01: committed WAL rows survive SQLite snapshot and isolated restore', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'medstore-backup-test-'));
  const source = new PrismaClient({ datasources: { db: { url: `file:${path.join(root, 'source.db')}` } } });
  let restored;
  try {
    await source.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await source.$executeRawUnsafe('CREATE TABLE backup_fixture (id INTEGER PRIMARY KEY, amount INTEGER NOT NULL)');
    await source.$executeRawUnsafe('INSERT INTO backup_fixture VALUES (1, 100)');
    const target = await backupSqlite({ prisma: source, PrismaClient, backupDir: root });
    await source.$executeRawUnsafe('INSERT INTO backup_fixture VALUES (2, 200)');
    restored = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
    const rows = await restored.$queryRawUnsafe('SELECT id, amount FROM backup_fixture ORDER BY id');
    assert.equal(rows.length, 1); assert.equal(Number(rows[0].amount), 100);
    const integrity = await restored.$queryRawUnsafe('PRAGMA integrity_check');
    assert.equal(Object.values(integrity[0])[0], 'ok');
  } finally {
    if (restored) await restored.$disconnect();
    await source.$disconnect();
    // Fixed test prefix and resolved OS temporary directory only.
    if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('medstore-backup-test-')) fs.rmSync(root, { recursive: true, force: true });
  }
});
