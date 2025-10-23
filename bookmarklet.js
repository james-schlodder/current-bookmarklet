// The Current - Bookmarklet Script
// This script injects the popup into the current webpage

(function() {
  'use strict';
  
  // Check if popup already exists
  if (document.getElementById('current-bookmarklet-popup')) {
    console.log('Popup already open');
    return;
  }
  
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
