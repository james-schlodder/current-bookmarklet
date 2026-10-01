// The Current - Bookmarklet Script
// This script injects the popup into the current webpage

(function() {
  'use strict';

  // Signal that the script executed successfully (used by CSP fallback detection)
  window.__currentBookmarkletLoaded = true;

  // If this script loaded slowly and the bookmark already showed its
  // "open in a new tab" banner, remove it — the side panel is opening instead
  const earlyBanner = document.getElementById('current-bookmarklet-banner');
  if (earlyBanner) earlyBanner.remove();

  // Check if popup already exists
  if (document.getElementById('current-bookmarklet-popup')) {
    console.log('Popup already open');
    return;
  }
  
  // Where popup.html and the CSV live — taken from wherever this script was
  // loaded from, so a local copy can be tested without touching the live site
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE_URL = SCRIPT_SRC
    ? SCRIPT_SRC.substring(0, SCRIPT_SRC.lastIndexOf('/') + 1)
    : 'https://james-schlodder.github.io/current-bookmarklet/';
  const BASE_ORIGIN = new URL(BASE_URL).origin;

  // If the side panel hasn't checked in after this long, offer the new-tab link
  // (some sites allow this script but block the panel from loading)
  const PANEL_TIMEOUT_MS = 6000;

  // Create container (no dimming background)
  const container = document.createElement('div');
  container.id = 'current-bookmarklet-popup';
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 520px;
    height: 100%;
    z-index: 999999;
  `;
  
  // Create iframe to hold the popup
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    border: none;
    border-left: 1px solid #e2e8f0;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
    width: 520px;
    height: 100%;
    background: white;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
  `;
  document.head.appendChild(style);
  iframe.src = BASE_URL + 'popup.html';
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 20px;
    left: -50px;
    background: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000000;
    transition: all 0.2s;
  `;
  closeBtn.addEventListener('mouseover', function() {
    this.style.background = '#f1f5f9';
  });
  closeBtn.addEventListener('mouseout', function() {
    this.style.background = 'white';
  });
  closeBtn.addEventListener('click', closePanel);
  
  container.appendChild(iframe);
  container.appendChild(closeBtn);
  document.body.appendChild(container);

  let panelCheckedIn = false;
  let banner = null;

  // Remove everything this script added to the page
  function closePanel() {
    clearTimeout(panelTimer);
    window.removeEventListener('message', onMessage);
    container.remove();
    style.remove();
    removeBanner();
  }
  
  // Listen for messages from iframe to get page data
  function onMessage(event) {
    // Only respond to our own panel
    if (event.origin !== BASE_ORIGIN || event.source !== iframe.contentWindow) {
      return;
    }
    
    if (event.data && event.data.action === 'extractPage') {
      panelCheckedIn = true;
      clearTimeout(panelTimer);
      removeBanner();

      // Extract page data (now async)
      extractPageData().then(pageData => {
        // Send back to iframe
        iframe.contentWindow.postMessage({
          action: 'pageData',
          data: pageData
        }, BASE_ORIGIN);
      });
    }
  }
  window.addEventListener('message', onMessage);

  // Panel never checked in — show a banner linking to The Current in a new tab
  // with the extracted data. The panel is left in place in case it's just slow;
  // if it checks in later the banner is removed.
  const panelTimer = setTimeout(function() {
    if (panelCheckedIn) return;
    extractPageData().then(function(pageData) {
      if (!panelCheckedIn && container.isConnected) showNewTabBanner(pageData);
    });
  }, PANEL_TIMEOUT_MS);

  // Same banner the bookmark itself shows on sites that block this script
  function showNewTabBanner(pageData) {
    removeBanner();
    const link = BASE_URL + 'popup.html#data=' + encodeURIComponent(JSON.stringify(pageData));
    banner = document.createElement('div');
    banner.id = 'current-bookmarklet-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1000001;background:rgb(74,159,181);padding:14px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-family:Arial,sans-serif';
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.textContent = 'Click here to open The Current in a new tab';
    a.style.cssText = 'color:white;font-size:16px;font-weight:bold;text-decoration:underline';
    a.addEventListener('click', function() { setTimeout(closePanel, 0); });
    const x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'background:none;border:none;color:white;font-size:20px;cursor:pointer;margin-left:16px;vertical-align:middle';
    x.addEventListener('click', closePanel);
    banner.appendChild(a);
    banner.appendChild(x);
    document.body.appendChild(banner);
  }

  function removeBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }
  
  // Publication mappings - loaded from CSV
  let publicationMappings = {};
  
  // Function to load publication mappings from CSV
  async function loadPublicationMappings() {
    try {
      const response = await fetch(BASE_URL + 'currentpublications.csv');
      const csvText = await response.text();
      
      const lines = csvText.trim().split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split on the FIRST comma only — publication names may contain commas
        const commaIndex = line.indexOf(',');
        if (commaIndex === -1) continue;

        let urlPattern = line.substring(0, commaIndex).trim();
        const publication = line.substring(commaIndex + 1).trim().replace(/,+/g, '').trim();

        if (!urlPattern || !publication) continue;

        // Clean up URL pattern
        urlPattern = urlPattern.replace(/^https?:\/\//, '');
        urlPattern = urlPattern.replace(/^www\./, '');

        publicationMappings[urlPattern] = publication;
      }
    } catch (error) {
      console.warn('Could not load publication mappings:', error);
    }
  }

  // Parse all JSON-LD blocks on the page and return the best article entry.
  // Article types are preferred; a generic WebPage entry is only used if no
  // article entry exists (WebPage often appears first but lacks author/date).
  function getJsonLd() {
    const ARTICLE_TYPES = ['NewsArticle', 'Article', 'ReportageNewsArticle', 'BlogPosting'];
    const items = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        // Handle single objects, top-level arrays, and @graph arrays
        const blocks = Array.isArray(data) ? data : [data];
        for (const block of blocks) {
          if (!block) continue;
          if (Array.isArray(block['@graph'])) items.push(...block['@graph']);
          else items.push(block);
        }
      } catch (e) {
        // Malformed JSON-LD — skip
      }
    }

    function typesOf(item) {
      const type = (item && item['@type']) || '';
      return Array.isArray(type) ? type : [type];
    }

    return items.find(item => typesOf(item).some(t => ARTICLE_TYPES.includes(t)))
        || items.find(item => typesOf(item).includes('WebPage'))
        || null;
  }

  // Safely format a date string — returns empty string if invalid
  function formatDate(rawDate) {
    if (!rawDate) return '';
    rawDate = String(rawDate).trim();
    // A bare date like "2026-09-30" would be read as midnight UTC, which shows
    // as the previous day in US time zones — read it as a local date instead
    const dateOnly = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = dateOnly
      ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
      : new Date(rawDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    });
  }

  // Check if a string looks like a URL rather than a name
  function isUrl(str) {
    return /^https?:\/\//i.test(str) || /^www\./i.test(str);
  }

  // Extract a clean author name from a JSON-LD author value (string, object, or array)
  function parseJsonLdAuthor(authorField) {
    if (!authorField) return '';
    const authors = Array.isArray(authorField) ? authorField : [authorField];
    const names = authors.map(a => {
      if (typeof a === 'string') return isUrl(a) ? '' : a.trim().replace(/,+$/, '');
      if (typeof a === 'object' && a.name) return isUrl(a.name) ? '' : a.name.trim().replace(/,+$/, '');
      return '';
    }).filter(Boolean);
    return names.join(', ');
  }

  // Strip commas from publication name — commas should never appear in publication field
  function cleanPublication(name) {
    if (!name) return '';
    return name.replace(/,+/g, '').trim();
  }

  // Function to get publication name from CSV mapping or fallback to scraping
  function getPublicationName(jsonLd) {
    const hostname = window.location.hostname.replace('www.', '');
    const pathname = window.location.pathname;
    const fullPath = hostname + pathname;
    
    // First, try full URL path match (e.g. subscriber.politicopro.com/article/eenews/)
    // Sort patterns longest-first so more specific paths win over shorter ones
    const sortedPatterns = Object.keys(publicationMappings)
      .sort((a, b) => b.length - a.length);
    for (const pattern of sortedPatterns) {
      if (fullPath.startsWith(pattern)) {
        return cleanPublication(publicationMappings[pattern]);
      }
    }
    
    // Second, try hostname match
    if (publicationMappings[hostname]) {
      return cleanPublication(publicationMappings[hostname]);
    }

    // Third, try JSON-LD publisher name
    if (jsonLd && jsonLd.publisher) {
      const pub = jsonLd.publisher;
      if (typeof pub === 'string' && !isUrl(pub)) return cleanPublication(pub);
      if (typeof pub === 'object' && pub.name) return cleanPublication(pub.name);
    }
    
    // Fourth, og:site_name
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) {
      return cleanPublication(ogSiteName.content);
    }
    
    // Final fallback to hostname
    return hostname;
  }

  // Strip AP/wire-style dateline prefixes (e.g. "HENDERSON, Ky. (WEHT) –")
  // and wire section labels (e.g. "CLIMATEWIRE | ", "GREENWIRE | ", "ENERGYWIRE | ")
  function stripDateline(text) {
    // Strip section labels like "CLIMATEWIRE | " or "GREENWIRE | "
    text = text.replace(/^[A-Z][A-Z]+(?:WIRE|NEWS|ALERT)\s*[\|\-–—]\s*/i, '');
    // Strip AP-style datelines like "WASHINGTON (AP) —"
    return text.replace(/^[A-Z][A-Z\s.]{1,30}(?:,\s*[A-Za-z.]+)?\s*(?:\([^)]+\)\s*)?[–—\-]\s*/, '');
  }

  // Extract first N sentences from text, handling common abbreviations
  function extractSentences(text, count) {
    if (!text) return '';
    const PLACEHOLDER = '\x00';
    const abbreviations = [
      'U.S.', 'U.N.', 'U.K.', 'E.U.', 'D.C.',
      'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
      'Sen.', 'Rep.', 'Gov.', 'Gen.', 'Sgt.', 'Cpl.', 'Pvt.',
      'Capt.', 'Lt.', 'Col.', 'Maj.', 'Cmdr.', 'Adm.',
      'Rev.', 'Hon.', 'Pres.',
      'Inc.', 'Corp.', 'Ltd.', 'Co.', 'vs.', 'etc.',
      'Jan.', 'Feb.', 'Mar.', 'Apr.', 'Jun.', 'Jul.', 'Aug.',
      'Sep.', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
      'St.', 'Ave.', 'Blvd.', 'Rd.', 'Dept.', 'Est.', 'Vol.',
      'No.', 'Approx.'
    ];

    let safe = text;
    abbreviations.forEach(function(abbr) {
      const escaped = abbr.replace(/\./g, '\\.');
      safe = safe.replace(new RegExp(escaped, 'g'), abbr.replace(/\./g, PLACEHOLDER));
    });

    // Protect decimal numbers (e.g. "$3.5 billion")
    safe = safe.replace(/(\d)\.(\d)/g, '$1' + PLACEHOLDER + '$2');

    const parts = safe.split(/(?<=[.!?])\s+/);
    const result = parts.slice(0, count).join(' ');
    return result.replace(/\x00/g, '.');
  }

  // Scrape the first substantial paragraphs from the article body
  function extractArticleText() {
    const containerSelectors = [
      '[itemprop="articleBody"]',
      'article',
      '[role="main"]',
      'main',
      '.article-body', '.story-body', '.post-content',
      '.entry-content', '.article-content'
    ];
    const excludeSelectors = 'figcaption, aside, nav, footer, figure, .related, .newsletter, .ad, .sidebar, .comment, .social-share, [role="complementary"], [class*="author-bio"], [class*="vf-comment"], [class*="vf-content"], [class*="Carousel"], [class*="carousel"], [class*="caption"], [class*="photo-credit"], [class*="image-credit"], [class*="media-credit"]';

    for (const selector of containerSelectors) {
      const container = document.querySelector(selector);
      if (!container) continue;

      const paragraphs = container.querySelectorAll('p');
      const texts = [];

      for (const p of paragraphs) {
        if (p.closest(excludeSelectors)) continue;

        const text = p.textContent.trim();
        if (text.length < 40) continue;

        // Skip promotional/newsletter paragraphs
        if (/\b(newsletter|sign up|subscribe|download the app|get the app)\b/i.test(text)) continue;

        // Skip byline/credits paragraphs (e.g. "Reporting by..., Editing by...")
        if (/\b(reporting by|writing by|editing by|compiled by|additional reporting)\b/i.test(text)) continue;

        // Skip photo captions/credits (e.g. "Francis Chung/POLITICO" or "Photo by John Smith")
        if (/\b(photo by|getty images|associated press|courtesy of)\b/i.test(text)) continue;
        if (/[A-Z][a-z]+\s[A-Z][a-z]+\/[A-Z]{2,}/.test(text) && text.length < 200) continue;

        // Skip paragraphs that are mostly links
        const linkLen = Array.from(p.querySelectorAll('a'))
          .reduce((sum, a) => sum + a.textContent.length, 0);
        if (linkLen > text.length * 0.7) continue;

        texts.push(text);
        if (texts.length >= 2) break;
      }

      if (texts.length > 0) return texts.join(' ');
    }
    return '';
  }

  // Function to extract page data
  async function extractPageData() {
    if (Object.keys(publicationMappings).length === 0) {
      await loadPublicationMappings();
    }

    // Parse JSON-LD once — used across all fields
    const jsonLd = getJsonLd();

    // -------------------------------------------------------------------------
    // HEADLINE
    // Priority: og:title → JSON-LD headline → <h1> inside article/main → 
    //           any <h1> → document.title (with site name stripped)
    // og:title is first because it's explicitly set by publishers for sharing
    // and is almost always the clean article title.
    // -------------------------------------------------------------------------
    let headline = '';
    const hostname = window.location.hostname.replace(/^www\./, '');

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      // Strip leading label prefixes like "Exclusive | " or "WATCH | "
      headline = ogTitle.content.trim().replace(/^[A-Z][A-Za-z\s]{0,20}\s*\|\s*/, '');
    }

    if (!headline && jsonLd && typeof jsonLd.headline === 'string') {
      headline = jsonLd.headline.trim();
    }

    if (!headline) {
      // Prefer h1 scoped inside <article> or <main> to avoid nav/logo h1s
      const scopedH1 = document.querySelector('article h1, main h1, [role="main"] h1');
      if (scopedH1) headline = scopedH1.textContent.trim();
    }

    if (!headline) {
      const anyH1 = document.querySelector('h1');
      if (anyH1) headline = anyH1.textContent.trim();
    }

    // Fallback: check h2 elements for one that matches part of document.title
    // (for sites like Politico Pro that use h2 for article headlines and have no h1)
    if (!headline) {
      const h2s = document.querySelectorAll('h2');
      const norm = s => s.toLowerCase().replace(/[\u2018\u2019\u201C\u201D\u0027\u0060]/g, "'");
      const titleNorm = norm(document.title);
      for (const h2 of h2s) {
        const h2Text = h2.textContent.trim();
        if (h2Text.length > 10 && titleNorm.includes(norm(h2Text))) {
          headline = h2Text;
          break;
        }
      }
    }

    if (!headline) {
      // Strip common " | Site Name", " - Site Name", or " » breadcrumb" from document.title
      // For » breadcrumbs like "Site » Section » Headline", take the last segment
      if (document.title.includes(' \u00BB ')) {
        const parts = document.title.split(' \u00BB ');
        headline = parts[parts.length - 1].trim();
      } else {
        headline = document.title.replace(/\s[\|\-\u2013\u2014]\s.+$/, '').trim();
      }
    }

    // Site-specific headline overrides
    if (hostname.includes('bartlesvilleradio.com')) {
      // h1 is the site tagline, headline only exists in document.title after last »
      if (document.title.includes(' \u00BB ')) {
        const parts = document.title.split(' \u00BB ');
        headline = parts[parts.length - 1].trim();
      }
    }

    // -------------------------------------------------------------------------
    // URL
    // -------------------------------------------------------------------------
    const url = window.location.href;
    
    // -------------------------------------------------------------------------
    // PUBLICATION
    // -------------------------------------------------------------------------
    const publication = getPublicationName(jsonLd);

    // Strip site-name suffixes/prefixes from the headline by fuzzy-matching
    // against the publication name and hostname. This catches patterns like:
    //   "Article Title - Houston Business Journal"
    //   "Article Title -- Portland Business Journal"
    //   "CNN | Breaking news headline"
    if (headline) {
      // Build a set of source words from publication name + hostname
      const sourceWords = (publication + ' ' + hostname.replace(/\.\w+$/, '').replace(/[.-]/g, ' '))
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2); // ignore tiny words like "us", "uk"

      // Check if a fragment fuzzy-matches the source (any shared word = match)
      function looksLikeSource(fragment) {
        const words = fragment.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return false;
        const matches = words.filter(w => sourceWords.some(sw => sw.includes(w) || w.includes(sw)));
        // Match if at least one word overlaps AND the fragment is short (likely a site name, not real content)
        return matches.length > 0 && words.length <= 6;
      }

      // Check trailing suffix: " - Suffix", " -- Suffix", " | Suffix", " — Suffix"
      // Use greedy match (.+) on the left to capture the LAST separator
      const trailMatch = headline.match(/^(.+)\s+[\|\-–—]{1,2}\s+([^|–—]+)$/);
      if (trailMatch && looksLikeSource(trailMatch[2])) {
        headline = trailMatch[1].trim();
      }

      // Check leading prefix: "Prefix | Headline", "Prefix - Headline", "Prefix: Headline"
      // Use lazy match (.+?) on the left to capture the FIRST separator
      if (!(trailMatch && looksLikeSource(trailMatch[2]))) {
        const leadMatch = headline.match(/^([^|–—:]+?)\s*[\|\-–—:]{1,2}\s+(.+)$/);
        if (leadMatch && looksLikeSource(leadMatch[1])) {
          headline = leadMatch[2].trim();
        }
      }
    }

    // -------------------------------------------------------------------------
    // AUTHOR
    // Priority: JSON-LD author → meta[name="author"] → 
    //           article:author (only if not a URL) → [rel="author"] text
    // -------------------------------------------------------------------------
    let author = '';

    if (jsonLd && jsonLd.author) {
      author = parseJsonLdAuthor(jsonLd.author);
    }

    if (!author) {
      const authorMeta = document.querySelector('meta[name="author"]');
      if (authorMeta && authorMeta.content && !isUrl(authorMeta.content)) {
        author = authorMeta.content.trim();
      }
    }

    if (!author) {
      const articleAuthor = document.querySelector('meta[property="article:author"]');
      if (articleAuthor && articleAuthor.content && !isUrl(articleAuthor.content)) {
        author = articleAuthor.content.trim();
      }
    }

    if (!author) {
      // [rel="author"] or common author class names scoped inside article/main
      const byline = document.querySelector(
        'article [rel="author"], main [rel="author"], [rel="author"], ' +
        '.author__name, [class*="author-name"], [class*="Author-name"], ' +
        '[class*="authorName"], [class*="AuthorName"], ' +
        '[data-testid="author-name"]'
      );
      if (byline) author = byline.textContent.trim();
    }

    // Site-specific author fallbacks
    if (!author && hostname.includes('bartlesvilleradio.com')) {
      const ns = document.querySelector('.news_source');
      if (ns) author = ns.textContent.trim();
    }

    // Convert ALL CAPS author names to Title Case (e.g. "RIO YAMAT" → "Rio Yamat")
    if (author && author === author.toUpperCase() && author.length > 1) {
      author = author.replace(/\b\w+/g, function(w) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      });
    }

    // -------------------------------------------------------------------------
    // DATE
    // Priority: JSON-LD datePublished → article:published_time → 
    //           itemprop="datePublished" → <time> with dateTime inside article/main
    // -------------------------------------------------------------------------
    let date = '';

    if (jsonLd && jsonLd.datePublished) {
      date = formatDate(jsonLd.datePublished);
    }

    if (!date) {
      const publishedTime = document.querySelector('meta[property="article:published_time"]');
      if (publishedTime && publishedTime.content) {
        date = formatDate(publishedTime.content);
      }
    }

    if (!date) {
      // itemprop uses "content" or "datetime" attributes, not "property"
      const itempropDate = document.querySelector('[itemprop="datePublished"]');
      if (itempropDate) {
        date = formatDate(itempropDate.getAttribute('content') || itempropDate.getAttribute('datetime') || itempropDate.textContent);
      }
    }

    if (!date) {
      // Prefer <time> scoped inside article/main to avoid sidebar/comment dates
      const timeEl = document.querySelector('article time[datetime], main time[datetime]')
                  || document.querySelector('time[datetime]');
      if (timeEl) date = formatDate(timeEl.getAttribute('datetime'));
    }

    // Site-specific date fallbacks
    if (!date && hostname.includes('bartlesvilleradio.com')) {
      const dateEl = document.querySelector('.news_small');
      if (dateEl) {
        const m = dateEl.textContent.match(/(?:Posted|Published|Updated)[:\s]+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i);
        if (m) date = formatDate(m[1]);
      }
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // Primary: scrape first ~2 sentences from the article body DOM
    // Fallback: og:description → meta description
    // -------------------------------------------------------------------------
    let summary = '';

    // Try DOM scraping first
    const articleText = extractArticleText();
    if (articleText) {
      const cleaned = stripDateline(articleText);
      summary = extractSentences(cleaned, 2);
      // If the first 2 sentences are unusually short, grab more
      if (summary && summary.length < 100) {
        summary = extractSentences(cleaned, 4);
      }
    }

    // Site-specific summary fallbacks
    if ((!summary || summary.length < 100) && hostname.includes('bartlesvilleradio.com')) {
      // Article text is in <span> tags with no classes, not <p> tags
      const spans = document.querySelectorAll('span');
      const parts = [];
      for (const sp of spans) {
        // Only use spans that have direct text content (not containers)
        const t = sp.textContent.trim();
        if (t.length > 40 && t.length < 500 && sp.children.length === 0) {
          parts.push(t);
          if (parts.length >= 2) break;
        }
      }
      if (parts.length > 0) summary = parts.join(' ');
    }

    // Fallback to meta descriptions
    if (!summary) {
      const ogDescription = document.querySelector('meta[property="og:description"]');
      const metaDescription = document.querySelector('meta[name="description"]');
      if (ogDescription && ogDescription.content) summary = ogDescription.content.trim();
      else if (metaDescription && metaDescription.content) summary = metaDescription.content.trim();
    }

    // Clean trailing ellipsis and ensure we end on a complete sentence
    if (summary) {
      summary = summary.replace(/\s*\.{3,}\s*$/, '').replace(/\s*…\s*$/, '');
      if (!/[.!?]$/.test(summary)) {
        const lastEnd = Math.max(summary.lastIndexOf('.'), summary.lastIndexOf('!'), summary.lastIndexOf('?'));
        if (lastEnd > summary.length * 0.5) {
          summary = summary.substring(0, lastEnd + 1);
        }
      }
    }
    
    return {
      headline,
      url,
      publication,
      author,
      date,
      summary
    };
  }
})();
