// ─────────────────────────────────────────────────────────────
// src/controllers/dashboardController.js
// Dashboard KPI aggregates — extended for full StoreOS dashboard
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

async function stats(req, res, next) {
  try {
    const userId = req.user.id;
    const now = new Date();
    const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const maxDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Wide window to catch timezone differences
    const wideMin = new Date(minDate.getTime() - 12 * 3600 * 1000);
    const wideMax = new Date(maxDate.getTime() + 12 * 3600 * 1000);

    const [
      todaySalesAgg,
      todayProfitRecord,
      totalReceivables,
      totalPayables,
      lowStockRaw,
      overdueCustomers,
      recentInvoices,
      todayPurchasesAgg,
      // Cash flow — payment in today (invoice payments received)
      paymentInToday,
      // Cash flow — payment out today (purchase payments made)
      paymentOutToday,
      // Overall received total (all invoice payments)
      overallReceived,
      // Overall settled total (all purchase payments)
      overallSettled,
      // Cash in hand (cash book running balance)
      cashBalance,
      // Bank accounts
      bankAccounts,
    ] = await Promise.all([
      // Today's total invoice sales
      prisma.invoice.aggregate({
        where: {
          userId,
          OR: [
            { invoiceDate: { gte: wideMin, lte: wideMax } },
            { createdAt: { gte: wideMin, lte: wideMax } },
          ],
        },
        _sum: { totalAmount: true },
      }),

      // Today's profit record
      prisma.dailyProfit.findFirst({
        where: { userId, reportDate: { gte: wideMin, lte: wideMax } },
        orderBy: { reportDate: 'desc' },
      }),

      // Total receivables (customers with positive balance)
      prisma.customer.aggregate({
        where: { userId, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),

      // Total payables (companies with positive balance)
      prisma.company.aggregate({
        where: { userId, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),

      // Low stock count
      prisma.$queryRaw`
        SELECT COUNT(*) as count FROM products
        WHERE user_id = ${userId} AND stock_qty <= min_stock_alert
      `,

      // Customers with outstanding balance
      prisma.customer.findMany({
        where: { userId, currentBalance: { gt: 0 } },
        orderBy: { currentBalance: 'desc' },
        take: 10,
        select: { id: true, customerName: true, shopName: true, currentBalance: true },
      }),

      // Last 5 invoices
      prisma.invoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: { select: { customerName: true } } },
      }),

      // Today's purchases
      prisma.purchase.aggregate({
        where: {
          userId,
          OR: [
            { purchaseDate: { gte: wideMin, lte: wideMax } },
            { createdAt: { gte: wideMin, lte: wideMax } },
          ],
        },
        _sum: { totalAmount: true },
      }).catch(() => ({ _sum: { totalAmount: 0 } })),

      // Cash payments received today (from invoice payments / cash book credit entries)
      prisma.cashBook.aggregate({
        where: { userId, type: 'CREDIT', date: { gte: wideMin, lte: wideMax } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      // Cash payments out today (cash book debit entries)
      prisma.cashBook.aggregate({
        where: { userId, type: 'DEBIT', date: { gte: wideMin, lte: wideMax } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      // Overall received (all time credit cash)
      prisma.cashBook.aggregate({
        where: { userId, type: 'CREDIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      // Overall settled (all time debit cash)
      prisma.cashBook.aggregate({
        where: { userId, type: 'DEBIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      // Cash in hand (latest cash book running balance, or net credit - debit)
      prisma.cashBook.aggregate({
        where: { userId },
        _sum: { amount: true },
      }).then(async (agg) => {
        // Try to get the running balance approach
        const credits = await prisma.cashBook.aggregate({
          where: { userId, type: 'CREDIT' },
          _sum: { amount: true },
        });
        const debits = await prisma.cashBook.aggregate({
          where: { userId, type: 'DEBIT' },
          _sum: { amount: true },
        });
        return {
          balance: parseFloat(credits._sum.amount || 0) - parseFloat(debits._sum.amount || 0),
        };
      }).catch(() => ({ balance: 0 })),

      // Bank accounts with current balance
      prisma.bankAccount.findMany({
        where: { userId },
        select: { id: true, accountName: true, bankName: true, currentBalance: true },
        orderBy: { accountName: 'asc' },
      }).catch(() => []),
    ]);

    const todaySales = parseFloat(todaySalesAgg._sum.totalAmount || todayProfitRecord?.totalSales || 0);
    const todayCOGS = parseFloat(todayProfitRecord?.totalCost || 0);
    const todayProfit = parseFloat(todayProfitRecord?.totalProfit || 0);

    // Combined cash + bank
    const bankTotal = bankAccounts.reduce((s, b) => s + parseFloat(b.currentBalance || 0), 0);
    const combinedLiquidity = (cashBalance.balance || 0) + bankTotal;

    res.json({
      success: true,
      data: {
        // Financial health KPIs
        todaySales: todaySales.toFixed(2),
        todayPurchases: parseFloat(todayPurchasesAgg._sum.totalAmount || 0).toFixed(2),
        totalReceivables: parseFloat(totalReceivables._sum.currentBalance || 0).toFixed(2),
        totalPayables: parseFloat(totalPayables._sum.currentBalance || 0).toFixed(2),
        lowStockCount: parseInt(lowStockRaw[0]?.count || 0),

        // Profitability
        todayProfit: todayProfit.toFixed(2),
        todayRevenue: todaySales.toFixed(2),
        todayCOGS: todayCOGS.toFixed(2),

        // Cash flow
        paymentInToday: parseFloat(paymentInToday._sum.amount || 0).toFixed(2),
        paymentOutToday: parseFloat(paymentOutToday._sum.amount || 0).toFixed(2),
        overallReceived: parseFloat(overallReceived._sum.amount || 0).toFixed(2),
        overallSettled: parseFloat(overallSettled._sum.amount || 0).toFixed(2),

        // Bank & liquidity
        cashInHand: parseFloat(cashBalance.balance || 0).toFixed(2),
        bankAccounts: bankAccounts.map((b) => ({
          id: b.id,
          name: b.accountName,
          bank: b.bankName,
          balance: parseFloat(b.currentBalance || 0).toFixed(2),
        })),
        combinedLiquidity: combinedLiquidity.toFixed(2),

        // Tables
        overdueCustomers,
        recentInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
