// ─────────────────────────────────────────────────────────────
// desktop/scripts/seed-desktop.js
// Seeds the desktop SQLite database with demo data
// Run: node scripts/seed-desktop.js
// ─────────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');

// Determine DB path — same as main.js logic
const { app } = require('electron');
let dbDir;
try {
  dbDir = path.join(app.getPath('userData'), 'data');
} catch (_) {
  // Running outside Electron — use local path
  dbDir = path.join(__dirname, '..', 'data');
}
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'medstore.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding desktop demo data...\n');
  console.log(`   Database: ${dbPath}\n`);

  const passwordHash = await bcrypt.hash('Demo@12345', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@medicalstore.app' },
    update: {},
    create: {
      businessName: 'Rahmat Medical Wholesale',
      ownerName: 'Muhammad Rahmat',
      email: 'demo@medicalstore.app',
      passwordHash,
      phone: '0300-1234567',
      address: 'Shop 12, Haider Market, Lahore',
      role: 'OWNER',
    },
  });
  console.log(`✅ User: ${user.email}  (Password: Demo@12345)`);

  console.log('\n🎉 Desktop seed complete!');
  console.log('   Email:    demo@medicalstore.app');
  console.log('   Password: Demo@12345\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
