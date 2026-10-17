# Repository audit — 2026-10-17

## Baseline and authorization

Audit baseline: `main`, clean working tree. Source review only unless explicitly marked as an in-memory reproduction. No production database or deployment was accessed. No historical repair is authorized.

Provisional scores: UI/UX 5/10 (shared visual system but accessibility/state gaps); functionality 3/10 (dashboard and accounting defects); code quality 4/10 (duplication, cache contracts and limited isolated tests).

Approved: Batch 1 S01–S06, F01–F11, F14–F16, F18, P01. D01 is approved separately. Only G01 and G05 from Batch 2 are approved. Stop after Batch 1 for review. No push. Disposable database URL pending; never use the production DATABASE_URL. Other findings remain held.

Accounting policy supplied by owner: customer receivable debit; supplier payable credit; opening counted once; P&L is gross profit; free/bonus cost included; Asia/Karachi business dates; same-day edits free, past-date edits password-gated; preserve later payments and audit trail. Accountant confirmation pending.

## Project map

- Web: React 19.2.8, React Router 7, TanStack Query 5, Axios, Recharts, Lucide; Vite 8.2.2 and Oxlint; JavaScript/JSX, npm lockfile v3 (`frontend/package.json:12`). Vite requires Node ^20.19.0 or >=22.12.0 (`frontend/package-lock.json:2035`).
- Server: Express 5.2.1, Prisma 5.22, PostgreSQL/pg adapter, CommonJS (`backend/package.json:24`). Entry `backend/src/server.js:12`; routes `backend/src/app.js:141`; controllers and PDF/Excel services under `backend/src`.
- Desktop: Electron 33.4.11, SQLite, copied backend; `desktop/main.js:20`, `desktop/scripts/prepare.js:47`. Full adapter refactor held.
- Frontend entry `frontend/src/main.jsx:1`; 21 routed screens `frontend/src/App.jsx:83`: login, signup, dashboard, invoicing, purchasing, customers, companies, cities, inventory, customer/company/bank ledgers, cash book, reports, party balance, offers, banks, payroll, account heads, trial balance, balance sheet.
- API groups: auth, companies, customers, products (including import/alerts/adjustment), purchases, invoices, ledger, cash-book, reports, dashboard, export, offers, bank-accounts, bank-book, cities, employees/payroll, account-heads (`backend/src/app.js:141`). Route-specific operations are in `backend/src/routes/*Routes.js`.
- 21 models in `backend/prisma/schema.prisma:17`: User, RefreshToken, Company, Customer, Product, Purchase/Item, Invoice/Item, LedgerTransaction, CashBookEntry, DailyProfit, StockMovement, OfferList/Item, BankAccount, BankBookEntry, City, Employee, SalaryPayment, AccountHead.
- State: React local/context state and shared query cache (`frontend/src/App.jsx:38`); JWTs in localStorage (`frontend/src/context/AuthContext.jsx:27`). Render configuration `render.yaml:1`; external fonts `frontend/index.html:21`.

## Baseline verification

- Node v24.20.0, npm 11.19.0. Frontend lint: exit 0, 47 warnings, zero errors. Syntax: 48 backend/desktop JavaScript files passed.
- In-memory source checks reproduced dashboard missing model, supplier debt 100 becoming liability -100, bank opening 100 becoming 200, same-second refresh token collision and Decimal/float rounding divergence.
- Build/install skipped: root/backend scripts push database schema (`package.json:8`, `backend/package.json:10`); frontend build empties backend/public (`frontend/vite.config.js:17`); desktop preparation deletes/recreates template DB (`desktop/scripts/prepare.js:79`).
- Existing E2E skipped: creates transactions/accounts and writes results (`backend/run_e2e_tests.js:129,428,502`).
- Browser rendering, real concurrent transactions, deployed configuration, CVEs, desktop execution and backup restoration: Unverified.

## Findings

Locations below refer to the audit baseline; implementation may move lines. Yes means source-verified, not production-tested. S/M/L denote effort; risk is implementation/data risk.

| ID | Category | Severity | Baseline location | Problem / proposed fix | Effort | Risk | Verified |
|---|---|---|---|---|---|---|---|
| S01 | Security | Critical | backend/src/controllers/invoiceController.js:627,713 | Edit accepts missing owned products then updates by ID alone; enforce ownership for every related read/write | M | High | Yes |
| S02 | Security | High | backend/src/controllers/offerListController.js:224,278; cashBookController.js:130 | Related IDs not tenant-checked; validate company/product/head ownership | M | Medium | Yes |
| S03 | Security | High | backend/src/routes/authRoutes.js:43; controllers/authController.js:218 | Password validator results ignored; enforce before updating | S | Low | Yes |
| S04 | Security | High | backend/src/utils/prismaClient.js:16 | TLS certificate verification disabled; use verified TLS | S | Medium | Yes (config) |
| S05 | Security | Medium | backend/src/app.js:80; middleware/errorHandler.js:27 | Public diagnostics/raw production messages; restrict and sanitize | M | Low | Yes |
| S06 | Function | High | backend/src/controllers/authController.js:28,148; prisma/schema.prisma:62 | Refresh collision/non-atomic rotation; nonce and transactional consume/create | M | Medium | Yes, reproduced |
| F01 | Function | High | backend/src/controllers/dashboardController.js:104,149 | Nonexistent cashBook/accountName; schema-correct queries and explicit errors | M | Medium | Yes, reproduced |
| F02 | Function | High | backend/src/controllers/invoiceController.js:388,673 | Edit leaves DailyProfit stale; reverse/reapply profit by date | M | High | Yes |
| F03 | Function | High | backend/src/controllers/invoiceController.js:694,843 | Destructive edit loses payment history, stale streams/double opening; preserve later payments, revisions and reconcile affected streams | L | High | Yes |
| F04 | Function | High | backend/src/controllers/invoiceController.js:153,287; productController.js:237 | Pre-write stock checks/duplicate lines/lost adjustments; atomic conditional stock and serialized posting | L | High | Yes (race runtime unverified) |
| F05 | Function | High | backend/src/controllers/purchaseController.js:210,344; invoiceController.js:17; cashBookController.js:8 | Stale balances/payments/numbers; transactional serialization, conditional writes and idempotency | L | High | Yes (race runtime unverified) |
| F06 | Function | High | backend/src/routes/invoiceRoutes.js:11,28; controllers/bankBookController.js:94; employeeController.js:99 | Missing numeric/date/enum/edit/paging validation; strict shared input checks | L | Medium | Yes |
| F07 | Function | High | backend/src/controllers/purchaseController.js:232; reportController.js:101,294 | Supplier debit/credit conflict and tautological balance check; credit payable, independent reconciliation | L | High | Yes, reproduced |
| F08 | Function | High | backend/src/controllers/reportController.js:107,163,375 | Historical reports use current inventory/heads/future parties; date-aware snapshots and evidence gaps | L | High | Yes |
| F09 | Function | High | backend/src/controllers/bankAccountController.js:87; bankBookController.js:37,76 | Opening counted twice; single opening convention | M | Medium | Yes, reproduced |
| F10 | Function | High | backend/src/controllers/ledgerController.js:35,84,132 | Filtered closing omits opening; canonical statement builder | M | Medium | Yes |
| F11 | Function | Medium | backend/src/controllers/cashBookController.js:56; bankBookController.js:63 | Summaries only page totals; full-filter aggregation and page opening | M | Medium | Yes |
| F12 | Function | Medium | frontend/src/pages/Cities.jsx:27; backend/src/controllers/cityController.js:8 | Search/paging contract ignored; align UI/API | S | Low | Yes |
| F13 | Function | Medium | frontend/src/pages/Purchasing.jsx:38; backend/src/controllers/productController.js:162 | Collected supplier/generic fields discarded; decision pending | M | Medium | Yes |
| F14 | Function | High | backend/src/controllers/invoiceController.js:180,286; utils/numberUtils.js:13 | Free-unit COGS omitted, rounding differs; shared Decimal arithmetic | M | High | Yes |
| F15 | Function | Medium | backend/src/controllers/productImportController.js:299,345 | Weak parsing and partial batch commits; validate entire import, atomic/idempotent policy | M | Medium | Yes |
| F16 | Security | High | frontend/src/App.jsx:38; context/AuthContext.jsx:33 | Cache survives identity change; cancel/clear and scope session caches | M | Medium | Yes |
| F17 | Overlap | High | frontend/src/pages/Employees.jsx:55; Invoicing.jsx:153; Purchasing.jsx:102 | Same keys/different shapes and incomplete invalidation; canonical query factories | M | Medium | Yes |
| F18 | Function | High | frontend/src/pages/Invoicing.jsx:417,511 | Stale keyboard save closure/no pending guard; current callback and idempotency | M | Medium | Yes |
| F19 | Function | Medium | frontend/src/utils/keyboardNav.js:55; pages/Login.jsx:19,47 | Enter callback lacks event/bypasses native validation; requestSubmit | S | Low | Yes |
| F20 | Function | Medium | desktop/main.js:26; backend/src/controllers/authController.js:104 | 90-day desktop JWT/30-day DB expiry; derive expiry | S | Low | Yes |
| U01 | UI/UX | Medium | frontend/src/components/ui/KpiCard.jsx:7; pages/Reports.jsx:85 | Caller props ignored; standardize component contract | M | Low | Yes |
| U02 | UI/UX | High | frontend/src/pages/Dashboard.jsx:167,175; Reports.jsx:24 | Query errors appear as empty/zero; explicit states and boundary | M | Medium | Yes |
| U03 | A11y | High | frontend/src/components/ImportExcelModal.jsx:85; pages/Customers.jsx:286; layout/Layout.jsx:146 | Dialog/drawer semantics and focus missing; accessible primitives | M | Medium | Yes (AT unverified) |
| U04 | A11y | High | frontend/src/pages/Login.jsx:55; Signup.jsx:62; components/ImportExcelModal.jsx:94,126 | Labels/names/keyboard/errors unassociated; accessible field/control contracts | M | Low | Yes |
| U05 | UI/UX | Medium | frontend/src/index.css:1632,1676,1761 | Specificity overrides targets, fixed-width preview, hardcoded styles; tokens and viewport checks | M | Low | Yes (render unverified) |
| U06 | UI/UX | Low | frontend/src/components/ImportExcelModal.jsx:41,106 | CSV copy versus XLSX picker; clarify | S | Low | Yes |
| O01 | Overlap | Medium | backend/src/controllers/reportController.js:188; exportController.js:451,511 | Repeated report builders; canonical result/renderers | M | Medium | Yes |
| O02 | Overlap | High | desktop/scripts/prepare.js:47,65 | 36 identical/7 divergent backend copies; future adapter/staging refactor held | L | High | Yes |
| O03 | Overlap | Low | frontend/src/pages/Dashboard.jsx:34; components/ui/SectionHeader.jsx:7; pages/Inventory.jsx:21 | Duplicate UI/formatters; shared variants | M | Low | Yes |
| P01 | Function | High | backend/package.json:10; package.json:8; render.yaml:6 | Install/build mutates DB, frontend not rebuilt; separate deterministic build and explicit migrations | M | High | Yes |
| P02 | Function | Medium | README.md:45; desktop/README.md:36; desktop/package.json:64 | Runtime/delivery docs disagree; correct docs/config | S | Low | Yes |
| P03 | Function | Medium | frontend/package.json:6; backend/package.json:7; run_e2e_tests.js:502 | No isolated test workflow, 47 lint warnings; regression harness/cleanup | M | Low | Yes |
| D01 | Function | High | desktop/main.js:154 | Live file copy backup consistency; database-supported snapshot and restore verification | M | Medium | No (integrity unverified) |

## Overlap groups

| Group | Items / evidence | Keep / consolidation | Migration | Risk |
|---|---|---|---|---|
| G01 approved | O01/F07/F09/F10; reportController:188, ledgerController:35, exportController:451 | Shared financial/statement builders; format-only PDF/Excel | Fixture baseline, fix semantics, compare outputs | High |
| G02 held | O02; prepare.js:47 | Canonical backend plus explicit provider adapters | Provider contract tests then packaging | High |
| G03 held as broad refactor | F02–F05; invoiceController:388,673 | Authoritative transactions, reconciled projections | Invariants then separately approved historical work | High |
| G04 held as broad refactor | F14/O03; numberUtils:13 | Decimal arithmetic and shared formatters | Agree policy then migrate | High money/low display |
| G05 approved | F16/F17; Employees:55, Invoicing:153 | Stable query factories, tenant/session isolation and invalidation | Normalize shapes, migrate consumers, test account switch | Medium |
| G06 held | U01/O03; KpiCard:7, Dashboard:34 | Shared UI API and variants | Migrate then visual QA | Low–Medium |
| G07 held | U03/U04; ImportExcelModal:85 | Accessible dialog/form primitive | One workflow then remaining screens | Medium |
| G08 held | Customers.jsx:47, schema.prisma:100 | Territory semantics undecided | Owner decision, preview mapping, separate approval | High |

## Batches and verification

1. Approved Batch 1: guarded isolated harness and P01; S01–S06 security/auth; F01 dashboard; F04–F06 posting/validation; F02/F03/F07–F11/F14 accounting; F15 atomic import; F16/F18 session/save. Tests: ownership, invalid input, duplicate/retried/concurrent posting, invoice revisions/later payments/date changes, opening/filter/page reconciliation, exact fixture reports. Existing-data discrepancy report must be SELECT-only and shown before any proposal. No repairs.
2. Only G01/G05 approved from Batch 2; execute after Batch 1 review. Other overlap/UI/contract work held. Dependencies: stable accounting fixtures; verify API/export parity and cache response/invalidation consistency.
3. Batch 3 held: UI states, accessibility, responsive/token/copy work. Verify Chrome/Android Chrome, keyboard, contrast and viewport sizes. Dark mode and RTL explicitly excluded.
4. D01 separately approved, queued after Batch 1 review. Test backup during writes and isolated restore integrity. Remaining docs/lint cleanup held.

## Rollback

New branch `codex/audit-batch-1`; focused commits referencing IDs, no push. Revert code commits individually. Additive schema changes require explicit test-database application first and reviewed release migration. Preserve previous deployment artifacts. Database posting and historical repairs cannot be undone by Git; no historical repairs authorized. Stop after Batch 1 and provide fixture before/after report numbers and validation limitations.

## Open questions / pending access

- Disposable Neon URL pending. Test harness must reject any non-test target; no default DATABASE_URL fallback.
- Accountant confirmation of supplied conventions pending. Existing historical data cannot be silently normalized.
- Product supplier/generic fields and city/area/town undecided and held.
- Owner-only, Asia/Karachi, Chrome/Android Chrome, unpacked desktop acceptable. Render authoritative; refresh secret confirmed configured by owner.
- Runtime concurrency, database migrations, browser checks and desktop restoration remain unverified until authorized isolated execution is possible.

## New findings (not automatically authorized)

None recorded yet. Newly discovered issues outside approved IDs must be listed here rather than fixed.
