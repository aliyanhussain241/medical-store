const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

async function backupSqlite({ prisma, PrismaClient, backupDir }) {
  const root = path.resolve(backupDir);
  const name = `medstore-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.db`;
  const finalPath = path.join(root, name);
  const temporaryPath = path.join(root, `.pending-${randomUUID()}.db`);
  const inside = (target) => path.dirname(path.resolve(target)) === root;
  if (!inside(finalPath) || !inside(temporaryPath)) throw new Error('Invalid backup destination.');
  let verification;
  try {
    // SQLite creates a consistent snapshot, including committed WAL contents.
    // VACUUM INTO must run outside a transaction; the target must not exist.
    await prisma.$executeRawUnsafe('VACUUM INTO ?', temporaryPath);
    verification = new PrismaClient({ datasources: { db: { url: `file:${temporaryPath}` } } });
    const integrity = await verification.$queryRawUnsafe('PRAGMA integrity_check');
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('Backup integrity verification failed.');
    const violations = await verification.$queryRawUnsafe('PRAGMA foreign_key_check');
    if (violations.length) throw new Error('Backup contains foreign-key violations.');
    await verification.$disconnect(); verification = null;
    fs.renameSync(temporaryPath, finalPath);
    // Rotate only after the new snapshot passes verification. Never delete files
    // outside the dedicated backup folder or unrelated .db files.
    const backups = fs.readdirSync(root).filter((f) => /^medstore-backup-[\w.-]+\.db$/.test(f)).sort().reverse();
    for (const old of backups.slice(10)) {
      const target = path.join(root, old);
      if (inside(target)) fs.unlinkSync(target);
    }
    return finalPath;
  } finally {
    if (verification) await verification.$disconnect();
    if (fs.existsSync(temporaryPath) && inside(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
module.exports = { backupSqlite };
