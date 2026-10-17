const { createHash } = require('crypto');

// Empty until the owner supplies the disposable Neon target. Add only its
// identity hash after reviewing that URL; never infer it from DATABASE_URL.
const APPROVED_TEST_TARGETS = Object.freeze([]);

function identityHash(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Only an explicitly approved PostgreSQL test target is supported.');
  // pg/libpq URL query parameters can override hostname/database/user (or route
  // a Neon endpoint through options). Never approve a URL by hostname alone
  // while allowing a query parameter to silently change its destination.
  for (const [key, option] of url.searchParams) {
    if (key === 'sslmode' && ['require', 'verify-full'].includes(option)) continue;
    if (key === 'channel_binding' && ['require', 'prefer'].includes(option)) continue;
    throw new Error('Refusing database access: routing or unsupported URL query parameters are not allowed.');
  }
  return createHash('sha256').update([url.hostname.toLowerCase(), url.port || '5432', url.pathname, decodeURIComponent(url.username)].join('|')).digest('hex');
}

function requireTestDatabase(env = process.env, { writes = true } = {}) {
  if (!env.TEST_DATABASE_URL) throw new Error('Refusing database access: TEST_DATABASE_URL was not supplied.');
  const hash = identityHash(env.TEST_DATABASE_URL);
  if (!APPROVED_TEST_TARGETS.includes(hash)) throw new Error('Refusing database access: target is not the owner-approved disposable database.');
  if (writes && env.ALLOW_TEST_DATABASE_WRITES !== 'yes') throw new Error('Refusing database writes: explicit test-write authorization is missing.');
  return env.TEST_DATABASE_URL;
}

module.exports = { requireTestDatabase, identityHash };
