// ─────────────────────────────────────────────────────────────
// src/middleware/authMiddleware.js
// Verifies JWT access token and attaches req.user (id + role)
// ALL business routes must be protected by this middleware.
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = '8f3a2e1d9c7b4f6e0a5d8c2b1f4e7a9d3c6b0e5f8a2d4c7b1e3f6a9d2c5b8e1f4a7d0c3b6e9f2a5d8c1b4e7f0a3d6';
const getJwtSecret = () => process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

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
