// Popup script for The Current bookmarklet

document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const copyBtn = document.getElementById('copyBtn');
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  
  const headlineInput = document.getElementById('headline');
  const urlInput = document.getElementById('url');
  const publicationInput = document.getElementById('publication');
  const authorInput = document.getElementById('author');
  const dateInput = document.getElementById('date');
  const summaryInput = document.getElementById('summary');
  
  // Analytics tracking function
  function trackEvent(eventName, parameters = {}) {
    try {
      if (window.parent && window.parent.gtag) {
        window.parent.gtag('event', eventName, {
          event_category: 'Bookmarklet',
          ...parameters
        });
      }
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  // Request data from parent window when extract button is clicked
  extractBtn.addEventListener('click', function() {
    // Track extraction attempt
    trackEvent('data_extraction_started');
    
    // Ask parent window to extract page data
    window.parent.postMessage({
      action: 'extractPage'
    }, '*');
    
    showStatus('Extracting...', 'success');
  });
  
  // Listen for data from parent window
  window.addEventListener('message', function(event) {
    if (event.data.action === 'pageData') {
      const data = event.data.data;
      
      // Fill in the form fields
      headlineInput.value = data.headline || '';
      urlInput.value = data.url || '';
      publicationInput.value = data.publication || '';
      authorInput.value = data.author || '';
      dateInput.value = data.date || '';
      summaryInput.value = data.summary || '';
      
      showStatus('✓ Extraction complete!', 'success');
      
      // Generate HTML output
      generateHTML();
      
      // Enable copy button
      copyBtn.disabled = false;
    }
  });
  
  // Generate HTML when any field changes
  const inputs = [headlineInput, urlInput, publicationInput, authorInput, dateInput, summaryInput];
  inputs.forEach(input => {
    input.addEventListener('input', generateHTML);
  });
  
  // Copy button functionality
  copyBtn.addEventListener('click', function() {
    const htmlCode = output.textContent;
    
    // Track copy action
    trackEvent('html_copied', {
      publication: publicationInput.value,
      has_author: !!authorInput.value,
      has_date: !!dateInput.value,
      has_summary: !!summaryInput.value
    });
    
    // Create a temporary textarea to copy from (works in iframes)
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
  
  function generateHTML() {
    const headline = headlineInput.value.trim();
    const url = urlInput.value.trim();
    const publication = publicationInput.value.trim();
    const author = authorInput.value.trim();
    const date = dateInput.value.trim();
    const summary = summaryInput.value.trim();
    
    if (!headline && !url) {
      output.classList.remove('show');
      copyBtn.disabled = true;
      return;
    }
    
    let html = '';
    
    // Headline section
    if (headline) {
      html += '<div><span style="font-size:16px;"><span style="font-family:Arial,sans-serif;"><font style="text-transform: capitalize;"><b>';
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
    output.classList.add('show');
    copyBtn.disabled = false;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = 'status ' + type;
    
    setTimeout(function() {
      status.className = 'status';
    }, 3000);
  }
});
