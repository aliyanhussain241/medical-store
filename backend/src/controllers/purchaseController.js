// ─────────────────────────────────────────────────────────────
// src/controllers/purchaseController.js
// Purchase pipeline: stock increase + company ledger + cash book
// All operations run inside a Prisma $transaction for atomicity
// ─────────────────────────────────────────────────────────────
const { validationResult } = require('express-validator');
const { Decimal } = require('@prisma/client/runtime/library');
const prisma = require('../utils/prismaClient');
const { calcLineTotal } = require('../utils/numberUtils');
const { getNextEntryNo } = require('./cashBookController');

// ── Generate sequential purchase number per user ──────────────
async function nextPurchaseNo(userId) {
  const last = await prisma.purchase.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNo: true },
  });
  if (!last) return 'PO-00001';
  const num = parseInt(last.invoiceNo.replace('PO-', ''), 10) + 1;
  return `PO-${String(num).padStart(5, '0')}`;
}

// ── GET /api/purchases ────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search, companyId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(companyId && { companyId }),
      ...(status && { paymentStatus: status }),
      ...(from || to) && {
        purchaseDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      },
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { company: { companyName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { purchaseDate: 'desc' },
        include: { company: { select: { companyName: true } }, items: { include: { product: { select: { productName: true, unit: true } } } } },
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({ success: true, data: purchases, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/purchases/:id ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        company: true,
        items: { include: { product: true } },
      },
    });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    res.json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/purchases ───────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { companyId, purchaseDate, items, paidAmount, notes, paymentMethod, bankAccountId, narration } = req.body;

    // Validate items
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

    // Resolve all products (must belong to same user)
    const productIds = items.map((i) => i.productId);
    const uniqueIds = [...new Set(productIds)];
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueIds }, userId: req.user.id },
    });
    if (products.length !== uniqueIds.length) {
      return res.status(400).json({ success: false, message: 'One or more products not found.' });
    }

    // Calculate totals
    const lineItems = items.map((item) => {
      const total = calcLineTotal(item.qty, item.unitPrice, item.discount || 0);
      return { ...item, total };
    });
    const totalAmount = lineItems.reduce((s, i) => s + parseFloat(i.total), 0).toFixed(2);
    const paid = parseFloat(paidAmount || 0);
    const balance = (parseFloat(totalAmount) - paid).toFixed(2);
    const paymentStatus = paid <= 0 ? 'PENDING' : paid >= parseFloat(totalAmount) ? 'PAID' : 'PARTIAL';

    const invoiceNo = await nextPurchaseNo(req.user.id);

    // Get current company balance
    const company = await prisma.company.findFirst({ where: { id: companyId, userId: req.user.id } });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    // Get cash book running balance (only needed for CASH method)
    let cashRunning = 0;
    if (method === 'CASH') {
      const lastCashEntry = await prisma.cashBookEntry.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });
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

    const txDate = purchaseDate ? new Date(purchaseDate) : new Date();

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create purchase
      const purchase = await tx.purchase.create({
        data: {
          userId: req.user.id,
          companyId,
          invoiceNo,
          purchaseDate: txDate,
          totalAmount,
          paidAmount: paid,
          balanceAmount: balance,
          paymentStatus,
          paymentMethod: method,
          bankAccountId: method === 'BANK' ? bankAccountId : null,
          narration: narration || null,
          notes,
          items: {
            create: lineItems.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              discount: i.discount || 0,
              total: i.total,
              subUnit: i.subUnit || null,
              piecesQty: i.piecesQty !== undefined && i.piecesQty !== null ? parseFloat(i.piecesQty) : null,
              piecesPerPack: i.piecesPerPack ? parseInt(i.piecesPerPack) : null,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Increase stock for each item + create stock movement
      for (const item of lineItems) {
        const product = products.find((p) => p.id === item.productId);
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: parseFloat(item.qty) } },
        });
        await tx.stockMovement.create({
          data: {
            userId: req.user.id,
            productId: item.productId,
            movementType: 'PURCHASE',
            qty: parseFloat(item.qty),
            referenceId: purchase.id,
            movementDate: txDate,
          },
        });
      }

      // 3. Update company balance (add to payable)
      const newCompanyBalance = parseFloat(company.currentBalance) + parseFloat(balance);
      await tx.company.update({
        where: { id: companyId },
        data: { currentBalance: newCompanyBalance },
      });

      // 4. Ledger: debit company (we owe them the full amount)
      const lastLedger = await tx.ledgerTransaction.findFirst({
        where: { userId: req.user.id, partyType: 'COMPANY', partyId: companyId },
        orderBy: { createdAt: 'desc' },
      });
      const ledgerRunning = parseFloat(lastLedger?.runningBalance || company.openingBalance);

      await tx.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'COMPANY',
          partyId: companyId,
          transactionDate: txDate,
          description: `Purchase — ${invoiceNo}`,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          debit: parseFloat(totalAmount),
          credit: 0,
          runningBalance: ledgerRunning + parseFloat(totalAmount),
        },
      });

      // 5. If payment made — route to CASH or BANK
      if (paid > 0) {
        if (method === 'BANK') {
          // ── BANK payment: create BankBookEntry (credit = money OUT of bank)
          const newBankBalance = bankRunning - paid;
          await tx.bankBookEntry.create({
            data: {
              userId: req.user.id,
              bankAccountId,
              transactionDate: txDate,
              description: `Paid against purchase# ${invoiceNo}`,
              debit: 0,
              credit: paid,
              runningBalance: newBankBalance,
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
              narration: narration || null,
              partyName: company.companyName.toUpperCase(),
            },
          });

          // Update bank account balance
          await tx.bankAccount.update({
            where: { id: bankAccountId },
            data: { currentBalance: newBankBalance },
          });
        } else {
          // ── CASH payment: create CashBookEntry (as before)
          const mcpNo = await getNextEntryNo(req.user.id, 'MCP');
          await tx.cashBookEntry.create({
            data: {
              userId: req.user.id,
              transactionDate: txDate,
              description: `MCP# ${mcpNo}, Paid cash against purchase# ${invoiceNo}`,
              cashIn: 0,
              cashOut: paid,
              runningBalance: cashRunning - paid,
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
              entryType: 'MCP',
              entryNo: mcpNo,
              partyName: company.companyName.toUpperCase(),
            },
          });
        }

        // Ledger credit for payment (regardless of method)
        await tx.ledgerTransaction.create({
          data: {
            userId: req.user.id,
            partyType: 'COMPANY',
            partyId: companyId,
            transactionDate: txDate,
            description: `Payment (${method}) — ${invoiceNo}`,
            referenceType: 'PAYMENT',
            referenceId: purchase.id,
            debit: 0,
            credit: paid,
            runningBalance: ledgerRunning + parseFloat(totalAmount) - paid,
          },
        });
      }

      return purchase;
    }, { maxWait: 15000, timeout: 30000 });

    const full = await prisma.purchase.findUnique({
      where: { id: result.id },
      include: { company: true, items: { include: { product: true } } },
    });

    res.status(201).json({ success: true, message: `Purchase ${invoiceNo} recorded successfully.`, data: full });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/purchases/:id/payment ─────────────────────────
// Record an additional payment against an existing purchase
async function recordPayment(req, res, next) {
  try {
    const { amount, paymentDate, paymentMethod, bankAccountId } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
    }

    const method = (paymentMethod || 'CASH').toUpperCase();

    const purchase = await prisma.purchase.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { company: true } });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    if (purchase.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This purchase is already fully paid.' });
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
    const remaining = parseFloat(purchase.balanceAmount);
    if (payAmt > remaining) {
      return res.status(400).json({ success: false, message: `Payment amount exceeds balance due of ${remaining}.` });
    }

    const newPaid = parseFloat(purchase.paidAmount) + payAmt;
    const newBalance = remaining - payAmt;
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';
    const txDate = paymentDate ? new Date(paymentDate) : new Date();

    const lastLedger = await prisma.ledgerTransaction.findFirst({
      where: { userId: req.user.id, partyType: 'COMPANY', partyId: purchase.companyId },
      orderBy: { createdAt: 'desc' },
    });
    const ledgerRunning = parseFloat(lastLedger?.runningBalance || 0);

    const txOps = [
      prisma.purchase.update({
        where: { id: req.params.id },
        data: { paidAmount: newPaid, balanceAmount: newBalance, paymentStatus: newStatus },
      }),
      prisma.company.update({
        where: { id: purchase.companyId },
        data: { currentBalance: { decrement: payAmt } },
      }),
      prisma.ledgerTransaction.create({
        data: {
          userId: req.user.id,
          partyType: 'COMPANY',
          partyId: purchase.companyId,
          transactionDate: txDate,
          description: `Payment (${method}) — ${purchase.invoiceNo}`,
          referenceType: 'PAYMENT',
          referenceId: purchase.id,
          debit: 0,
          credit: payAmt,
          runningBalance: ledgerRunning - payAmt,
        },
      }),
    ];

    if (method === 'BANK') {
      // Bank payment
      const lastBankEntry = await prisma.bankBookEntry.findFirst({
        where: { userId: req.user.id, bankAccountId },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      });
      const bankRunning = parseFloat(lastBankEntry?.runningBalance ?? bankAccount.openingBalance);
      const newBankBalance = bankRunning - payAmt;

      txOps.push(
        prisma.bankBookEntry.create({
          data: {
            userId: req.user.id,
            bankAccountId,
            transactionDate: txDate,
            description: `Paid against purchase# ${purchase.invoiceNo}`,
            debit: 0,
            credit: payAmt,
            runningBalance: newBankBalance,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            partyName: purchase.company.companyName.toUpperCase(),
          },
        }),
        prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: newBankBalance },
        }),
      );
    } else {
      // Cash payment
      const lastCashEntry = await prisma.cashBookEntry.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
      const cashRunning = parseFloat(lastCashEntry?.runningBalance || 0);
      const mcpNo2 = await getNextEntryNo(req.user.id, 'MCP');

      txOps.push(
        prisma.cashBookEntry.create({
          data: {
            userId: req.user.id,
            transactionDate: txDate,
            description: `MCP# ${mcpNo2}, Paid cash due to ${payAmt} — ${purchase.invoiceNo}`,
            cashIn: 0,
            cashOut: payAmt,
            runningBalance: cashRunning - payAmt,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            entryType: 'MCP',
            entryNo: mcpNo2,
            partyName: purchase.company.companyName.toUpperCase(),
          },
        }),
      );
    }

    await prisma.$transaction(txOps);

    res.json({ success: true, message: `Payment of ${payAmt} recorded.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, recordPayment };
