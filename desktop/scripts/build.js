// ─────────────────────────────────────────────────────────────
// desktop/scripts/build.js
// Builds the Electron app with code signing properly disabled.
// ─────────────────────────────────────────────────────────────
const { execSync } = require('child_process');

// Remove all code signing env vars
delete process.env.CSC_LINK;
delete process.env.WIN_CSC_LINK;
delete process.env.CSC_KEY_PASSWORD;
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

console.log('🔧 Building MedStore Desktop (unsigned)...\n');

try {
  execSync('npx electron-builder --win --dir', {
    cwd: __dirname.replace(/[\\/]scripts$/, ''),
    stdio: 'inherit',
    env: process.env,
  });
  console.log('\n🎉 Build complete! Check desktop/dist/win-unpacked/');
} catch (err) {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
}
