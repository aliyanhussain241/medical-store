const prisma = require('../utils/db');
const { partyStatement, bankStatement } = require('../services/statementService');
function party(type) { return async (req, res, next) => { try { res.json({ success: true, data: await partyStatement(prisma, req.user.id, type, req.params.customerId || req.params.companyId, req.query) }); } catch (error) { next(error); } }; }
async function bankLedger(req, res, next) { try { res.json({ success: true, data: await bankStatement(prisma, req.user.id, req.params.bankAccountId, req.query) }); } catch (error) { next(error); } }
module.exports = { customerLedger: party('CUSTOMER'), companyLedger: party('COMPANY'), bankLedger };
