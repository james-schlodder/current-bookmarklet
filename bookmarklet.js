// The Current - Bookmarklet Script
// This script injects the popup into the current webpage

(function() {
  'use strict';
  
  // Check if popup already exists
  if (document.getElementById('current-bookmarklet-popup')) {
    console.log('Popup already open');
    return;
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'current-bookmarklet-popup';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  // Create iframe to hold the popup
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    border: none;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 520px;
    height: 680px;
    background: white;
  `;
  iframe.src = 'https://james-schlodder.github.io/current-bookmarklet/popup.html';
  
  // Close popup when clicking overlay
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
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
    document.body.removeChild(overlay);
  });
  
  overlay.appendChild(iframe);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  
  // Listen for messages from iframe to get page data
  window.addEventListener('message', function(event) {
    // Verify origin
    if (event.origin !== 'https://james-schlodder.github.io') {
      return;
    }
    
    if (event.data.action === 'extractPage') {
      // Extract page data
      const pageData = extractPageData();
      
      // Send back to iframe
      iframe.contentWindow.postMessage({
        action: 'pageData',
        data: pageData
      }, 'https://james-schlodder.github.io');
    }
  });
  
  // Function to extract page data
  function extractPageData() {
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
    
    // Try to extract publication
    let publication = '';
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      publication = ogSiteName.content;
    } else {
      publication = window.location.hostname.replace('www.', '');
    }
    
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
        day: 'numeric', 
        year: 'numeric' 
      });
    } else if (datePublished) {
      date = new Date(datePublished.content).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } else if (timeElement && timeElement.dateTime) {
      date = new Date(timeElement.dateTime).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
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
