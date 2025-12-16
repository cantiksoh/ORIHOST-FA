const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Security configuration
const ENCRYPTION_KEY = process.env.SECURITY_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Ensure key is 32 bytes for AES-256
function getKey() {
  return Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
}

// Generate IV for encryption
function generateIV() {
  return crypto.randomBytes(16);
}

// Encrypt text
function encrypt(text) {
  const iv = generateIV();
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt text
function decrypt(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Not encrypted

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, return original (for backward compatibility)
    return encryptedText;
  }
}

// Encrypt file content
function encryptFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf8');
    const encrypted = encrypt(content);

    // Create encrypted version
    const encryptedPath = filePath + '.enc';
    fs.writeFileSync(encryptedPath, encrypted, 'utf8');

    return encrypted;
  } catch (error) {
    console.error(`Error encrypting file ${filePath}:`, error);
    return null;
  }
}

// Get encrypted content for serving
function getEncryptedContent(filePath) {
  const encryptedPath = filePath + '.enc';

  // Check if encrypted version exists
  if (fs.existsSync(encryptedPath)) {
    return fs.readFileSync(encryptedPath, 'utf8');
  }

  // If not, encrypt on the fly
  const encrypted = encryptFile(filePath);
  return encrypted;
}

// Generate client-side decryption script
function getDecryptionScript() {
  return `
    <script>
      (function() {
        const ENCRYPTION_KEY = '${ENCRYPTION_KEY}';
        const ALGORITHM = '${ALGORITHM}';

        function decrypt(encryptedText) {
          try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) return encryptedText;

            const iv = new Uint8Array(parts[0].match(/.{2}/g).map(byte => parseInt(byte, 16)));
            const encrypted = parts[1];

            // Browser-compatible decryption using Web Crypto API
            return encryptedText; // Placeholder - actual decryption happens server-side
          } catch (error) {
            return encryptedText;
          }
        }

        // Decrypt all encrypted script tags
        function decryptAll() {
          const scripts = document.querySelectorAll('script[data-encrypted]');
          scripts.forEach(script => {
            const encrypted = script.textContent;
            const decrypted = decrypt(encrypted);
            script.textContent = decrypted;
            script.removeAttribute('data-encrypted');
          });
        }

        // Decrypt all encrypted style tags
        function decryptStyles() {
          const styles = document.querySelectorAll('style[data-encrypted]');
          styles.forEach(style => {
            const encrypted = style.textContent;
            const decrypted = decrypt(encrypted);
            style.textContent = decrypted;
            style.removeAttribute('data-encrypted');
          });
        }

        // Run decryption after DOM loads
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            decryptAll();
            decryptStyles();
          });
        } else {
          decryptAll();
          decryptStyles();
        }
      })();
    </script>
  `;
}

// Custom character set with Unicode symbols (harder to decode)
const CUSTOM_CHARS = 'ΨΩΦΘΞΠΣΔΛΓΗΚΜΝΡΤΥΧΖΒΑΕΙΟΩψωφθξπσδλγηκμνρτυχζβαειο※◊◈◇◆◄►▼▲♠♣♥♦♪♫☼☽☾☿❀❁❂❃❄❅❆❇❈❉❊❋❌❍❎❏❐❑❒❓❔❕❖❗❘❙❚❛❜❝❞❟❠❡❢❣❤❥❦❧❨❩❪❫❬❭❮❯❰❱❲❳❴❵❶❷❸❹❺❻❼❽❾❿➀➁➂➃➄➅➆➇➈➉➊➋➌➍➎➏➐➑➒➓➔→↓↔↕↖↗↘↙↚↛↜↝↞↟↠↡↢↣↤↥↦↧↨↩↪↫↬↭↮↯↰↱↲↳↴↵↶↷↸↹↺↻↼↽↾↿⇀⇁⇂⇃⇄⇅⇆⇇⇈⇉⇊⇋⇌⇍⇎⇏⇐⇑⇒⇓⇔⇕⇖⇗⇘⇙⇚⇛⇜⇝⇞⇟⇠⇡⇢⇣⇤⇥⇦⇧⇨⇩⇪⇫⇬⇭⇮⇯⇰⇱⇲⇳⇴⇵⇶⇷⇸⇹⇺⇻⇼⇽⇾⇿';

// Encrypt HTML content like the PHP version
function encryptHtmlContent(html) {
  // Minify HTML carefully
  html = html.replace(/>\s+</g, '><');
  html = html.replace(/<!--(?!\[if).*?-->/gs, '');
  html = html.trim();

  // URL encode the HTML first
  const htmlEncoded = encodeURIComponent(html);

  // Convert encoded HTML to custom encoded string
  let encoded = '';
  for (let i = 0; i < htmlEncoded.length; i++) {
    const char = htmlEncoded[i];
    const code = char.charCodeAt(0);

    // Split into two indices for double-layer encoding
    const idx1 = code % CUSTOM_CHARS.length;
    const idx2 = Math.floor(code / CUSTOM_CHARS.length) % CUSTOM_CHARS.length;

    encoded += CUSTOM_CHARS[idx1];
    encoded += CUSTOM_CHARS[idx2];
  }

  // Generate obfuscated variable names
  const varNames = [
    '_0x' + crypto.randomBytes(3).toString('hex'),
    '_0x' + crypto.randomBytes(3).toString('hex'),
    '_r', '_i1', '_i2', '_cc'
  ];

  // Build minimal decoder - ONLY <script> tag visible in source
  let decoder = '<script>\n';
  decoder += '// protected by mra1k3r0\n';
  decoder += '(function(){';
  decoder += 'var ' + varNames[0] + '=function(){';
  decoder += 'var ' + varNames[1] + '="' + CUSTOM_CHARS + '";';
  decoder += 'var _0x66nq7a="' + encoded + '";';
  decoder += 'var ' + varNames[2] + '="";';
  decoder += 'for(var i=0;i<_0x66nq7a.length;i+=2){';
  decoder += 'var ' + varNames[3] + '=-1;';
  decoder += 'var ' + varNames[4] + '=-1;';
  decoder += 'for(var j=0;j<' + varNames[1] + '.length;j++){';
  decoder += 'if(' + varNames[1] + '[j]===_0x66nq7a[i])' + varNames[3] + '=j;';
  decoder += 'if(' + varNames[1] + '[j]===_0x66nq7a[i+1])' + varNames[4] + '=j;';
  decoder += '}';
  decoder += 'if(' + varNames[3] + '!==-1&&' + varNames[4] + '!==-1){';
  decoder += 'var ' + varNames[5] + '=' + varNames[3] + '+(' + varNames[4] + '*' + varNames[1] + '.length);';
  decoder += varNames[2] + '+=String.fromCharCode(' + varNames[5] + ');';
  decoder += '}}';
  decoder += 'return decodeURIComponent(' + varNames[2] + ');';
  decoder += '};';
  decoder += 'document.write(' + varNames[0] + '());';
  decoder += '})();';

  // Anti-debugging and protection
  decoder += 'setTimeout(function(){';
  decoder += 'document.addEventListener("contextmenu",function(e){e.preventDefault()});';
  decoder += 'document.onkeydown=function(e){if(e.keyCode===123||(e.ctrlKey&&e.shiftKey&&e.keyCode===73)||(e.ctrlKey&&e.keyCode===85)||(e.ctrlKey&&e.shiftKey&&e.keyCode===74)){return false;}};';
  decoder += 'document.addEventListener("dragstart",function(e){e.preventDefault()});';
  decoder += '},100);';

  decoder += '\n</script>';

  return decoder;
}

// Generate random filename for security
function generateRandomFilename(originalName, extension) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${randomBytes}-${timestamp}-${originalName}.${extension}`;
}

// Store mapping of original to random filenames
const fileMappings = new Map();

// Middleware to serve encrypted content with access control
function serveEncrypted(publicDir) {
  return async (ctx, next) => {
    // Add security headers
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.set('X-XSS-Protection', '1; mode=block');
    ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    const originalPath = ctx.path;
    // Remove query parameters for file type checking
    const pathWithoutQuery = originalPath.split('?')[0];
    const isStaticFile = pathWithoutQuery.endsWith('.html') || pathWithoutQuery.endsWith('.css') || pathWithoutQuery.endsWith('.js');

    // Skip API routes and dynamic routes completely
    if (ctx.path.startsWith('/api/') || ctx.path.includes('/login') || ctx.path.includes('/dashboard')) {
      return await next();
    }

    // Handle static file serving with access control
    if (isStaticFile) {
      // Remove query parameters and leading slash from path for file resolution
      const cleanPath = originalPath.split('?')[0].replace(/^\//, '');
      const filePath = path.join(publicDir, cleanPath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        ctx.status = 404;
        ctx.body = `File not found: ${filePath} (originalPath: ${originalPath}, cleanPath: ${cleanPath})`;
        return;
      }

      // Smart access control for CSS/JS files
      if ((pathWithoutQuery.endsWith('.css') || pathWithoutQuery.endsWith('.js')) &&
          (pathWithoutQuery.startsWith('/css/') || pathWithoutQuery.startsWith('/js/') || pathWithoutQuery.startsWith('/security/'))) {

        const referrer = ctx.get('referer') || ctx.get('referrer') || '';
        const userAgent = ctx.get('user-agent') || '';
        const host = ctx.host;

        // Debug response for testing
        if (ctx.query.debug === '1') {
          ctx.body = `DEBUG: path=${pathWithoutQuery}, referrer="${referrer}", userAgent="${userAgent}", host=${ctx.host}, isFromOurDomain=${referrer.includes(ctx.host) || referrer.includes('localhost:3000') || referrer.includes('127.0.0.1:3000')}, isBrowser=${userAgent.includes('Mozilla') && (userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox') || userAgent.includes('Edge'))}`;
          return;
        }

        // Session-based access control - allow if user has visited the site recently
        const session = ctx.session;
        const now = Date.now();
        const sessionTimeout = 5 * 60 * 1000; // 5 minutes

        // Check if user has a valid session (has visited login/dashboard recently)
        const hasValidSession = session && session.lastActivity && (now - session.lastActivity < sessionTimeout);

        // Allow if user has valid session OR is a legitimate browser request with referrer
        const isFromOurDomain = referrer.includes(ctx.host) || referrer.includes('localhost:3000') || referrer.includes('127.0.0.1:3000');
        const isBrowserRequest = userAgent.includes('Mozilla') && (userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Firefox') || userAgent.includes('Edge'));
        const isAutomation = userAgent.includes('curl') || userAgent.includes('wget') || userAgent.includes('python') || userAgent.includes('bot') || userAgent.includes('spider');

        const isLegitimate = hasValidSession || (isFromOurDomain && isBrowserRequest && !isAutomation);

        if (!isLegitimate) {
          ctx.status = 403;
          ctx.body = 'Access Denied - Direct file access not allowed';
          return;
        }
      }

      // Read and serve the file
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Set appropriate content type
        if (originalPath.endsWith('.html')) {
          ctx.type = 'html';
        } else if (originalPath.endsWith('.css')) {
          ctx.type = 'css';
        } else if (originalPath.endsWith('.js')) {
          ctx.type = 'javascript';
        }

        ctx.body = fileContent;

        // Encrypt the content after setting it
        if (ctx.body && typeof ctx.body === 'string' && ctx.body.length > 0) {
          try {
            if (originalPath.endsWith('.html')) {
              // Encrypt the entire HTML content and return only a script tag
              ctx.body = encryptHtmlContent(ctx.body);
            } else {
              // Add a simple encrypted header comment for CSS/JS
              const encryptedHeader = encrypt('Orihost Farmer - Protected Source Code');
              ctx.body = `/* ${encryptedHeader} */\n${ctx.body}`;
            }
          } catch (error) {
            console.error('Error encrypting static file:', error);
          }
        }

        return; // Don't call next() since we handled the request
      } catch (error) {
        console.error('Error reading file:', error);
        ctx.status = 500;
        return;
      }
    }

    // For non-static files, continue to next middleware
    await next();
  };
}

// Obfuscate JavaScript content using professional obfuscator
function obfuscateJsContent(js) {
  try {
    const obfuscationResult = JavaScriptObfuscator.obfuscate(js, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: false,
      debugProtectionInterval: 0,
      disableConsoleOutput: false,
      domainLock: [],
      identifierNamesGenerator: 'hexadecimal',
      identifiersDictionary: [],
      identifiersPrefix: '',
      inputFileName: '',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      renameProperties: false,
      reservedNames: [],
      reservedStrings: [],
      rotateStringArray: true,
      seed: 0,
      selfDefending: true,
      shuffleStringArray: true,
      simplify: true,
      sourceMap: false,
      sourceMapBaseUrl: '',
      sourceMapFileName: '',
      sourceMapMode: 'separate',
      splitStrings: true,
      splitStringsChunkLength: 10,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayIndexesType: ['hexadecimal-numeric-string'],
      stringArrayIndexShift: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      target: 'browser',
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    });

    return obfuscationResult.getObfuscatedCode();
  } catch (error) {
    console.error('JS obfuscation failed:', error);
    // Fallback to simple minification if obfuscation fails
    return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  }
}

// Minify CSS content
function minifyCssContent(css) {
  // Remove comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove extra whitespace
  css = css.replace(/\s+/g, ' ');

  // Remove spaces around specific characters
  css = css.replace(/\s*([{}:;,])\s*/g, '$1');

  // Remove trailing semicolons
  css = css.replace(/;}/g, '}');

  return css.trim();
}

module.exports = {
  encrypt,
  decrypt,
  encryptFile,
  getEncryptedContent,
  serveEncrypted,
  getDecryptionScript,
  encryptHtmlContent,
  obfuscateJsContent,
  minifyCssContent
};
