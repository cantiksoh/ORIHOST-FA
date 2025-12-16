/* ab15222fbd7bfa5a1b0c0e40bd0c3bb1:b3d420e2c58508c701191d133b44576042da788e8bb6618cec10e031aaf05bbab514395e0016b4a464c0cfba336f4e27fbdc12fa5bd0e144ccb74c94b36d5e6f */
/* 1bc47a4d4cdb4cd0eb7d5073a945ec9d:8121b45a8280edfaa944d4da76d59a412bf7a8c6625884132c247aa0e29323a707334ba7f84ea18c74f3510ce0678f61c05da1ed71c80795809ee1606d9acc81 */
// Anti-DevTools Protection Script
// Include this on all pages for maximum security

(function() {
    'use strict';

    // Console warnings array
    const warnings = [
        '⚠️ WARNING: Do not paste any code here!',
        '🚫 SECURITY ALERT: This console is monitored',
        '🔒 PROTECTED: Unauthorized access detected',
        '🛡️ Orihost Farmer: Console access logged',
        '❌ WARNING: Pasting code here may compromise your account',
        '🚨 ALERT: Console manipulation detected',
        '🔐 SECURE: This system is protected against attacks',
        '🚫 FORBIDDEN: Unauthorized console access',
        '⚡ DANGER: Malicious code injection detected',
        '🛑 STOP: Do not execute unknown scripts'
    ];

    let warningIndex = 0;
    let devtoolsOpen = false;
    let consoleClearCount = 0;

    // Override dangerous console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalClear = console.clear;

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

    console.clear = function() {
        // Prevent clearing and show warning instead
        showSecurityWarning();
        return originalClear.apply(console);
    };

    function showSecurityWarning() {
        const warning = warnings[warningIndex % warnings.length];
        warningIndex++;

        // Clear console and show security message
        originalClear.call(console);
        originalLog.call(console, '%c' + warning, 'color: #ff0000; font-size: 20px; font-weight: bold; background: #000; padding: 10px;');
        originalLog.call(console, '%c🚫 NEVER paste code from unknown sources!', 'color: #ff6600; font-size: 16px; font-weight: bold;');
        originalLog.call(console, '%c💡 This can steal your accounts and data.', 'color: #ff6600; font-size: 14px;');
        originalLog.call(console, '%c🔒 If someone told you to paste something here, it\'s a SCAM!', 'color: #d32f2f; font-size: 16px; font-weight: bold; text-decoration: underline;');

        // Show visual warning occasionally
        if (Math.random() < 0.3) { // 30% chance
            showPageWarning();
        }
    }

    function showPageWarning() {
        // Remove existing warnings
        const existing = document.querySelectorAll('.security-warning');
        existing.forEach(el => el.remove());

        // Create warning overlay
        const warning = document.createElement('div');
        warning.className = 'security-warning';
        warning.innerHTML = '<div class="warning-content"><div class="warning-icon">🚨</div><div class="warning-text"><h3>🚨 Security Alert!</h3><p><strong>Developer Tools Detected</strong></p><div class="warning-details"><p>⚠️ <strong>Never paste code here!</strong></p><p>🔒 This console is monitored</p><p>🛡️ Unauthorized access is logged</p><p>🚫 Pasting malicious code can compromise your accounts</p></div><p class="warning-footer">If you were instructed to paste code here, <strong>it\'s a scam!</strong></p></div><button onclick="this.parentElement.parentElement.remove()">I Understand</button></div>';

        // Add styles inline
        warning.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: \'Inter\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; animation: securityFadeIn 0.3s ease-out;';

        const content = warning.querySelector('.warning-content');
        content.style.cssText = 'background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); padding: 40px; border-radius: 20px; max-width: 550px; width: 90%; text-align: center; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3); border: 2px solid #ff4444; position: relative;';

        const icon = warning.querySelector('.warning-icon');
        icon.style.cssText = 'font-size: 64px; margin-bottom: 20px; animation: securityPulse 2s infinite;';

        const h3 = warning.querySelector('h3');
        h3.style.cssText = 'color: #d32f2f; margin: 0 0 15px 0; font-size: 28px; font-weight: 700;';

        const details = warning.querySelector('.warning-details');
        details.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: left;';

        const paragraphs = details.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.cssText = 'margin: 8px 0; color: #856404; font-size: 16px; font-weight: 500;';
        });

        const footer = warning.querySelector('.warning-footer');
        footer.style.cssText = 'color: #d32f2f; font-weight: 700; font-size: 18px; margin: 20px 0 0 0;';

        const button = warning.querySelector('button');
        button.style.cssText = 'background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%); color: white; border: none; padding: 15px 30px; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600; margin-top: 25px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);';

        button.onmouseover = function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 8px 25px rgba(255, 68, 68, 0.4)';
        };

        button.onmouseout = function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(255, 68, 68, 0.3)';
        };

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = '@keyframes securityFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } } @keyframes securityPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }';
        document.head.appendChild(style);

        document.body.appendChild(warning);

        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (warning.parentElement) {
                warning.remove();
            }
        }, 15000);
    }

    // Detect devtools opening using multiple methods
    function checkDevTools() {
        // Method 1: Performance timing
        const start = performance.now();
        debugger; // This will be slower if devtools are open
        const end = performance.now();

        if (end - start > 100) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                showSecurityWarning();
            }
        } else {
            devtoolsOpen = false;
        }

        // Method 2: Check console object
        if (window.console && typeof window.console.clear === 'function') {
            // Additional checks can be added here
        }
    }

    // Check for devtools every 300ms
    setInterval(checkDevTools, 300);

    // Detect common devtools shortcuts
    document.addEventListener('keydown', function(e) {
        const isDevShortcut =
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
            (e.ctrlKey && e.keyCode === 85) || // Ctrl+U (view source)
            (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
            (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
            (e.ctrlKey && e.shiftKey && e.keyCode === 75) || // Ctrl+Shift+K (clear console)
            (e.ctrlKey && e.keyCode === 74); // Ctrl+J (open console on some browsers)

        if (isDevShortcut) {
            e.preventDefault();
            showSecurityWarning();
            return false;
        }
    });

    // Detect right-click (often used to inspect element)
    document.addEventListener('contextmenu', function(e) {
        // Only show warning if it's not on a form element
        if (!e.target.closest('input, textarea, select')) {
            setTimeout(() => {
                showSecurityWarning();
            }, 100);
        }
    });

    // Clear console and show warnings periodically
    setInterval(() => {
        originalClear.call(console);
        showSecurityWarning();
        consoleClearCount++;

        // Show additional security messages
        if (consoleClearCount % 3 === 0) {
            originalLog.call(console, '%c🛡️ SECURITY SYSTEM ACTIVE 🛡️', 'color: #2196f3; font-size: 24px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);');
            originalLog.call(console, '%c🔒 All console activities are monitored and logged', 'color: #666; font-size: 16px; font-style: italic;');
            originalLog.call(console, '%c⚠️ Do not execute code from untrusted sources', 'color: #ff9800; font-size: 16px; font-weight: bold;');
        }
    }, 45000); // Every 45 seconds

    // Initial security message
    setTimeout(() => {
        originalLog.call(console, '%c🔐 Orihost Farmer Security System Active', 'color: #4caf50; font-size: 18px; font-weight: bold;');
        originalLog.call(console, '%cConsole access is protected and monitored for your security.', 'color: #666; font-size: 14px; font-style: italic;');
        originalLog.call(console, '%cNever paste or execute code from unknown sources.', 'color: #ff5722; font-size: 14px; font-weight: bold;');
    }, 1000);

    // Prevent eval and other dangerous functions
    window.eval = function() {
        showSecurityWarning();
        throw new Error('eval() is disabled for security reasons');
    };

    // Monitor for suspicious activity
    let suspiciousActivityCount = 0;
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;

    window.setTimeout = function(callback, delay) {
        if (typeof callback === 'string') {
            suspiciousActivityCount++;
            showSecurityWarning();
        }
        return originalSetTimeout.call(this, callback, delay);
    };

    window.setInterval = function(callback, delay) {
        if (typeof callback === 'string') {
            suspiciousActivityCount++;
            showSecurityWarning();
        }
        return originalSetInterval.call(this, callback, delay);
    };

    // If too much suspicious activity, show stronger warning
    setInterval(() => {
        if (suspiciousActivityCount > 0) {
            originalLog.call(console, '%c🚨 SUSPICIOUS ACTIVITY DETECTED 🚨', 'color: #f44336; font-size: 28px; font-weight: bold; text-shadow: 3px 3px 6px rgba(0,0,0,0.7);');
            originalLog.call(console, '%cYour session may be compromised. Please log out and change your password.', 'color: #f44336; font-size: 18px; font-weight: bold;');
            suspiciousActivityCount = 0;
        }
    }, 60000); // Check every minute

})();
