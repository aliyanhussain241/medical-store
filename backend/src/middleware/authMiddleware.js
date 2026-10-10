// ─────────────────────────────────────────────────────────────
// src/middleware/authMiddleware.js
// Verifies JWT access token and attaches req.user (id + role)
// ALL business routes must be protected by this middleware.
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is required');
  return process.env.JWT_SECRET;
};

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in.' });
  }
}

// Role-based authorization factory
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
