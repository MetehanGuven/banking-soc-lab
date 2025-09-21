const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const logger = require('../logger');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// VULNERABLE LOGIN - SQL Injection açığı VAR (kasıtlı)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');

  logger.info('Login attempt', { 
    username, 
    ip, 
    userAgent,
    timestamp: new Date().toISOString()
  });

  try {
    // SQL INJECTION AÇIĞI - Direkt string concatenation kullanıyoruz
    const query = `SELECT * FROM users WHERE username = '${username}'`;
    
    logger.warn('Executing vulnerable query', { 
      query, 
      ip, 
      username,
      event: 'sql_query_executed'
    });

    const result = await pool.query(query);
    
    let loginSuccess = false;
    let user = null;

    if (result.rows.length > 0) {
      user = result.rows[0];
      // Normal login: şifre kontrolü yap
      // SQL Injection: şifre kontrolünü bypass et
      const isSQLi = username.includes("'") || username.includes("--") || username.includes("#") || username.includes("OR") || username.includes("UNION");
      
      if (isSQLi) {
        // SQL Injection durumunda şifre kontrolü yapma (authentication bypass)
        loginSuccess = true;
        logger.warn('SQL Injection detected - Authentication bypassed!', {
          username,
          ip,
          event: 'sqli_auth_bypass'
        });
      } else {
        // Normal login: bcrypt ile şifre kontrol et
        loginSuccess = await bcrypt.compare(password, user.password);
      }
    }

    // Login attempt kaydı
    await pool.query(
      'INSERT INTO login_attempts (username, ip_address, user_agent, success) VALUES ($1, $2, $3, $4)',
      [username, ip, userAgent, loginSuccess]
    );

    if (loginSuccess && user) {
      const user = result.rows[0];
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          account_number: user.account_number 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      logger.info('Login successful', { 
        username, 
        ip,
        event: 'successful_login'
      });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          account_number: user.account_number,
          balance: user.balance
        }
      });
    } else {
      logger.warn('Login failed - Invalid credentials', { 
        username, 
        ip,
        event: 'failed_login'
      });

      res.status(401).json({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı'
      });
    }
  } catch (error) {
    logger.error('Login error', { 
      error: error.message,
      username,
      ip,
      event: 'login_error',
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu',
      error: error.message
    });
  }
});

// GÜVENLI KAYIT - Sadece yönetici erişimi için
router.post('/register', async (req, res) => {
  const { username, password, full_name, email } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const accountNumber = 'TR' + Math.random().toString().slice(2, 18);

    const result = await pool.query(
      'INSERT INTO users (username, password, full_name, email, account_number, balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [username, hashedPassword, full_name, email, accountNumber, 10000.00]
    );

    logger.info('User registered', { 
      username, 
      ip,
      account_number: accountNumber,
      event: 'user_registration'
    });

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: {
        username: result.rows[0].username,
        account_number: result.rows[0].account_number
      }
    });
  } catch (error) {
    logger.error('Registration error', { 
      error: error.message,
      username,
      ip,
      event: 'registration_error'
    });

    res.status(500).json({
      success: false,
      message: 'Kayıt sırasında bir hata oluştu',
      error: error.message
    });
  }
});

module.exports = router;