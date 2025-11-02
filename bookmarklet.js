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
      
      // Parse CSV (handle extra commas and URL paths)
      const lines = csvText.trim().split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 2 && values[0].trim() && values[1].trim()) {
          let urlPattern = values[0].trim();
          const publication = values[1].trim();
          
          // Clean up URL pattern
          urlPattern = urlPattern.replace(/^https?:\/\//, ''); // Remove protocol
          urlPattern = urlPattern.replace(/^www\./, ''); // Remove www
          
          if (urlPattern) {
            publicationMappings[urlPattern] = publication;
          }
        }
      }
    } catch (error) {
      console.warn('Could not load publication mappings:', error);
    }
  }

  // Function to get publication name from CSV mapping or fallback to scraping
  function getPublicationName() {
    const hostname = window.location.hostname.replace('www.', '');
    const pathname = window.location.pathname;
    const fullPath = hostname + pathname;
    
    // First, try to match the full URL path (for cases like subscriber.politicopro.com/article/eenews/)
    for (const pattern in publicationMappings) {
      if (fullPath.startsWith(pattern)) {
        return publicationMappings[pattern];
      }
    }
    
    // Second, try to match just the hostname
    if (publicationMappings[hostname]) {
      return publicationMappings[hostname];
    }
    
    // Fallback to original scraping method
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      return ogSiteName.content;
    }
    
    // Final fallback to hostname
    return hostname;
  }

  // Function to extract page data
  async function extractPageData() {
    // Load publication mappings if not already loaded
    if (Object.keys(publicationMappings).length === 0) {
      await loadPublicationMappings();
    }
    
    // Try to extract headline
    let headline = '';
    const h1 = document.querySelector('h1');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    
    if (h1) headline = h1.textContent.trim();
    else if (ogTitle) headline = ogTitle.content;
    else if (twitterTitle) headline = twitterTitle.content;
    else headline = document.title;
    
    // Get URL
    const url = window.location.href;
    
    // Get publication using our CSV mapping system
    const publication = getPublicationName();
    
    // Try to extract author
    let author = '';
    const authorMeta = document.querySelector('meta[name="author"]');
    const articleAuthor = document.querySelector('meta[property="article:author"]');
    const byline = document.querySelector('[rel="author"]');
    
    if (authorMeta) author = authorMeta.content;
    else if (articleAuthor) author = articleAuthor.content;
    else if (byline) author = byline.textContent.trim();
    
    // Try to extract date
    let date = '';
    const publishedTime = document.querySelector('meta[property="article:published_time"]');
    const datePublished = document.querySelector('meta[property="datePublished"]');
    const timeElement = document.querySelector('time');
    
    if (publishedTime) {
      date = new Date(publishedTime.content).toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    } else if (datePublished) {
      date = new Date(datePublished.content).toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    } else if (timeElement && timeElement.dateTime) {
      date = new Date(timeElement.dateTime).toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    }
    
    // Try to extract summary/description
    let summary = '';
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const metaDescription = document.querySelector('meta[name="description"]');
    
    if (ogDescription) summary = ogDescription.content;
    else if (metaDescription) summary = metaDescription.content;
    
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
