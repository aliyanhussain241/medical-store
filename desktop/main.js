// ─────────────────────────────────────────────────────────────
// desktop/main.js — Electron main process
// Starts the Express backend internally and opens the app in
// a native desktop window. Uses embedded SQLite database.
// ─────────────────────────────────────────────────────────────
const { app, BrowserWindow, shell, dialog, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Paths ────────────────────────────────────────────────────
const USER_DATA = app.getPath('userData');
const DB_DIR = path.join(USER_DATA, 'data');
const DB_PATH = path.join(DB_DIR, 'medstore.db');
const BACKUP_DIR = path.join(USER_DATA, 'backups');

// Ensure data & backup directories exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── Environment setup (BEFORE requiring backend) ─────────────
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || `medstore-desktop-${require('crypto').randomBytes(16).toString('hex')}`;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `medstore-refresh-${require('crypto').randomBytes(16).toString('hex')}`;
process.env.JWT_EXPIRES_IN = '24h';
process.env.JWT_REFRESH_EXPIRES_IN = '90d';

// Save JWT secrets to file so they persist across restarts
const secretsFile = path.join(USER_DATA, '.secrets.json');
if (fs.existsSync(secretsFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    process.env.JWT_SECRET = saved.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = saved.JWT_REFRESH_SECRET;
  } catch (_) { /* ignore corrupt file */ }
} else {
  fs.writeFileSync(secretsFile, JSON.stringify({
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  }), 'utf-8');
}

// ── Backend port ─────────────────────────────────────────────
const PORT = 42847; // Fixed port for desktop app — unlikely to conflict
let mainWindow = null;
let tray = null;
let serverReady = false;

// ── Start Express Server ─────────────────────────────────────
async function startServer() {
  try {
    // On first launch, copy the template database (with schema pre-applied)
    if (!fs.existsSync(DB_PATH)) {
      console.log('📦 First launch — creating database...');
      // Template DB is bundled alongside the app
      const templatePath = path.join(__dirname, 'template.db');
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, DB_PATH);
        console.log('✅ Database created from template');
      } else {
        console.log('⚠️ No template DB found — Prisma will create empty DB on connect');
      }
    } else {
      console.log('✅ Existing database found');
    }

    const prisma = require('./backend/src/utils/prismaClient');
    const { PrismaClient } = require('./generated/prisma-client');
    const { backupSqlite } = require('./backend/src/utils/sqliteBackup');
    const { ensureSqlitePostingSchema } = require('./backend/src/utils/sqlitePostingSchema');
    await ensureSqlitePostingSchema({ prisma, beforeUpgrade: () => backupSqlite({ prisma, PrismaClient, backupDir: BACKUP_DIR }) });

    // Now require and start the Express app
    const expressApp = require('./backend/src/app');

    return new Promise((resolve, reject) => {
      const server = expressApp.listen(PORT, '127.0.0.1', () => {
        console.log(`🚀 MedStore server running on http://127.0.0.1:${PORT}`);
        serverReady = true;
        resolve(server);
      });
      server.on('error', reject);
    });
  } catch (err) {
    console.error('❌ Server start failed:', err);
    dialog.showErrorBox(
      'MedStore — Startup Error',
      `Server could not start:\n${err.message}\n\nPlease contact support.`
    );
    app.quit();
  }
}

// ── Create Main Window ───────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MedStore — Wholesale Medical Management',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    show: false, // Show after loading
    backgroundColor: '#F6F8F6',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove default menu bar for clean look
  mainWindow.setMenuBarVisibility(false);

  // Load the app
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);

  // Show window when content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Context menu for right-click
  mainWindow.webContents.on('context-menu', (_e, params) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Back', click: () => mainWindow.webContents.goBack(), enabled: mainWindow.webContents.canGoBack() },
      { label: 'Forward', click: () => mainWindow.webContents.goForward(), enabled: mainWindow.webContents.canGoForward() },
      { type: 'separator' },
      { label: 'Reload', click: () => mainWindow.webContents.reload() },
      { type: 'separator' },
      { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
      { label: 'Select All', role: 'selectAll' },
      { type: 'separator' },
      {
        label: '📁 Open Data Folder',
        click: () => shell.openPath(DB_DIR),
      },
      {
        label: '💾 Backup Database Now',
        click: () => backupDatabase(),
      },
    ]);
    menu.popup();
  });
}

// ── Database Backup ──────────────────────────────────────────
let backupInProgress = false;
async function backupDatabase() {
  if (backupInProgress) return;
  backupInProgress = true;
  try {
    const { backupSqlite } = require('./backend/src/utils/sqliteBackup');
    const { PrismaClient } = require('./generated/prisma-client');
    const backupPath = await backupSqlite({ prisma: require('./backend/src/utils/prismaClient'), PrismaClient, backupDir: BACKUP_DIR });

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Backup Complete',
      message: `Database backup saved successfully!\n\nLocation: ${backupPath}`,
      buttons: ['OK', 'Open Folder'],
    }).then(({ response }) => {
      if (response === 1) shell.openPath(BACKUP_DIR);
    });
  } catch (err) {
    dialog.showErrorBox('Backup Failed', err.message);
  } finally {
    backupInProgress = false;
  }
}

// ── App Lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  // Show splash / loading state
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps usually stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
