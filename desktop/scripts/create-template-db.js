// Create template.db with schema
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const dbPath = path.join(desktopDir, 'template.db');
const schemaPath = path.join(desktopDir, 'prisma', 'schema.prisma');

// Delete old template if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Deleted old template.db');
}

// Use absolute file path for SQLite
const dbUrl = `file:${dbPath}`;
console.log('Schema:', schemaPath);
console.log('DB URL:', dbUrl);
console.log('');

execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
  cwd: desktopDir,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: dbUrl },
});

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`\n✅ template.db created (${stats.size} bytes)`);
} else {
  // Prisma might have created it relative to schema dir
  const altPath = path.join(desktopDir, 'prisma', 'template.db');
  if (fs.existsSync(altPath)) {
    fs.renameSync(altPath, dbPath);
    console.log(`\n✅ template.db found in prisma/ dir, moved to root`);
  } else {
    console.log('\n❌ template.db still not found!');
    // List all .db files
    const findDb = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (f.endsWith('.db')) console.log('  Found:', fp);
        if (fs.statSync(fp).isDirectory() && !f.startsWith('node_modules') && !f.startsWith('.') && f !== 'dist') {
          findDb(fp);
        }
      }
    };
    console.log('Searching for .db files:');
    findDb(desktopDir);
  }
}
