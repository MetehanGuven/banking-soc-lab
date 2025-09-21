const API_URL = 'http://localhost:3000/api';

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                errorDiv.textContent = data.message || 'Giriş başarısız';
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'Bağlantı hatası: ' + error.message;
            errorDiv.classList.add('show');
        }
    });
}

// Transfer Form Handler
const transferForm = document.getElementById('transferForm');
if (transferForm) {
    transferForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const toAccount = document.getElementById('toAccount').value;
        const amount = document.getElementById('amount').value;
        const description = document.getElementById('description').value;
        const messageDiv = document.getElementById('transfer-message');
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`${API_URL}/transactions/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ to_account: toAccount, amount, description })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageDiv.textContent = '✅ ' + data.message + ' - Yeni bakiye: ₺' + data.new_balance;
                messageDiv.className = 'message success';
                transferForm.reset();
                loadAccountInfo();
                loadTransactions();
            } else {
                messageDiv.textContent = '❌ ' + data.message;
                messageDiv.className = 'message error';
            }
        } catch (error) {
            messageDiv.textContent = '❌ Bağlantı hatası: ' + error.message;
            messageDiv.className = 'message error';
        }
    });
}

// Load Account Info
async function loadAccountInfo() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/transactions/balance`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('balance').textContent = '₺' + parseFloat(data.balance).toFixed(2);
            document.getElementById('fullName').textContent = data.full_name;
            document.getElementById('accountNumber').textContent = data.account_number;
            document.getElementById('iban').textContent = data.account_number;
            document.getElementById('userName').textContent = data.full_name;
        }
    } catch (error) {
        console.error('Hesap bilgileri yüklenemedi:', error);
    }
}

// Load Transactions
async function loadTransactions() {
    const token = localStorage.getItem('token');
    const accountFilter = document.getElementById('accountFilter')?.value || '';
    const listDiv = document.getElementById('transactions-list');
    
    if (!listDiv) return;
    
    try {
        const url = accountFilter 
            ? `${API_URL}/transactions/history?account=${accountFilter}`
            : `${API_URL}/transactions/history`;
            
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.transactions.length === 0) {
                listDiv.innerHTML = '<p class="loading">Henüz işlem bulunmuyor</p>';
                return;
            }
            
            const user = JSON.parse(localStorage.getItem('user'));
            const userAccount = user.account_number;
            
                listDiv.innerHTML = data.transactions.map(tx => {
            const isIncoming = tx.to_account === userAccount;
            const amountClass = isIncoming ? 'incoming' : 'outgoing';
            const prefix = isIncoming ? '+' : '-';
            
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <h4>${tx.transaction_type === 'transfer' ? 'Transfer' : tx.transaction_type}</h4>
                        <p>${isIncoming ? 'Gönderen: ' + tx.from_account : 'Alıcı: ' + tx.to_account}</p>
                        <p style="font-style: italic; color: #666;">${tx.description || ''}</p>
                        <p style="font-size: 12px;">${new Date(tx.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${prefix}₺${parseFloat(tx.amount).toFixed(2)}
                    </div>
                </div>
            `;
        }).join('');
        }
    } catch (error) {
        listDiv.innerHTML = '<p class="loading">İşlemler yüklenirken hata oluştu: ' + error.message + '</p>';
    }
}

// Section Navigation
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById(`${sectionName}-section`).classList.add('active');
    event.target.classList.add('active');
    
    if (sectionName === 'history') {
        loadTransactions();
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}