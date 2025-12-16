const { fork } = require('child_process');
const path = require('path');
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const session = require('koa-session');
const crypto = require('crypto');
const fs = require('fs');
const { autoEncryptIfNeeded, logMaster, loadEncryptedCookies, saveEncryptedCookies, addAccount, removeAccount, getAccount } = require('./utils');
const database = require('./backend/database');
const { encryptHtmlContent, obfuscateJsContent, minifyCssContent } = require('./security');

// Generate random file names for security
const generateRandomFileName = (baseName, extension) => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${randomBytes}-${timestamp}-${baseName}.${extension}`;
};

// Generate consistent random names for the application
const randomFileNames = {
  loginCss: generateRandomFileName('login', 'css'),
  dashboardCss: generateRandomFileName('dashboard', 'css'),
  dashboardJs: generateRandomFileName('dashboard', 'js'),
  antiDevtoolsJs: generateRandomFileName('anti-devtools', 'js'),
  decryptJs: {
    A: generateRandomFileName('decrypt-a', 'js'),
    B: generateRandomFileName('decrypt-b', 'js'),
    C: generateRandomFileName('decrypt-c', 'js'),
    D: generateRandomFileName('decrypt-d', 'js'),
    E: generateRandomFileName('decrypt-e', 'js'),
    F: generateRandomFileName('decrypt-f', 'js'),
    G: generateRandomFileName('decrypt-g', 'js')
  }
};

logMaster(`🔐 Generated secure file names:`);
logMaster(`   CSS: ${randomFileNames.loginCss}, ${randomFileNames.dashboardCss}`);
logMaster(`   JS: ${randomFileNames.dashboardJs}, ${randomFileNames.antiDevtoolsJs}`);
logMaster(`   Decrypt files: ${Object.values(randomFileNames.decryptJs).join(', ')}`);

// Auto-encrypt cookies if needed on startup
try {
  autoEncryptIfNeeded();
} catch (error) {
  logMaster(`❌ Auto-encryption failed: ${error.message}`);
  process.exit(1);
}

// Generate unique account ID
function generateAccountId() {
  return crypto.randomBytes(8).toString('hex');
}

// Load all accounts from database
let allAccounts = [];
let databaseConnected = false;

async function initializeDatabase() {
  try {
    await database.connect();
    databaseConnected = true;

    allAccounts = await loadEncryptedCookies();
    if (!Array.isArray(allAccounts)) {
      allAccounts = [];
    }

    // Migrate old accounts to new format if needed
    allAccounts = allAccounts.map(account => {
      if (!account.name) {
        account.name = `Account ${account.id}`;
      }
      if (!account.webhook) {
        account.webhook = '';
      }
      if (typeof account.isAdmin !== 'boolean') {
        account.isAdmin = false;
      }
      return account;
    });

    // Save migrated format back to database
    if (allAccounts.length > 0) {
      await saveEncryptedCookies(allAccounts);
    }

    // Initialize account states for worker management
    initializeAccountStates();

    const storageType = database.isUsingMongoDB() ? 'MongoDB' : 'Local File';
    logMaster(`✅ Loaded ${allAccounts.length} account(s) from ${storageType}: ${allAccounts.map(acc => acc.name).join(', ')}`);
  } catch (error) {
    logMaster(`❌ Error loading accounts: ${error.message}`);
    allAccounts = [];
  }
}

// Master process state exposed via /status - now per account
const state = {
  startedAt: new Date(),
  accounts: {},
  totalRestarts: 0
};

// Function to initialize state for accounts (called after database is loaded)
function initializeAccountStates() {
  allAccounts.forEach(account => {
    if (!state.accounts[account.id]) {
      state.accounts[account.id] = {
        lastInfo: null,
        lastEarn: null,
        lastError: null,
        lastBalance: null,
        restarts: 0,
        sessionStatus: 'unknown', // 'valid', 'expired', 'refreshing', 'unknown'
        lastSessionRefresh: null,
        worker: null
      };
    }
  });
}

// Authentication setup
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Default password for demo
const USER_PASSWORD = process.env.USER_PASSWORD || 'user123'; // Default user password
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Generate unique account ID
function generateAccountId() {
  return crypto.randomBytes(8).toString('hex');
}

// Create Koa app and router
const app = new Koa();
const router = new Router();

// Session configuration
app.keys = [SESSION_SECRET];
const CONFIG = {
  key: 'orihost:sess',
  maxAge: 86400000, // 24 hours
  autoCommit: true,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: false,
  renew: false,
};
app.use(session(CONFIG, app));

// Body parser middleware
app.use(bodyParser());

// Static file access is now blocked for security - files served via secure routes only

// Authentication middleware
const requireAuth = async (ctx, next) => {
  if (ctx.session.authenticated) {
    return next();
  }

  // For API routes, return JSON error instead of redirect
  if (ctx.path.startsWith('/api/')) {
    ctx.status = 401;
    ctx.body = { error: 'Authentication required' };
    return;
  }

  // For web routes, redirect to login
  ctx.redirect('/login');
};

// Worker management functions
function startWorker(accountId) {
  const accountState = state.accounts[accountId];
  if (!accountState) {
    logMaster(`❌ Account state not found for ${accountId}`);
    return;
  }

  const env = { ...process.env };
  env.INTERVAL_MS = env.INTERVAL_MS || '60000';
  env.ACCOUNT_ID = accountId;

  const workerPath = path.join(__dirname, 'worker', 'farmer.js');
  const worker = fork(workerPath, { env });
  accountState.worker = worker;

  worker.on('message', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'info') {
      accountState.lastInfo = { ts: msg.ts, status: msg.status, message: msg.message };
      const m = /balance=(\d+(?:\.\d+)?)/.exec(msg.message || '');
      if (m) accountState.lastBalance = Number(m[1]);

      // Update session status based on message
      if (msg.message.includes('refreshed')) {
        accountState.sessionStatus = 'refreshed';
        accountState.lastSessionRefresh = new Date(msg.ts);
      } else if (msg.status >= 200 && msg.status < 300) {
        accountState.sessionStatus = 'valid';
      }
    } else if (msg.type === 'earn') {
      accountState.lastEarn = { ts: msg.ts, status: msg.status, message: msg.message };
      if (msg.message === 'session expired') {
        accountState.sessionStatus = 'expired';
      } else if (msg.status === 204) {
        accountState.sessionStatus = 'valid';
      }
    } else if (msg.type === 'error') {
      accountState.lastError = { ts: msg.ts, message: msg.message };
    }
  });

  worker.on('exit', (code, signal) => {
    logMaster(`⚠️ Worker for account '${accountId}' exited code=${code} signal=${signal}, restarting...`);
    accountState.worker = null;
    accountState.restarts += 1;
    state.totalRestarts += 1;
    setTimeout(() => startWorker(accountId), 2000);
  });
}

function stopWorker(accountId) {
  const accountState = state.accounts[accountId];
  if (accountState && accountState.worker) {
    accountState.worker.kill();
    accountState.worker = null;
  }
}

function startAllWorkers() {
  allAccounts.forEach(account => {
    startWorker(account.id);
  });
}

// Secure Static File Routes (serves encrypted/minified content with random names)
router.get(`/css/${randomFileNames.loginCss}`, async (ctx) => {
  try {
    const filePath = path.join(__dirname, 'public', 'css', 'login.css');
    const content = fs.readFileSync(filePath, 'utf8');
    ctx.type = 'css';
    ctx.body = `/* Protected by mra1k3r0 */\n${minifyCssContent(content)}`;
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/css/${randomFileNames.dashboardCss}`, requireAuth, async (ctx) => {
  try {
    const filePath = path.join(__dirname, 'public', 'css', 'dashboard.css');
    const content = fs.readFileSync(filePath, 'utf8');
    ctx.type = 'css';
    ctx.body = `/* Protected by mra1k3r0 */\n${minifyCssContent(content)}`;
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/js/${randomFileNames.dashboardJs}`, requireAuth, async (ctx) => {
  try {
    const filePath = path.join(__dirname, 'public', 'js', 'dashboard.js');
    const content = fs.readFileSync(filePath, 'utf8');
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(content);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.antiDevtoolsJs}`, async (ctx) => {
  // Allow anti-devtools for both login and authenticated users
  try {
    const filePath = path.join(__dirname, 'public', 'security', 'anti-devtools.js');
    const content = fs.readFileSync(filePath, 'utf8');
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(content);
  } catch (error) {
    ctx.status = 404;
  }
});

// Split decrypt.js into multiple files for enhanced security
router.get(`/security/${randomFileNames.decryptJs.A}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part A - Initialization
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.A = true;
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.B}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part B - Script Detection
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.B = function() {
          return document.querySelectorAll('script[data-encrypted]');
        };
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.C}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part C - Script Decryption
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.C = function(scripts) {
          scripts.forEach(script => {
            try {
              script.removeAttribute('data-encrypted');
              console.log('Script would be decrypted here');
            } catch (error) {
              console.error('Failed to decrypt script:', error);
            }
          });
        };
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.D}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part D - Style Detection
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.D = function() {
          return document.querySelectorAll('style[data-encrypted]');
        };
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.E}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part E - Style Decryption
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.E = function(styles) {
          styles.forEach(style => {
            try {
              style.removeAttribute('data-encrypted');
              console.log('Style would be decrypted here');
            } catch (error) {
              console.error('Failed to decrypt style:', error);
            }
          });
        };
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.F}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part F - DOM Ready Check
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.F = function() {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', window.decryptParts.G);
          } else {
            window.decryptParts.G();
          }
        };
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

router.get(`/security/${randomFileNames.decryptJs.G}`, requireAuth, async (ctx) => {
  try {
    ctx.type = 'javascript';
    ctx.body = obfuscateJsContent(`
      // Decrypt Part G - Main Decryption Logic
      (function() {
        window.decryptParts = window.decryptParts || {};
        window.decryptParts.G = function() {
          if (window.decryptParts.A && window.decryptParts.B && window.decryptParts.C &&
              window.decryptParts.D && window.decryptParts.E) {

            const scripts = window.decryptParts.B();
            window.decryptParts.C(scripts);

            const styles = window.decryptParts.D();
            window.decryptParts.E(styles);

            // Also run on window load
            window.addEventListener('load', function() {
              const scripts2 = window.decryptParts.B();
              window.decryptParts.C(scripts2);

              const styles2 = window.decryptParts.D();
              window.decryptParts.E(styles2);
            });
          }
        };

        // Initialize if all parts are loaded
        if (window.decryptParts.F) {
          window.decryptParts.F();
        }
      })();
    `);
  } catch (error) {
    ctx.status = 404;
  }
});

// Block ALL direct access to js/ and css/ directories - only allow specific random file names
app.use(async (ctx, next) => {
  const requestPath = ctx.path;

  // Allow access only to the specific randomly named files
  const allowedPaths = [
    `/css/${randomFileNames.loginCss}`,
    `/css/${randomFileNames.dashboardCss}`,
    `/js/${randomFileNames.dashboardJs}`,
    `/security/${randomFileNames.antiDevtoolsJs}`,
    `/security/${randomFileNames.decryptJs.A}`,
    `/security/${randomFileNames.decryptJs.B}`,
    `/security/${randomFileNames.decryptJs.C}`,
    `/security/${randomFileNames.decryptJs.D}`,
    `/security/${randomFileNames.decryptJs.E}`,
    `/security/${randomFileNames.decryptJs.F}`,
    `/security/${randomFileNames.decryptJs.G}`
  ];

  // Block all access to /css/*, /js/*, and /security/* except for allowed paths
  if ((requestPath.startsWith('/css/') && !allowedPaths.includes(requestPath)) ||
      (requestPath.startsWith('/js/') && !allowedPaths.includes(requestPath)) ||
      (requestPath.startsWith('/security/') && !allowedPaths.includes(requestPath))) {
    ctx.status = 403;
    ctx.body = 'Direct access to static files is blocked for security';
    return;
  }

  await next();
});

// API Routes

// Login routes
router.get('/login', async (ctx) => {
  // Update session activity for CSS/JS access control
  ctx.session.lastActivity = Date.now();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orihost Farmer - Login</title>
        <link rel="stylesheet" href="/css/${randomFileNames.loginCss}">
    </head>
    <body>
        <div class="login-container">
            <div class="login-card">
                <h1>Orihost Farmer</h1>
                <p>Enter your credentials to access the dashboard</p>
                <form method="POST" action="/login">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" name="username" placeholder="Enter username" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <div class="password-input-container">
                            <input type="password" name="password" id="password" placeholder="Enter password" required autocomplete="current-password">
                            <button type="button" class="password-toggle" onclick="togglePassword()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-icon">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Honeypot field to catch bots -->
                    <div class="form-group honeypot">
                        <label for="website">Website (leave empty)</label>
                        <input type="text" name="website" placeholder="Leave this field empty">
                    </div>
                    <button type="submit" class="btn-login">Sign In</button>
                </form>
                ${ctx.query.error ? '<div class="error">Invalid credentials</div>' : ''}
            </div>
        </div>
        <script src="/security/${randomFileNames.antiDevtoolsJs}"></script>
        <script>
            function togglePassword() {
                const passwordInput = document.getElementById('password');
                const toggleButton = document.querySelector('.password-toggle');
                const eyeIcon = toggleButton.querySelector('.eye-icon');

                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeIcon.innerHTML = '<path d="M2.99902 3L21 21M9.5 9.5C9.5 10.0523 9.94772 10.5 10.5 10.5C11.0523 10.5 11.5 10.0523 11.5 9.5C11.5 8.94772 11.0523 8.5 10.5 8.5C9.94772 8.5 9.5 8.94772 9.5 9.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.45702 6.95703C3.95702 5.45703 6.45703 4.45703 9.45703 4.45703C12.457 4.45703 15.057 5.45703 16.557 6.95703C18.057 8.45703 18.957 10.457 18.957 12.457C18.957 14.457 18.057 16.457 16.557 17.957C15.057 19.457 12.457 20.457 9.45703 20.457C6.45703 20.457 3.95702 19.457 2.45702 17.957C0.957024 16.457 0.0570068 14.457 0.0570068 12.457C0.0570068 10.457 0.957024 8.45703 2.45702 6.95703Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                } else {
                    passwordInput.type = 'password';
                    eyeIcon.innerHTML = '<path d="M1 12C1 12 4 8 12 8C20 8 23 12 23 12C23 12 20 16 12 16C4 16 1 12 1 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                }
            }
        </script>
    </body>
    </html>
  `;

  // Encrypt the HTML content with custom mra1k3r0 encryption
  ctx.type = 'html';
  ctx.body = encryptHtmlContent(html);
});

router.post('/login', async (ctx) => {
  const { username, password, website } = ctx.request.body;

  // Honeypot protection - if website field is filled, it's likely a bot
  if (website && website.trim() !== '') {
    ctx.redirect('/login?error=1');
    return;
  }

  // Check credentials
  const isAdmin = username === 'admin' && password === ADMIN_PASSWORD;
  const isUser = username === 'user' && password === (process.env.USER_PASSWORD || USER_PASSWORD);

  if (isAdmin || isUser) {
    ctx.session.authenticated = true;
    ctx.session.userType = isAdmin ? 'admin' : 'user';
    ctx.session.username = username;
    ctx.redirect('/');
  } else {
    ctx.redirect('/login?error=1');
  }
});

router.post('/logout', async (ctx) => {
  ctx.session.authenticated = false;
  ctx.redirect('/login');
});

// Protected routes
router.get('/', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const username = ctx.session.username;

  // Update session activity for CSS/JS access control
  ctx.session.lastActivity = Date.now();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orihost Farmer - Dashboard</title>
        <link rel="stylesheet" href="/css/${randomFileNames.dashboardCss}">
    </head>
    <body>
        <div class="dashboard">
            <header class="header">
                <div>
                    <h1>Orihost Farmer Dashboard</h1>
                    <div class="user-info">
                        <span class="user-badge ${userType}">${userType.toUpperCase()}</span>
                        <span class="username">${username}</span>
                    </div>
                </div>
                <form method="POST" action="/logout" style="display: inline;">
                    <button type="submit" class="btn-logout">Logout</button>
                </form>
            </header>

            <div class="stats-grid" id="stats">
                <div class="stat-card">
                    <h3>Total Accounts</h3>
                    <div class="stat-value" id="total-accounts">0</div>
                </div>
                <div class="stat-card">
                    <h3>Total Balance</h3>
                    <div class="stat-value" id="total-balance">0</div>
                </div>
                <div class="stat-card">
                    <h3>Active Workers</h3>
                    <div class="stat-value" id="active-workers">0</div>
                </div>
                <div class="stat-card">
                    <h3>Uptime</h3>
                    <div class="stat-value" id="uptime">0s</div>
                </div>
            </div>

            <div class="accounts-section">
                <div class="section-header">
                    <h2>Accounts</h2>
                </div>

                <div id="accounts-list" class="accounts-list">
                    <!-- Accounts will be loaded here -->
                </div>
            </div>

            <!-- Floating Add Button for Mobile -->
            ${userType === 'admin' ? '<button class="fab-add" onclick="showAddAccountModal()" title="Add Account"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>' : ''}
        </div>

        <!-- Add Account Modal (Admin only) -->
        ${userType === 'admin' ? `
        <div id="addAccountModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal()">&times;</span>
                <h2>Add New Account</h2>
                <form id="addAccountForm">
                    <div class="form-group">
                        <label for="accountName">Account Name:</label>
                        <input type="text" id="accountName" name="accountName" placeholder="e.g., My Main Account" required>
                    </div>
                    <div class="form-group">
                        <label for="cookies">Cookie String:</label>
                        <textarea id="cookies" name="cookies" placeholder="Paste your cookie string here..." rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="webhook">Discord Webhook (optional):</label>
                        <input type="url" id="webhook" name="webhook" placeholder="https://discord.com/api/webhooks/...">
                    </div>
                    ${userType === 'admin' ? `
                    <div class="form-group">
                        <label for="isAdmin">
                            <input type="checkbox" id="isAdmin" name="isAdmin"> Mark as Admin Account
                        </label>
                    </div>
                    ` : ''}
                    <button type="submit" class="btn-primary">Add Account</button>
                </form>
            </div>
        </div>
        ` : ''}

        <!-- Edit Account Modal -->
        <div id="editAccountModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal()">&times;</span>
                <h2>Edit Account</h2>
                <form id="editAccountForm">
                    <input type="hidden" id="editAccountId" name="accountId">
                    <div class="form-group">
                        <label for="editAccountName">Account Name:</label>
                        <input type="text" id="editAccountName" name="accountName" placeholder="Account name" required>
                    </div>
                    <div class="form-group">
                        <label for="editCookies">Cookie String:</label>
                        <textarea id="editCookies" name="cookies" placeholder="Paste your cookie string here..." rows="4" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="editWebhook">Discord Webhook (optional):</label>
                        <input type="url" id="editWebhook" name="webhook" placeholder="https://discord.com/api/webhooks/...">
                    </div>
                    ${userType === 'admin' ? `
                    <div class="form-group">
                        <label for="decodedCookies">Decoded Cookies (Admin Only):</label>
                        <div id="decodedCookiesDisplay" class="decoded-cookies" readonly>
                            Loading decoded cookies...
                        </div>
                    </div>
                    ` : ''}
                    <button type="submit" class="btn-primary">Update Account</button>
                </form>
            </div>
        </div>

        <script src="/js/${randomFileNames.dashboardJs}"></script>
        <script src="/security/${randomFileNames.decryptJs.A}"></script>
        <script src="/security/${randomFileNames.decryptJs.B}"></script>
        <script src="/security/${randomFileNames.decryptJs.C}"></script>
        <script src="/security/${randomFileNames.decryptJs.D}"></script>
        <script src="/security/${randomFileNames.decryptJs.E}"></script>
        <script src="/security/${randomFileNames.decryptJs.F}"></script>
        <script src="/security/${randomFileNames.decryptJs.G}"></script>
        <script src="/security/${randomFileNames.antiDevtoolsJs}"></script>
        <script>
            // Pass user type to JavaScript
            window.userType = '${userType}';
        </script>
    </body>
    </html>
  `;

  // Encrypt the HTML content
  ctx.type = 'html';
  ctx.body = encryptHtmlContent(html);
});

// API endpoints
router.get('/api/accounts', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const uptimeSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
  let totalBalance = 0;
  let activeWorkers = 0;

  // Load accounts from database
  const allAccountsFromDB = await database.getAllAccounts();

  // Filter accounts based on user permissions
  let visibleAccounts = allAccountsFromDB;
  if (userType !== 'admin') {
    // Users can only see non-admin accounts
    visibleAccounts = allAccountsFromDB.filter(account => !account.isAdmin);
  }

  const accounts = visibleAccounts.map(account => {
    const accountState = state.accounts[account.id] || {};
    if (accountState.lastBalance !== null) {
      totalBalance += accountState.lastBalance;
    }
    if (accountState.worker) {
      activeWorkers++;
    }

    return {
      id: account.id,
      name: account.name,
      balance: accountState.lastBalance,
      status: accountState.sessionStatus,
      lastEarn: accountState.lastEarn,
      lastError: accountState.lastError,
      restarts: accountState.restarts,
      active: !!accountState.worker,
      isAdmin: account.isAdmin,
      canEdit: userType === 'admin' || !account.isAdmin
    };
  });

  ctx.body = {
    uptime: uptimeSec,
    totalAccounts: accounts.length,
    totalBalance,
    activeWorkers,
    accounts
  };
});

// Get individual account details (for editing)
router.get('/api/accounts/:id', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const accountId = ctx.params.id;

  const account = await database.getAccountById(accountId);
  if (!account) {
    ctx.status = 404;
    ctx.body = { error: 'Account not found' };
    return;
  }

  // Check permissions
  if (userType !== 'admin' && account.isAdmin) {
    ctx.status = 403;
    ctx.body = { error: 'Access denied' };
    return;
  }

  ctx.body = {
    id: account.id,
    name: account.name,
    cookies: account.cookies,
    webhook: account.webhook,
    isAdmin: account.isAdmin
  };
});

router.post('/api/accounts', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const { accountName, cookies, webhook, isAdmin } = ctx.request.body;

  if (!accountName || !cookies) {
    ctx.status = 400;
    ctx.body = { error: 'Account name and cookies are required' };
    return;
  }

  // Only admins can create admin accounts
  if (isAdmin && userType !== 'admin') {
    ctx.status = 403;
    ctx.body = { error: 'Only admins can create admin accounts' };
    return;
  }

  try {
    // Generate unique ID
    const accountId = generateAccountId();

    // Parse cookies
    const { parseCookieString } = require('./utils');
    const parsedCookies = parseCookieString(cookies);

    // Create account object
    const newAccount = {
      id: accountId,
      name: accountName,
      cookies: parsedCookies,
      webhook: webhook || '',
      isAdmin: isAdmin || false
    };

    // Add account to database
    await database.createAccount(newAccount);
    // Refresh allAccounts from database
    allAccounts = await database.getAllAccounts();
    // Initialize state for new account
    initializeAccountStates();

    // Initialize state
    state.accounts[accountId] = {
      lastInfo: null,
      lastEarn: null,
      lastError: null,
      lastBalance: null,
      restarts: 0,
      sessionStatus: 'unknown',
      lastSessionRefresh: null,
      worker: null
    };

    // Start worker
    startWorker(accountId);

    ctx.body = { success: true, message: `Account "${accountName}" added successfully` };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

router.put('/api/accounts/:id', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const accountId = ctx.params.id;
  const { accountName, cookies, webhook } = ctx.request.body;

  if (!accountName || !cookies) {
    ctx.status = 400;
    ctx.body = { error: 'Account name and cookies are required' };
    return;
  }

  try {
    // Find account
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
      ctx.status = 404;
      ctx.body = { error: 'Account not found' };
      return;
    }

    // Check permissions
    if (userType !== 'admin' && account.isAdmin) {
      ctx.status = 403;
      ctx.body = { error: 'You cannot edit admin accounts' };
      return;
    }

    // Parse new cookies
    const { parseCookieString } = require('./utils');
    const parsedCookies = parseCookieString(cookies);

    // Update account in database
    await database.updateAccount(accountId, {
      name: accountName,
      cookies: parsedCookies,
      webhook: webhook !== undefined ? webhook : account.webhook
    });

    // Refresh allAccounts from database
    allAccounts = await database.getAllAccounts();

    // Restart worker with new cookies
    stopWorker(accountId);
    setTimeout(() => startWorker(accountId), 1000);

    ctx.body = { success: true, message: `Account "${accountName}" updated successfully` };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

router.delete('/api/accounts/:id', requireAuth, async (ctx) => {
  const userType = ctx.session.userType;
  const accountId = ctx.params.id;

  try {
    // Find account
    const account = allAccounts.find(acc => acc.id === accountId);
    if (!account) {
      ctx.status = 404;
      ctx.body = { error: 'Account not found' };
      return;
    }

    // Check permissions
    if (userType !== 'admin' && account.isAdmin) {
      ctx.status = 403;
      ctx.body = { error: 'You cannot delete admin accounts' };
      return;
    }

    // Stop worker
    stopWorker(accountId);

    // Remove account from database
    await database.deleteAccount(accountId);

    // Refresh allAccounts from database
    allAccounts = await database.getAllAccounts();

    // Remove from state
    delete state.accounts[accountId];

    ctx.body = { success: true, message: `Account "${account.name}" removed successfully` };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
});

// Legacy status endpoint (public)
router.get('/status', async (ctx) => {
  const uptimeSec = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);

  let totalBalance = 0;
  let accountCount = 0;
  const accountStatuses = {};

  Object.entries(state.accounts).forEach(([accountId, accountState]) => {
    accountCount++;
    if (accountState.lastBalance !== null) {
      totalBalance += accountState.lastBalance;
    }
    accountStatuses[accountId] = {
      lastInfo: accountState.lastInfo,
      lastEarn: accountState.lastEarn,
      lastError: accountState.lastError,
      lastBalance: accountState.lastBalance,
      restarts: accountState.restarts,
      sessionStatus: accountState.sessionStatus,
      lastSessionRefresh: accountState.lastSessionRefresh?.toISOString()
    };
  });

  ctx.set('Content-Type', 'application/json');
  ctx.body = JSON.stringify({
    uptimeSec,
    startedAt: state.startedAt.toISOString(),
    totalAccounts: accountCount,
    totalBalance: totalBalance,
    totalRestarts: state.totalRestarts,
    accounts: accountStatuses
  });
});

// Apply routes
app.use(router.routes());
app.use(router.allowedMethods());

// Initialize server with database
async function startServer() {
  try {
    await initializeDatabase();

    const port = process.env.PORT ? Number(process.env.PORT) : 3000;
    app.listen(port, () => {
      const storageType = databaseConnected ? (database.isUsingMongoDB() ? 'MongoDB' : 'Local File') : 'Local File';
      logMaster(`🌐 Orihost Farmer listening on http://localhost:${port}`);
      logMaster(`🔐 Admin panel available at http://localhost:${port}/`);
      logMaster(`💾 Using ${storageType} storage`);
    });

    startAllWorkers();
  } catch (error) {
    logMaster(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();