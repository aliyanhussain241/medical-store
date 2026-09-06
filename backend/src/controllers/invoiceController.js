// ─────────────────────────────────────────────────────────────
// src/controllers/invoiceController.js
// Sales Invoice pipeline:
//   - Decrease stock
//   - Customer ledger debit (they owe us)
//   - Cash book credit (cash received)
//   - Daily profit update
// All inside a Prisma $transaction
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const prisma = require('../utils/prismaClient');
const { calcLineTotal } = require('../utils/numberUtils');
const { getNextEntryNo } = require('./cashBookController');

// ── Sequential invoice number per user ────────────────────────
async function nextInvoiceNo(userId) {
  const last = await prisma.invoice.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNo: true },
  });
  if (!last) return 'INV-00001';
  const num = parseInt(last.invoiceNo.replace('INV-', ''), 10) + 1;
  return `INV-${String(num).padStart(5, '0')}`;
}

// ── GET /api/invoices ─────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search, customerId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(customerId && { customerId }),
      ...(status && { paymentStatus: status }),
      ...((from || to) && {
        invoiceDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { customer: { customerName: { contains: search, mode: 'insensitive' } } },
          { customer: { shopName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { customerName: true, shopName: true } },
          items: { include: { product: { select: { productName: true, unit: true } } } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ success: true, data: invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/invoices/:id ─────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/invoices/:id/print ────────────────────────────
async function markPrinted(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { printCount: { increment: 1 } },
    });

    res.json({
      success: true,
      printCount: updated.printCount,
      status: updated.printCount > 1 ? 'COPY' : 'ORIGINAL',
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/invoices ────────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { customerId, invoiceDate, items, paidAmount, notes, salesman, paymentMethod, bankAccountId, narration, invoiceType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required.' });
    }

    const method = (paymentMethod || 'CASH').toUpperCase();

    // If BANK, validate bank account
    let bankAccount = null;
    if (method === 'BANK') {
      if (!bankAccountId) {
        return res.status(400).json({ success: false, message: 'Bank account is required when payment method is Bank.' });
      }
      bankAccount = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId: req.user.id } });
      if (!bankAccount) {
        return res.status(404).json({ success: false, message: 'Bank account not found.' });
      }
    }

    // Fetch products
    const productIds = items.map((i) => i.productId);
    const uniqueIds = [...new Set(productIds)];
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueIds }, userId: req.user.id },
    });
    if (products.length !== uniqueIds.length) {
      return res.status(400).json({ success: false, message: 'One or more products not found.' });
    }

    // Stock check accounting for regular qty + scheme units + free pcs
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      const schemeUnits = parseFloat(item.schemeUnits || 0);
      const freePcs = parseFloat(item.freePcs || 0);
      const totalUnitsDeducted = parseFloat(item.qty || 0) + schemeUnits + freePcs;
      if (parseFloat(product.stockQty) < totalUnitsDeducted) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.productName}". Available: ${product.stockQty} ${product.unit}, required: ${totalUnitsDeducted}.`,
        });
      }
    }

    // Calculate line totals and reference table fields
    const lineItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const qty = parseFloat(item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount || 0);
      const grossTotal = parseFloat((qty * unitPrice).toFixed(2));
      const discountAmt = parseFloat((grossTotal * (discount / 100)).toFixed(2));
      const lineNet = parseFloat((grossTotal - discountAmt).toFixed(2));
      const schemeUnits = parseFloat(item.schemeUnits || 0);
      const schemeTotal = parseFloat(item.schemeTotal || 0);
      const freePcs = parseFloat(item.freePcs || 0);
      const costTotal = parseFloat((qty * parseFloat(product.purchasePrice)).toFixed(2));

      return {
        ...item,
        qty,
        unitPrice,
        pricingMode: item.pricingMode || 'TP',
        batchNo: item.batchNo || product.batchNo || null,
        packing: item.packing || product.unit || null,
        discount,
        discountAmt,
        schemeUnits,
        schemeTotal,
        freePcs,
        grossTotal,
        total: lineNet,
        costTotal,
      };
    });

    const totalAmount = lineItems.reduce((s, i) => s + parseFloat(i.total), 0).toFixed(2);
    const totalCost = lineItems.reduce((s, i) => s + parseFloat(i.costTotal), 0).toFixed(2);
    const totalProfit = (parseFloat(totalAmount) - parseFloat(totalCost)).toFixed(2);
    const paid = parseFloat(paidAmount || 0);
    const balance = (parseFloat(totalAmount) - paid).toFixed(2);
    const paymentStatus = paid <= 0 ? 'PENDING' : paid >= parseFloat(totalAmount) ? 'PAID' : 'PARTIAL';

    const invoiceNo = await nextInvoiceNo(req.user.id);

    const customer = await prisma.customer.findFirst({ where: { id: customerId, userId: req.user.id } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    // Get cash book running balance (only needed for CASH method)
    let cashRunning = 0;
    if (method === 'CASH') {
      const lastCashEntry = await prisma.cashBookEntry.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
      cashRunning = parseFloat(lastCashEntry?.runningBalance || 0);
    }

    // Get bank running balance (only needed for BANK method)
    let bankRunning = 0;
    if (method === 'BANK' && bankAccount) {
      const lastBankEntry = await prisma.bankBookEntry.findFirst({
        where: { userId: req.user.id, bankAccountId },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      });
      bankRunning = parseFloat(lastBankEntry?.runningBalance ?? bankAccount.openingBalance);
    }

    const lastLedger = await prisma.ledgerTransaction.findFirst({
      where: { userId: req.user.id, partyType: 'CUSTOMER', partyId: customerId },
      orderBy: { createdAt: 'desc' },
    });
    const prvBalance = parseFloat(lastLedger?.runningBalance ?? customer.openingBalance);
    const ledgerRunning = prvBalance;

    const txDate = invoiceDate ? new Date(invoiceDate) : new Date();
    const reportDate = new Date(txDate.toDateString()); // midnight

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create invoice with full reference fields
      const invoice = await tx.invoice.create({
        data: {
          userId: req.user.id,
          customerId,
          invoiceNo,
          invoiceDate: txDate,
          totalAmount,
          paidAmount: paid,
          balanceAmount: balance,
          paymentStatus,
          paymentMethod: method,
          bankAccountId: method === 'BANK' ? bankAccountId : null,
          invoiceType: (invoiceType || 'CREDIT').toUpperCase(),
          narration: narration || null,
          salesman: salesman || null,
          printCount: 0,
          prvBalance,
          notes,
          items: {
            create: lineItems.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              pricingMode: i.pricingMode,
              batchNo: i.batchNo,
              packing: i.packing,
              discount: i.discount,
              discountAmt: i.discountAmt,
              schemeUnits: i.schemeUnits,
              schemeTotal: i.schemeTotal,
              freePcs: i.freePcs,
              grossTotal: i.grossTotal,
              total: i.total,
            })),
          },
        },
        include: { customer: true, items: { include: { product: true } } },
      });

      // 2. Decrease stock + stock movement per item
      for (const item of lineItems) {
        const totalDeducted = parseFloat(item.qty) + parseFloat(item.schemeUnits || 0) + parseFloat(item.freePcs || 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: totalDeducted } },
        });
        await tx.stockMovement.create({
          data: {
            userId: req.user.id,
            productId: item.productId,
            movementType: 'SALE',
            qty: -totalDeducted,
            referenceId: invoice.id,
            movementDate: txDate,
          },
        });
      }

      // 3. Update customer balance (add outstanding)
      await tx.customer.update({
        where: { id: customerId },
        data: { currentBalance: { increment: parseFloat(balance) } },
      });

      // 4. Customer ledger: debit for full sale amount
      await tx.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'CUSTOMER',
          partyId: customerId,
          transactionDate: txDate,
          description: `Invoice — ${invoiceNo}`,
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          debit: parseFloat(totalAmount),
          credit: 0,
          runningBalance: ledgerRunning + parseFloat(totalAmount),
        },
      });

      // 5. If payment received — route to CASH or BANK
      if (paid > 0) {
        if (method === 'BANK') {
          // ── BANK payment: create BankBookEntry (debit = money INTO bank)
          const newBankBalance = bankRunning + paid;
          await tx.bankBookEntry.create({
            data: {
              userId: req.user.id,
              bankAccountId,
              transactionDate: txDate,
              description: `Received from sale invoice# ${invoiceNo}`,
              debit: paid,
              credit: 0,
              runningBalance: newBankBalance,
              referenceType: 'INVOICE',
              referenceId: invoice.id,
              narration: narration || null,
              partyName: customer.customerName.toUpperCase(),
            },
          });

          // Update bank account balance
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { currentBalance: newBankBalance },
          });
        } else {
          // ── CASH payment: create CashBookEntry (as before)
          const mcrNo = await getNextEntryNo(req.user.id, 'MCR');
          await tx.cashBookEntry.create({
            data: {
              userId: req.user.id,
              transactionDate: txDate,
              description: `MCR# ${mcrNo}, Cash received from sale invoice# ${invoiceNo}`,
              cashIn: paid,
              cashOut: 0,
              runningBalance: cashRunning + paid,
              referenceType: 'INVOICE',
              referenceId: invoice.id,
              entryType: 'MCR',
              entryNo: mcrNo,
              partyName: customer.customerName.toUpperCase(),
            },
          });
        }

        // Ledger credit for payment (regardless of method)
        await tx.ledgerTransaction.create({
          data: {
            userId: req.user.id,
            partyType: 'CUSTOMER',
            partyId: customerId,
            transactionDate: txDate,
            description: `Payment (${method}) — ${invoiceNo}`,
            referenceType: 'PAYMENT',
            referenceId: invoice.id,
            debit: 0,
            credit: paid,
            runningBalance: ledgerRunning + parseFloat(totalAmount) - paid,
          },
        });
      }

      // 6. Upsert daily profit record
      await tx.dailyProfit.upsert({
        where: { userId_reportDate: { userId: req.user.id, reportDate } },
        create: {
          userId: req.user.id,
          reportDate,
          totalSales: parseFloat(totalAmount),
          totalCost: parseFloat(totalCost),
          totalProfit: parseFloat(totalProfit),
        },
        update: {
          totalSales: { increment: parseFloat(totalAmount) },
          totalCost: { increment: parseFloat(totalCost) },
          totalProfit: { increment: parseFloat(totalProfit) },
        },
      });

      return invoice;
    }, { maxWait: 15000, timeout: 30000 });

    const full = await prisma.invoice.findUnique({
      where: { id: result.id },
      include: { customer: true, items: { include: { product: true } } },
    });

    res.status(201).json({ success: true, message: `Invoice ${invoiceNo} created successfully.`, data: full });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/invoices/:id/payment ──────────────────────────
async function recordPayment(req, res, next) {
  try {
    const { amount, paymentDate, paymentMethod, bankAccountId } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
    }

    const method = (paymentMethod || 'CASH').toUpperCase();

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { customer: true },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This invoice is already fully paid.' });
    }

    // If BANK, validate bank account
    let bankAccount = null;
    if (method === 'BANK') {
      if (!bankAccountId) {
        return res.status(400).json({ success: false, message: 'Bank account is required when payment method is Bank.' });
      }
      bankAccount = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId: req.user.id } });
      if (!bankAccount) {
        return res.status(404).json({ success: false, message: 'Bank account not found.' });
      }
    }

    const payAmt = parseFloat(amount);
    const remaining = parseFloat(invoice.balanceAmount);
    if (payAmt > remaining) {
      return res.status(400).json({ success: false, message: `Payment exceeds balance due of ${remaining}.` });
    }

    const newPaid = parseFloat(invoice.paidAmount) + payAmt;
    const newBalance = remaining - payAmt;
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';
    const txDate = paymentDate ? new Date(paymentDate) : new Date();

    const lastLedger = await prisma.ledgerTransaction.findFirst({
      where: { userId: req.user.id, partyType: 'CUSTOMER', partyId: invoice.customerId },
      orderBy: { createdAt: 'desc' },
    });
    const ledgerRunning = parseFloat(lastLedger?.runningBalance || 0);

    const txOps = [
      prisma.invoice.update({
        where: { id: req.params.id },
        data: { paidAmount: newPaid, balanceAmount: newBalance, paymentStatus: newStatus },
      }),
      prisma.customer.update({
        where: { id: invoice.customerId },
        data: { currentBalance: { decrement: payAmt } },
      }),
      prisma.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'CUSTOMER',
          partyId: invoice.customerId,
          transactionDate: txDate,
          description: `Payment (${method}) — ${invoice.invoiceNo}`,
          referenceType: 'PAYMENT',
          referenceId: invoice.id,
          debit: 0,
          credit: payAmt,
          runningBalance: ledgerRunning - payAmt,
        },
      }),
    ];

    if (method === 'BANK') {
      // Bank payment received
      const lastBankEntry = await prisma.bankBookEntry.findFirst({
        where: { userId: req.user.id, bankAccountId },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      });
      const bankRunning = parseFloat(lastBankEntry?.runningBalance ?? bankAccount.openingBalance);
      const newBankBalance = bankRunning + payAmt;

      txOps.push(
        prisma.bankBookEntry.create({
          data: {
            userId: req.user.id,
            bankAccountId,
            transactionDate: txDate,
            description: `Received payment — ${invoice.invoiceNo}`,
            debit: payAmt,
            credit: 0,
            runningBalance: newBankBalance,
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            partyName: invoice.customer.customerName.toUpperCase(),
          },
        }),
        prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: newBankBalance },
        }),
      );
    } else {
      // Cash payment received
      const lastCashEntry = await prisma.cashBookEntry.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
      const cashRunning = parseFloat(lastCashEntry?.runningBalance || 0);
      const mcrNo2 = await getNextEntryNo(req.user.id, 'MCR');

      txOps.push(
        prisma.cashBookEntry.create({
          data: {
            userId: req.user.id,
            transactionDate: txDate,
            description: `MCR# ${mcrNo2}, Received cash due to ${payAmt} — ${invoice.invoiceNo}`,
            cashIn: payAmt,
            cashOut: 0,
            runningBalance: cashRunning + payAmt,
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            entryType: 'MCR',
            entryNo: mcrNo2,
            partyName: invoice.customer.customerName.toUpperCase(),
          },
        }),
      );
    }

    await prisma.$transaction(txOps);

    res.json({ success: true, message: `Payment of ${payAmt} recorded on invoice ${invoice.invoiceNo}.` });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/invoices/:id ────────────────────────────────────
// Same-day editing only — invoice date must be today
async function update(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    // Enforce same-day rule
    const today = new Date();
    const invoiceDateObj = new Date(invoice.invoiceDate);
    const isToday =
      invoiceDateObj.getFullYear() === today.getFullYear() &&
      invoiceDateObj.getMonth() === today.getMonth() &&
      invoiceDateObj.getDate() === today.getDate();

    if (!isToday) {
      return res.status(403).json({
        success: false,
        message: 'Only today\'s invoices can be edited. For past invoices, use the "Record Payment" feature instead.',
      });
    }

    // Only allow editing non-financial metadata fields safely
    // (stock/ledger/cashbook were already committed — full re-processing is out of scope)
    const { salesman, notes, narration, invoiceType } = req.body;

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        ...(salesman !== undefined && { salesman: salesman || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(narration !== undefined && { narration: narration || null }),
        ...(invoiceType !== undefined && { invoiceType: invoiceType.toUpperCase() }),
      },
      include: { customer: true, items: { include: { product: true } } },
    });

    res.json({ success: true, message: 'Invoice updated.', data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, recordPayment, markPrinted };
