# Medical Store Wholesale Management System

A production-ready, full-stack wholesale and pharmacy management web application built for fast keyboard-driven data entry, invoicing, purchasing, inventory management, multi-ledger accounting, staff payroll, and financial reports.

---

## 🚀 Live Production Deployment

- **Official Live Application**: [https://medical-store-xi88.onrender.com](https://medical-store-xi88.onrender.com)
- **Hosting Platform**: [Render.com](https://render.com) (Continuous Deployment linked to GitHub `main` branch)
- **Database**: [Neon Cloud Serverless PostgreSQL](https://neon.tech)
- **GitHub Repository**: [https://github.com/aliyanhussain241/medical-store](https://github.com/aliyanhussain241/medical-store)

> [!NOTE]
> **Deployment Decision Note**: Hostinger shared hosting was initially attempted, but its low thread / memory limits triggered Prisma binary crashes (`PANIC: timer has gone away`). Production was officially migrated to **Render**, where Node.js and Prisma run reliably with zero thread crashes.

---

## ⚡ Key Features

1. **POS / Billing & Invoicing**:
   - Cash vs Credit invoice toggle.
   - Live previous balance alerts for selected customers.
   - Same-day invoice editing with automatic ledger & stock reversal.
   - Fast keyboard workflow: `Customer` -> `Enter` -> `Salesman` -> `Enter` -> `Product Search` ($\uparrow/\downarrow$ + `Enter`) -> `Qty` -> `Unit Price` -> `Disc %` -> `Enter` (loops back). Empty search `Enter` advances to payment & print.
2. **Purchasing & Supplier Ledgers**:
   - Purchase orders with auto stock increment, trade pricing, and bonus item calculations.
   - Same keyboard-driven entry and payment recording.
3. **Double-Entry Accounting & Banking**:
   - **Cash Book**: Manual & automated cash in/out entries tagged to Account Heads.
   - **Bank Accounts & Bank Ledger**: Tracking multiple bank accounts with PDF/Excel exports.
   - **Chart of Accounts**: Managed heads under `EXPENSE`, `INCOME`, and `LIABILITY`.
4. **Staff & Payroll Register**:
   - Employee profiles with monthly salaries, designation, and regional areas.
   - Salary payment vouchers disbursed via Cash or Bank with automated posting to Cash Book / Bank Book.
5. **Inventory & Master Registers**:
   - Medicine inventory with TP, MRP, min stock alerts, batch adjustments, and in-stock filters.
   - Customers & Companies registered with Town, Sector, CNIC, and managed Cities/Areas.
   - Scheme/Offer lists (Percentage, Net price, Bonus schemes like 10+1).

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, Vite, TanStack Query (React Query v5), Lucide Icons, React Hot Toast.
- **Backend**: Node.js, Express, Prisma ORM, JWT Authentication (Access + Refresh tokens).
- **Database**: Neon Serverless PostgreSQL with SSL.
- **Serving Strategy**: Express serves the compiled Vite single-page application from `backend/public/` with SPA routing fallback.

---

## ⚙️ Environment Variables on Render

| Variable | Description | Example / Current Setting |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | Neon Cloud PostgreSQL connection string | `postgresql://neondb_owner:***@ep-noisy-shadow-aex4es0t.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secret key for signing short-lived access tokens (15m) | 64+ char random hex string |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens (30d) | 64+ char random hex string |
| `TOKIO_WORKER_THREADS` | Rust/Tokio worker threads for Prisma engine | `1` |
| `UV_THREADPOOL_SIZE` | Libuv thread pool size for Node.js | `2` |

---

## 🔄 Deployment & CI/CD Workflow

Deployments are **100% automated**. Any push to the `main` branch of GitHub automatically triggers a build on Render:

```bash
# 1. Rebuild frontend into backend/public (when frontend files change)
cd frontend
npm run build

# 2. Commit and push
git add -A
git commit -m "Your update description"
git push origin main
```
Render automatically executes `npm run build` (running `prisma generate`) and starts the server via `npm start`.

---

## ⏱️ Render Free Tier Behavior & Cold Starts

- **Idle Spin-Down**: On Render's Free tier, the web service enters sleep mode if there are **no HTTP requests for 15 minutes**.
- **Cold Start Delay**: The *first* visitor to load the app after an idle period will experience a **30–50 second delay** while the container starts up. Once awake, all subsequent requests and pages respond instantly.
- **24/7 Zero Cold Starts**: Upgrading to Render's **Starter tier ($7/month)** keeps the server warm 24/7 with zero spin-down and dedicated compute.
- **Free Keep-Alive Workaround**: A free uptime monitoring ping (e.g. UptimeRobot or Cron-job.org) hitting `https://medical-store-xi88.onrender.com/` every 10–12 minutes will keep the free container awake continuously.

---

## 🔐 Demo Credentials & Client Handover

- **Current Demo Login**:
  - **Email**: `demo@medicalstore.app`
  - **Password**: `Demo@12345`
  - **Business**: Rahmat Medical Wholesale

> [!WARNING]
> **Pre-Client Handover Checklist**:
> 1. Instruct the client to register their official account at `https://medical-store-xi88.onrender.com/signup`.
> 2. Delete or repurpose the demo user and test invoices/transactions prior to accounting live use.
> 3. Remove the demo credentials text from `frontend/src/pages/Login.jsx` once real users take over.
