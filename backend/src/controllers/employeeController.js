// ─────────────────────────────────────────────────────────────
// src/controllers/employeeController.js
// Employee register + salary payment voucher
// Salary payments create CashBook/BankBook EXPENSE entries
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');
const { getNextEntryNo } = require('./cashBookController');

// ── GET /api/employees ────────────────────────────────────────
async function list(req, res, next) {
  try {
    const { search, isActive } = req.query;

    const where = {
      userId: req.user.id,
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && {
        OR: [
          { employeeName: { contains: search, mode: 'insensitive' } },
          { designation: { contains: search, mode: 'insensitive' } },
          { town: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { employeeName: 'asc' },
      include: {
        _count: { select: { salaryPayments: true } },
      },
    });

    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/employees/:id ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        salaryPayments: {
          orderBy: { paymentDate: 'desc' },
          include: { bankAccount: { select: { bankName: true, accountTitle: true } } },
        },
      },
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/employees ───────────────────────────────────────
async function create(req, res, next) {
  try {
    const { employeeName, town, sector, designation, salary } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ success: false, message: 'Employee name is required.' });
    }
    if (!salary || isNaN(parseFloat(salary)) || parseFloat(salary) < 0) {
      return res.status(400).json({ success: false, message: 'Valid salary amount is required.' });
    }

    const employee = await prisma.employee.create({
      data: {
        userId: req.user.id,
        employeeName: employeeName.trim(),
        town: town ? town.trim() : null,
        sector: sector ? sector.trim() : null,
        designation: designation ? designation.trim() : null,
        salary: parseFloat(salary),
        isActive: true,
      },
    });

    res.status(201).json({ success: true, message: 'Employee added.', data: employee });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/employees/:id ────────────────────────────────────
async function update(req, res, next) {
  try {
    const { employeeName, town, sector, designation, salary, isActive } = req.body;

    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...(employeeName !== undefined && { employeeName: employeeName.trim() }),
        ...(town !== undefined && { town: town ? town.trim() : null }),
        ...(sector !== undefined && { sector: sector ? sector.trim() : null }),
        ...(designation !== undefined && { designation: designation ? designation.trim() : null }),
        ...(salary !== undefined && { salary: parseFloat(salary) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json({ success: true, message: 'Employee updated.', data: employee });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/employees/:id ─────────────────────────────────
async function remove(req, res, next) {
  try {
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const paymentCount = await prisma.salaryPayment.count({ where: { employeeId: req.params.id } });
    if (paymentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this employee has ${paymentCount} salary payment(s). Deactivate them instead.`,
      });
    }

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Employee deleted.' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/employees/:id/pay-salary ───────────────────────
// Records a salary payment → creates CashBook EXPENSE or BankBook EXPENSE entry
async function paySalary(req, res, next) {
  try {
    const { amount, paymentDate, paymentMethod, bankAccountId, narration } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const method = (paymentMethod || 'CASH').toUpperCase();
    const payAmt = parseFloat(amount);
    const txDate = paymentDate ? new Date(paymentDate) : new Date();

    // Find the "Salary" account head (EXPENSE category) — create default if not exists
    let salaryHead = await prisma.accountHead.findFirst({
      where: { userId: req.user.id, category: 'EXPENSE', name: { equals: 'Salary', mode: 'insensitive' } },
    });
    if (!salaryHead) {
      salaryHead = await prisma.accountHead.create({
        data: {
          userId: req.user.id,
          name: 'Salary',
          category: 'EXPENSE',
          description: 'Employee salary payments',
        },
      });
    }

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

    const description = `Salary — ${employee.employeeName}${narration ? ` (${narration})` : ''}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the salary payment record
      const payment = await tx.salaryPayment.create({
        data: {
          userId: req.user.id,
          employeeId: employee.id,
          paymentDate: txDate,
          amount: payAmt,
          paymentMethod: method,
          bankAccountId: method === 'BANK' ? bankAccountId : null,
          narration: narration || null,
        },
      });

      if (method === 'BANK') {
        // 2a. Bank payment: credit bank account (money out)
        const lastBankEntry = await tx.bankBookEntry.findFirst({
          where: { userId: req.user.id, bankAccountId },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        });
        const bankRunning = parseFloat(lastBankEntry?.runningBalance ?? bankAccount.openingBalance);
        const newBankBalance = bankRunning - payAmt;

        await tx.bankBookEntry.create({
          data: {
            userId: req.user.id,
            bankAccountId,
            transactionDate: txDate,
            description,
            debit: 0,
            credit: payAmt,
            runningBalance: newBankBalance,
            referenceType: 'SALARY',
            referenceId: payment.id,
            narration: narration || null,
            partyName: employee.employeeName.toUpperCase(),
            accountHeadId: salaryHead.id,
          },
        });

        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: newBankBalance },
        });
      } else {
        // 2b. Cash payment: cashOut entry (EXPENSE type)
        const lastCash = await tx.cashBookEntry.findFirst({
          where: { userId: req.user.id },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        });
        const cashRunning = parseFloat(lastCash?.runningBalance || 0);
        const mcpNo = await getNextEntryNo(req.user.id, 'MCP');

        await tx.cashBookEntry.create({
          data: {
            userId: req.user.id,
            transactionDate: txDate,
            description: `MCP# ${mcpNo}, ${description}`,
            cashIn: 0,
            cashOut: payAmt,
            runningBalance: cashRunning - payAmt,
            referenceType: 'SALARY',
            referenceId: payment.id,
            entryType: 'MCP',
            entryNo: mcpNo,
            partyName: employee.employeeName.toUpperCase(),
            accountHeadId: salaryHead.id,
          },
        });
      }

      return payment;
    }, { maxWait: 15000, timeout: 30000 });

    res.status(201).json({
      success: true,
      message: `Salary of ${payAmt} paid to ${employee.employeeName} via ${method}.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/employees/:id/salary-history ────────────────────
async function salaryHistory(req, res, next) {
  try {
    const { from, to } = req.query;

    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const payments = await prisma.salaryPayment.findMany({
      where: {
        employeeId: req.params.id,
        userId: req.user.id,
        ...((from || to) && {
          paymentDate: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        }),
      },
      orderBy: { paymentDate: 'desc' },
      include: { bankAccount: { select: { bankName: true, accountTitle: true } } },
    });

    const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

    res.json({
      success: true,
      data: { employee, payments, summary: { totalPaid: totalPaid.toFixed(2), paymentCount: payments.length } },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, paySalary, salaryHistory };
