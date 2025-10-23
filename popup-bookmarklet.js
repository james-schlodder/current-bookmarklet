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
    
    navigator.clipboard.writeText(htmlCode).then(function() {
      showStatus('✓ Copied to clipboard!', 'success');
    }).catch(function(err) {
      showStatus('✗ Failed to copy', 'error');
      console.error('Copy failed:', err);
    });
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
    
    let html = '<div class="article-card">\n';
    
    if (headline) {
      if (url) {
        html += `  <h3><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(headline)}</a></h3>\n`;
      } else {
        html += `  <h3>${escapeHtml(headline)}</h3>\n`;
      }
    }
    
    const metadata = [];
    if (publication) metadata.push(escapeHtml(publication));
    if (author) metadata.push(`by ${escapeHtml(author)}`);
    if (date) metadata.push(escapeHtml(date));
    
    if (metadata.length > 0) {
      html += `  <p class="metadata">${metadata.join(' • ')}</p>\n`;
    }
    
    if (summary) {
      html += `  <p class="summary">${escapeHtml(summary)}</p>\n`;
    }
    
    if (url && !headline) {
      html += `  <p><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></p>\n`;
    }
    
    html += '</div>';
    
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
