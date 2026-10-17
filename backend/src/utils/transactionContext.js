const { AsyncLocalStorage } = require('async_hooks');
const context = new AsyncLocalStorage();

// Existing controller transactions join the outer posting transaction.
// Reads before their inner $transaction therefore share the same tenant lock.
function contextualClient(root) {
  return new Proxy(root, {
    get(target, property) {
      const tx = context.getStore();
      if (property === '$transaction' && tx) return async (work) => typeof work === 'function' ? work(tx) : Promise.all(work);
      const owner = tx && property !== '$transaction' && property !== 'pool' && property !== 'prisma' ? tx : target;
      if (property === 'prisma') return contextualClient(target);
      const value = owner[property];
      return typeof value === 'function' ? value.bind(owner) : value;
    },
  });
}

async function tenantTransaction(prisma, userId, work) {
  if (context.getStore()) return work();
  return prisma.$transaction(async (tx) => {
    if (!process.env.DATABASE_URL?.startsWith('file:')) {
      // Serializes participating mutations across processes, not just one server.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
    }
    return context.run(tx, work);
  }, { maxWait: 15000, timeout: 60000 });
}

module.exports = { contextualClient, tenantTransaction };
