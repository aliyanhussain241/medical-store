// This guard runs before loading Prisma, dotenv, the application, or test code.
const { requireTestDatabase } = require('../test/databaseTarget');
const { spawnSync } = require('child_process');
try {
  const url = requireTestDatabase();
  const args = process.argv.includes('--init') ? [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'] : process.argv.includes('--seed') ? ['prisma/seed.js'] : process.argv.includes('--migrate')
    ? [require.resolve('prisma/build/index.js'), 'db', 'execute', '--schema=prisma/schema.prisma', '--file=prisma/posting-safety.sql']
    : ['--test', 'test/database.integration.js'];
  const result = spawnSync(process.execPath, args, { cwd: require('path').join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' } });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
