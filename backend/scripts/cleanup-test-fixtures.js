// Removes only tenants created by this audit's integration harness. This is not
// demo-data cleanup or a historical repair; the same strict target guard applies.
const { requireTestDatabase } = require('../test/databaseTarget');
if (process.env.DATABASE_URL !== requireTestDatabase()) throw new Error('Wrong cleanup target.');
const db = require('../src/utils/prismaClient');
async function run() {
  try {
    const users = await db.user.findMany({ where: {
      businessName: { in: ['Audit report fixture', 'Disposable audit fixture', 'Foreign fixture'] },
      email: { endsWith: '@test.invalid' }, passwordHash: 'not-a-login-hash', ownerName: 'Fixture',
    }, select: { id: true } });
    for (const user of users) {
      await db.$transaction(async (tx) => {
        await tx.purchase.deleteMany({ where: { userId: user.id } });
        await tx.invoice.deleteMany({ where: { userId: user.id } });
        await tx.auditEvent.deleteMany({ where: { userId: user.id } });
        await tx.idempotencyRecord.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });
      }, { timeout: 60000 });
    }
    console.log(`Removed ${users.length} audit-created fixture tenants; existing demo tenants untouched.`);
  } finally { await db.$disconnect(); await db.pool.end(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
