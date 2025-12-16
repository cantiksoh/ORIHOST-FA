const fs = require('fs');
const path = require('path');
const { encode, decode } = require('./backend/crypto');
const database = require('./backend/database');

// Determine secure env path (hidden/system location)
const getEnvPath = () => {
  const homeDir = process.env.USERPROFILE || process.env.HOME;
  const appData = process.env.APPDATA;
  // Use appdata on Windows, home on others
  const secureDir = appData || homeDir;
  return path.join(secureDir, '.orihost-key');
};

// Load environment variables
const ENV_PATH = getEnvPath();
require('dotenv').config({ path: ENV_PATH });

// Generate UUID for farmer identification
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate random key and UUID if not exists
if (!fs.existsSync(ENV_PATH)) {
  // Generate 32 bytes (256 bits) and convert to hex
  const randomBytes = require('crypto').randomBytes(32);
  const randomKey = randomBytes.toString('hex');
  const farmerUUID = generateUUID();

  // Ensure directory exists
  const envDir = path.dirname(ENV_PATH);
  if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
  }

  fs.writeFileSync(ENV_PATH, `ORI_KEY=${randomKey}\nORIFARM_UUID=${farmerUUID}\n`, 'utf8');
  logUtils('Created .env with new ORI_KEY and ORIFARM_UUID');
  // Reload env after creating file
  require('dotenv').config({ path: ENV_PATH });
}

// Generate UUID if it doesn't exist in existing .env file
if (!process.env.ORIFARM_UUID) {
  const farmerUUID = generateUUID();
  const existingContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  fs.writeFileSync(ENV_PATH, existingContent + `\nORIFARM_UUID=${farmerUUID}\n`, 'utf8');
  logUtils('Added ORIFARM_UUID to existing .env');
  // Reload env after updating .env file
  require('dotenv').config({ path: ENV_PATH });
}



// Parse cookie string into object
function parseCookieString(cookieString) {
  const cookies = {};
  if (!cookieString || typeof cookieString !== 'string') return cookies;

  const pairs = cookieString.split(';').map(s => s.trim());
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      cookies[key.trim()] = valueParts.join('=').trim();
    }
  }
  return cookies;
}

// Helper to load accounts from database
async function loadEncryptedCookies() {
  try {
    // Ensure database is connected
    if (!database.isConnected) {
      await database.connect();
    }

    const accounts = await database.getAllAccounts();

    // If no accounts in database, check for legacy encrypted file
    if (accounts.length === 0) {
    const encryptedPath = path.join(__dirname, 'cookie.json.enc');

    // Check for plain text cookie files (cookie.txt, cookie.md, etc.)
    const extensions = ['txt', 'md', 'cookie'];
    let plainCookieString = null;
    let plainTextPath = null;

    for (const ext of extensions) {
      plainTextPath = path.join(__dirname, `cookie.${ext}`);
      if (fs.existsSync(plainTextPath)) {
        plainCookieString = fs.readFileSync(plainTextPath, 'utf8').trim();
          logUtils(`Found cookie.${ext}, migrating to database...`);
        break;
      }
    }

      // If we found a plain cookie string, convert and save to database
    if (plainCookieString && plainTextPath) {
      const cookieObj = parseCookieString(plainCookieString);
        const accountData = {
        id: 'account1',
          name: 'Migrated Account',
          cookies: cookieObj,
          webhook: '',
          isAdmin: false
        };

        await database.createAccount(accountData);
      fs.unlinkSync(plainTextPath); // Remove plain file for security
        logUtils('✅ Cookies migrated to database and secured');
        return [accountData];
    }

      // Check for legacy encrypted file
      if (fs.existsSync(encryptedPath)) {
        try {
    const encryptedData = fs.readFileSync(encryptedPath, 'utf8');
    const decryptedData = decode(encryptedData);

          let accountsToMigrate = [];

          // Handle legacy formats and migrate to database
    if (typeof decryptedData === 'string') {
      const cookieObj = parseCookieString(decryptedData);
            accountsToMigrate = [{
        id: 'account1',
              name: 'Legacy Account',
              cookies: cookieObj,
              webhook: '',
              isAdmin: false
      }];
    } else if (Array.isArray(decryptedData)) {
            accountsToMigrate = decryptedData.map((acc, index) => ({
              id: acc.id || `account${index + 1}`,
              name: acc.name || `Account ${index + 1}`,
              cookies: acc.cookies || {},
              webhook: acc.webhook || '',
              isAdmin: acc.isAdmin || false
            }));
    } else if (typeof decryptedData === 'object' && decryptedData !== null) {
            accountsToMigrate = [{
        id: 'account1',
              name: 'Legacy Account',
              cookies: decryptedData,
              webhook: '',
              isAdmin: false
            }];
          }

          // Migrate accounts to database
          for (const account of accountsToMigrate) {
            await database.createAccount(account);
          }

          // Backup and remove old file
          fs.renameSync(encryptedPath, encryptedPath + '.backup');
          logUtils('✅ Legacy cookies migrated to database');
          return accountsToMigrate;
        } catch (error) {
          logUtils('⚠️  Could not migrate legacy encrypted file (different encryption key), starting fresh');
          // If we can't decode the legacy file, just continue without it
        }
      }
    }

    return accounts;
  } catch (error) {
    throw new Error(`Failed to load accounts: ${error.message}`);
  }
}

// Helper to save accounts to database
async function saveEncryptedCookies(data) {
  try {
    // Ensure data is in multi-account format
    let accounts = data;
    if (!Array.isArray(accounts)) {
      // Convert single account to multi-account format
      accounts = [{
        id: 'account1',
        name: 'Account 1',
        cookies: data,
        webhook: '',
        isAdmin: false
      }];
    }

    // Ensure database is connected
    if (!database.isConnected) {
      await database.connect();
    }

    // For now, we'll keep the legacy file as backup
    // In production, you might want to remove this
    const encryptedData = encode(accounts);
    const encryptedPath = path.join(__dirname, 'cookie.json.enc');
    fs.writeFileSync(encryptedPath, encryptedData, 'utf8');

    logUtils('Accounts saved to database and encrypted backup created');
  } catch (error) {
    throw new Error(`Failed to save accounts: ${error.message}`);
  }
}

// Auto-encrypt cookies if not encrypted yet (legacy JSON support)
function autoEncryptIfNeeded() {
  const plainJsonPath = path.join(__dirname, 'cookie.json');
  const encryptedPath = path.join(__dirname, 'cookie.json.enc');

  if (fs.existsSync(plainJsonPath) && !fs.existsSync(encryptedPath)) {
    try {
      logUtils('🔐 Auto-encrypting legacy cookie.json...');
      const data = JSON.parse(fs.readFileSync(plainJsonPath, 'utf8'));

      let multiAccountFormat;
      if (Array.isArray(data)) {
        // Already multi-account format
        multiAccountFormat = data;
      } else {
        // Convert single account to multi-account format
        multiAccountFormat = [{
          id: 'account1',
          cookies: data
        }];
      }

      const encryptedData = encode(multiAccountFormat);
      fs.writeFileSync(encryptedPath, encryptedData, 'utf8');

      // Remove plain file
      fs.unlinkSync(plainJsonPath);
      logUtils('✅ Legacy cookies encrypted! Plain file removed for security.');
    } catch (error) {
      logUtils(`❌ Auto-encryption failed: ${error.message}`);
      throw error;
    }
  }
}

// Helper functions for multi-account management
function addAccount(accounts, accountId, cookies) {
  // Remove existing account if it exists
  const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
  filteredAccounts.push({
    id: accountId,
    cookies: cookies
  });
  return filteredAccounts;
}

function removeAccount(accounts, accountId) {
  return accounts.filter(acc => acc.id !== accountId);
}

function getAccount(accounts, accountId) {
  return accounts.find(acc => acc.id === accountId);
}

function updateAccountCookies(accounts, accountId, updatedCookies) {
  return accounts.map(acc =>
    acc.id === accountId
      ? { ...acc, cookies: { ...acc.cookies, ...updatedCookies } }
      : acc
  );
}

// Discord webhook for balance updates
const axios = require('axios');

// Default fallback webhook
const DEFAULT_DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || 'https://discord.com/api/webhooks/1429767170803634237/il_s_wfM2CAPDGjL2Z0uolguT8UoloSlQpT5M4ZmoB8fIzqtKpoyY3079fNXQ4iV3on1';

// Validate webhook URL format
function validateWebhookUrl(url) {
  const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  return webhookRegex.test(url);
}

// Test if webhook exists and is valid
async function testWebhook(webhookUrl = null) {
  const webhookToTest = webhookUrl || DEFAULT_DISCORD_WEBHOOK;

  if (!webhookToTest) {
    console.log('[webhook] ❌ No webhook URL configured');
    return false;
  }

  if (!validateWebhookUrl(webhookToTest)) {
    console.log('[webhook] ❌ Invalid webhook URL format');
    return false;
  }

  try {
    // Test webhook by getting info (Discord allows GET requests to webhooks)
    const response = await axios.get(webhookToTest, { timeout: 5000 });
    console.log('[webhook] ✅ Webhook exists and is valid');
    console.log('[webhook] 📍 Channel:', response.data?.channel_id || 'unknown');
    console.log('[webhook] 🏠 Server:', response.data?.guild_id || 'unknown');
    console.log('[webhook] 🤖 Name:', response.data?.name || 'unknown');
    return true;
  } catch (err) {
    console.log('[webhook] ❌ Webhook test failed:', err.response?.status || 'unknown error');
    if (err.response?.status === 404) {
      console.log('[webhook] 💡 The webhook has been deleted or the URL is incorrect');
    } else if (err.response?.status === 401) {
      console.log('[webhook] 💡 The webhook token is invalid');
    }
    return false;
  }
}

// Short Manila time format
function formatShortTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Simple CLI logging with prefixes

// Farmer logs with timezone (info:, earn:, etc.)
function logFarmer(level, message, timestamp = new Date()) {
  const timeStr = formatShortTime(timestamp);
  const colors = {
    info: '\x1b[36m',
    earn: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m'
  };

  const color = colors[level] || colors.reset;
  console.log(`${color}[${timeStr}] ${level}:${colors.reset} ${message}`);
}

// Component logs with short prefixes (backward compatibility)
function logWithTimezone(level, message, timestamp = new Date()) {
  logFarmer(level, message, timestamp);
}

// Short prefix component logs
function logUtils(message) { console.log(`[utils] ${message}`); }
function logMaster(message) { console.log(`[master] ${message}`); }
function logStatus(message) { console.log(`[status] ${message}`); }
function logWorker(message) { console.log(`[worker] ${message}`); }

function sendDiscordEmbed(balance, timestamp = new Date(), accountId = null, webhookUrl = null) {
  // Use account-specific webhook if provided, otherwise use default
  const webhookToUse = webhookUrl || DEFAULT_DISCORD_WEBHOOK;

  if (!webhookToUse) {
    console.log('[webhook] ⚠️ No webhook URL configured');
    return;
  }

  if (!validateWebhookUrl(webhookToUse)) {
    console.log('[webhook] ❌ Invalid webhook URL format');
    console.log('[webhook] Expected: https://discord.com/api/webhooks/ID/TOKEN');
    return;
  }

  const farmerUUID = process.env.ORIFARM_UUID || 'unknown';
  const accountInfo = accountId ? ` (${accountId})` : '';
  const embed = {
    title: `💰 Orihost Farmer Balance${accountInfo}`,
    description: `**Instance:** \`${farmerUUID.substring(0, 8)}\`${accountId ? `\n**Account:** \`${accountId}\`` : ''}`,
    color: 0x00ff00,
    fields: [
      { name: 'Credits', value: balance?.toString() || 'Unknown', inline: true },
      { name: 'Updated', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`, inline: true }
    ],
    footer: {
      text: 'Orihost Auto Farmer',
      icon_url: 'https://panel.orihost.com/favicons/favicon.ico'
    },
    timestamp: timestamp.toISOString()
  };

  console.log(`[webhook] Sending balance update: ${balance} credits`);

  axios.post(webhookToUse, { embeds: [embed] }, { timeout: 10000 })
    .then(response => {
      console.log(`[webhook] ✅ Sent successfully (${response.status})`);
    })
    .catch(err => {
      console.log(`[webhook] ❌ Failed (${err.response?.status || 'unknown'}): ${err.response?.data?.message || err.message}`);
      if (err.response?.status === 401) {
        console.log('[webhook] ⚠️ URL might be invalid or expired');
      } else if (err.response?.status === 429) {
        console.log('[webhook] ⚠️ Rate limited by Discord');
      } else if (err.response?.status === 404) {
        console.log('[webhook] ⚠️ Channel might be deleted');
      }
    });
}

// Synchronous version for workers
function loadEncryptedCookiesSync() {
  try {
    // For workers, we need to load synchronously
    // Use the database if available, otherwise fall back to local file
    const database = require('./backend/database');

    if (database.isConnected && !database.useLocalStorage) {
      // For MongoDB, we need to make it sync - this is a limitation
      // Workers should get account data passed from parent process
      throw new Error('Workers cannot load from MongoDB synchronously');
    }

    // Load from local file synchronously
    const fs = require('fs');
    const path = require('path');
    const LOCAL_STORAGE_FILE = path.join(__dirname, 'accounts.local.json');

    if (fs.existsSync(LOCAL_STORAGE_FILE)) {
      const data = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8');
      const accounts = JSON.parse(data);

      // Decrypt cookies
      return accounts.map(account => ({
        ...account,
        cookies: account.cookies ? decode(account.cookies) : {}
      }));
    }

    return [];
  } catch (error) {
    console.error('Error in loadEncryptedCookiesSync:', error.message);
    return [];
  }
}

module.exports = {
  encode,
  decode,
  loadEncryptedCookies,
  loadEncryptedCookiesSync,
  saveEncryptedCookies,
  autoEncryptIfNeeded,
  sendDiscordEmbed,
  testWebhook,
  formatShortTime,
  logWithTimezone,
  logFarmer,
  logUtils,
  logMaster,
  logStatus,
  logWorker,
  parseCookieString,
  addAccount,
  removeAccount,
  getAccount,
  updateAccountCookies
};
