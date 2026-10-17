# Repository audit — 2026-10-17

## Baseline and authorization

Audit baseline: `main`, clean working tree. Source review only unless explicitly marked as an in-memory reproduction. No production database or deployment was accessed. No historical repair is authorized.

Provisional scores: UI/UX 5/10 (shared visual system but accessibility/state gaps); functionality 3/10 (dashboard and accounting defects); code quality 4/10 (duplication, cache contracts and limited isolated tests).

Approved: Batch 1 S01–S06, F01–F11, F14–F16, F18, P01. D01 is approved separately. Only G01 and G05 from Batch 2 are approved. Stop after Batch 1 for review. No push. Disposable database URL pending; never use the production DATABASE_URL. Other findings remain held.

Accounting policy supplied by owner: customer receivable debit; supplier payable credit; opening counted once; P&L is gross profit; free/bonus cost included; moving weighted average inventory cost (subsequently confirmed); Asia/Karachi business dates; same-day edits free, past-date edits password-gated; preserve later payments and audit trail. Accountant confirmation pending.

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
2. Only G01/G05 approved from Batch 2. G01 shared report builders are necessary to Batch 1 accounting corrections and are included with those changes. Full G05 query-key/response-contract consolidation remains queued for the Batch 1 review; F16 session isolation is included now. Other overlap/UI/contract work held.
3. Batch 3 held: UI states, accessibility, responsive/token/copy work. Verify Chrome/Android Chrome, keyboard, contrast and viewport sizes. Dark mode and RTL explicitly excluded.
4. D01 is included as the separately approved extension to Batch 1. Runtime snapshot/restore testing remains blocked on test-execution access. Remaining docs/lint cleanup held.

## Rollback

New branch `codex/audit-batch-1`; focused commits referencing IDs, no push. Revert code commits individually. Additive schema changes require explicit test-database application first and reviewed release migration. Preserve previous deployment artifacts. Database posting and historical repairs cannot be undone by Git; no historical repairs authorized. Stop after Batch 1 and provide fixture before/after report numbers and validation limitations.

## Open questions / pending access

- Owner created Neon branch `audit-test`; `backend/.env.test` is still missing as of this checkpoint. No database connection is allowed until it exists and its endpoint passes the production-host exclusion check.
- Accountant confirmation of supplied conventions pending. Existing historical data cannot be silently normalized.
- Product supplier/generic fields and city/area/town undecided and held.
- Owner-only, Asia/Karachi, Chrome/Android Chrome, unpacked desktop acceptable. Render authoritative; refresh secret confirmed configured by owner.
- Runtime concurrency, database migrations, browser checks and desktop restoration remain unverified until authorized isolated execution is possible.

## New findings (not automatically authorized)

N01 — Security / High / source-verified: unexpired access JWTs remain valid after logout/password change until expiry. `backend/src/middleware/authMiddleware.js:22` verifies signature/expiry without a revocation/version check; `backend/src/controllers/authController.js:222` revokes refresh tokens only. This is outside the approved refresh-token/validation changes; it has NOT been fixed. Runtime exploitation is unverified. A separate approved design would be needed for immediate access-token revocation.

## Batch 1 implementation checkpoint (not final acceptance)

Branch: `codex/audit-batch-1`. Local commits only; no push. No database connection, migration, existing-data repair or desktop launch has occurred.

### Prepared changes

- S01–S06: tenant-scoped references, strict password validation, unique/atomic refresh rotation, verified PostgreSQL TLS and restricted diagnostics/error output.
- F01–F11/F14–F16/F18: schema-correct dashboard; serialized and conditionally checked stock/payment writes; required idempotency keys; append-only invoice reversals and audit snapshots; later payments retained; Decimal/server and integer/browser rounding agreement; bonus COGS; weighted-average purchases; single-count openings and canonical as-of/filter/page statements; atomic validated imports; session cache clearing/stale-response rejection; current-state keyboard save with pending guard.
- G01: report/statement JSON and PDF/XLSX use shared data builders, including gross profit. No operating expenses are deducted from gross profit.
- P01: install/build no longer pushes schema. Explicit database runners load only `backend/.env.test`, reject the production host (including its pooled variant), reject URL routing overrides, and pass the exact file URL to child processes. Desktop startup performs a read-only schema preflight; packaging no longer creates/mutates the template database. Template creation is a separate explicit command. Existing unsafe localhost E2E entry point is disabled.
- D01: SQLite `VACUUM INTO` snapshot, integrity/foreign-key checks before publishing, then retention. Automatic desktop migration has been removed. The disposable demo data does not require a precautionary backup; the backup/restore feature test remains required. This does not implement the held provider-adapter refactor.

### Material behavior and limits

- Additive PostgreSQL SQL is prepared in `backend/prisma/posting-safety.sql`; NOT applied. Clients/schema must be generated and migrated on the disposable database before integration verification. Production deployment remains outside this task.
- Legacy invoices without reliable initial-payment and unit-cost snapshots fail closed on edit (409). No historical cost/payment values are invented or backfilled. New invoice revisions preserve original snapshots in audit records.
- Legacy supplier signs are normalized only in read results according to the old controller's known reference types. Persisted historical rows remain untouched.
- Incomplete historical inventory/classification evidence is explicitly marked Unverified; a zero difference alone cannot claim a balanced report.
- New retroactive stock postings before later stock movements fail closed rather than silently repricing historical weighted-average costs. Password-authorized invoice revisions retain recorded cost snapshots.
- Mutating business APIs now require `Idempotency-Key`; the frontend supplies it, shares keys for concurrent duplicate writes, and preserves them after unknown network outcomes.
- Imports now require an explicit purchase cost; invalid rows or duplicate product/batch identities reject the entire import. There is no guessed MRP-to-cost fallback.
- Broad UI polish, remaining lint cleanup, full G05 consolidation and the web/desktop provider refactor remain held/queued as authorized above. Existing SQLite provider incompatibilities identified in O02 are not claimed resolved.

### Verification available without a database

- Database-free regression suite: 27 tests prepared/passing across financial fixtures, ownership, edits/later payments, past-date password gate, weighted average/bonus COGS, rollback/idempotency/import atomicity, refresh rotation, stale-session responses, renderer parity and backup/upgrade control flow.
- Static checks: backend/desktop source syntax; both Prisma schemas validate using inert local URLs without connecting. Frontend lint exits 0 with 46 remaining warnings; frontend build compiles 31 assets in memory with output writing disabled.
- Actual PDF/XLSX renderer buffers were generated in memory. Visual browser/PDF layout QA is unverified.
- All four live entry points (discrepancy scan, concurrency tests, migration, backup/restore test) refused before connecting because `backend/.env.test` is missing. Unit checks verify production-host/pooler rejection, override rejection and query-routing rejection. Environment variables cannot replace the file as the target source.
- Neon integration, concurrency/locking behavior, additive SQL application, desktop WAL snapshot/restore and actual existing-data scan remain Unverified pending the owner's disposable URL. Backend generation/build and packaged desktop build have not run.

### Before/after report-calculation fixture (not a live database)

Fixture: opening bank 100, customer debit 50, supplier credit 20, opening stock 10 at 10; purchase 10 at 20 with 50 paid; sale of 4 plus 1 free at 30 with 40 bank receipt and later 20 cash receipt. Recorded inventory average is 15, COGS 75 and gross profit 45. The baseline report code is pinned to commit `176b6e3775e0619a11cba576aa1fe252bf693ddc`; these are report-calculation comparisons, not a full baseline posting simulation.

| Report | Before | After |
|---|---:|---:|
| Trial Balance debit / credit | 615 / 0 | 445 / 445 |
| Balance Sheet assets / liabilities / equity | 445 / -170 / 615 | 445 / 170 / 275 |
| Filtered customer closing | 60 DR | 110 DR |
| Filtered supplier closing | 150 DR | 170 CR |
| Bank book closing | 190 | 90 |

### Step 7 — read-only discrepancy checkpoint

The scanner starts `BEGIN TRANSACTION READ ONLY`, executes fixed SELECTs, and rolls back. Its fixture test reports customer stored 60 versus computed 110, and bank stored 190 versus computed 90, while leaving those stored values unchanged. No repair is proposed or applied. The actual existing-data discrepancy report cannot be produced until the disposable database URL is provided; production is never a fallback.

### Owner update — disposable demo data and complete schema inventory

No reset is requested or required for the additive changes. No legacy invoice compatibility, invoice reconciliation or backfill will be built. Invoices without snapshots return 409 on edit. The read-only discrepancy report is diagnostic only; it does not propose or execute repairs. Existing demo rows may therefore remain incomplete. The user's statement that backups are unnecessary supersedes the earlier precautionary backup requirement for demo migrations; D01 functionality itself remains approved.

The complete baseline-to-branch Prisma diff was reviewed for BOTH schemas. These are all additions; no columns, tables, relationships, enums or indexes are removed or renamed:

| Model / SQL table | Added fields | PostgreSQL | SQLite | Schema locations |
|---|---|---|---|---|
| Invoice / invoices | initialPaidAmount / initial_paid_amount; recordedCost / recorded_cost | nullable DECIMAL(15,2) each | nullable NUMERIC each | backend/prisma/schema.prisma:211; desktop/prisma/schema.prisma:203 |
| InvoiceItem / invoice_items | unitCost / unit_cost | nullable DECIMAL(30,15) | nullable NUMERIC | backend/prisma/schema.prisma:245; desktop/prisma/schema.prisma:237 |
| StockMovement / stock_movements | valueDelta / value_delta | nullable DECIMAL(15,2) | nullable NUMERIC | backend/prisma/schema.prisma:368; desktop/prisma/schema.prisma:344 |
| CashBookEntry / cash_book | accountCategory / account_category; accountHeadName / account_head_name | nullable TEXT each | nullable TEXT each | backend/prisma/schema.prisma:317; desktop/prisma/schema.prisma:293 |
| BankBookEntry / bank_book | accountCategory / account_category; accountHeadName / account_head_name | nullable TEXT each | nullable TEXT each | backend/prisma/schema.prisma:481; desktop/prisma/schema.prisma:435 |
| AuditEvent / audit_events | id (PK, Prisma UUID default), userId, entityId, action, before, after, createdAt | six required TEXT fields; required TIMESTAMP(3), default CURRENT_TIMESTAMP | six required TEXT fields; required DATETIME, default CURRENT_TIMESTAMP | backend/prisma/schema.prisma:592; desktop/prisma/schema.prisma:540 |
| IdempotencyRecord / idempotency_records | id (PK, Prisma UUID default), userId, key, operation, fingerprint, status, response, createdAt | six required TEXT fields; required INTEGER status; required TIMESTAMP(3), default CURRENT_TIMESTAMP | six required TEXT fields; required INTEGER status; required DATETIME, default CURRENT_TIMESTAMP | backend/prisma/schema.prisma:604; desktop/prisma/schema.prisma:552 |

New indexes: `audit_events_user_id_entity_id_idx` (user_id, entity_id); unique `idempotency_records_user_id_key_key` (user_id, key). UUID defaults are generated by Prisma, not SQL server defaults. New metadata tables use scalar tenant IDs without new foreign-key relations.

Complete executable migration SQL is retained in `backend/prisma/posting-safety.sql:1` (PostgreSQL) and `desktop/prisma/posting-safety.sql:1` (SQLite). Both contain only transaction control, eight ADD COLUMN statements, two CREATE TABLE statements and two CREATE INDEX statements. Nothing is dropped and no historical data is changed. PostgreSQL additions are idempotent; SQLite migration targets the original schema and must run once, explicitly, offline. Neither build nor application startup applies these scripts.

Latest validation: 27 database-free tests pass. The discrepancy, concurrency, migration and desktop backup/restore entry points all refuse execution while `backend/.env.test` is absent. Therefore live before/after figures for Trial Balance, Balance Sheet, customer/supplier ledgers, bank book and Dashboard are **Unverified**; the earlier table remains an in-memory report-calculation fixture only. Dashboard is explicitly included in the pending live comparison. The discrepancy scan must be shown before any repair proposal; concurrency testing may require the explicit additive migration first if the test branch has the old schema. No database was contacted, reset or repaired.

N01 detail: access-token verification checks signature and expiry only (`backend/src/middleware/authMiddleware.js:22`). Logout deletes refresh tokens (`backend/src/controllers/authController.js:161`); password change does likewise (`backend/src/controllers/authController.js:222`). Existing access tokens therefore remain usable until expiry: web fallback 15 minutes (`backend/src/controllers/authController.js:25`), configured web duration not inspected, desktop 24 hours (`desktop/main.js:28`). Immediate access-token revocation remains held and unchanged.
