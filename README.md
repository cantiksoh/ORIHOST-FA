# Orihost Farmer

A secure Node.js application that automatically earns credits on Orihost panel with multi-account support.

## Features

- 🔒 **Double AES Encryption** for cookie storage
- 👥 **Multi-Account Support** - Run multiple accounts simultaneously
- 🖥️ **HTTP Server** with status monitoring
- 🔄 **Auto-restart** worker process
- 📊 **Real-time status** via HTTP endpoint per account

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup cookies:**

   ### Single Account Setup
   Choose one of these formats:

   **Option A: JSON format (`cookie.json`)**
   ```json
   {
     "laravel_session": "your_laravel_session_here",
     "XSRF-TOKEN": "your_xsrf_token_here",
     "orihost_session": "your_orihost_session_here"
   }
   ```

   **Option B: Cookie string format (`cookie.txt`, `cookie.md`, or `cookie.cookie`)**
   ```
   laravel_session=your_session_here; XSRF-TOKEN=your_token_here; orihost_session=your_session_here
   ```

   ### Multi-Account Setup
   For multiple accounts, use the interactive setup script:
   ```bash
   node setup-multi-accounts.js
   ```

   Or manually create a JSON file with the format shown in `cookies-multi.example.json`:
   ```json
   [
     {
       "id": "account1",
       "cookies": {
         "laravel_session": "your_session_here",
         "XSRF-TOKEN": "your_token_here"
       }
     },
     {
       "id": "account2",
       "cookies": {
         "laravel_session": "your_second_session_here",
         "XSRF-TOKEN": "your_second_token_here"
       }
     }
   ]
   ```

   **Note:** Multi-account setup automatically encrypts your cookies and runs a separate worker for each account.

## Usage

### Local Development:
```bash
npm start
```
*Note: Cookies are automatically encrypted on first run using double AES encryption with a unique machine key.*

### Production (with PM2):
```bash
npm install -g pm2  # Install PM2 globally
npm run pm2        # Start with PM2
npm run pm2-logs   # View logs
npm run pm2-stop   # Stop the process
```

### Monitor status:
Visit `http://localhost:3000/status` for JSON status including:
- Total accounts and combined balance
- Per-account status (balance, session status, last farming results)
- Session expiration tracking per account
- Auto-refresh timestamps per account

### Environment Variables:
- `PORT` - Server port (default: 3000)
- `INTERVAL_MS` - Farming interval in milliseconds (default: 60000)
- `DISCORD_WEBHOOK` - Discord webhook URL for balance notifications (optional)

## 🚀 Deployment Options

### ✅ **Recommended Platforms:**

#### **1. VPS/Dedicated Servers**
- **DigitalOcean Droplets** ($6/month)
- **Linode** ($5/month)
- **Vultr** ($2.50/month)
- **AWS EC2** (Free tier available)

**Setup:**
```bash
# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd orihost-farmer
npm install
npm run pm2
```

#### **2. Cloud Platforms**
- **Railway** (Free tier, easy Node.js deploy)
- **Render** (Free tier, auto-deploys from Git)
- **Fly.io** (Generous free tier)

#### **3. Container Platforms**
- **Google Cloud Run**
- **AWS Fargate**
- **Docker anywhere**

### ⚠️ **Limitations:**

#### **❌ Not Compatible:**
- **Shared Hosting** (GoDaddy, Hostinger) - No persistent processes
- **Static Site Hosts** (Netlify, Vercel) - No server-side execution
- **Free Tiers with Restrictions** (Heroku free tier sleeps)

#### **⚠️ Requires Special Setup:**
- **cPanel Hosting** - May need custom Node.js setup
- **WordPress Hosting** - Usually no Node.js support

### 📋 **Deployment Checklist:**

- ✅ Node.js 16+ available
- ✅ Persistent file storage
- ✅ Outbound HTTP requests allowed
- ✅ Long-running processes allowed
- ✅ Port binding allowed (or use serverless)

### 🔧 **Environment Setup:**

Create a `.env` file or set environment variables:
```bash
PORT=3000
INTERVAL_MS=60000
```

Your farmer can run 24/7 on any Node.js-compatible hosting platform! 🎯

## CLI Output Example

```
[master] ✅ Loaded 2 account(s): account1, account2
[master] listening on http://localhost:3000/status
[worker] [account1] starting, interval=60s
[worker] [account2] starting, interval=60s
[20:04:50] info: 🔄 [account1] Refreshing session (initial setup)...
[20:04:50] info: ✅ [account1] Session refreshed
[20:04:50] info: [account1] balance=525
[20:04:50] earn: [account1] ok (204)
[20:04:51] info: 🔄 [account2] Refreshing session (initial setup)...
[20:04:51] info: ✅ [account2] Session refreshed
[20:04:51] info: [account2] balance=315
[20:04:51] earn: [account2] ok (204)
[webhook] ✅ Sent successfully (204) - Instance: a1b2c3d4 (account1)
[webhook] ✅ Sent successfully (204) - Instance: a1b2c3d4 (account2)
```

**Features:**
- 🕒 **Short Manila Time**: HH:MM:SS format in PHT
- 🎨 **Color-Coded**: Cyan=info, Green=earn, Yellow=warn, Red=error
- 📝 **Prefixed Logs**: [utils], [master], [worker], [webhook] prefixes
- 👥 **Account-Aware**: Each log shows which account it belongs to
- ✅ **Emoji Status**: Clear success/error indicators

## Features

- 🤖 **Auto Farming**: Earns credits automatically every minute
- 👥 **Multi-Account Support**: Run unlimited accounts simultaneously with separate workers
- 🔄 **Proactive Session Refresh**: Keeps sessions fresh every 25 minutes to prevent expiration
- 🔒 **Military-Grade Security**: Double AES encryption with unique keys per machine
- 📊 **Real-Time Monitoring**: HTTP status endpoint with per-account statistics
- 💬 **Discord Notifications**: Balance updates with account identification sent every 30 minutes
- 🔄 **Auto-Restart**: PM2 integration for 24/7 operation with per-account recovery
- 🌍 **Cross-Platform**: Works on Windows, Linux, macOS, and any Node.js hosting
- 🆔 **Multi-Instance Support**: Each farmer instance has a unique UUID for identification
- 🕒 **Manila Timezone**: All timestamps displayed in Asia/Manila (PHT)
- 🎨 **Color-Coded CLI**: Professional terminal output with colors
- 📈 **Combined Statistics**: Total balance across all accounts in status endpoint

## Security

- 🔒 **Double AES Encryption** for cookie storage
- 🏠 **Secure Key Storage**: Encryption key stored in system directory (`%APPDATA%/.orihost-key` on Windows)
- 📁 **No Plain Text**: Original cookies are removed after encryption
- 🔐 **Embedded Backup**: Original cookie data stored encrypted within the `.enc` file
- 🛡️ **Hidden Locations**: Sensitive files stored in system directories

### Manual encryption (optional):
```bash
npm run encrypt
```
This will encrypt cookies immediately instead of waiting for first run.

## Files Structure

```
├── index.js                    # Master server & multi-account worker manager
├── worker/farmer.js           # Farming logic (supports multiple accounts)
├── utils.js                   # Encryption & multi-account utilities
├── setup-multi-accounts.js    # Interactive multi-account setup script
├── encrypt-cookies.js         # Manual cookie encryption CLI
├── cookie.json.enc            # Encrypted multi-account cookies + embedded backup
├── cookies-multi.example.json # Multi-account cookie format example
├── cookies.txt.example        # Single account cookie format example
└── package.json

# System directory (~/.orihost-key on Linux/Mac, %APPDATA%/.orihost-key on Windows):
# └── .orihost-key     # Unique encryption key (hidden)
```
