const CryptoJS = require('crypto-js');

// Generate UUID for farmer identification
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Initialize encryption key with deployment-friendly approach
function initializeEncryptionKey() {
  let key = process.env.ORI_KEY;

  // First priority: Environment variable (for deployments like Render, Vercel)
  if (key) {
    console.log('🔑 Using ORI_KEY from environment variable');
    if (key.length !== 64) {
      throw new Error(`ORI_KEY must be 64 hex characters, got ${key.length}`);
    }
    return key;
  }

  // Second priority: File system (for local development)
  try {
    const fs = require('fs');
    const path = require('path');

    // Determine secure env path (hidden/system location)
    const homeDir = process.env.USERPROFILE || process.env.HOME;
    const appData = process.env.APPDATA;
    const secureDir = appData || homeDir;

    if (secureDir) {
      const envPath = path.join(secureDir, '.orihost-key');

      // Try to load from file
      if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        key = process.env.ORI_KEY;

        if (key) {
          console.log('🔑 Using ORI_KEY from file system');
          if (key.length !== 64) {
            throw new Error(`ORI_KEY must be 64 hex characters, got ${key.length}`);
          }
          return key;
        }
      }

      // File doesn't exist, create it for local development
      console.log('🔑 No ORI_KEY found, generating new key for local development...');
      const randomBytes = require('crypto').randomBytes(32);
      key = randomBytes.toString('hex');
      const farmerUUID = generateUUID();

      // Ensure directory exists
      const envDir = path.dirname(envPath);
      if (!fs.existsSync(envDir)) {
        fs.mkdirSync(envDir, { recursive: true });
      }

      fs.writeFileSync(envPath, `ORI_KEY=${key}\nORIFARM_UUID=${farmerUUID}\n`, 'utf8');
      console.log('✅ Key saved to local file for development');
      return key;
    }
  } catch (error) {
    console.warn('⚠️  File system not available (expected in serverless deployments)');
  }

  // Third priority: Generate temporary key (for serverless deployments)
  console.log('🔑 Generating temporary key (will change on restart - set ORI_KEY env var for persistence)');
  console.log('⚠️  WARNING: Data will be lost on app restart! Set ORI_KEY environment variable.');

  // Generate 32 bytes (256 bits) and convert to hex
  const randomBytes = require('crypto').randomBytes(32);
  key = randomBytes.toString('hex');

  // In production deployments, you should set this as an environment variable
  // For now, we'll log it so the user can set it
  console.log('⚠️  GENERATED NEW ENCRYPTION KEY - SET THIS AS ENVIRONMENT VARIABLE:');
  console.log(`   ORI_KEY=${key}`);
  console.log('   Add this to your deployment environment variables for data persistence!\n');

  return key;
}

// Get encryption key (initialize if needed)
function getKey() {
  return initializeEncryptionKey();
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
    console.log('Attempting to decode data, length:', encryptedData.length);

    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      console.log('Decryption produced empty result, data might be corrupted or encrypted with different key');
      throw new Error('Decryption failed - empty result');
    }

    console.log('Decryption successful, attempting JSON parse...');
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error('Decode error details:', error.message);
    console.error('This might indicate data was encrypted with a different key or is corrupted');
    throw new Error(`Decode failed: ${error.message}`);
  }
}

module.exports = {
  encode,
  decode,
  getKey
};
