const { createHash } = require('crypto');

const fs = require('fs');
const path = require('path');
const { parse } = require('dotenv');

function readTargets() {
  const root = path.join(__dirname, '..');
  const testPath = path.join(root, '.env.test');
  if (!fs.existsSync(testPath)) throw new Error('Refusing database access: backend/.env.test is missing.');
  const test = parse(fs.readFileSync(testPath));
  const production = fs.existsSync(path.join(root, '.env')) ? parse(fs.readFileSync(path.join(root, '.env'))) : {};
  return { test, production };
}

function endpoint(value) {
  return new URL(value).hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
}

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

function requireTestDatabase(env = process.env, { writes = true, sources } = {}) {
  const { test, production } = sources || readTargets();
  const target = test.TEST_DATABASE_URL || test.DATABASE_URL;
  if (!target) throw new Error('Refusing database access: backend/.env.test has no database URL.');
  try {
    identityHash(target);
    if (test.TEST_DATABASE_URL && test.DATABASE_URL && test.TEST_DATABASE_URL !== test.DATABASE_URL) throw new Error('Conflicting test URLs.');
    for (const [name, value] of Object.entries(production)) {
      if (name.startsWith('DATABASE_URL') && value && endpoint(value) === endpoint(target)) throw new Error('Production endpoint.');
    }
    if (env.TEST_DATABASE_URL && env.TEST_DATABASE_URL !== target) throw new Error('Test URL override.');
  } catch {
    throw new Error('Refusing database access: invalid test URL, conflicting override, unsupported URL parameters, or production host.');
  }
  if (writes && env.ALLOW_TEST_DATABASE_WRITES !== 'yes') throw new Error('Refusing database writes: explicit test-write authorization is missing.');
  return target;
}

module.exports = { requireTestDatabase, identityHash };
