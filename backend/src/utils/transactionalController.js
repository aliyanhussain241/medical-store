const { createHash } = require('crypto');
const prisma = require('./db');
const { tenantTransaction } = require('./transactionContext');
const { bad } = require('./input');
const { validatePosting } = require('./validatePosting');

function transactionalController(handler) {
  return async (req, res, next) => {
    try {
      const response = await tenantTransaction(prisma, req.user.id, async () => {
        const key = req.get?.('Idempotency-Key');
        if (!key) bad('Idempotency-Key header is required for this operation.');
        const operation = `${req.method}:${req.originalUrl}`;
        const fingerprint = createHash('sha256').update(JSON.stringify({ body: req.body || {}, ...(req.file && { fileHash: createHash('sha256').update(req.file.buffer).digest('hex') }) })).digest('hex');
        if (key && (key.length > 128 || !/^[\w-]+$/.test(key))) bad('Invalid idempotency key.');
        if (key) {
          const prior = await prisma.idempotencyRecord.findUnique({ where: { userId_key: { userId: req.user.id, key } } });
          if (prior) {
            if (prior.operation !== operation || prior.fingerprint !== fingerprint) bad('Idempotency key was already used for another request.');
            return { status: prior.status, body: JSON.parse(prior.response) };
          }
        }
        await validatePosting(req);
        let status = 200, body, failure;
        const buffered = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
        await handler(req, buffered, (error) => { failure = error; });
        if (failure) throw failure;
        if (status >= 400) throw Object.assign(new Error(body?.message || 'Invalid request.'), { statusCode: status, details: body?.errors });
        if (body === undefined) throw new Error('Posting controller did not produce a response.');
        if (key) await prisma.idempotencyRecord.create({ data: { userId: req.user.id, key, operation, fingerprint, status, response: JSON.stringify(body) } });
        return { status, body };
      });
      res.status(response.status).json(response.body);
    } catch (error) { next(error); }
  };
}
module.exports = { transactionalController };
