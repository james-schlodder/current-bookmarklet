// The Current - Bookmarklet Script
// This script injects the popup into the current webpage

(function() {
  'use strict';
  
  // Check if popup already exists
  if (document.getElementById('current-bookmarklet-popup')) {
    console.log('Popup already open');
    return;
  }
  
  // Google Analytics tracking function
  function trackEvent(eventName, parameters = {}) {
    try {
      // Load Google Analytics if not already loaded
      if (typeof gtag === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-WMSPQVX00W';
        document.head.appendChild(script);
        
        window.dataLayer = window.dataLayer || [];
        window.gtag = function(){dataLayer.push(arguments);};
        gtag('js', new Date());
        gtag('config', 'G-WMSPQVX00W');
      }
      
      // Track the event
      gtag('event', eventName, {
        event_category: 'Bookmarklet',
        event_label: window.location.hostname,
        ...parameters
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }
  
  // Track bookmarklet usage
  trackEvent('bookmarklet_opened', {
    page_url: window.location.href,
    page_title: document.title
  });
  
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
  iframe.src = 'https://james-schlodder.github.io/current-bookmarklet/popup.html';
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
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
  closeBtn.addEventListener('click', function() {
    document.body.removeChild(container);
  });
  
  container.appendChild(iframe);
  container.appendChild(closeBtn);
  document.body.appendChild(container);
  
  // Listen for messages from iframe to get page data
  window.addEventListener('message', function(event) {
    // Verify origin
    if (event.origin !== 'https://james-schlodder.github.io') {
      return;
    }
    
    if (event.data.action === 'extractPage') {
      // Extract page data (now async)
      extractPageData().then(pageData => {
        // Send back to iframe
        iframe.contentWindow.postMessage({
          action: 'pageData',
          data: pageData
        }, 'https://james-schlodder.github.io');
      });
    }
  });
  
  // Publication mappings - loaded from CSV
  let publicationMappings = {};
  
  // Function to load publication mappings from CSV
  async function loadPublicationMappings() {
    try {
      const response = await fetch('https://james-schlodder.github.io/current-bookmarklet/currentpublications.csv');
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

  // Parse all JSON-LD blocks on the page, returning the first NewsArticle/Article/ReportageNewsArticle
  function getJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        // Handle both single objects and @graph arrays
        const items = data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          const type = item['@type'] || '';
          const types = Array.isArray(type) ? type : [type];
          if (types.some(t => ['NewsArticle', 'Article', 'ReportageNewsArticle', 'BlogPosting', 'WebPage'].includes(t))) {
            return item;
          }
        }
      } catch (e) {
        // Malformed JSON-LD — skip
      }
    }
    return null;
  }

  // Safely format a date string — returns empty string if invalid
  function formatDate(rawDate) {
    if (!rawDate) return '';
    const d = new Date(rawDate);
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
    for (const pattern in publicationMappings) {
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

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      // Strip leading label prefixes like "Exclusive | " or "WATCH | "
      headline = ogTitle.content.trim().replace(/^[A-Z][A-Za-z\s]{0,20}\s*\|\s*/, '');
    }

    if (!headline && jsonLd && jsonLd.headline) {
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

    if (!headline) {
      // Strip common " | Site Name" or " - Site Name" suffixes from document.title
      headline = document.title.replace(/\s[\|\-–—]\s.+$/, '').trim();
    }

    // -------------------------------------------------------------------------
    // URL
    // -------------------------------------------------------------------------
    const url = window.location.href;
    
    // -------------------------------------------------------------------------
    // PUBLICATION
    // -------------------------------------------------------------------------
    const publication = getPublicationName(jsonLd);
    
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
      // [rel="author"] scoped inside article/main is more reliable
      const byline = document.querySelector('article [rel="author"], main [rel="author"], [rel="author"]');
      if (byline) author = byline.textContent.trim();
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

    // -------------------------------------------------------------------------
    // SUMMARY
    // Pull first 2 sentences from the article body using site-specific selectors,
    // with generic fallbacks. og:description is last resort only.
    // -------------------------------------------------------------------------
    const ogDescContent = (document.querySelector('meta[property="og:description"]') || {}).content || '';
    const summaryHostname = window.location.hostname.replace('www.', '');

    const BOILERPLATE_START = /^(subscribe|sign in|log in|already a subscriber|copyright ©|write to |corrections|advertisement)/i;
    const BOILERPLATE_BODY = /non-commercial use|subscriber agreement|copyright law|reprints|all rights reserved|terms of use|privacy policy|javascript is required|dow jones & company/i;

    function isInsideExcludedZone(el) {
      const excluded = [
        '.paywall', '[class*="paywall"]',
        'header', 'footer', 'nav',
        '[class*="newsletter"]', '[class*="subscribe"]',
        '[class*="related"]', '[class*="sidebar"]',
        '[class*="ad-"]', '[class*="-ad"]',
        '.css-16aepit',  // WSJ hidden copyright paragraph
      ];
      return excluded.some(sel => {
        try { return el.closest(sel) !== null; } catch(e) { return false; }
      });
    }

    function extractTwoSentences(text) {
      const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
      if (sentences.length > 0) return sentences.slice(0, 2).join(' ').trim();
      return text.length > 40 ? text : '';
    }

    function tryParagraphList(nodeList) {
      for (const p of nodeList) {
        if (isInsideExcludedZone(p)) continue;
        const text = p.textContent.trim();
        if (text.length < 40) continue;
        if (BOILERPLATE_START.test(text)) continue;
        if (BOILERPLATE_BODY.test(text)) continue;
        // Skip if it's just the og:description / deck echoed verbatim
        if (ogDescContent && text.startsWith(ogDescContent.substring(0, 60))) continue;
        const result = extractTwoSentences(text);
        if (result.length >= 40) return result;
      }
      return '';
    }

    // Site-specific selectors tried first
    const siteSelectors = {
      'wsj.com':        'p[data-testid="paragraph"]',
      'nytimes.com':    'section[name="articleBody"] p, [class*="StoryBodyCompanionColumn"] p, p[data-block-type="paragraph"]',
      'reuters.com':    '[class*="text__text"] p, [class*="article-body"] p, [data-testid="paragraph"] p',
      'politico.com':   '.story-text p, .article-content p',
      'thehill.com':    '.article__text p',
      'axios.com':      '[class*="gtm-story-text"] p, article p',
      'apnews.com':     '.RichTextStoryBody p, [class*="Article"] p',
      'bloomberg.com':  '[class*="body-content"] p',
      'ft.com':         '[class*="article-body"] p',
      'economist.com':  'article p',
    };

    // Generic fallback selectors in priority order
    const genericSelectors = [
      'article p',
      '[data-testid="article-body"] p',
      '[class*="article-body"] p',
      '[class*="article-content"] p',
      '[class*="story-body"] p',
      '[class*="post-content"] p',
      '[class*="entry-content"] p',
      'main p',
    ];

    let summary = '';

    // 1. Try site-specific selector
    for (const [domain, sel] of Object.entries(siteSelectors)) {
      if (summaryHostname.includes(domain)) {
        summary = tryParagraphList(document.querySelectorAll(sel));
        if (summary) break;
      }
    }

    // 2. Try generic selectors
    if (!summary) {
      for (const sel of genericSelectors) {
        summary = tryParagraphList(document.querySelectorAll(sel));
        if (summary) break;
      }
    }

    // 3. Fall back to og:description only if body extraction failed
    if (!summary && ogDescContent && ogDescContent.length > 40) {
      summary = ogDescContent.trim();
    }

    // 4. Last resort: meta description
    if (!summary) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription && metaDescription.content) summary = metaDescription.content.trim();
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
