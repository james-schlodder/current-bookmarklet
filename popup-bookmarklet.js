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
  
  // Request data from parent window when extract button is clicked
  extractBtn.addEventListener('click', function() {
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
    
    // Headline
    if (headline) {
      html += '<div><span style="font-size:16px;"><span style="font-family:Arial,sans-serif;"><font style="text-transform: capitalize;"><b>';
      if (url) {
        html += `<a href="${escapeHtml(url)}" style="text-decoration: underline;">${escapeHtml(headline)}</a>`;
      } else {
        html += escapeHtml(headline);
      }
      html += '</b></font></span></span>\n</div>\n';
    }
    
    // Metadata (publication, author, date)
    const metadata = [];
    if (publication) metadata.push(escapeHtml(publication));
    if (author) metadata.push(escapeHtml(author));
    if (date) metadata.push(escapeHtml(date));
    
    if (metadata.length > 0) {
      html += '<div><span style="font-size:14px;"><font face="Arial, sans-serif" style=""><span style="color: rgb(136, 139, 148); line-height: 2; font-family: Arial, &quot;Arial Black&quot;, sans-serif;"><span style="font-family: Arial, sans-serif;">';
      html += metadata.join('&middot;&nbsp;');
      html += '</span></span></font></span>\n</div>\n';
    }
    
    // Summary
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
