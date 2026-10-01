// Popup script for The Current bookmarklet

document.addEventListener('DOMContentLoaded', function() {
  const copyBtn = document.getElementById('copyBtn');
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  
  const headlineInput = document.getElementById('headline');
  const urlInput = document.getElementById('url');
  const publicationInput = document.getElementById('publication');
  const authorInput = document.getElementById('author');
  const dateInput = document.getElementById('date');
  const summaryInput = document.getElementById('summary');
  
  // Set today's date as placeholder with 2-digit day
  const today = new Date();
  const todayFormatted = today.toLocaleDateString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric' 
  });
  dateInput.placeholder = todayFormatted;
  
  // ---------------------------------------------------------------------------
  // Invisible character sanitizer
  // Strips Unicode characters that are invisible in editors/previews but render
  // as "?" in sent emails. Common sources: Factiva, Dow Jones, scraped content.
  // Targets:
  //   U+200B  Zero Width Space
  //   U+200C  Zero Width Non-Joiner
  //   U+200D  Zero Width Joiner
  //   U+2060  Word Joiner          <- confirmed culprit in Factiva content
  //   U+FEFF  Zero Width No-Break Space / BOM
  //   U+00AD  Soft Hyphen
  //   U+180E  Mongolian Vowel Separator
  //   U+2028  Line Separator
  //   U+2029  Paragraph Separator
  // ---------------------------------------------------------------------------
  const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\u2060\uFEFF\u00AD\u180E\u2028\u2029]/g;

  function stripInvisible(text) {
    if (!text) return text;
    return text.replace(INVISIBLE_CHARS_REGEX, '');
  }

  // ---------------------------------------------------------------------------
  // Email-safe characters
  // Higher Logic sends emails in an older encoding (ISO-8859-1 / Windows-1252).
  // Any character outside that set becomes "?" in the sent email, even though
  // it looks fine in the Higher Logic editor. Tested Oct 2026: dashes, curly
  // quotes, accented letters, \u2026 \u2022 \u20AC \u2122 all come through fine; the minus sign
  // (USA Today uses it as a dash) and invisible characters do not.
  // Characters outside the set are swapped for a safe look-alike here.
  // ---------------------------------------------------------------------------
  const WINDOWS_1252_EXTRAS = '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';

  const SAFE_REPLACEMENTS = {
    '\u2010': '-', '\u2011': '-', '\u2043': '-', '\uFE63': '-', '\uFF0D': '-',  // hyphens
    '\u2012': '\u2013',                                                             // figure dash
    '\u2015': '\u2014', '\u2E3A': '\u2014', '\u2E3B': '\u2014', '\uFE58': '\u2014',                 // long dashes
    '\u201B': '\u2018', '\u201F': '\u201C', '\u02BC': '\u2019', '\u2032': "'", '\u2033': '"',  // quotes/primes
    '\u2024': '.', '\u2027': '\u00B7', '\u2219': '\u00B7', '\u22C5': '\u00B7',                 // dots
    '\u2044': '/', '\u2215': '/',                                              // slashes
    '\u0141': 'L', '\u0142': 'l', '\u0110': 'D', '\u0111': 'd', '\u0126': 'H', '\u0127': 'h', '\u0131': 'i'       // letters with no plain form
  };

  function isEmailSafe(ch) {
    const code = ch.codePointAt(0);
    return code < 0x80 || (code >= 0xA0 && code <= 0xFF) || WINDOWS_1252_EXTRAS.indexOf(ch) !== -1;
  }

  function makeEmailSafe(text) {
    if (!text) return text;

    // Minus sign: used as a dash between spaces ("companies \u2212 including"),
    // otherwise it's a real minus ("\u22125 degrees") and becomes a hyphen
    text = text.replace(/(\s)\u2212(?=\s)/g, '$1\u2014').replace(/\u2212/g, '-');

    // Unusual spaces (thin, narrow, em space, etc.) become a normal space
    text = text.replace(/[\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

    return Array.from(text).map(function(ch) {
      if (isEmailSafe(ch)) return ch;
      if (SAFE_REPLACEMENTS[ch]) return SAFE_REPLACEMENTS[ch];
      // Rare accented letters, ligatures and full-width characters: use the
      // plain version (e.g. "\u014D" -> "o", "\uFB01" -> "fi") if that is email-safe
      const plain = ch.normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
      if (plain && Array.from(plain).every(isEmailSafe)) return plain;
      // No safe look-alike (e.g. emoji): leave it \u2014 a warning is shown
      return ch;
    }).join('');
  }

  // Characters that will still turn into "?" (shown as a warning)
  function findUnsafeChars(text) {
    return Array.from(text || '').filter(function(ch) { return !isEmailSafe(ch); });
  }

  function sanitizeText(text) {
    return makeEmailSafe(stripInvisible(text));
  }

  // ---------------------------------------------------------------------------
  // Auto-extract on load
  // If opened in a new tab with hash data (CSP fallback), use that directly.
  // Otherwise, request page data from parent iframe as normal.
  // ---------------------------------------------------------------------------
  var hashData = null;
  if (window.location.hash && window.location.hash.startsWith('#data=')) {
    try {
      hashData = JSON.parse(decodeURIComponent(window.location.hash.substring(6)));
    } catch (e) {
      console.warn('Could not parse hash data:', e);
    }
  }

  if (hashData) {
    // CSP fallback mode — pre-fill from URL hash data
    headlineInput.value    = titleCase(sanitizeText(hashData.headline    || ''));
    urlInput.value         = stripInvisible(hashData.url         || '');
    publicationInput.value = sanitizeText(hashData.publication || '');
    authorInput.value      = sanitizeText(hashData.author      || '');
    dateInput.value        = sanitizeText(hashData.date        || '');
    summaryInput.value     = sanitizeText(hashData.summary     || '');
    generateHTML();
    copyBtn.disabled = false;
    // Clean the hash from the URL so it doesn't look messy
    if (history.replaceState) {
      history.replaceState(null, '', window.location.pathname);
    }

    // Look up publication name from CSV (the popup page can fetch it freely)
    if (hashData.url) {
      fetch('currentpublications.csv')
        .then(function(response) { return response.text(); })
        .then(function(csvText) {
          var lines = csvText.trim().split('\n');
          var mappings = {};
          for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var commaIndex = line.indexOf(',');
            if (commaIndex === -1) continue;
            var urlPattern = line.substring(0, commaIndex).trim()
              .replace(/^https?:\/\//, '').replace(/^www\./, '');
            var pub = line.substring(commaIndex + 1).trim().replace(/,+/g, '').trim();
            if (urlPattern && pub) mappings[urlPattern] = pub;
          }

          // Extract hostname + path from the article URL
          try {
            var articleUrl = new URL(hashData.url);
            var hostname = articleUrl.hostname.replace(/^www\./, '');
            var fullPath = hostname + articleUrl.pathname;

            // Sort patterns longest-first so specific paths win
            var patterns = Object.keys(mappings).sort(function(a, b) { return b.length - a.length; });
            for (var i = 0; i < patterns.length; i++) {
              if (fullPath.startsWith(patterns[i])) {
                publicationInput.value = sanitizeText(mappings[patterns[i]]);
                generateHTML();
                return;
              }
            }
            // Try hostname-only match
            if (mappings[hostname]) {
              publicationInput.value = sanitizeText(mappings[hostname]);
              generateHTML();
            }
          } catch (e) {
            console.warn('Publication lookup failed:', e);
          }
        })
        .catch(function(err) { console.warn('Could not load CSV:', err); });
    }
  } else {
    // Normal iframe mode — request data from parent
    window.parent.postMessage({ action: 'extractPage' }, '*');
  }

  // ---------------------------------------------------------------------------
  // Receive extracted page data from parent window
  // Sanitize all fields silently before populating
  // ---------------------------------------------------------------------------
  window.addEventListener('message', function(event) {
    // Only accept data from the page that opened this panel
    if (event.source !== window.parent || window.parent === window) return;
    if (event.data && event.data.action === 'pageData') {
      const data = event.data.data;

      headlineInput.value    = titleCase(sanitizeText(data.headline    || ''));
      urlInput.value         = stripInvisible(data.url         || '');
      publicationInput.value = sanitizeText(data.publication || '');
      authorInput.value      = sanitizeText(data.author      || '');
      dateInput.value        = sanitizeText(data.date        || '');
      summaryInput.value     = sanitizeText(data.summary     || '');

      generateHTML();
      copyBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Paste sanitization — silently strips invisible chars on paste into any field
  // ---------------------------------------------------------------------------
  const allInputs = [headlineInput, urlInput, publicationInput, authorInput, dateInput, summaryInput];

  allInputs.forEach(function(input) {
    input.addEventListener('paste', function() {
      const self = this;
      setTimeout(function() {
        const cleaned = self === urlInput ? stripInvisible(self.value) : sanitizeText(self.value);
        if (cleaned !== self.value) {
          self.value = cleaned;
          generateHTML();
        }
      }, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Regenerate HTML preview whenever any field is edited
  // ---------------------------------------------------------------------------
  allInputs.forEach(input => {
    input.addEventListener('input', generateHTML);
  });
  
  // ---------------------------------------------------------------------------
  // Copy button
  // ---------------------------------------------------------------------------
  copyBtn.addEventListener('click', function() {
    const htmlCode = output.textContent;
    
    // Use a temporary textarea to copy (works inside iframes)
    const textarea = document.createElement('textarea');
    textarea.value = htmlCode;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showStatus('✓ Copied to clipboard!', 'success');
      } else {
        showStatus('✗ Failed to copy', 'error');
      }
    } catch (err) {
      showStatus('✗ Failed to copy', 'error');
      console.error('Copy failed:', err);
    }
    
    document.body.removeChild(textarea);
  });
  
  // ---------------------------------------------------------------------------
  // Generate HTML output
  // sanitizeText() applied here as a final safety net
  // ---------------------------------------------------------------------------
  function generateHTML() {
    const headline    = titleCase(sanitizeText(headlineInput.value.trim()));
    // Any non-ASCII character in the link is percent-encoded (the link still works)
    const url         = stripInvisible(urlInput.value.trim()).replace(/[^\x00-\x7F]/gu, encodeURIComponent);
    const publication = sanitizeText(publicationInput.value.trim());
    const author      = sanitizeText(authorInput.value.trim());
    const date        = sanitizeText(dateInput.value.trim());
    const summary     = sanitizeText(summaryInput.value.trim());
    
    if (!headline && !url) {
      output.classList.remove('show');
      copyBtn.disabled = true;
      return;
    }
    
    let html = '';
    
    // Headline section
    if (headline) {
      html += '<div><span style="font-size:16px;"><span style="font-family:Arial,sans-serif;"><font><b>';
      if (url) {
        html += '<a href="' + escapeHtml(url) + '" style="text-decoration: underline;">' + escapeHtml(headline) + '</a>';
      } else {
        html += escapeHtml(headline);
      }
      html += '</b></font></span></span>\n</div>\n';
    }
    
    // Metadata section (publication, author, date)
    if (publication || author || date) {
      html += '<div><span style="font-size:14px;"><font face="Arial, sans-serif" style=""><span style="color: rgb(136, 139, 148); line-height: 2; font-family: Arial, &quot;Arial Black&quot;, sans-serif;"><span style="font-family: Arial, sans-serif;">';
      
      if (publication) {
        html += escapeHtml(publication);
      }
      if (author) {
        if (publication) html += '&nbsp;&middot;&nbsp;';
        html += escapeHtml(author);
      }
      if (date) {
        if (publication || author) html += '&nbsp;&middot;&nbsp;';
      }
      
      html += '</span></span>';
      
      if (date) {
        html += '<span style="color:#888b94"><span style="line-height:2"><span style="font-family:Arial,\'Arial Black\',sans-serif"><span style="font-family:Arial,sans-serif">' + escapeHtml(date) + '</span></span>\n  </span>\n  </span>';
      }
      
      html += '\n  </font>\n  </span>\n</div>\n';
    }
    
    // Summary section
    if (summary) {
      html += '<div><span style="font-size:14px;"><font face="Arial, sans-serif"><span style="color:#000000;"><span style="font-family:Arial,sans-serif;"><span style="line-height: 1; font-family: Arial, &quot;Arial Black&quot;, sans-serif;"><span style="font-family:Arial,sans-serif;">';
      html += escapeHtml(summary);
      html += '</span> </span>\n  </span>\n  </span>\n  </font>\n  </span>\n</div>';
    }
    
    output.textContent = html;
    showCharWarning(findUnsafeChars(headline + publication + author + date + summary));
    output.classList.add('show');
    copyBtn.disabled = false;
  }
  
  // ---------------------------------------------------------------------------
  // Title case (client requirement)
  // Capitalizes each word except short articles/conjunctions/prepositions in
  // the middle of a headline. Words that already contain capitals after the
  // first letter (EPA, FERC, iPhone, McDonald's) are left exactly as written.
  // Headlines published in ALL CAPS are lowered first so they can be cased.
  // ---------------------------------------------------------------------------
  function titleCase(text) {
    if (!text) return text;

    const SMALL_WORDS = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in',
      'nor', 'of', 'off', 'on', 'or', 'per', 'so', 'the', 'to', 'up', 'via', 'vs',
      'yet'];

    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length > 3 && letters === letters.toUpperCase()) {
      text = text.toLowerCase();
    }

    const words = text.split(/(\s+)/);
    const lastIndex = words.length - 1 - (words[words.length - 1].trim() ? 0 : 1);
    let startOfPhrase = true;

    return words.map(function(word, i) {
      if (!word.trim()) return word;

      const isFirstOrLast = startOfPhrase || i === lastIndex;
      // Next word starts a new phrase after a colon, dash or question mark
      startOfPhrase = /[:–—?!]$/.test(word) || /^[–—-]+$/.test(word);

      // Handle hyphenated words part by part (e.g. "long-term" -> "Long-Term")
      return word.split('-').map(function(part, j) {
        const core = part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        if (!core) return part;
        // Leave words with capitals beyond the first letter alone
        if (/[A-Z]/.test(core.slice(1))) return part;
        // Leave URLs/domains alone (e.g. "Amazon.com")
        if (/\.[a-z]/i.test(core)) return part;
        if (j === 0 && !isFirstOrLast && SMALL_WORDS.indexOf(core.toLowerCase()) !== -1) {
          return part.toLowerCase();
        }
        return part.replace(/[A-Za-z]/, function(c) { return c.toUpperCase(); });
      }).join('-');
    }).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Warn about characters that will show as "?" in the sent email
  function showCharWarning(chars) {
    const warning = document.getElementById('charWarning');
    if (!chars.length) {
      warning.className = 'status';
      warning.textContent = '';
      return;
    }
    const unique = chars.filter(function(ch, i) { return chars.indexOf(ch) === i; });
    warning.textContent = '⚠ These characters may show as "?" in the email: ' + unique.join(' ') +
      ' — consider editing them out.';
    warning.className = 'status warning';
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status ' + type;
    
    setTimeout(function() {
      status.className = 'status';
    }, 3000);
  }
});
