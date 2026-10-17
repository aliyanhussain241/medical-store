// ─────────────────────────────────────────────────────────────
// src/app.js  — Express application setup
// In production: also serves the built React frontend from public/
// ─────────────────────────────────────────────────────────────
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const cashBookRoutes = require('./routes/cashBookRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const exportRoutes = require('./routes/exportRoutes');
const offerListRoutes = require('./routes/offerListRoutes');
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const bankBookRoutes = require('./routes/bankBookRoutes');
const cityRoutes = require('./routes/cityRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const accountHeadRoutes = require('./routes/accountHeadRoutes');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { validateQuery } = require('./utils/input');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// ── Security & parsing middleware ─────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// CORS: in production, frontend is served from the same origin — CORS is
// only needed if you add a separate mobile/desktop client later.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : true; // allow all during dev / when env var not set

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (!isProduction) {
  app.use(morgan('dev'));
} else {
  // Concise production logging
  app.use(morgan('combined'));
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Diagnostic endpoint — confirms both direct pg driver and Prisma connection mode
app.get('/health/diag', (_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));
app.use('/api', validateQuery);
// ── API routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/cash-book', cashBookRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/offer-lists', offerListRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/bank-book', bankBookRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/account-heads', accountHeadRoutes);

// ── Frontend static files (production only) ───────────────────
// Vite builds the React app into backend/public/ (see frontend/vite.config.js).
// Express serves these files, and falls back to index.html for SPA routing.
if (isProduction) {
  const publicDir = path.join(__dirname, '..', 'public');

  // Serve static assets (JS, CSS, images) — cached aggressively
  app.use(express.static(publicDir, {
    maxAge: '1y',
    immutable: true,
    index: false, // Don't serve index.html here — let SPA fallback handle it
  }));

  // SPA fallback — any non-API route serves index.html (Express 5 uses /*)
  app.get('/{*path}', (req, res, next) => {
    // Don't catch API routes with the SPA fallback
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

// ── Error handling ────────────────────────────────────────────
// In dev mode, 404 is useful. In production, unknown routes are SPA routes.
if (!isProduction) {
  app.use(notFound);
}
app.use(errorHandler);

module.exports = app;
