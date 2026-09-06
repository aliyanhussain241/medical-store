// ─────────────────────────────────────────────────────────────
// run_e2e_tests.js — Comprehensive End-to-End Test Suite
// Covers all 5 test scenarios using Node 24 native fetch + ExcelJS
// ─────────────────────────────────────────────────────────────
const ExcelJS = require('exceljs');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api';

async function api(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  
  if (options.asBuffer) {
    const arrayBuffer = await res.arrayBuffer();
    return { status: res.status, headers: res.headers, buffer: Buffer.from(arrayBuffer) };
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data, ok: res.ok };
}

const results = {
  test1_sales: { pass: false, details: {} },
  test2_purchase: { pass: false, details: {} },
  test3_exports: { pass: false, details: {} },
  test4_multisession: { pass: false, details: {} },
  test5_isolation: { pass: false, details: {} },
};

function logHeader(title) {
  console.log('\n===============================================================');
  console.log(`  ${title}`);
  console.log('===============================================================');
}

async function run() {
  try {
    // ─────────────────────────────────────────────────────────
    // AUTH: Login as Demo Account
    // ─────────────────────────────────────────────────────────
    logHeader('INITIALIZING: Login as Demo Account');
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@medicalstore.app', password: 'Demo@12345' }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);

    const token1 = loginRes.data.accessToken;
    const user1 = loginRes.data.user;
    console.log(`✓ Logged in as: ${user1.ownerName} (${user1.businessName}) [ID: ${user1.id}]`);
    const authHeaders1 = { Authorization: `Bearer ${token1}` };

    // ─────────────────────────────────────────────────────────
    // TEST 1: Full Sales Flow Test
    // ─────────────────────────────────────────────────────────
    logHeader('TEST 1: Full Sales Flow Test');

    // 1. Get Customers & Products
    const customersRes = await api('/customers', { headers: authHeaders1 });
    const customer = customersRes.data.data[0];
    console.log(`Selected Customer: "${customer.customerName}" (Initial Ledger Balance: Rs ${customer.currentBalance})`);

    const productsRes = await api('/products?limit=10', { headers: authHeaders1 });
    const prod1 = productsRes.data.data[0];
    const prod2 = productsRes.data.data[1];
    const prod3 = productsRes.data.data[2];

    const initialStock1 = parseFloat(prod1.stockQty);
    const initialStock2 = parseFloat(prod2.stockQty);
    const initialStock3 = parseFloat(prod3.stockQty);
    console.log(`Initial Stock Values:`);
    console.log(`  - ${prod1.productName}: ${initialStock1} ${prod1.unit} (Sale Price: Rs ${prod1.salePrice}, Cost: Rs ${prod1.purchasePrice})`);
    console.log(`  - ${prod2.productName}: ${initialStock2} ${prod2.unit} (Sale Price: Rs ${prod2.salePrice}, Cost: Rs ${prod2.purchasePrice})`);
    console.log(`  - ${prod3.productName}: ${initialStock3} ${prod3.unit} (Sale Price: Rs ${prod3.salePrice}, Cost: Rs ${prod3.purchasePrice})`);

    // 2. Note initial Dashboard stats
    const dashBefore = (await api('/dashboard/stats', { headers: authHeaders1 })).data.data;
    console.log(`Dashboard Before Sale: Today Sales = Rs ${dashBefore.todaySales}, Today Profit = Rs ${dashBefore.todayProfit}, Receivables = Rs ${dashBefore.totalReceivables}`);

    // 3. Note initial Customer Ledger & Cash Book
    const custLedgerBefore = (await api(`/ledger/customer/${customer.id}`, { headers: authHeaders1 })).data.data;
    const initialLedgerClosing = parseFloat(custLedgerBefore.summary.closingBalance);
    const initialLedgerTxCount = custLedgerBefore.transactions.length;

    const cashBookBefore = (await api('/cash-book', { headers: authHeaders1 })).data;
    const initialCashBalance = parseFloat(cashBookBefore.summary.net);
    const initialCashEntries = cashBookBefore.data.length;

    console.log(`Customer Ledger Before: ${initialLedgerTxCount} entries, Closing Balance = Rs ${initialLedgerClosing}`);
    console.log(`Cash Book Before: ${initialCashEntries} entries, Net Cash Balance = Rs ${initialCashBalance}`);

    // 4. Create Invoice with 3 products, quantities, and discounts
    const saleQty1 = 10;
    const saleQty2 = 5;
    const saleQty3 = 2;
    const disc1 = 5;  // 5% discount
    const disc2 = 10; // 10% discount
    const disc3 = 0;  // 0% discount

    const line1Total = saleQty1 * parseFloat(prod1.salePrice) * (1 - disc1 / 100);
    const line2Total = saleQty2 * parseFloat(prod2.salePrice) * (1 - disc2 / 100);
    const line3Total = saleQty3 * parseFloat(prod3.salePrice) * (1 - disc3 / 100);
    const expectedInvoiceTotal = (line1Total + line2Total + line3Total).toFixed(2);
    const paidAmount = 50.00; // Partial payment of Rs 50
    const expectedBalance = (expectedInvoiceTotal - paidAmount).toFixed(2);

    console.log(`Creating Sales Invoice:`);
    console.log(`  * ${saleQty1} x ${prod1.productName} @ Rs ${prod1.salePrice} (-${disc1}%) = Rs ${line1Total.toFixed(2)}`);
    console.log(`  * ${saleQty2} x ${prod2.productName} @ Rs ${prod2.salePrice} (-${disc2}%) = Rs ${line2Total.toFixed(2)}`);
    console.log(`  * ${saleQty3} x ${prod3.productName} @ Rs ${prod3.salePrice} (-${disc3}%) = Rs ${line3Total.toFixed(2)}`);
    console.log(`  * Gross Invoice Total: Rs ${expectedInvoiceTotal}`);
    console.log(`  * Paid Amount (Cash In): Rs ${paidAmount.toFixed(2)} (Partial Payment)`);
    console.log(`  * Remaining Balance Due: Rs ${expectedBalance}`);

    const createInvRes = await api('/invoices', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        customerId: customer.id,
        invoiceDate: new Date().toISOString().split('T')[0],
        paidAmount: paidAmount,
        notes: 'E2E Automated Verification Test Sale',
        items: [
          { productId: prod1.id, qty: saleQty1, unitPrice: parseFloat(prod1.salePrice), discount: disc1 },
          { productId: prod2.id, qty: saleQty2, unitPrice: parseFloat(prod2.salePrice), discount: disc2 },
          { productId: prod3.id, qty: saleQty3, unitPrice: parseFloat(prod3.salePrice), discount: disc3 },
        ],
      }),
    });
    if (!createInvRes.ok) throw new Error(`Invoice creation failed: ${JSON.stringify(createInvRes.data)}`);

    const createdInvoice = createInvRes.data.data;
    console.log(`✓ Invoice Saved to Neon Cloud DB: ${createdInvoice.invoiceNo} (ID: ${createdInvoice.id})`);

    // 5. Confirm Stock Decreased
    const p1After = (await api(`/products/${prod1.id}`, { headers: authHeaders1 })).data.data;
    const p2After = (await api(`/products/${prod2.id}`, { headers: authHeaders1 })).data.data;
    const p3After = (await api(`/products/${prod3.id}`, { headers: authHeaders1 })).data.data;

    const stockCheck1 = parseFloat(p1After.stockQty) === initialStock1 - saleQty1;
    const stockCheck2 = parseFloat(p2After.stockQty) === initialStock2 - saleQty2;
    const stockCheck3 = parseFloat(p3After.stockQty) === initialStock3 - saleQty3;

    console.log(`Stock Decrease Verification:`);
    console.log(`  - ${prod1.productName}: ${initialStock1} -> ${p1After.stockQty} (Expected: ${initialStock1 - saleQty1}) [${stockCheck1 ? 'PASS' : 'FAIL'}]`);
    console.log(`  - ${prod2.productName}: ${initialStock2} -> ${p2After.stockQty} (Expected: ${initialStock2 - saleQty2}) [${stockCheck2 ? 'PASS' : 'FAIL'}]`);
    console.log(`  - ${prod3.productName}: ${initialStock3} -> ${p3After.stockQty} (Expected: ${initialStock3 - saleQty3}) [${stockCheck3 ? 'PASS' : 'FAIL'}]`);

    // 6. Confirm Customer Ledger
    const custLedgerAfter = (await api(`/ledger/customer/${customer.id}`, { headers: authHeaders1 })).data.data;
    const newTxns = custLedgerAfter.transactions.slice(initialLedgerTxCount);
    console.log(`Customer Ledger Verification:`);
    console.log(`  New Ledger Transactions Appended: ${newTxns.length}`);
    newTxns.forEach(t => {
      console.log(`    * [${t.referenceType}] ${t.description} -> Debit (Dr): Rs ${t.debit} | Credit (Cr): Rs ${t.credit} | Running Balance: Rs ${t.runningBalance}`);
    });
    const expectedNewLedgerClosing = (initialLedgerClosing + parseFloat(expectedInvoiceTotal) - paidAmount).toFixed(2);
    const ledgerCheck = parseFloat(custLedgerAfter.summary.closingBalance).toFixed(2) === expectedNewLedgerClosing;
    console.log(`  Ledger Closing Balance: Before = Rs ${initialLedgerClosing} -> After = Rs ${custLedgerAfter.summary.closingBalance} (Expected: Rs ${expectedNewLedgerClosing}) [${ledgerCheck ? 'PASS' : 'FAIL'}]`);

    // 7. Confirm Cash Book
    const cashBookAfter = (await api('/cash-book', { headers: authHeaders1 })).data;
    const latestCashEntry = cashBookAfter.data[cashBookAfter.data.length - 1];
    const cashInAmount = parseFloat(latestCashEntry.cashIn);
    const cashCheck = cashInAmount === paidAmount;
    console.log(`Cash Book Verification:`);
    console.log(`  New Cash Book Entry: "${latestCashEntry.description}"`);
    console.log(`  Recorded Cash In: Rs ${cashInAmount.toFixed(2)} (Expected: Rs ${paidAmount.toFixed(2)}) [${cashCheck ? 'PASS' : 'FAIL'}]`);
    console.log(`  Net Cash Running Balance: Rs ${cashBookBefore.summary.net} -> Rs ${cashBookAfter.summary.net}`);

    // 8. Confirm Dashboard
    const dashAfter = (await api('/dashboard/stats', { headers: authHeaders1 })).data.data;
    const salesDiff = (parseFloat(dashAfter.todaySales) - parseFloat(dashBefore.todaySales)).toFixed(2);
    const profitDiff = (parseFloat(dashAfter.todayProfit) - parseFloat(dashBefore.todayProfit)).toFixed(2);

    const cost1 = saleQty1 * parseFloat(prod1.purchasePrice);
    const cost2 = saleQty2 * parseFloat(prod2.purchasePrice);
    const cost3 = saleQty3 * parseFloat(prod3.purchasePrice);
    const expectedProfit = ((line1Total - cost1) + (line2Total - cost2) + (line3Total - cost3)).toFixed(2);

    const dashSalesCheck = salesDiff === expectedInvoiceTotal;
    const dashProfitCheck = profitDiff === expectedProfit;
    console.log(`Dashboard Verification:`);
    console.log(`  Today Sales: Rs ${dashBefore.todaySales} -> Rs ${dashAfter.todaySales} (+Rs ${salesDiff}, Expected: +Rs ${expectedInvoiceTotal}) [${dashSalesCheck ? 'PASS' : 'FAIL'}]`);
    console.log(`  Today Profit: Rs ${dashBefore.todayProfit} -> Rs ${dashAfter.todayProfit} (+Rs ${profitDiff}, Expected: +Rs ${expectedProfit}) [${dashProfitCheck ? 'PASS' : 'FAIL'}]`);

    const test1Passed = stockCheck1 && stockCheck2 && stockCheck3 && ledgerCheck && cashCheck && dashSalesCheck && dashProfitCheck;
    results.test1_sales = {
      pass: test1Passed,
      invoiceNo: createdInvoice.invoiceNo,
      invoiceId: createdInvoice.id,
      customerName: customer.customerName,
      totalAmount: expectedInvoiceTotal,
      paidAmount: paidAmount.toFixed(2),
      balanceAmount: expectedBalance,
      stockDeltas: [
        { product: prod1.productName, before: initialStock1, sold: saleQty1, after: parseFloat(p1After.stockQty) },
        { product: prod2.productName, before: initialStock2, sold: saleQty2, after: parseFloat(p2After.stockQty) },
        { product: prod3.productName, before: initialStock3, sold: saleQty3, after: parseFloat(p3After.stockQty) },
      ],
      ledger: { before: initialLedgerClosing, after: parseFloat(custLedgerAfter.summary.closingBalance), expected: expectedNewLedgerClosing },
      cashBook: { recordedCashIn: cashInAmount, expectedCashIn: paidAmount },
      dashboard: {
        todaySales: { before: dashBefore.todaySales, after: dashAfter.todaySales, diff: salesDiff, expected: expectedInvoiceTotal },
        todayProfit: { before: dashBefore.todayProfit, after: dashAfter.todayProfit, diff: profitDiff, expected: expectedProfit },
      },
    };
    console.log(`\nTEST 1 RESULT: ${test1Passed ? '>>> PASS <<<' : '>>> FAIL <<<'}`);

    // ─────────────────────────────────────────────────────────
    // TEST 2: Purchasing Flow Test
    // ─────────────────────────────────────────────────────────
    logHeader('TEST 2: Purchasing Flow Test');

    const companiesRes = await api('/companies', { headers: authHeaders1 });
    const company = companiesRes.data.data[0];
    console.log(`Selected Company/Distributor: "${company.companyName}" (Initial Balance: Rs ${company.currentBalance})`);

    const targetProd = p1After;
    const poBeforeStock = parseFloat(targetProd.stockQty);
    console.log(`Target Product: "${targetProd.productName}" (Stock Before PO: ${poBeforeStock} ${targetProd.unit}, Purchase Price: Rs ${targetProd.purchasePrice})`);

    const compLedgerBefore = (await api(`/ledger/company/${company.id}`, { headers: authHeaders1 })).data.data;
    const compLedgerBeforeBal = parseFloat(compLedgerBefore.summary.closingBalance);
    const compLedgerBeforeCount = compLedgerBefore.transactions.length;

    const cashBeforePO = (await api('/cash-book', { headers: authHeaders1 })).data;
    const cashBalBeforePO = parseFloat(cashBeforePO.summary.net);

    console.log(`Company Ledger Before: ${compLedgerBeforeCount} entries, Closing Balance = Rs ${compLedgerBeforeBal}`);
    console.log(`Cash Book Before PO: Net Cash = Rs ${cashBalBeforePO}`);

    const poQty = 50;
    const poUnitPrice = parseFloat(targetProd.purchasePrice);
    const poDisc = 0;
    const expectedPOTotal = (poQty * poUnitPrice).toFixed(2);
    const poPaidAmount = 50.00; // Partial payment of Rs 50 made to distributor
    const expectedPOBalance = (expectedPOTotal - poPaidAmount).toFixed(2);

    console.log(`Creating Purchase Order:`);
    console.log(`  * ${poQty} x ${targetProd.productName} @ Rs ${poUnitPrice} = Rs ${expectedPOTotal}`);
    console.log(`  * Amount Paid Out: Rs ${poPaidAmount.toFixed(2)}`);
    console.log(`  * Remaining Balance Payable to Distributor: Rs ${expectedPOBalance}`);

    const poRes = await api('/purchases', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        companyId: company.id,
        purchaseDate: new Date().toISOString().split('T')[0],
        paidAmount: poPaidAmount,
        notes: 'E2E Automated Verification Test PO',
        items: [
          { productId: targetProd.id, qty: poQty, unitPrice: poUnitPrice, discount: poDisc },
        ],
      }),
    });
    if (!poRes.ok) throw new Error(`PO creation failed: ${JSON.stringify(poRes.data)}`);

    const createdPO = poRes.data.data;
    const poNumber = createdPO.invoiceNo || createdPO.purchaseNo;
    console.log(`✓ Purchase Order Saved: ${poNumber} (ID: ${createdPO.id})`);

    // Confirm Stock Increased
    const poAfterProd = (await api(`/products/${targetProd.id}`, { headers: authHeaders1 })).data.data;
    const poAfterStock = parseFloat(poAfterProd.stockQty);
    const poStockCheck = poAfterStock === poBeforeStock + poQty;
    console.log(`Stock Increase Verification:`);
    console.log(`  - ${targetProd.productName}: ${poBeforeStock} -> ${poAfterStock} (Expected: ${poBeforeStock + poQty}) [${poStockCheck ? 'PASS' : 'FAIL'}]`);

    // Confirm Company Ledger
    const compLedgerAfter = (await api(`/ledger/company/${company.id}`, { headers: authHeaders1 })).data.data;
    const newCompTxns = compLedgerAfter.transactions.slice(compLedgerBeforeCount);
    console.log(`Company Ledger Verification:`);
    console.log(`  New Ledger Transactions Appended: ${newCompTxns.length}`);
    newCompTxns.forEach(t => {
      console.log(`    * [${t.referenceType}] ${t.description} -> Debit (Dr): Rs ${t.debit} | Credit (Cr): Rs ${t.credit} | Running Balance: Rs ${t.runningBalance}`);
    });
    const expectedCompClosing = (compLedgerBeforeBal + parseFloat(expectedPOTotal) - poPaidAmount).toFixed(2);
    const compLedgerCheck = parseFloat(compLedgerAfter.summary.closingBalance).toFixed(2) === expectedCompClosing;
    console.log(`  Company Ledger Closing Balance: Before = Rs ${compLedgerBeforeBal} -> After = Rs ${compLedgerAfter.summary.closingBalance} (Expected: Rs ${expectedCompClosing}) [${compLedgerCheck ? 'PASS' : 'FAIL'}]`);

    // Confirm Cash Book for Cash Out
    const cashAfterPO = (await api('/cash-book', { headers: authHeaders1 })).data;
    const latestPOCashEntry = cashAfterPO.data[cashAfterPO.data.length - 1];
    const cashOutAmount = parseFloat(latestPOCashEntry.cashOut);
    const poCashCheck = cashOutAmount === poPaidAmount;
    console.log(`Cash Book Outflow Verification:`);
    console.log(`  Recorded Entry: "${latestPOCashEntry.description}"`);
    console.log(`  Cash Out Recorded: Rs ${cashOutAmount.toFixed(2)} (Expected: Rs ${poPaidAmount.toFixed(2)}) [${poCashCheck ? 'PASS' : 'FAIL'}]`);
    console.log(`  Net Cash Running Balance: Rs ${cashBalBeforePO} -> Rs ${cashAfterPO.summary.net} (-Rs ${(cashBalBeforePO - parseFloat(cashAfterPO.summary.net)).toFixed(2)})`);

    const test2Passed = poStockCheck && compLedgerCheck && poCashCheck;
    results.test2_purchase = {
      pass: test2Passed,
      purchaseNo: poNumber,
      purchaseId: createdPO.id,
      companyName: company.companyName,
      totalAmount: expectedPOTotal,
      paidAmount: poPaidAmount.toFixed(2),
      balanceAmount: expectedPOBalance,
      stock: { product: targetProd.productName, before: poBeforeStock, added: poQty, after: poAfterStock },
      ledger: { before: compLedgerBeforeBal, after: parseFloat(compLedgerAfter.summary.closingBalance), expected: expectedCompClosing },
      cashBook: { recordedCashOut: cashOutAmount, expectedCashOut: poPaidAmount },
    };
    console.log(`\nTEST 2 RESULT: ${test2Passed ? '>>> PASS <<<' : '>>> FAIL <<<'}`);

    // ─────────────────────────────────────────────────────────
    // TEST 3: PDF & Excel Export Test
    // ─────────────────────────────────────────────────────────
    logHeader('TEST 3: PDF & Excel Export Test');

    const exportsToTest = [
      { name: 'Invoice PDF', url: `/export/invoice/${createdInvoice.id}/pdf`, type: 'pdf' },
      { name: 'Invoice Excel', url: `/export/invoice/${createdInvoice.id}/excel`, type: 'excel' },
      { name: 'Customer Ledger PDF', url: `/export/ledger/customer/${customer.id}/pdf`, type: 'pdf' },
      { name: 'Customer Ledger Excel', url: `/export/ledger/customer/${customer.id}/excel`, type: 'excel' },
      { name: 'Cash Book PDF', url: `/export/cash-book/pdf`, type: 'pdf' },
      { name: 'Cash Book Excel', url: `/export/cash-book/excel`, type: 'excel' },
      { name: 'Profit Report PDF', url: `/export/profit/pdf`, type: 'pdf' },
      { name: 'Profit Report Excel', url: `/export/profit/excel`, type: 'excel' },
    ];

    const exportItems = [];
    let allExportsValid = true;

    for (const exp of exportsToTest) {
      const response = await api(exp.url, {
        headers: authHeaders1,
        asBuffer: true,
      });
      const buffer = response.buffer;
      const sizeBytes = buffer.length;
      let valid = false;
      let notes = '';

      if (exp.type === 'pdf') {
        const header = buffer.slice(0, 5).toString('ascii');
        valid = response.status === 200 && header.startsWith('%PDF-') && sizeBytes > 1000;
        notes = `Valid PDF Header (${header}), File Size: ${(sizeBytes / 1024).toFixed(1)} KB`;
      } else if (exp.type === 'excel') {
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        const rowCount = worksheet.rowCount;
        valid = response.status === 200 && isZip && rowCount > 3;
        notes = `Valid XLSX (${worksheet.name}), Rows: ${rowCount}, Size: ${(sizeBytes / 1024).toFixed(1)} KB`;
      }

      if (!valid) allExportsValid = false;
      console.log(`  ${valid ? '✓' : '✗'} ${exp.name.padEnd(24)} -> HTTP ${response.status} | ${notes} [${valid ? 'PASS' : 'FAIL'}]`);
      exportItems.push({ name: exp.name, status: response.status, size: sizeBytes, valid, notes });
    }

    results.test3_exports = {
      pass: allExportsValid,
      items: exportItems,
    };
    console.log(`\nTEST 3 RESULT: ${allExportsValid ? '>>> PASS <<<' : '>>> FAIL <<<'}`);

    // ─────────────────────────────────────────────────────────
    // TEST 4: Multi-Device / Multi-Session Sync Test
    // ─────────────────────────────────────────────────────────
    logHeader('TEST 4: Multi-Device / Multi-Session Sync Test');

    console.log('Simulating fresh login from a second laptop / incognito session...');
    const session2Login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@medicalstore.app', password: 'Demo@12345' }),
    });
    const token2 = session2Login.data.accessToken;
    console.log(`✓ Second Session Authenticated independently! Access token granted.`);
    const authHeaders2 = { Authorization: `Bearer ${token2}` };

    // Fetch invoice from session 2
    const s2Invoice = (await api(`/invoices/${createdInvoice.id}`, { headers: authHeaders2 })).data.data;
    const invSyncMatch = s2Invoice.invoiceNo === createdInvoice.invoiceNo &&
                         parseFloat(s2Invoice.totalAmount).toFixed(2) === expectedInvoiceTotal;
    console.log(`  Session 2 Invoice Query: Invoice ${s2Invoice.invoiceNo} Total = Rs ${s2Invoice.totalAmount} (Match: ${invSyncMatch})`);

    // Fetch product stock from session 2
    const s2Prod = (await api(`/products/${prod1.id}`, { headers: authHeaders2 })).data.data;
    const stockSyncMatch = parseFloat(s2Prod.stockQty) === poAfterStock;
    console.log(`  Session 2 Product Stock: ${s2Prod.productName} = ${s2Prod.stockQty} ${s2Prod.unit} (Match: ${stockSyncMatch})`);

    // Fetch customer ledger from session 2
    const s2Ledger = (await api(`/ledger/customer/${customer.id}`, { headers: authHeaders2 })).data.data;
    const ledgerSyncMatch = parseFloat(s2Ledger.summary.closingBalance).toFixed(2) === custLedgerAfter.summary.closingBalance;
    console.log(`  Session 2 Customer Ledger: Closing Balance = Rs ${s2Ledger.summary.closingBalance} (Match: ${ledgerSyncMatch})`);

    // Fetch dashboard stats from session 2
    const s2Dash = (await api('/dashboard/stats', { headers: authHeaders2 })).data.data;
    const dashSyncMatch = s2Dash.todaySales === dashAfter.todaySales && s2Dash.todayProfit === dashAfter.todayProfit;
    console.log(`  Session 2 Dashboard: Today Sales = Rs ${s2Dash.todaySales}, Today Profit = Rs ${s2Dash.todayProfit} (Match: ${dashSyncMatch})`);

    const test4Passed = invSyncMatch && stockSyncMatch && ledgerSyncMatch && dashSyncMatch;
    results.test4_multisession = {
      pass: test4Passed,
      invoiceMatch: invSyncMatch,
      stockMatch: stockSyncMatch,
      ledgerMatch: ledgerSyncMatch,
      dashMatch: dashSyncMatch,
    };
    console.log(`\nTEST 4 RESULT: ${test4Passed ? '>>> PASS <<<' : '>>> FAIL <<<'}`);

    // ─────────────────────────────────────────────────────────
    // TEST 5: Data Isolation Test (Multi-Tenant)
    // ─────────────────────────────────────────────────────────
    logHeader('TEST 5: Data Isolation Test (Multi-Tenant)');

    const user2Email = `isolated_${Date.now()}@medicalstore.app`;
    console.log(`Registering brand new separate business tenant: "${user2Email}"...`);
    const user2Signup = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        businessName: 'Apex Health Distributors',
        ownerName: 'Zubair Tariq',
        email: user2Email,
        password: 'Zubair@Secure123',
      }),
    });
    if (!user2Signup.ok) throw new Error(`User 2 signup failed: ${JSON.stringify(user2Signup.data)}`);

    const tokenUser2 = user2Signup.data.accessToken;
    const user2 = user2Signup.data.user;
    console.log(`✓ Second Tenant Created: ${user2.ownerName} (${user2.businessName}) [ID: ${user2.id}]`);
    const authHeadersUser2 = { Authorization: `Bearer ${tokenUser2}` };

    // 1. Verify User 2 sees 0 products
    const u2Products = (await api('/products', { headers: authHeadersUser2 })).data;
    const u2ProdCount = u2Products.total;
    const u2ProdZero = u2ProdCount === 0;
    console.log(`  Tenant 2 Products: ${u2ProdCount} (Expected: 0) [${u2ProdZero ? 'PASS' : 'FAIL'}]`);

    // 2. Verify User 2 sees 0 customers
    const u2Customers = (await api('/customers', { headers: authHeadersUser2 })).data;
    const u2CustCount = u2Customers.total;
    const u2CustZero = u2CustCount === 0;
    console.log(`  Tenant 2 Customers: ${u2CustCount} (Expected: 0) [${u2CustZero ? 'PASS' : 'FAIL'}]`);

    // 3. Verify User 2 sees 0 companies
    const u2Companies = (await api('/companies', { headers: authHeadersUser2 })).data;
    const u2CompCount = u2Companies.total;
    const u2CompZero = u2CompCount === 0;
    console.log(`  Tenant 2 Companies: ${u2CompCount} (Expected: 0) [${u2CompZero ? 'PASS' : 'FAIL'}]`);

    // 4. Verify User 2 sees 0 invoices
    const u2Invoices = (await api('/invoices', { headers: authHeadersUser2 })).data;
    const u2InvCount = u2Invoices.total;
    const u2InvZero = u2InvCount === 0;
    console.log(`  Tenant 2 Invoices: ${u2InvCount} (Expected: 0) [${u2InvZero ? 'PASS' : 'FAIL'}]`);

    // 5. Verify User 2 sees 0 cash book entries
    const u2Cash = (await api('/cash-book', { headers: authHeadersUser2 })).data;
    const u2CashCount = u2Cash.data.length;
    const u2CashZero = u2CashCount === 0;
    console.log(`  Tenant 2 Cash Book: ${u2CashCount} entries (Expected: 0) [${u2CashZero ? 'PASS' : 'FAIL'}]`);

    // 6. Verify User 2 dashboard is clean
    const u2Dash = (await api('/dashboard/stats', { headers: authHeadersUser2 })).data.data;
    const u2DashClean = parseFloat(u2Dash.todaySales) === 0 &&
                        parseFloat(u2Dash.todayProfit) === 0 &&
                        parseFloat(u2Dash.totalReceivables) === 0 &&
                        parseFloat(u2Dash.totalPayables) === 0;
    console.log(`  Tenant 2 Dashboard: Sales = Rs ${u2Dash.todaySales}, Profit = Rs ${u2Dash.todayProfit}, Receivables = Rs ${u2Dash.totalReceivables}, Payables = Rs ${u2Dash.totalPayables} [${u2DashClean ? 'PASS' : 'FAIL'}]`);

    // 7. Security: Direct ID access attack — User 2 attempts to fetch User 1's invoice
    const directInvoiceReq = await api(`/invoices/${createdInvoice.id}`, { headers: authHeadersUser2 });
    const directInvoiceBlocked = directInvoiceReq.status === 404;
    console.log(`  Security Check: Direct ID query on Tenant 1 Invoice (${createdInvoice.id}) -> HTTP ${directInvoiceReq.status} [${directInvoiceBlocked ? 'PASS' : 'FAIL'}]`);

    // 8. Security: Direct ID access attack — User 2 attempts to fetch User 1's customer ledger
    const directLedgerReq = await api(`/ledger/customer/${customer.id}`, { headers: authHeadersUser2 });
    const directLedgerBlocked = directLedgerReq.status === 404;
    console.log(`  Security Check: Direct ID query on Tenant 1 Customer Ledger (${customer.id}) -> HTTP ${directLedgerReq.status} [${directLedgerBlocked ? 'PASS' : 'FAIL'}]`);

    const test5Passed = u2ProdZero && u2CustZero && u2CompZero && u2InvZero && u2CashZero && u2DashClean && directInvoiceBlocked && directLedgerBlocked;
    results.test5_isolation = {
      pass: test5Passed,
      user2Email,
      counts: { products: u2ProdCount, customers: u2CustCount, companies: u2CompCount, invoices: u2InvCount, cashEntries: u2CashCount },
      directInvoiceBlocked,
      directLedgerBlocked,
    };
    console.log(`\nTEST 5 RESULT: ${test5Passed ? '>>> PASS <<<' : '>>> FAIL <<<'}`);

    // Output final summary json
    fs.writeFileSync('test_results_summary.json', JSON.stringify(results, null, 2));
    console.log('\n===============================================================');
    console.log('  ALL END-TO-END TESTS FINISHED SUCCESSFULLY');
    console.log('===============================================================');
  } catch (err) {
    console.error('Fatal Test Execution Error:', err);
    process.exit(1);
  }
}

run();
