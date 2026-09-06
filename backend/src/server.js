// ─────────────────────────────────────────────────────────────
// src/server.js  — HTTP server entry point
// ─────────────────────────────────────────────────────────────
// Limit Tokio runtime worker threads to 1 and Node worker pool to 2
// to prevent thread exhaustion (ulimit / CloudLinux LVE limits) on shared hosting
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || '1';
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';

const systemPort = process.env.PORT;
require('dotenv').config({ quiet: true });

const app = require('./app');

// Hostinger / Passenger / Docker compatibility:
// Use system-provided PORT first, then .env PORT, fallback to 3000
const PORT = systemPort || process.env.PORT || 3000;

// Prevent uncaught errors from crashing the process
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('🚨 Unhandled Rejection:', reason);
});

// Start listening: bind to 0.0.0.0 for Docker containers, or socket path if provided
const isSocket = typeof PORT === 'string' && isNaN(Number(PORT));
const listenArgs = isSocket ? [PORT] : [Number(PORT) || 3000, '0.0.0.0'];

const server = app.listen(...listenArgs, () => {
  const addressInfo = isSocket ? PORT : `0.0.0.0:${PORT}`;
  console.log(`🚀 Medical Store API running on ${addressInfo} (${process.env.NODE_ENV || 'production'})`);
});

// Non-blocking background DB verification (two-stage: raw pg driver first, then Prisma)
(async () => {
  try {
    const { prisma, pool } = require('./utils/prismaClient');

    // Stage 1: Test raw pg driver connection (pure JavaScript — no Rust, no Tokio)
    try {
      const t0 = Date.now();
      await pool.query('SELECT 1 as startup_check');
      console.log(`✅ Direct pg driver connected in ${Date.now() - t0}ms (Network/SSL/Credentials to Neon are 100% OK)`);
    } catch (pgErr) {
      console.error('❌ DIRECT PG DRIVER FAILED on startup:', {
        message: pgErr.message,
        code: pgErr.code,
        detail: pgErr.detail,
        hint: pgErr.hint
      });
      return;
    }

    // Stage 2: Test Prisma Client query
    try {
      const t1 = Date.now();
      await prisma.$queryRaw`SELECT 1 as prisma_check`;
      console.log(`✅ Prisma Client connected via pg adapter in ${Date.now() - t1}ms`);
    } catch (prismaErr) {
      console.error('⚠️ Prisma query error on startup:', {
        message: prismaErr.message,
        name: prismaErr.name,
        code: prismaErr.code
      });
    }
  } catch (err) {
    console.error('⚠️ Could not initialize DB clients:', err.message);
  }
})();

// Graceful shutdown
function shutdown() {
  server.close(() => {
    try {
      const prisma = require('./utils/prismaClient');
      prisma.$disconnect().catch(() => {});
    } catch (_) {}
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
