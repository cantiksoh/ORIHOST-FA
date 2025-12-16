const axios = require('axios');
const fs = require('fs');

// Load encrypted cookies and utility functions
const { loadEncryptedCookiesSync, sendDiscordEmbed, logWithTimezone, logWorker, getAccount } = require('../utils');

// Get account ID from environment variable or command line argument
const accountId = process.env.ACCOUNT_ID || process.argv[2] || 'account1';

let allAccounts = [];
let account = null;
try {
  allAccounts = loadEncryptedCookiesSync();
  account = getAccount(allAccounts, accountId);
  if (!account) {
    logWorker(`❌ Account '${accountId}' not found in accounts`);
    process.exit(1);
  }
  logWorker(`✅ Loaded account: ${accountId}`);
} catch (error) {
  logWorker(`❌ Error loading accounts: ${error.message}`);
  process.exit(1);
}

// Use account-specific cookies
let cookies = account.cookies;

function buildCookieString(cookieMap) {
  return Object.entries(cookieMap)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function mergeSetCookies(cookieMap, setCookieHeaders = []) {
  if (!Array.isArray(setCookieHeaders)) return cookieMap;
  const updated = { ...cookieMap };
  for (const setCookie of setCookieHeaders) {
    if (typeof setCookie !== 'string') continue;
    const firstPart = setCookie.split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx === -1) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const value = firstPart.slice(eqIdx + 1).trim();
    updated[name] = value;
  }
  return updated;
}

function extractXsrfTokenFromHtml(html) {
  const metaMatch = html.match(/name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
  return metaMatch ? metaMatch[1] : null;
}

function getXsrfToken(cookieMap, html) {
  if (cookieMap['XSRF-TOKEN']) return decodeURIComponent(cookieMap['XSRF-TOKEN']);
  const fromHtml = extractXsrfTokenFromHtml(html || '');
  return fromHtml || '';
}


async function fetchHtmlAndRefreshSession(cookiesRef) {
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Cookie': buildCookieString(cookiesRef),
    'Referer': 'https://panel.orihost.com/auth/login',
    'Sec-Ch-Ua': '"Google Chrome";v="141", "Chromium";v="141", "Not?A_Brand";v="8"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
  };

  const resp = await axios({
    method: 'GET',
    url: 'https://panel.orihost.com/auth/login',
    headers: {
      ...headers,
      'Referer': 'https://panel.orihost.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    decompress: true,
    timeout: 30000,
    validateStatus: () => true
  });

  const setCookie = resp.headers['set-cookie'];
  const merged = mergeSetCookies(cookiesRef, setCookie);
  return { html: resp.data, userAgent: headers['User-Agent'], cookies: merged };
}

async function getStoreInfo(html, userAgent, cookiesRef) {
  const xsrfToken = getXsrfToken(cookiesRef, html);
  const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': buildCookieString(cookiesRef),
    'Referer': 'https://panel.orihost.com/store/credits',
    'User-Agent': userAgent,
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': xsrfToken
  };

  return await axios({
    method: 'GET',
    url: 'https://panel.orihost.com/api/client/store',
    headers,
    decompress: true,
    timeout: 30000,
    validateStatus: () => true
  });
}

async function postEarn(html, userAgent, cookiesRef) {
  const xsrfToken = getXsrfToken(cookiesRef, html);
  const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': buildCookieString(cookiesRef),
    'Origin': 'https://panel.orihost.com',
    'Referer': 'https://panel.orihost.com/store/credits',
    'User-Agent': userAgent,
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': xsrfToken
  };

  return await axios({
    method: 'POST',
    url: 'https://panel.orihost.com/api/client/store/earn',
    headers,
    data: '',
    decompress: true,
    timeout: 30000,
    validateStatus: () => true
  });
}

function extractNumericField(obj, candidateKeys = ['balance', 'credits', 'coins', 'amount']) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'number') {
      return obj[key];
    }
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value) {
      const found = extractNumericField(value, candidateKeys);
      if (typeof found === 'number') return found;
    }
  }
  return null;
}

async function runFarmer(intervalMs = 60000) {
  logWorker(`[${accountId}] starting, interval=${Math.round(intervalMs/1000)}s`);
  let cycleCount = 0;
  let sessionValid = false; // Start with refresh needed
  let sessionRefreshCount = 0;
  let isFirstRun = true;
  const webhookInterval = Math.floor((30 * 60 * 1000) / intervalMs); // 30 minutes in cycles
  const sessionRefreshInterval = Math.floor((25 * 60 * 1000) / intervalMs); // Refresh session every 25 minutes proactively

  while (true) {
    const startedAt = new Date();
    let html, userAgent;

    try {
      // Proactive session refresh every 25 minutes OR reactive refresh when invalid
      sessionRefreshCount++;
      const needsRefresh = !sessionValid || sessionRefreshCount >= sessionRefreshInterval;

      if (needsRefresh) {
        let refreshReason;
        if (isFirstRun) {
          refreshReason = 'initial setup';
        } else if (!sessionValid) {
          refreshReason = 'session expired';
        } else {
          refreshReason = 'preventive refresh';
        }
        logWithTimezone('info', `🔄 [${accountId}] Refreshing session (${refreshReason})...`, startedAt);
        isFirstRun = false;

        // Don't clear cookies completely, just try to refresh them
        const freshSession = await fetchHtmlAndRefreshSession(cookies);
        if (freshSession.cookies && Object.keys(freshSession.cookies).length > 0) {
          // Merge new cookies with existing ones
          cookies = { ...cookies, ...freshSession.cookies };
          // Save updated cookies back to account
          const { saveEncryptedCookies, updateAccountCookies } = require('../utils');
          allAccounts = updateAccountCookies(allAccounts, accountId, cookies);
          saveEncryptedCookies(allAccounts);
        }
        html = freshSession.html;
        userAgent = freshSession.userAgent;
        sessionValid = true;
        sessionRefreshCount = 0;
        logWithTimezone('info', `✅ [${accountId}] Session refreshed`, startedAt);
      } else {
        // Use existing session data
        const sessionData = await fetchHtmlAndRefreshSession(cookies);
        cookies = sessionData.cookies;
        html = sessionData.html;
        userAgent = sessionData.userAgent;
      }

      const infoResp = await getStoreInfo(html, userAgent, cookies);
      let infoStr = `http ${infoResp.status}`;
      let currentBalance = null;

      if (infoResp.status >= 200 && infoResp.status < 300) {
        const balance = extractNumericField(infoResp.data, ['balance', 'credits', 'coins']);
        infoStr = typeof balance === 'number' ? `balance=${balance}` : 'ok';
        currentBalance = balance;
        sessionValid = true;
      } else if (infoResp.status === 401 || infoResp.status === 403) {
        logWithTimezone('warn', `Session expired (${infoResp.status}), will refresh next cycle`, startedAt);
        infoStr = 'session expired';
        sessionValid = false; // Will trigger refresh on next cycle
      } else {
        logWithTimezone('warn', `API error: ${infoResp.status}`, startedAt);
        infoStr = `http ${infoResp.status}`;
        sessionValid = false;
      }

      process.send && process.send({ type: 'info', ts: startedAt.toISOString(), status: infoResp.status, message: `[${accountId}] ${infoStr}` });
      logWithTimezone('info', `[${accountId}] ${infoStr}`, startedAt);

      // Send Discord webhook every 30 minutes
      cycleCount++;
      if (cycleCount >= webhookInterval && currentBalance !== null) {
        sendDiscordEmbed(currentBalance, startedAt, accountId);
        cycleCount = 0; // Reset counter
      }

      const earnResp = await postEarn(html, userAgent, cookies);
      if (earnResp.status === 204) {
        process.send && process.send({ type: 'earn', ts: startedAt.toISOString(), status: 204, message: 'ok' });
        logWithTimezone('earn', `[${accountId}] ok (${earnResp.status})`, startedAt);
        sessionValid = true;
      } else if (earnResp.status === 401 || earnResp.status === 403) {
        logWithTimezone('warn', `[${accountId}] session expired`, startedAt);
        sessionValid = false; // Will trigger refresh on next cycle
        process.send && process.send({ type: 'earn', ts: startedAt.toISOString(), status: earnResp.status, message: 'session expired' });
      } else {
        process.send && process.send({ type: 'earn', ts: startedAt.toISOString(), status: earnResp.status, message: 'http ' + earnResp.status });
        logWithTimezone('error', `[${accountId}] http ${earnResp.status}`, startedAt);
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.send && process.send({ type: 'error', ts: startedAt.toISOString(), message: msg });
      logWithTimezone('error', msg, startedAt);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

const intervalEnv = process.env.INTERVAL_MS ? Number(process.env.INTERVAL_MS) : 60000;
runFarmer(intervalEnv);


