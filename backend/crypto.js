const CryptoJS = require('crypto-js');

// Generate UUID for farmer identification
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Determine secure env path (hidden/system location)
const getEnvPath = () => {
  const homeDir = process.env.USERPROFILE || process.env.HOME;
  const appData = process.env.APPDATA;
  // Use appdata on Windows, home on others
  const secureDir = appData || homeDir;

  if (!secureDir) {
    throw new Error('Could not determine secure directory path');
  }

  const envPath = require('path').join(secureDir, '.orihost-key');
  return envPath;
};

// Generate random key and UUID if not exists
const fs = require('fs');
const path = require('path');
const ENV_PATH = getEnvPath();

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
}

// Load environment variables
require('dotenv').config({ path: ENV_PATH });

// Get encryption key
function getKey() {
  const key = process.env.ORI_KEY;
  if (!key) {
    throw new Error('ORI_KEY not found. Delete .orihost-key file and restart.');
  }

  // Ensure key is exactly 64 characters (32 bytes hex)
  if (key.length !== 64) {
    throw new Error(`ORI_KEY must be 64 hex characters, got ${key.length}`);
  }

  return key; // Return raw hex string, CryptoJS can handle it
}

// Encrypt data with single encryption (for testing)
function encode(data) {
  try {
    const key = getKey();
    const jsonStr = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonStr, key).toString();
    return encrypted;
  } catch (error) {
    throw new Error(`Encode failed: ${error.message}`);
  }
}

// Decrypt data with single decryption
function decode(encryptedData) {
  try {
    const key = getKey();
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      throw new Error('Decryption failed - empty result');
    }

    return JSON.parse(decryptedStr);
  } catch (error) {
    throw new Error(`Decode failed: ${error.message}`);
  }
}

module.exports = {
  encode,
  decode,
  getKey
};
