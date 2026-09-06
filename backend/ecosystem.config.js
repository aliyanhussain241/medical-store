// ─────────────────────────────────────────────────────────────
// ecosystem.config.js — PM2 process manager configuration
// Usage:  pm2 start ecosystem.config.js --env production
// ─────────────────────────────────────────────────────────────
module.exports = {
  apps: [
    {
      name: 'rahmat-medical-api',
      script: 'src/server.js',

      // Production env vars are set in Hostinger hPanel → Node.js → Environment
      // variables section — do NOT put secrets here.
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Run a single instance (Hostinger shared Node.js plans allow 1)
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,

      // Restart if memory exceeds 512MB
      max_memory_restart: '512M',

      // Don't watch files (production)
      watch: false,

      // Logs (Hostinger writes these to the app's log directory)
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
