// ─────────────────────────────────────────────────────────────
// src/utils/prismaClient.js — singleton Prisma client
// Uses pg driver adapter to bypass the Rust query engine
// (fixes "PANIC: timer has gone away" on shared hosting)
// ─────────────────────────────────────────────────────────────
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Create a standard pg connection pool
const connectionString = process.env.DATABASE_URL;
const isNeonOrCloud = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'));

const pool = new Pool({
  connectionString,
  ssl: isNeonOrCloud ? { rejectUnauthorized: false } : undefined,
  max: 3,                         // keep pool small for shared hosting thread limits
  idleTimeoutMillis: 30000,       // close idle connections after 30s
  connectionTimeoutMillis: 10000, // 10s connection timeout
});

// Handle pool errors so they don't crash the process
pool.on('error', (err) => {
  console.error('⚠️ pg pool background error:', err.message);
});

// Create the Prisma adapter backed by the pg pool
const adapter = new PrismaPg(pool);

// Instantiate PrismaClient with the driver adapter
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Attach pool to prisma instance for direct driver diagnostics
prisma.pool = pool;

module.exports = prisma;
module.exports.pool = pool;
module.exports.prisma = prisma;
