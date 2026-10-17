// Explicit creation of a new, empty packaging template. Never uses DATABASE_URL
// from the environment and never overwrites an existing SQLite database.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const target = path.join(root, 'template.db');
if (fs.existsSync(target)) throw new Error('Refusing to overwrite template.db. Review the existing template separately.');
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: `file:${target}` },
});
process.exitCode = result.status ?? 1;
