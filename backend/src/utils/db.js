const { contextualClient } = require('./transactionContext');
module.exports = contextualClient(require('./prismaClient'));
