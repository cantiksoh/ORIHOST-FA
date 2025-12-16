const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Disable buffering for faster error feedback
mongoose.set('bufferCommands', false);
const { encode, decode } = require('./crypto');

// Local file storage fallback
const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'accounts.local.json');

// MongoDB Models
const AccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  cookies: { type: mongoose.Schema.Types.Mixed, default: {} },
  webhook: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  bufferCommands: false, // Disable buffering for this schema
  autoCreate: false // Disable auto-creation since buffering is disabled
});

const Account = mongoose.model('Account', AccountSchema);

// Database connection class
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.useLocalStorage = false;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

      if (!mongoUri) {
        console.log('⚠️  No MongoDB URI found, falling back to local file storage');
        this.useLocalStorage = true;
        this.isConnected = true;
        return;
      }

      // For mongoose 8+, use simple connection
      await mongoose.connect(mongoUri);

      this.isConnected = true;
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      console.log('⚠️  Falling back to local file storage');
      this.useLocalStorage = true;
      this.isConnected = true;
    }
  }

  // Account operations
  async getAllAccounts() {
    if (this.useLocalStorage) {
      const accounts = this._readLocalAccounts();
      // Decrypt cookies for local storage accounts
      return accounts.map(account => ({
        ...account,
        cookies: account.cookies ? decode(account.cookies) : {}
      }));
    }

    try {
      const accounts = await Account.find({});
      // Decrypt cookies for MongoDB accounts, skip corrupted ones
      const validAccounts = [];
      for (const acc of accounts) {
        try {
          const account = acc.toObject();
          const decryptedCookies = account.cookies ? decode(account.cookies) : {};
          validAccounts.push({
            ...account,
            cookies: decryptedCookies
          });
        } catch (decodeError) {
          console.warn(`⚠️  Skipping corrupted account ${acc.id}: ${decodeError.message}`);
          // Try to salvage account without cookies
          const account = acc.toObject();
          validAccounts.push({
            ...account,
            cookies: {} // Empty cookies for corrupted account
          });
        }
      }
      return validAccounts;
    } catch (error) {
      console.error('Error fetching accounts from MongoDB:', error);
      const accounts = this._readLocalAccounts();
      // Decrypt cookies for local storage accounts
      return accounts.map(account => ({
        ...account,
        cookies: account.cookies ? decode(account.cookies) : {}
      }));
    }
  }

  async getAccountById(id) {
    if (this.useLocalStorage) {
      const accounts = this._readLocalAccounts();
      const account = accounts.find(acc => acc.id === id);
      // Decrypt cookies if found
      return account ? {
        ...account,
        cookies: account.cookies ? decode(account.cookies) : {}
      } : null;
    }

    try {
      const account = await Account.findOne({ id });
      if (account) {
        const accountObj = account.toObject();
        return {
          ...accountObj,
          cookies: accountObj.cookies ? decode(accountObj.cookies) : {}
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching account from MongoDB:', error);
      const accounts = this._readLocalAccounts();
      const account = accounts.find(acc => acc.id === id);
      // Decrypt cookies if found
      return account ? {
        ...account,
        cookies: account.cookies ? decode(account.cookies) : {}
      } : null;
    }
  }

  async createAccount(accountData) {
    // Encrypt cookies before saving
    const accountToSave = {
      ...accountData,
      cookies: accountData.cookies ? encode(accountData.cookies) : {}
    };

    if (this.useLocalStorage) {
      const accounts = this._readLocalAccounts();
      accounts.push(accountToSave);
      this._writeLocalAccounts(accounts);
      // Return decrypted version for consistency
      return accountData;
    }

    try {
      const account = new Account(accountToSave);
      await account.save();
      // Sync to local file for worker access
      await this._syncToLocalFile();
      // Return decrypted version
      return account.toObject();
    } catch (error) {
      console.error('Error creating account in MongoDB:', error);
      // Fallback to local storage
      const accounts = this._readLocalAccounts();
      accounts.push(accountToSave);
      this._writeLocalAccounts(accounts);
      // Return decrypted version
      return accountData;
    }
  }

  async updateAccount(id, updateData) {
    // Encrypt cookies before saving if present
    const updateDataToSave = {
      ...updateData,
      ...(updateData.cookies && { cookies: encode(updateData.cookies) }),
      updatedAt: new Date()
    };

    if (this.useLocalStorage) {
      const accounts = this._readLocalAccounts();
      const index = accounts.findIndex(acc => acc.id === id);
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updateDataToSave };
        this._writeLocalAccounts(accounts);
        // Return decrypted version
        return {
          ...accounts[index],
          cookies: accounts[index].cookies ? decode(accounts[index].cookies) : {}
        };
      }
      return null;
    }

    try {
      const account = await Account.findOneAndUpdate(
        { id },
        updateDataToSave,
        { new: true }
      );
      if (account) {
        // Sync to local file for worker access
        await this._syncToLocalFile();
        const accountObj = account.toObject();
        return {
          ...accountObj,
          cookies: accountObj.cookies ? decode(accountObj.cookies) : {}
        };
      }
      return null;
    } catch (error) {
      console.error('Error updating account in MongoDB:', error);
      // Fallback to local storage
      const accounts = this._readLocalAccounts();
      const index = accounts.findIndex(acc => acc.id === id);
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updateDataToSave };
        this._writeLocalAccounts(accounts);
        // Return decrypted version
        return {
          ...accounts[index],
          cookies: accounts[index].cookies ? decode(accounts[index].cookies) : {}
        };
      }
      return null;
    }
  }

  async deleteAccount(id) {
    if (this.useLocalStorage) {
      const accounts = this._readLocalAccounts();
      const filteredAccounts = accounts.filter(acc => acc.id !== id);
      this._writeLocalAccounts(filteredAccounts);
      return true;
    }

    try {
      const result = await Account.findOneAndDelete({ id });
      if (result) {
        // Sync to local file for worker access
        await this._syncToLocalFile();
      }
      return !!result;
    } catch (error) {
      console.error('Error deleting account from MongoDB:', error);
      // Fallback to local storage
      const accounts = this._readLocalAccounts();
      const filteredAccounts = accounts.filter(acc => acc.id !== id);
      this._writeLocalAccounts(filteredAccounts);
      return true;
    }
  }

  // Sync database accounts to local file for worker access
  async _syncToLocalFile() {
    try {
      if (this.useLocalStorage) return; // Already using local storage

      const accounts = await this.getAllAccounts();
      const encryptedAccounts = [];
      for (const account of accounts) {
        try {
          encryptedAccounts.push({
            ...account,
            cookies: account.cookies ? encode(account.cookies) : {}
          });
        } catch (encodeError) {
          console.warn(`⚠️  Skipping account ${account.id} during sync: ${encodeError.message}`);
          // Skip corrupted accounts during sync
        }
      }

      this._writeLocalAccounts(encryptedAccounts);
      console.log(`✅ Synced ${encryptedAccounts.length} accounts to local file for worker access`);
    } catch (error) {
      console.error('Error syncing to local file:', error);
    }
  }

  // Local storage helpers
  _readLocalAccounts() {
    try {
      if (fs.existsSync(LOCAL_STORAGE_FILE)) {
        const data = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error reading local accounts:', error);
      return [];
    }
  }

  _writeLocalAccounts(accounts) {
    try {
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(accounts, null, 2));
    } catch (error) {
      console.error('Error writing local accounts:', error);
    }
  }

  // Utility methods
  isUsingMongoDB() {
    return !this.useLocalStorage;
  }

  async close() {
    if (!this.useLocalStorage && this.isConnected) {
      await mongoose.connection.close();
    }
  }
}

// Export singleton instance
const dbManager = new DatabaseManager();
module.exports = dbManager;
