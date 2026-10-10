# MedStore Desktop App

One-click `.exe` installer for **MedStore — Wholesale Medical Store Management**.

## Architecture

```
desktop/
├── main.js                    # Electron main process
├── package.json               # Desktop dependencies + electron-builder config
├── prisma/
│   └── schema.prisma          # SQLite version (no PostgreSQL needed!)
├── backend/
│   ├── src/                   # Copied from main backend (auto by prepare script)
│   │   ├── utils/
│   │   │   └── prismaClient.js  # SQLite-specific (NOT the pg version)
│   │   └── ...                # All controllers, routes, services
│   └── public/                # Built React frontend (auto by prepare script)
├── scripts/
│   ├── prepare.js             # Copies backend + builds frontend + generates Prisma
│   └── seed-desktop.js        # Seeds demo user into SQLite DB
└── dist/                      # Output: MedStore Setup.exe
```

## How It Works

1. **Electron** wraps the Express backend + React frontend in a native desktop window
2. **SQLite** embedded database — no PostgreSQL installation needed
3. Database file stored in: `%APPDATA%/MedStore/data/medstore.db`
4. Automatic backup feature (right-click → Backup Database)
5. JWT secrets persisted in `%APPDATA%/MedStore/.secrets.json`

## Build Steps

### Prerequisites
- Node.js 18+ installed
- npm installed

### 1. Install dependencies
```bash
cd desktop
npm install
```

### 2. Build the installer
```bash
npm run build
```

This will:
- Copy backend source code (with SQLite-specific Prisma client)
- Build the React frontend
- Generate Prisma Client for SQLite
- Package everything into `dist/MedStore Setup 1.0.0.exe`

### 3. Test without building installer
```bash
npm run build:dir   # Creates unpacked directory
npm start           # Run Electron directly (for development)
```

## Customer Delivery

1. Send the `.exe` file via WhatsApp/Email/USB
2. Customer double-clicks → **Next → Install → Finish**
3. Desktop icon "MedStore" appears
4. First launch creates empty database, customer signs up with their own business name
5. All data stored locally on their computer

## Backup & Restore

- **Backup**: Right-click anywhere in the app → "💾 Backup Database Now"
- **Data Location**: `%APPDATA%/MedStore/data/medstore.db`
- **Backups**: `%APPDATA%/MedStore/backups/` (auto-keeps last 10)
- **Restore**: Copy a backup `.db` file over `medstore.db` and restart the app
