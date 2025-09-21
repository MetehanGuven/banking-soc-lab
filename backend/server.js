const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const { initDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      event: 'http_request'
    });
  });
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Banking SOC Lab'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    event: 'unhandled_error'
  });

  res.status(500).json({
    success: false,
    message: 'Sunucu hatası',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 Not Found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    event: '404_error'
  });

  res.status(404).json({
    success: false,
    message: 'Endpoint bulunamadı'
  });
});

// Server başlatma
const startServer = async () => {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV,
        event: 'server_start'
      });
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Logs directory: ./logs`);
      console.log(`🔒 Security: VULNERABLE MODE (for testing)`);
    });
  } catch (error) {
    logger.error('Server startup failed', {
      error: error.message,
      event: 'server_startup_failed'
    });
    process.exit(1);
  }
};

startServer();