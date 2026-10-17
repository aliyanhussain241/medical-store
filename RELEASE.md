# Batch 1 release instructions

Prepared on 2026-10-17. These are manual instructions, not actions already performed. Production has not been contacted. Nothing has been merged, pushed or redeployed. Batch 2/3 work remains held.

Use PowerShell from the repository root. Keep the last successful Render deployment ID and the current main commit ID so you can roll back.

## A. Run the production Neon SQL first

1. Schedule a short period without application writes. Keep Render auto-deploy off until the SQL is complete and you are ready for step C.
2. Open the Neon project used by Render. Select the **production branch and production database**, not `audit-test`. Match the endpoint/database to Render's DATABASE_URL without sharing its credentials.
3. Open Neon SQL Editor. Run `SELECT current_database(), current_user;` and confirm the selected database and role.
4. Open [backend/prisma/posting-safety.sql](backend/prisma/posting-safety.sql) from `codex/audit-batch-1`. Copy the ENTIRE file, including all six ALTER TYPE statements before BEGIN, into the editor. Run it and check that there are no errors. Do not wrap the whole file in another transaction. [Neon SQL Editor instructions](https://neon.com/docs/get-started/query-with-neon-sql-editor).
5. Run the following read-only checks in that same production database:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND (
  (table_name = 'invoices' AND column_name IN ('initial_paid_amount', 'recorded_cost')) OR
  (table_name = 'invoice_items' AND column_name = 'unit_cost') OR
  (table_name = 'stock_movements' AND column_name = 'value_delta') OR
  (table_name IN ('cash_book', 'bank_book') AND column_name IN ('account_category', 'account_head_name'))
)
ORDER BY table_name, column_name;

SELECT e.enumlabel
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'ReferenceType'
  AND e.enumlabel IN ('OPENING_BALANCE_V2', 'PURCHASE_V2', 'SUPPLIER_PAYMENT_V2',
                      'INVOICE_INITIAL_PAYMENT', 'INVOICE_PAYMENT', 'INVOICE_REVERSAL')
ORDER BY e.enumlabel;

SELECT to_regclass('public.audit_events') AS audit_events,
       to_regclass('public.idempotency_records') AS idempotency_records,
       to_regclass('public.audit_events_user_id_entity_id_idx') AS audit_index,
       to_regclass('public.idempotency_records_user_id_key_key') AS retry_index;
```

Expected: eight nullable columns, six enum values, and all four table/index names present. Stop before merging/deploying if anything is missing.

The PostgreSQL file adds eight nullable columns, two tables, two indexes and six enum values. It drops nothing, repairs nothing and does not reset the database. It can be rerun if interrupted; the enum additions and table/column/index additions tolerate existing names. The names-only checks do not replace review if production already has differently defined objects with those names.

Do not run `db push`, seed, reset, or the test migration runner against production. The test runner deliberately accepts only `backend/.env.test` and rejects the production endpoint. Do not run the SQLite SQL on Neon. No demo-data backup/reset is required for this additive release.

## B. Merge the release branch into main

Conflict check performed during preparation: freshly fetched `origin/main` and local `main` both point to `176b6e3`. That commit is already an ancestor of `codex/audit-batch-1`. Main had zero commits absent from the audit branch. Git's merge simulation exited 0 with no conflicts; no branch or working files were merged. Main's existing UI commits are included through that ancestor. If you expect newer UI commits, make sure they have been pushed to this repository before continuing.

Fetch again immediately before merging because main can change after this check:

```powershell
git status --short
git fetch origin main
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git merge-tree --write-tree --name-only main codex/audit-batch-1
```

Start with a clean working tree. Record the HEAD printed above as PRE_RELEASE_COMMIT. The simulation should exit 0 and print only a tree ID. If it reports conflicts, stop and review them before any merge. Preserve the UI changes on main together with the posting/security fixes; do not blindly choose one side.

When the check is clean:

```powershell
git merge --no-ff codex/audit-batch-1 -m "Release audited Batch 1"
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
node backend/scripts/verify-release.js
git status --short
```

The audit branch already includes the rebuilt `backend/public` assets. If main acquired new frontend commits, rebuilding may change those assets: review and commit only those generated changes before pushing. Record the merge commit ID as RELEASE_MERGE_COMMIT. No schema command belongs in this build/merge step.

## C. Push and redeploy Render

Only after the SQL, merge and checks succeed:

```powershell
git push origin main
```

In Render, select the existing medical-store service. Confirm the linked branch is `main`, the root directory is the repository root, Build Command is `npm run build`, and Start Command is `npm start`. Verify the production DATABASE_URL, JWT_SECRET and JWT_REFRESH_SECRET remain configured. Live Render settings were not inspected during preparation; [render.yaml](render.yaml) is the checked-in configuration.

The root build runs these steps in order:

```text
npm --prefix backend ci --ignore-scripts
npm --prefix frontend ci --ignore-scripts
npm --prefix frontend run build
npm --prefix backend run build
```

The final backend build is **`prisma generate`**. This always regenerates the PostgreSQL client after dependency installation, including the new models and enum values, before a successful release build completes. Root/backend have no custom postinstall hook; generation is explicit in the build and does not depend on dependency install hooks. There is no `db push` or migration in this Render build. A bare root `npm install` alone is not a release build.

Choose **Manual Deploy → Clear build cache & deploy** for this release, so stale assets/client files are not reused. Confirm the target commit is the new main commit. In the logs, verify both the Vite build and a successful Prisma Client generation message before the server starts. If deployment fails, leave the previous deployment serving and investigate. [Render deployment instructions](https://render.com/docs/deploys).

## D. Smoke test after deployment

Use Chrome and Android Chrome. Hard-refresh the page to load the new bundle. Use a clearly labelled disposable smoke-test account; no fixture amounts below describe existing demo balances.

- **Login:** log in to an existing demo account, reload, then log out. Confirm the account/session displays correctly and another account's cached records do not appear.
- **Signup:** register a new account with a unique email and valid password. Confirm success, signed-in state, and login again after logout. This specifically checks the previously stale Prisma client path. Reusing that email should show a useful duplicate-account error, not a server error.
- **Idempotency header:** in Chrome Developer Tools → Network, save a customer, supplier, product, invoice, purchase and payment. Inspect each POST/PUT/PATCH/DELETE request: `Idempotency-Key` must be nonempty. Also check a product import if used. GET requests and the internal auth refresh call do not need this header. Rapidly pressing Save must not create duplicate postings. Do not manually replay a payment with a new key as a retry.
- **Fixture setup:** on the new account, add a customer with opening 50, supplier with opening 20, bank with opening 100 and a product with stock 10, purchase price 10, sale price 30. Use today's Asia/Karachi date for the following transactions.
- **Purchase:** buy 10 units at 20, pay 50 from that bank. Confirm purchase total 200, supplier due 170 including its opening, stock 20 and weighted-average cost 15.
- **Create invoice:** sell 4 units at 30 with 1 bonus/free unit; receive 40 into the same bank. Confirm total 120, stock 15, cost 75 and gross profit 45.
- **Payment:** receive another 20 in cash against the invoice. Confirm invoice paid 60/due 60, customer ledger due 110 including its opening, cash 20 and bank 90. Edit the invoice on the same Karachi day without changing its amounts; confirm the later payment is retained, balances stay the same and an edit audit record exists. Check an old invoice without snapshots gives a clear rejection.
- **Dashboard:** on the new fixture account, confirm today's sales 120, purchases 200, COGS 75, gross profit 45, receivables 110, payables 170 and combined cash/bank 110. No server error or incomplete-data flag should appear for this new fixture.
- **Trial Balance:** debit 445, credit 445, difference zero; openings counted once. Balance Sheet should show assets 445, liabilities 170 and equity 275. Customer/supplier ledgers and bank book should agree with the balances above.

Release preparation already verified the compiled request interceptor against every one of the 41 mutating service methods, using a fake transport with no network access. The first production entry is currently `index-DCl-EnXU.js`; a rebuild after other UI changes can legitimately change the hash. Browser smoke checks above still need to be performed after deployment. Do not silently repair existing demo balances when they differ from these new-fixture numbers.

## E. Roll back if smoke tests fail

1. Stop new writes while investigating. In Render's Deploys page, select the previously recorded successful deployment, choose Rollback, and confirm that deployment. This reuses its retained build artifact; it does not rebuild old source. Check its restored environment settings, especially JWT secrets/database target, and repeat login/signup checks. Dashboard rollback disables automatic deploys until you reenable them. [Render rollback instructions](https://render.com/docs/rollbacks).
2. Leave the additive SQL in place. Do not drop the new columns/tables/enum values: rollback must preserve records written after release. Git or a Render rollback cannot undo financial transactions. An old artifact's Prisma client may reject the new enum labels once new postings exist, so keep writes stopped and check financial reads too. If it cannot read them, deploy a corrected release with the current schema/client instead; do not delete postings to make the old client work. Do not rebuild the original pre-audit source unchanged: its old build scripts included automatic schema mutation.
3. To undo the Git release while keeping the deployment safeguards, create a local rollback branch and revert the release merge:

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/rollback-batch-1
git revert -m 1 RELEASE_MERGE_COMMIT
```

Replace RELEASE_MERGE_COMMIT with the recorded real merge SHA. That revert also restores the old unsafe build configuration, so **do not push or deploy this revert yet**. Restore the safe root/backend package scripts, render.yaml and the current PostgreSQL schema from the reviewed release commit. Retain client generation without db push so the rollback client recognizes all persisted enum values, then rebuild the matching frontend, review and commit. Resolve any revert conflicts manually. Test financial reads and writes on a disposable branch before a separate reviewed merge/push; old posting behavior is not acceptable merely because it compiles. If the retained Render artifact is unavailable or incompatible with new postings, use a corrected release rather than deploying the original commit directly.

## Desktop: exact commands for a new template and Windows installer

Run these manually from the repository root on Windows after reviewing the release. They create packaging files only. They do not migrate or overwrite an installed user's database. Node/npm and Windows Electron build prerequisites must be installed; installer creation was not run during this preparation.

```powershell
npm --prefix frontend ci --ignore-scripts
Set-Location .\desktop
npm ci

# Preserve an existing packaging template so the creator can make a fresh one.
if (Test-Path -LiteralPath .\template.db) {
  Rename-Item -LiteralPath .\template.db -NewName ('template.before-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.db')
}
npm run db:template
if ($LASTEXITCODE -ne 0) { throw 'Template creation failed. Stop here.' }

# Copies the shared backend fixes, builds the frontend, generates the SQLite client.
node scripts/prepare.js
if ($LASTEXITCODE -ne 0) { throw 'Desktop preparation failed. Stop here.' }

# Explicit NSIS target is required: the package default is an unpacked directory.
npx electron-builder --win nsis --x64
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
```

The new template uses [desktop/prisma/schema.prisma](desktop/prisma/schema.prisma), including the posting metadata. It deliberately uses schema creation only in the explicit `db:template` command. The installer is written under `desktop/dist`; inspect the actual output filename in the build log. To keep the previously accepted unpacked format instead, replace the last command with `npx electron-builder --win dir --x64`.

For an existing installed desktop database, startup now checks the schema without altering it. Upgrading it requires a separate explicit, offline application of [desktop/prisma/posting-safety.sql](desktop/prisma/posting-safety.sql), once against the original SQLite schema. Creating a packaging template does not perform that upgrade. Full existing desktop provider incompatibilities remain outside this release scope; do not treat an installer build alone as desktop application acceptance.
