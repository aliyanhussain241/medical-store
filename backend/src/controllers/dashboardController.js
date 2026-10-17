const prisma = require('../utils/db');
const { businessDay, dateOnly } = require('../utils/businessDate');
const { cashStatement, partyStatement, D } = require('../services/statementService');
const { financialData } = require('../services/financialReportService');
async function stats(req, res, next) {
 try {
  const userId = req.user.id, day = businessDay(), date = dateOnly(day);
  const yesterday = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
  const [fd, previous, cashToday, cashAll, purchases, products, customers, recentInvoices] = await Promise.all([
   financialData(prisma, userId, day), financialData(prisma, userId, yesterday),
   cashStatement(prisma, userId, { from: day, to: day }), cashStatement(prisma, userId),
   prisma.purchase.aggregate({ where: { userId, purchaseDate: date }, _sum: { totalAmount: true } }),
   prisma.product.findMany({ where: { userId }, select: { stockQty: true, minStockAlert: true } }),
   prisma.customer.findMany({ where: { userId } }),
   prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5, include: { customer: { select: { customerName: true } } } }),
  ]);
  const balances = await Promise.all(customers.map(async (c) => ({ id: c.id, customerName: c.customerName, shopName: c.shopName, currentBalance: (await partyStatement(prisma, userId, 'CUSTOMER', c.id)).summary.closingBalance })));
  const sales = D(fd.totalSales).minus(previous.totalSales), cost = D(fd.totalCost).minus(previous.totalCost);
  res.json({ success: true, data: {
   todaySales: sales.toFixed(2), todayRevenue: sales.toFixed(2), todayCOGS: cost.toFixed(2), todayProfit: sales.minus(cost).toFixed(2), todayPurchases: D(purchases._sum.totalAmount).toFixed(2),
   totalReceivables: D(fd.totalReceivableDr).toFixed(2), totalPayables: D(fd.totalPayableCr).toFixed(2), lowStockCount: products.filter((p) => D(p.stockQty).lte(p.minStockAlert)).length,
   paymentInToday: cashToday.summary.totalIn, paymentOutToday: cashToday.summary.totalOut, overallReceived: cashAll.summary.totalIn, overallSettled: cashAll.summary.totalOut,
   cashInHand: D(fd.cashBalance).toFixed(2), bankAccounts: fd.bankBalances.map((b) => ({ id: b.id, name: b.name, balance: D(b.balance).toFixed(2) })), combinedLiquidity: D(fd.cashBalance).plus(fd.totalBankBalance).toFixed(2),
   overdueCustomers: balances.filter((c) => D(c.currentBalance).gt(0)).sort((a,b) => D(b.currentBalance).cmp(a.currentBalance)).slice(0,10), recentInvoices,
   complete: fd.complete, warnings: fd.warnings,
  } });
 } catch (error) { next(error); }
}
module.exports = { stats };
