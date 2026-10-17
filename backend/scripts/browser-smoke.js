// Run after npm --prefix frontend run build:
// npm --prefix backend run test:browser
// Requires backend/.env.test and installed Chrome (or CHROME_PATH).
// Uses the production Express/static build on loopback, never a remote app.
const { requireTestDatabase } = require('../test/databaseTarget');
if (process.env.DATABASE_URL !== requireTestDatabase()) throw new Error('Browser test target must match backend/.env.test exactly.');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
const puppeteer = require('puppeteer-core');
const db = require('../src/utils/prismaClient');
const app = require('../src/app');

const routes = ['/dashboard', '/invoicing', '/purchasing', '/customers', '/companies', '/cities', '/inventory', '/ledger/customer', '/ledger/company', '/ledger/bank', '/cash-book', '/bank-accounts', '/payroll', '/chart-of-accounts', '/offer-lists', '/reports', '/reports/party-balance', '/reports/trial-balance', '/reports/balance-sheet'];
const reproduce = process.argv.includes('--expect-dashboard-crash');
async function run() {
  let server, browser;
  const email = `browser-smoke-${randomUUID()}@test.invalid`, password = randomUUID();
  const results = [];
  try {
    const executablePath = [process.env.CHROME_PATH,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].find((candidate) => candidate && fs.existsSync(candidate));
    assert.ok(executablePath, 'Install Chrome or set CHROME_PATH to its executable.');
    const publicDir = path.join(__dirname, '../public');
    assert.ok(fs.existsSync(path.join(publicDir, 'index.html')), 'Build the production frontend first.');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const signup = await fetch(origin + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName: 'Browser smoke fixture', ownerName: 'Browser fixture', email, password }), signal: AbortSignal.timeout(60000) });
    assert.equal(signup.status, 201, 'Throwaway signup must succeed on audit-test.');
    await signup.arrayBuffer();
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking'] });
    console.log(`Browser: ${await browser.version()}; database: guarded audit-test file; app: loopback production build`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    page.setDefaultTimeout(60000);
    let errors = [], apiFailures = [], injectCrash = false;
    page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('response', (response) => { if (response.url().startsWith(origin + '/api/') && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    // Restrict browser traffic to this local app; no external deployment or font
    // service is contacted. Delay stats so the Dashboard loading render is tested.
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin !== origin) return await request.respond({ status: 200, contentType: 'text/css', body: '' });
        if (url.pathname === '/api/dashboard/stats') {
          if (injectCrash) return await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { bankAccounts: {} } }) });
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
        await request.continue();
      } catch (error) { errors.push(`request: ${error.message}`); }
    });
    await page.goto(origin + '/login', { waitUntil: 'networkidle0' });
    await page.type('#login-email', email);
    await page.type('#login-password', password);
    await page.click('#login-btn');
    await page.waitForFunction(() => location.pathname === '/dashboard');
    if (reproduce) {
      await page.waitForFunction(() => document.getElementById('root')?.innerText.trim().length === 0);
      assert.ok(errors.some((error) => /d is not defined/.test(error)), 'Expected the reported pre-fix ReferenceError.');
      console.log('REPRODUCED: login → Dashboard loading → ReferenceError: d is not defined; React root blank.');
      return;
    }
    await page.waitForSelector('.db-root .skeleton', { visible: true, timeout: 10000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 });
    assert.deepEqual(errors, [], 'Initial login/Dashboard must render without errors.');
    console.log('PASS: real login and delayed Dashboard loading state');
    for (const route of routes) {
      errors = []; apiFailures = [];
      try {
        await page.goto(origin + route, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => {
          const content = document.querySelector('.page-content');
          return content && content.innerText.trim().length > 20 && !content.querySelector('.suspense-loader, .spinner, .db-root .skeleton');
        });
        assert.equal(new URL(page.url()).pathname, route, 'Must stay authenticated on the requested route.');
        assert.equal(await page.$('[data-screen-error]'), null, 'Error fallback is not a route pass.');
        assert.deepEqual(errors, [], 'No uncaught or console errors.');
        assert.deepEqual(apiFailures, [], 'No failing API requests.');
        results.push({ route, result: 'PASS', consoleErrors: 0, apiErrors: 0, nonblank: true });
      } catch (error) {
        results.push({ route, result: 'FAIL', detail: [error.message, ...errors, ...apiFailures].join(' | ') });
      }
      console.log(JSON.stringify(results.at(-1)));
    }
    assert.ok(results.every((result) => result.result === 'PASS'), 'At least one route failed.');

    // Prove the real production error boundary catches a render exception, then
    // prove its Reload button recovers. Only this request's response is mocked.
    injectCrash = true; errors = [];
    await page.goto(origin + '/dashboard', { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-screen-error]', { visible: true });
    assert.match(await page.$eval('[data-screen-error]', (element) => element.innerText), /could not be displayed/i);
    injectCrash = false; errors = []; apiFailures = [];
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('[data-screen-error] button')]);
    await page.waitForSelector('.db-welcome-title');
    assert.equal(await page.$('[data-screen-error]'), null);
    assert.deepEqual(errors, [], 'Reload must recover without errors.');
    assert.deepEqual(apiFailures, []);
    console.log('PASS: deliberate render failure shows readable error + Reload; Reload recovers Dashboard');
    console.log(`PASS: ${results.length}/${routes.length} production routes`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      // Exact random email belongs only to this run; never delete demo tenants.
      await db.user.deleteMany({ where: { email, businessName: 'Browser smoke fixture', ownerName: 'Browser fixture' } });
      console.log('Throwaway browser account removed.');
    } finally { await db.$disconnect(); await db.pool.end(); }
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
