const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const logger = require('../logger');
const { verifyToken } = require('../middleware/auth');

// Para transferi
router.post('/transfer', verifyToken, async (req, res) => {
  const { to_account, amount, description } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');
  
  // Token'dan account_number al, yoksa veritabanından çek
  let from_account = req.user.account_number;
  if (!from_account) {
    const userResult = await pool.query('SELECT account_number FROM users WHERE id = $1', [req.user.id]);
    from_account = userResult.rows[0].account_number;
  }

  logger.info('Transfer initiated', {
    from_account,
    to_account,
    amount,
    ip,
    username: req.user.username,
    event: 'transfer_initiated'
  });

  try {
    // Bakiye kontrolü
    const userResult = await pool.query(
      'SELECT balance FROM users WHERE account_number = $1',
      [from_account]
    );

    const currentBalance = parseFloat(userResult.rows[0].balance);
    const transferAmount = parseFloat(amount);
    
    if (currentBalance < transferAmount) {
      logger.warn('Insufficient balance', {
        from_account,
        requested_amount: transferAmount,
        current_balance: currentBalance,
        event: 'insufficient_balance'
      });

      return res.status(400).json({
        success: false,
        message: 'Yetersiz bakiye'
      });
    }

    // Transaction başlat
    await pool.query('BEGIN');

    // Gönderenden düş
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE account_number = $2',
      [transferAmount, from_account]
    );

    // Alıcıya ekle
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE account_number = $2',
      [transferAmount, to_account]
    );

    // Transaction kaydı oluştur
    await pool.query(
      'INSERT INTO transactions (from_account, to_account, amount, transaction_type, description, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [from_account, to_account, transferAmount, 'transfer', description, ip, userAgent]
    );

    await pool.query('COMMIT');

    // XSS tespiti için log (COMMIT'ten sonra)
    if (description && (description.includes('<script>') || description.includes('onerror') || description.includes('javascript:'))) {
      logger.warn('XSS attempt detected in transaction', {
        from_account,
        description,
        ip,
        username: req.user.username,
        event: 'xss_attempt'
      });
    }

    logger.info('Transfer successful', {
      from_account,
      to_account,
      amount,
      event: 'transfer_successful'
    });

    res.json({
      success: true,
      message: 'Transfer başarılı',
      new_balance: (currentBalance - transferAmount).toFixed(2)
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    
    logger.error('Transfer failed', {
      error: error.message,
      from_account,
      to_account,
      amount,
      event: 'transfer_failed'
    });

    res.status(500).json({
      success: false,
      message: 'Transfer sırasında bir hata oluştu'
    });
  }
});

// İşlem geçmişi - VULNERABLE (SQL Injection)
router.get('/history', verifyToken, async (req, res) => {
  const account_number = req.query.account || req.user.account_number;
  const ip = req.ip || req.connection.remoteAddress;

  logger.info('Transaction history requested', {
    account_number,
    username: req.user.username,
    ip,
    event: 'history_requested'
  });

  try {
    // SQL INJECTION AÇIĞI
    const query = `SELECT * FROM transactions WHERE from_account = '${account_number}' OR to_account = '${account_number}' ORDER BY created_at DESC`;
    
    logger.warn('Executing vulnerable query', {
      query,
      account_number,
      ip,
      event: 'vulnerable_query_executed'
    });

    const result = await pool.query(query);

    res.json({
      success: true,
      transactions: result.rows
    });
  } catch (error) {
    logger.error('History fetch error', {
      error: error.message,
      account_number,
      event: 'history_error'
    });

    res.status(500).json({
      success: false,
      message: 'İşlem geçmişi alınırken hata oluştu',
      error: error.message
    });
  }
});

// Bakiye sorgulama
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT balance, account_number, full_name FROM users WHERE id = $1',
      [req.user.id]
    );

    logger.info('Balance checked', {
      username: req.user.username,
      event: 'balance_checked'
    });

    res.json({
      success: true,
      balance: result.rows[0].balance,
      account_number: result.rows[0].account_number,
      full_name: result.rows[0].full_name
    });
  } catch (error) {
    logger.error('Balance check error', {
      error: error.message,
      username: req.user.username
    });

    res.status(500).json({
      success: false,
      message: 'Bakiye sorgulanırken hata oluştu'
    });
  }
});

module.exports = router;