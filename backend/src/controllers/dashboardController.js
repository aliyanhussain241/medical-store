// ─────────────────────────────────────────────────────────────
// src/controllers/dashboardController.js
// Dashboard KPI aggregates (today's sales, profit, receivables,
// payables, low-stock count, overdue customers)
// ─────────────────────────────────────────────────────────────
const prisma = require('../utils/prismaClient');

async function stats(req, res, next) {
  try {
    const userId = req.user.id;
    const now = new Date();
    const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const utcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const utcEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const minDate = new Date(Math.min(localStart.getTime(), utcStart.getTime()) - 12 * 3600 * 1000);
    const maxDate = new Date(Math.max(localEnd.getTime(), utcEnd.getTime()) + 12 * 3600 * 1000);

    const [
      todaySales,
      todayProfit,
      totalReceivables,
      totalPayables,
      lowStockCount,
      overdueCustomers,
      recentInvoices,
    ] = await Promise.all([
      // Today's total invoice sales
      prisma.invoice.aggregate({
        where: {
          userId,
          OR: [
            { invoiceDate: { gte: minDate, lte: maxDate } },
            { createdAt: { gte: minDate, lte: maxDate } },
          ],
        },
        _sum: { totalAmount: true },
      }),

      // Today's profit (from dailyProfit record matching today or latest)
      prisma.dailyProfit.findFirst({
        where: {
          userId,
          reportDate: { gte: minDate, lte: maxDate },
        },
        orderBy: { reportDate: 'desc' },
      }),

      // Total receivables from customers (currentBalance > 0)
      prisma.customer.aggregate({
        where: { userId, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),

      // Total payables to companies (currentBalance > 0)
      prisma.company.aggregate({
        where: { userId, currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),

      // Low stock items count
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
    ]);

    res.json({
      success: true,
      data: {
        todaySales: parseFloat(todaySales._sum.totalAmount || todayProfit?.totalSales || 0).toFixed(2),
        todayProfit: parseFloat(todayProfit?.totalProfit || 0).toFixed(2),
        totalReceivables: parseFloat(totalReceivables._sum.currentBalance || 0).toFixed(2),
        totalPayables: parseFloat(totalPayables._sum.currentBalance || 0).toFixed(2),
        lowStockCount: parseInt(lowStockCount[0]?.count || 0),
        overdueCustomers,
        recentInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
