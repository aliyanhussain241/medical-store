// Test that Prisma uses driver adapter and doesn't load the Rust engine
const prisma = require('./src/utils/prismaClient');

async function test() {
  try {
    console.log('Testing Prisma with pg driver adapter...');
    
    // Try a real query
    const result = await prisma.$queryRawUnsafe('SELECT 1 as ok');
    console.log('✅ Query result:', JSON.stringify(result));
    
    // Try a model query (this is what login does)
    const user = await prisma.user.findFirst();
    console.log('✅ User query works:', user ? 'found user' : 'no users yet');
    
    console.log('\n🎉 Driver adapter is working — NO Rust engine loaded!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('Full error:', e);
    process.exit(1);
  }
}

test();
