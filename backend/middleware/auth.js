const jwt = require('jsonwebtoken');
const logger = require('../logger');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  const ip = req.ip || req.connection.remoteAddress;

  if (!token) {
    logger.warn('No token provided', {
      ip,
      endpoint: req.originalUrl,
      event: 'missing_token'
    });

    return res.status(403).json({
      success: false,
      message: 'Token bulunamadı'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    logger.info('Token verified', {
      username: decoded.username,
      ip,
      endpoint: req.originalUrl,
      event: 'token_verified'
    });

    next();
  } catch (error) {
    logger.warn('Invalid token', {
      ip,
      endpoint: req.originalUrl,
      error: error.message,
      event: 'invalid_token'
    });

    return res.status(401).json({
      success: false,
      message: 'Geçersiz token'
    });
  }
};

module.exports = { verifyToken };