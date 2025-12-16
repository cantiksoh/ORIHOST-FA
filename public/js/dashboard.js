/* 27e6d895cc3bcb25ec043efd3b276643:0c102314da6eea4244b89a1761a3c8fa25c491d30e0b7917c78c0b0cf23027f4432f5093cc5b27f7f2db8a05e40f91c6a0a227f3e434246a5e68c3b496ed8c7f */
/* 304e1b71f10b966a2082c78b911c98f5:a802110a1214da6d6194474996dedc65049161d8a80f4b9478f7aed44f4203bebf2f2d2e813ca5dd64fa4c1204a4fcbc03fe67140919eed50147cdb52a0a6cd3 */
// Orihost Farmer - Dashboard JavaScript

let refreshInterval;

// Anti-DevTools Protection
(function() {
    'use strict';

    // Console warnings
    const warnings = [
        '⚠️ WARNING: Do not paste any code here!',
        '🚫 SECURITY ALERT: This console is monitored',
        '🔒 PROTECTED: Unauthorized access detected',
        '🛡️ Orihost Farmer: Console access logged',
        '❌ WARNING: Pasting code here may compromise your account',
        '🚨 ALERT: Console manipulation detected'
    ];

    let warningIndex = 0;

    // Override console methods to show warnings
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = function(...args) {
        showSecurityWarning();
        return originalLog.apply(console, args);
    };

    console.warn = function(...args) {
        showSecurityWarning();
        return originalWarn.apply(console, args);
    };

    console.error = function(...args) {
        showSecurityWarning();
        return originalError.apply(console, args);
    };

    function showSecurityWarning() {
        const warning = warnings[warningIndex % warnings.length];
        warningIndex++;

        // Show warning in console
        console.clear();
        console.log('%c' + warning, 'color: #ff0000; font-size: 20px; font-weight: bold;');
        console.log('%cNever paste code from unknown sources!', 'color: #ff6600; font-size: 16px;');
        console.log('%cThis can compromise your accounts and data.', 'color: #ff6600; font-size: 16px;');
        console.log('%cIf you were told to paste something here, it\'s likely a scam!', 'color: #ff0000; font-size: 14px; font-weight: bold;');

        // Show visual warning on page
        showPageWarning();
    }

    function showPageWarning() {
        // Remove existing warnings
        const existing = document.querySelectorAll('.security-warning');
        existing.forEach(el => el.remove());

        // Create warning overlay
        const warning = document.createElement('div');
        warning.className = 'security-warning';
        warning.innerHTML = '<div class="warning-content"><div class="warning-icon">🚨</div><div class="warning-text"><h3>Security Alert!</h3><p>Developer tools detected. For your security:</p><ul><li>Never paste code from unknown sources</li><li>Do not share your login credentials</li><li>Close developer tools if not needed</li></ul></div><button onclick="this.parentElement.parentElement.remove()">Dismiss</button></div>';

        // Add styles
        warning.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; font-family: Arial, sans-serif;';

        const content = warning.querySelector('.warning-content');
        content.style.cssText = 'background: white; padding: 30px; border-radius: 10px; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); border: 2px solid #ff4444;';

        const icon = warning.querySelector('.warning-icon');
        icon.style.cssText = 'font-size: 48px; margin-bottom: 20px;';

        const h3 = warning.querySelector('h3');
        h3.style.cssText = 'color: #d32f2f; margin: 0 0 15px 0; font-size: 24px; font-weight: 700;';

        const ul = warning.querySelector('ul');
        ul.style.cssText = 'text-align: left; display: inline-block; margin: 15px 0;';

        const lis = warning.querySelectorAll('li');
        lis.forEach(li => {
            li.style.cssText = 'margin: 8px 0; color: #333;';
        });

        const button = warning.querySelector('button');
        button.style.cssText = 'background: #d32f2f; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 20px;';

        document.body.appendChild(warning);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warning.parentElement) {
                warning.remove();
            }
        }, 10000);
    }

    // Detect devtools opening
    let devtoolsOpen = false;

    function checkDevTools() {
        const start = performance.now();
        debugger; // This will be slower if devtools are open
        const end = performance.now();

        if (end - start > 100) { // If debugger took more than 100ms, devtools are likely open
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                showSecurityWarning();
            }
        } else {
            devtoolsOpen = false;
        }
    }

    // Check for devtools every 500ms
    setInterval(checkDevTools, 500);

    // Detect right-click (often used to open devtools)
    document.addEventListener('contextmenu', function(e) {
        setTimeout(() => {
            showSecurityWarning();
        }, 100);
    });

    // Detect F12, Ctrl+Shift+I, Ctrl+U, etc.
    document.addEventListener('keydown', function(e) {
        if (
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
            (e.ctrlKey && e.keyCode === 85) || // Ctrl+U
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
            (e.ctrlKey && e.shiftKey && e.keyCode === 67) // Ctrl+Shift+C
        ) {
            e.preventDefault();
            showSecurityWarning();
            return false;
        }
    });

    // Clear console periodically and show warnings
    let consoleClearCount = 0;
    setInterval(() => {
        console.clear();
        showSecurityWarning();
        consoleClearCount++;

        // Show additional warnings occasionally
        if (consoleClearCount % 5 === 0) {
            console.log('%c🚨 SECURITY MONITOR ACTIVE 🚨', 'color: #ff0000; font-size: 24px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);');
            console.log('%cThis system is protected against unauthorized access.', 'color: #ff6600; font-size: 18px;');
            console.log('%cAll console activities are logged and monitored.', 'color: #ff6600; font-size: 16px;');
        }
    }, 30000); // Every 30 seconds

    // Initial warning
    setTimeout(() => {
        console.log('%c🔒 Orihost Farmer Security System Active', 'color: #2196f3; font-size: 18px; font-weight: bold;');
        console.log('%cConsole access is monitored for security purposes.', 'color: #666; font-size: 14px;');
    }, 2000);

})();

// DOM Elements
const statsContainer = document.getElementById('stats');
const accountsList = document.getElementById('accounts-list');
const addAccountModal = document.getElementById('addAccountModal');
const addAccountForm = document.getElementById('addAccountForm');
const editAccountModal = document.getElementById('editAccountModal');
const editAccountForm = document.getElementById('editAccountForm');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboard();
    startAutoRefresh();
});

// Auto refresh every 5 seconds
function startAutoRefresh() {
    refreshInterval = setInterval(loadDashboard, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        const response = await fetch('/api/accounts');
        const data = await response.json();

        updateStats(data);
        updateAccountsList(data.accounts);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard data', 'error');
    }
}

// Update statistics cards
function updateStats(data) {
    const totalAccounts = document.getElementById('total-accounts');
    const totalBalance = document.getElementById('total-balance');
    const activeWorkers = document.getElementById('active-workers');
    const uptime = document.getElementById('uptime');

    if (totalAccounts) totalAccounts.textContent = data.totalAccounts;
    if (totalBalance) totalBalance.textContent = data.totalBalance.toLocaleString();
    if (activeWorkers) activeWorkers.textContent = data.activeWorkers;
    if (uptime) uptime.textContent = formatUptime(data.uptime);
}

// Update accounts list
function updateAccountsList(accounts) {
    if (!accountsList) return;

    let html = '';

    // Add the "Add Account" card for all users
    html += '<div class="add-account-card" onclick="showAddAccountModal()"><div class="add-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div><div class="add-text">Add New Account</div></div>';

    if (accounts.length === 0) {
        html += '<div class="loading">No accounts configured. Click above to add your first account!</div>';
    } else {
        html += accounts.map(account => createAccountCard(account, window.userType)).join('');
    }

    accountsList.innerHTML = html;
}

// Create account card HTML
function createAccountCard(account, userType) {
    const statusClass = getStatusClass(account.status);
    const lastEarnTime = account.lastEarn ? formatTime(account.lastEarn.ts) : 'Never';
    const balance = account.balance !== null ? account.balance.toLocaleString() : 'Unknown';
    const isAdmin = account.isAdmin;
    const canEdit = account.canEdit;

    return `
        <div class="account-card ${isAdmin ? 'admin' : ''}">
            <div class="account-info">
                <h3>${account.name}</h3>
                <div class="account-id">${account.id}</div>
                <div class="account-stats">
                    <div class="stat-item">
                        <span class="stat-label">Balance</span>
                        <span class="stat-number">${balance}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Status</span>
                        <span class="stat-number">
                            <span class="status-indicator ${statusClass}"></span>
                            ${account.status || 'Unknown'}
                        </span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Last Earn</span>
                        <span class="stat-number">${lastEarnTime}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Restarts</span>
                        <span class="stat-number">${account.restarts || 0}</span>
                    </div>
                </div>
            </div>
            <div class="account-actions">
                ${canEdit ? `<button class="btn-secondary" onclick="editAccount('${account.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>` : ''}
                ${(userType === 'admin' || (!account.isAdmin && userType === 'user')) ? `<button class="btn-danger" onclick="removeAccount('${account.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Remove</button>` : ''}
            </div>
        </div>
    `;
}

// Get CSS class for status
function getStatusClass(status) {
    switch (status) {
        case 'valid': return 'status-valid';
        case 'expired': return 'status-expired';
        case 'refreshing': return 'status-refreshing';
        default: return 'status-unknown';
    }
}

// Format uptime
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

// Modal functions
function showAddAccountModal() {
    addAccountModal.style.display = 'block';
}

function closeModal() {
    addAccountModal.style.display = 'none';
    editAccountModal.style.display = 'none';
    addAccountForm.reset();
    editAccountForm.reset();
}

// Add account form submission
addAccountForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(addAccountForm);
    const accountData = {
        accountName: formData.get('accountName').trim(),
        cookies: formData.get('cookies').trim(),
        webhook: formData.get('webhook').trim(),
        isAdmin: formData.get('isAdmin') === 'on'
    };

    if (!accountData.accountName || !accountData.cookies) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(accountData)
        });

        const result = await response.json();

        if (response.ok) {
            showAlert(result.message, 'success');
            closeModal();
            loadDashboard(); // Refresh the dashboard
        } else {
            showAlert(result.error || 'Failed to add account', 'error');
        }
    } catch (error) {
        console.error('Error adding account:', error);
        showAlert('Error adding account', 'error');
    }
});

// Edit account
async function editAccount(accountId) {
    try {
        // Fetch account details from API
        const response = await fetch(`/api/accounts/${accountId}`);
        const account = await response.json();

        document.getElementById('editAccountId').value = account.id;
        document.getElementById('editAccountName').value = account.name;
        document.getElementById('editWebhook').value = account.webhook || '';

        // For admins, show decoded cookies
        if (window.userType === 'admin') {
            const decodedCookiesDisplay = document.getElementById('decodedCookiesDisplay');
            if (decodedCookiesDisplay) {
                // Format cookies for display
                const cookieString = account.cookies ?
                    Object.entries(account.cookies)
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ') : 'No cookies stored';

                decodedCookiesDisplay.textContent = cookieString;
            }
            // Still allow editing the cookie string
            document.getElementById('editCookies').value = account.cookies ?
                Object.entries(account.cookies)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ') : '';
        } else {
            document.getElementById('editCookies').value = '';
        }

        editAccountModal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching account details:', error);
        showAlert('Error loading account details', 'error');
    }
}

// Edit account form submission
editAccountForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(editAccountForm);
    const accountId = formData.get('accountId');
    const accountData = {
        accountName: formData.get('accountName').trim(),
        cookies: formData.get('cookies').trim(),
        webhook: formData.get('webhook').trim()
    };

    if (!accountData.accountName || !accountData.cookies) {
        showAlert('Please fill in account name and cookie string', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(accountData)
        });

        const result = await response.json();

        if (response.ok) {
            showAlert(result.message, 'success');
            closeModal();
            loadDashboard(); // Refresh the dashboard
        } else {
            showAlert(result.error || 'Failed to update account', 'error');
        }
    } catch (error) {
        console.error('Error updating account:', error);
        showAlert('Error updating account', 'error');
    }
});

// Remove account
async function removeAccount(accountId) {
    const accounts = Array.from(document.querySelectorAll('.account-card')).map(card => {
        const name = card.querySelector('h3').textContent;
        return name;
    });

    const accountName = accounts.find(name => {
        const card = Array.from(document.querySelectorAll('.account-card')).find(c =>
            c.querySelector('h3').textContent === name && c.querySelector('.account-id').textContent === accountId
        );
        return card;
    });

    if (!confirm(`Are you sure you want to remove account "${accountName || accountId}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showAlert(result.message, 'success');
            loadDashboard(); // Refresh the dashboard
        } else {
            showAlert(result.error || 'Failed to remove account', 'error');
        }
    } catch (error) {
        console.error('Error removing account:', error);
        showAlert('Error removing account', 'error');
    }
}

// Show alert message
function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Insert at top of dashboard
    const dashboard = document.querySelector('.dashboard');
    dashboard.insertBefore(alert, dashboard.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Click outside modal to close
window.addEventListener('click', function(event) {
    if (event.target === addAccountModal || event.target === editAccountModal) {
        closeModal();
    }
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});
