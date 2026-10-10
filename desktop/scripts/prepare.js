// ─────────────────────────────────────────────────────────────
// desktop/scripts/prepare.js
// Prepares the desktop build:
// 1. Copies backend source code (minus pg-specific files)
// 2. Builds frontend into desktop/backend/public/
// 3. Generates Prisma Client for SQLite
// ─────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');
const BACKEND_DST = path.join(DESKTOP, 'backend', 'src');

// ── Utility: recursive copy ─────────────────────────────────
function copyDir(src, dst, opts = {}) {
  const { exclude = [] } = opts;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    // Skip excluded paths
    if (exclude.some(ex => srcPath.includes(ex))) continue;

    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath, opts);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('🔧 Preparing MedStore Desktop Build...\n');

// ── Step 1: Copy backend source ──────────────────────────────
console.log('📁 Step 1: Copying backend source...');
// Copy everything except prismaClient.js (we have our own SQLite version)
const prismaClientDst = path.join(BACKEND_DST, 'utils', 'prismaClient.js');
const prismaClientBackup = fs.existsSync(prismaClientDst)
  ? fs.readFileSync(prismaClientDst, 'utf-8')
  : null;

copyDir(BACKEND_SRC, BACKEND_DST, {
  exclude: ['node_modules'],
});

// Restore our custom SQLite prismaClient.js (don't overwrite it with the pg version)
if (prismaClientBackup) {
  fs.writeFileSync(prismaClientDst, prismaClientBackup, 'utf-8');
}
console.log('   ✅ Backend source copied (prismaClient.js kept as SQLite version)\n');

// ── Step 2: Copy built frontend (public/) ─────────────────────
console.log('📁 Step 2: Building frontend...');
const FRONTEND = path.join(ROOT, 'frontend');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

// Copy built files to desktop/backend/public/
const publicSrc = path.join(ROOT, 'backend', 'public');
const publicDst = path.join(DESKTOP, 'backend', 'public');
copyDir(publicSrc, publicDst);
console.log('   ✅ Frontend built and copied to desktop/backend/public/\n');

// ── Step 3: Generate Prisma Client for SQLite ─────────────────
console.log('📦 Step 3: Generating Prisma Client for SQLite...');
const schemaPath = path.join(DESKTOP, 'prisma', 'schema.prisma');
execSync(`npx prisma generate --schema="${schemaPath}"`, {
  cwd: DESKTOP,
  stdio: 'inherit',
});
console.log('   ✅ Prisma Client generated for SQLite\n');

// ── Step 4: Create template SQLite database ───────────────────
console.log('📦 Step 4: Creating template database...');
const templateDbPath = path.join(DESKTOP, 'template.db');
// Remove old template if exists
if (fs.existsSync(templateDbPath)) fs.unlinkSync(templateDbPath);

execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
  cwd: DESKTOP,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: `file:${templateDbPath}` },
});
console.log('   ✅ Template database created (schema applied)\n');

console.log('🎉 Desktop build preparation complete!');
console.log('   Run "npm run build" to create the .exe installer.\n');

