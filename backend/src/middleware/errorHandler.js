// ─────────────────────────────────────────────────────────────
// src/middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────

function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

function errorHandler(err, req, res, _next) {
  // Prisma-specific errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      field: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ success: false, message: 'Invalid reference: related record does not exist.' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred. Please try again.';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${statusCode} —`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
