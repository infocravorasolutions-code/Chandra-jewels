/**
 * PDF Generator Utility
 * Generates HTML content for enquiry PDFs that can be saved/shared
 */

import Share from 'react-native-share';
import { Platform } from 'react-native';

// Debug: Log when module loads
if (__DEV__) {
  console.log('pdfGenerator.js module loaded');
}

// Helper to convert string to base64 (for data URLs)
const toBase64 = (str) => {
  try {
    // First, try btoa if available (some React Native environments have it)
    if (typeof btoa !== 'undefined') {
      try {
        // Encode to UTF-8 bytes first, then base64
        const utf8Bytes = unescape(encodeURIComponent(str));
        return btoa(utf8Bytes);
      } catch (e) {
        console.warn('btoa failed, using fallback:', e);
      }
    }
    
    // More reliable manual implementation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    
    // Convert string to UTF-8 bytes
    const utf8Bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        utf8Bytes.push(code);
      } else if (code < 0x800) {
        utf8Bytes.push(0xc0 | (code >> 6));
        utf8Bytes.push(0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        utf8Bytes.push(0xe0 | (code >> 12));
        utf8Bytes.push(0x80 | ((code >> 6) & 0x3f));
        utf8Bytes.push(0x80 | (code & 0x3f));
      } else {
        // Surrogate pair
        i++;
        const code2 = str.charCodeAt(i);
        const codePoint = 0x10000 + (((code & 0x3ff) << 10) | (code2 & 0x3ff));
        utf8Bytes.push(0xf0 | (codePoint >> 18));
        utf8Bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
        utf8Bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
        utf8Bytes.push(0x80 | (codePoint & 0x3f));
      }
    }
    
    // Convert bytes to base64
    let i = 0;
    while (i < utf8Bytes.length) {
      const a = utf8Bytes[i++];
      const b = i < utf8Bytes.length ? utf8Bytes[i++] : 0;
      const c = i < utf8Bytes.length ? utf8Bytes[i++] : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += (i - 2 < utf8Bytes.length) ? chars.charAt((bitmap >> 6) & 63) : '=';
      result += (i - 1 < utf8Bytes.length) ? chars.charAt(bitmap & 63) : '=';
    }
    
    return result;
  } catch (error) {
    console.error('Base64 encoding error:', error);
    throw new Error(`Failed to encode to base64: ${error.message}`);
  }
};

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (error) {
    return dateString;
  }
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
  if (!amount || amount === 0) return '₹ 0';
  return `₹ ${parseFloat(amount).toLocaleString('en-IN')}`;
};

/**
 * Generate HTML content for enquiry PDF
 */
export const generateEnquiryHTML = (enquiry) => {
  const metal = enquiry?.Metal || enquiry?.metal || {};
  const metalColor = metal.Color || metal.color || 'N/A';
  const metalQuality = metal.Quality || metal.quality || '';
  const metalWeight = enquiry?.MetalWeight || enquiry?.metalWeight || {};
  const diamondWeight = enquiry?.DiamondWeight || enquiry?.diamondWeight || {};

  // Format metal weight
  let metalWeightText = 'N/A';
  if (metalWeight.Exact || metalWeight.exact) {
    metalWeightText = `${metalWeight.Exact || metalWeight.exact} gms`;
  } else if (metalWeight.From || metalWeight.from) {
    const from = metalWeight.From || metalWeight.from || '';
    const to = metalWeight.To || metalWeight.to || '';
    metalWeightText = `${from}${to ? ` - ${to}` : ''} gms`;
  }

  // Format diamond weight
  let diamondWeightText = 'N/A';
  if (diamondWeight.Exact || diamondWeight.exact) {
    diamondWeightText = `${diamondWeight.Exact || diamondWeight.exact} carats`;
  } else if (diamondWeight.From || diamondWeight.from) {
    const from = diamondWeight.From || diamondWeight.from || '';
    const to = diamondWeight.To || diamondWeight.to || '';
    diamondWeightText = `${from}${to ? ` - ${to}` : ''} carats`;
  }

  const statusColors = {
    pending: '#FFA500',
    in_progress: '#2196F3',
    completed: '#4CAF50',
    rejected: '#F44336',
  };

  const priorityColors = {
    high: '#F44336',
    medium: '#FF9800',
    low: '#4CAF50',
  };

  const status = (enquiry?.status || 'pending').toLowerCase();
  const priority = (enquiry?.priority || 'medium').toLowerCase();
  const statusColor = statusColors[status] || statusColors.pending;
  const priorityColor = priorityColors[priority] || priorityColors.medium;

  // Get images (first image URL if available)
  let imageUrl = '';
  if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
    const firstImage = enquiry.images[0];
    if (typeof firstImage === 'string') {
      imageUrl = firstImage;
    } else if (firstImage?.url || firstImage?.Url || firstImage?.uri) {
      imageUrl = firstImage.url || firstImage.Url || firstImage.uri;
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      padding: 20px;
      color: #333;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1976D2;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1976D2;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .subtitle {
      color: #666;
      font-size: 14px;
    }
    .enquiry-title {
      font-size: 24px;
      font-weight: bold;
      color: #1976D2;
      margin-bottom: 20px;
      text-align: center;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .badges {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 8px 16px;
      border-radius: 20px;
      color: white;
      font-weight: bold;
      font-size: 12px;
      text-transform: uppercase;
    }
    .status-badge {
      background-color: ${statusColor};
    }
    .priority-badge {
      background-color: ${priorityColor};
    }
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1976D2;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1976D2;
    }
    .info-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      width: 40%;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .info-value {
      width: 60%;
      color: #333;
      font-size: 14px;
    }
    .description {
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
      margin-top: 10px;
      line-height: 1.6;
      color: #555;
    }
    .image-section {
      text-align: center;
      margin: 30px 0;
    }
    .enquiry-image {
      max-width: 300px;
      max-height: 300px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body {
        padding: 10px;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CHANDRA JEWELLERY</h1>
    <div class="subtitle">Enquiry Details Report</div>
  </div>

  <div class="enquiry-title">
    ${enquiry?.title || enquiry?.Name || 'Untitled Enquiry'}
  </div>

  <div class="badges">
    <span class="badge status-badge">Status: ${(enquiry?.status || 'pending').toUpperCase()}</span>
    <span class="badge priority-badge">Priority: ${(enquiry?.priority || 'medium').toUpperCase()}</span>
  </div>

  ${imageUrl ? `
  <div class="image-section">
    <img src="${imageUrl}" alt="Enquiry Image" class="enquiry-image" />
  </div>
  ` : ''}

  <div class="content-grid">
    <div class="section">
      <div class="section-title">Basic Information</div>
      <div class="info-row">
        <div class="info-label">Client</div>
        <div class="info-value">${enquiry?.clientName || enquiry?.client || 'Unknown Client'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Category</div>
        <div class="info-value">${enquiry?.category || enquiry?.Category || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Quantity</div>
        <div class="info-value">${enquiry?.Quantity || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Created Date</div>
        <div class="info-value">${formatDate(enquiry?.createdAt)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Last Updated</div>
        <div class="info-value">${formatDate(enquiry?.updatedAt || enquiry?.createdAt)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Shipping Date</div>
        <div class="info-value">${enquiry?.deadline || enquiry?.ShippingDate ? formatDate(enquiry.deadline || enquiry.ShippingDate) : 'Not set'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Product Details</div>
      <div class="info-row">
        <div class="info-label">Style Number</div>
        <div class="info-value">${enquiry?.StyleNumber || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Gati Order Number</div>
        <div class="info-value">${enquiry?.GatiOrderNumber || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Stone Type</div>
        <div class="info-value">${enquiry?.stoneType || enquiry?.StoneType || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Budget</div>
        <div class="info-value">${formatCurrency(enquiry?.estimatedPrice || enquiry?.budget || 0)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Coral Code</div>
        <div class="info-value">${enquiry?.CoralCode || enquiry?.coralVersion || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">CAD Code</div>
        <div class="info-value">${enquiry?.CadCode || enquiry?.cadVersion || 'N/A'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Metal Details</div>
    <div class="info-row">
      <div class="info-label">Metal Color</div>
      <div class="info-value">${metalColor}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Metal Quality</div>
      <div class="info-value">${metalQuality || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Metal Weight</div>
      <div class="info-value">${metalWeightText}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Diamond Weight</div>
      <div class="info-value">${diamondWeightText}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Stamping</div>
      <div class="info-value">${enquiry?.Stamping || 'N/A'}</div>
    </div>
  </div>

  ${enquiry?.description || enquiry?.Remarks ? `
  <div class="section">
    <div class="section-title">Description / Remarks</div>
    <div class="description">
      ${(enquiry?.description || enquiry?.Remarks || '').replace(/\n/g, '<br>')}
    </div>
  </div>
  ` : ''}

  ${enquiry?.AssignedTo ? `
  <div class="section">
    <div class="section-title">Assignment Details</div>
    <div class="info-row">
      <div class="info-label">Assigned To</div>
      <div class="info-value">${enquiry.AssignedTo}</div>
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated on ${formatDate(new Date().toISOString())}</p>
    <p>Chandra Jewellery - Enquiry Management System</p>
  </div>
</body>
</html>
  `;

  return html;
};

/**
 * Share/Save enquiry as PDF
 */
export const downloadEnquiryPDF = async (enquiry) => {
  try {
    // Generate HTML content
    const htmlContent = generateEnquiryHTML(enquiry);

    // Create filename
    const enquiryName = (enquiry?.title || enquiry?.Name || 'Enquiry')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${enquiryName}_${timestamp}.html`;

    // For both platforms, share HTML content directly
    try {
      if (Platform.OS === 'ios') {
        // iOS: Share HTML directly
        await Share.open({
          title: 'Download Enquiry PDF',
          message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
          html: htmlContent,
          filename: filename.replace('.html', '.pdf'),
          subject: `Enquiry - ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
        });
      } else {
        // Android: Share HTML content directly first, fallback to base64
        try {
          await Share.open({
            title: 'Download Enquiry PDF',
            message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
            html: htmlContent,
            filename: filename.replace('.html', '.pdf'),
            subject: `Enquiry - ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
          });
        } catch (htmlError) {
          // If HTML sharing fails, try with base64 data URL
          console.log('HTML sharing failed, trying base64 data URL:', htmlError);
          const base64Content = toBase64(htmlContent);
          const dataUrl = `data:text/html;charset=utf-8;base64,${base64Content}`;
          
          await Share.open({
            title: 'Download Enquiry PDF',
            message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
            url: dataUrl,
            type: 'text/html',
            filename: filename,
            subject: `Enquiry - ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
          });
        }
      }

      return { success: true };
    } catch (shareError) {
      // If sharing fails on Android, try alternative approach
      if (Platform.OS === 'android') {
        try {
          const base64Content = toBase64(htmlContent);
          const dataUrl = `data:text/html;base64,${base64Content}`;
          
          await Share.open({
            title: 'Download Enquiry PDF',
            message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}\n\nOpen the link in a browser to view.`,
            url: dataUrl,
          });
          return { success: true };
        } catch (fallbackError) {
          throw shareError;
        }
      }
      throw shareError;
    }
  } catch (error) {
    if (error.message !== 'User did not share') {
      console.error('Error generating PDF:', error);
      throw error;
    }
      return { success: false, cancelled: true };
  }
};

/**
 * Generate HTML content for multiple enquiries PDF (table format)
 */
export const generateEnquiriesListHTML = (enquiries) => {
  // Get first image URL for each enquiry
  const getFirstImageUrl = (enquiry) => {
    if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      const firstImage = enquiry.images[0];
      if (typeof firstImage === 'string') return firstImage;
      if (firstImage?.url || firstImage?.Url || firstImage?.uri) {
        return firstImage.url || firstImage.Url || firstImage.uri;
      }
    }
    return '';
  };

  // Get assigned date (if available in enquiry data)
  const getAssignedDate = (enquiry) => {
    // Try to find assigned date from StatusHistory or other fields
    if (enquiry?._originalData?.StatusHistory && Array.isArray(enquiry._originalData.StatusHistory)) {
      const assignedStatus = enquiry._originalData.StatusHistory.find(
        s => s.Status?.toLowerCase().includes('assigned') || s.status?.toLowerCase().includes('assigned')
      );
      if (assignedStatus) {
        return formatDate(assignedStatus.Timestamp || assignedStatus.timestamp);
      }
    }
    return '';
  };

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'pending') return '#FFA500';
    if (statusLower === 'in_progress' || statusLower.includes('progress')) return '#2196F3';
    if (statusLower === 'completed') return '#4CAF50';
    if (statusLower === 'rejected') return '#F44336';
    return '#9CA3AF';
  };

  const getPriorityColor = (priority) => {
    const priorityLower = (priority || '').toLowerCase();
    if (priorityLower === 'high' || priorityLower === 'urgent' || priorityLower.includes('super')) return '#F44336';
    if (priorityLower === 'medium') return '#FF9800';
    if (priorityLower === 'low') return '#4CAF50';
    return '#9CA3AF';
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enquiries List - ${enquiries.length} Enquiries</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      padding: 20px;
      color: #333;
      background: #fff;
      font-size: 10px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1976D2;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #1976D2;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: #666;
      font-size: 12px;
    }
    .summary {
      margin-bottom: 20px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9px;
    }
    thead {
      background-color: #1976D2;
      color: white;
    }
    th {
      padding: 8px 4px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #1565C0;
      font-size: 9px;
    }
    td {
      padding: 6px 4px;
      border: 1px solid #e0e0e0;
      font-size: 8px;
      vertical-align: top;
    }
    tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    tbody tr:hover {
      background-color: #f0f0f0;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7px;
      font-weight: bold;
      text-transform: uppercase;
      color: white;
    }
    .status-badge {
      background-color: #9CA3AF;
    }
    .priority-badge {
      background-color: #9CA3AF;
    }
    .image-cell {
      text-align: center;
      width: 50px;
    }
    .enquiry-image {
      max-width: 40px;
      max-height: 40px;
      border-radius: 4px;
    }
    .text-truncate {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 9px;
    }
    @media print {
      body {
        padding: 10px;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CHANDRA JEWELLERY</h1>
    <div class="subtitle">Enquiries List Report</div>
  </div>

  <div class="summary">
    <strong>Total Enquiries:</strong> ${enquiries.length} | 
    <strong>Generated:</strong> ${formatDate(new Date().toISOString())}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 3%;">#</th>
        <th style="width: 12%;">Name</th>
        <th style="width: 8%;">Category</th>
        <th style="width: 8%;">Status</th>
        <th style="width: 8%;">Client</th>
        <th style="width: 5%;">Image</th>
        <th style="width: 8%;">Assigned To</th>
        <th style="width: 8%;">Assigned Date</th>
        <th style="width: 8%;">Created Date</th>
        <th style="width: 8%;">Priority</th>
        <th style="width: 12%;">Metal</th>
        <th style="width: 8%;">Stone Type</th>
        <th style="width: 8%;">Shipping Date</th>
      </tr>
    </thead>
    <tbody>
      ${enquiries.map((enquiry, index) => {
        const metal = enquiry?.Metal || enquiry?.metal || {};
        const metalColor = metal.Color || metal.color || '';
        const metalQuality = metal.Quality || metal.quality || '';
        const metalType = metalColor ? `${metalColor}${metalQuality ? ` (${metalQuality})` : ''}` : 'N/A';
        
        const status = (enquiry?.status || 'pending').toUpperCase();
        const priority = (enquiry?.priority || 'medium').toUpperCase();
        const statusColor = getStatusColor(enquiry?.status);
        const priorityColor = getPriorityColor(enquiry?.priority);
        
        const imageUrl = getFirstImageUrl(enquiry);
        const assignedDate = getAssignedDate(enquiry);
        const assignedTo = enquiry?.AssignedTo || enquiry?.assignedTo || '';
        
        return `
        <tr>
          <td>${index + 1}</td>
          <td class="text-truncate">${enquiry?.title || enquiry?.Name || 'Untitled'}</td>
          <td>${enquiry?.category || enquiry?.Category || 'N/A'}</td>
          <td>
            <span class="badge status-badge" style="background-color: ${statusColor}">${status}</span>
          </td>
          <td>${enquiry?.clientName || enquiry?.client || 'Unknown'}</td>
          <td class="image-cell">
            ${imageUrl ? `<img src="${imageUrl}" alt="Enquiry Image" class="enquiry-image" />` : '-'}
          </td>
          <td>${assignedTo || 'N/A'}</td>
          <td>${assignedDate || 'N/A'}</td>
          <td>${formatDate(enquiry?.createdAt)}</td>
          <td>
            <span class="badge priority-badge" style="background-color: ${priorityColor}">${priority}</span>
          </td>
          <td class="text-truncate">${metalType}</td>
          <td>${enquiry?.stoneType || enquiry?.StoneType || 'N/A'}</td>
          <td>${enquiry?.deadline || enquiry?.ShippingDate ? formatDate(enquiry.deadline || enquiry.ShippingDate) : 'Not set'}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated on ${formatDate(new Date().toISOString())}</p>
    <p>Chandra Jewellery - Enquiry Management System</p>
    <p>Total Records: ${enquiries.length}</p>
  </div>
</body>
</html>
  `;

  return html;
};

/**
 * Download all enquiries as PDF
 */
export const downloadAllEnquiriesPDF = async (enquiries) => {
  try {
    // Generate HTML content
    const htmlContent = generateEnquiriesListHTML(enquiries);

    // Create filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `All_Enquiries_${timestamp}.html`;

    // For both platforms, try sharing HTML content directly
    // react-native-share should handle HTML content on both iOS and Android
    try {
      if (Platform.OS === 'ios') {
        // iOS: Share HTML directly
        await Share.open({
          title: 'Download All Enquiries PDF',
          message: `Enquiries List - ${enquiries.length} enquiries`,
          html: htmlContent,
          filename: filename.replace('.html', '.pdf'),
          subject: `All Enquiries - ${timestamp}`,
        });
      } else {
        // Android: Share HTML content directly
        // Try sharing as HTML content first
        try {
          await Share.open({
            title: 'Download All Enquiries PDF',
            message: `Enquiries List - ${enquiries.length} enquiries`,
            html: htmlContent,
            filename: filename.replace('.html', '.pdf'),
            subject: `All Enquiries - ${timestamp}`,
          });
        } catch (htmlError) {
          // If HTML sharing fails, try with base64 data URL
          console.log('HTML sharing failed, trying base64 data URL:', htmlError);
          const base64Content = toBase64(htmlContent);
          const dataUrl = `data:text/html;charset=utf-8;base64,${base64Content}`;
          
          await Share.open({
            title: 'Download All Enquiries PDF',
            message: `Enquiries List - ${enquiries.length} enquiries`,
            url: dataUrl,
            type: 'text/html',
            filename: filename,
            subject: `All Enquiries - ${timestamp}`,
          });
        }
      }

      return { success: true };
    } catch (shareError) {
      // If sharing fails, try alternative approach for Android
      if (Platform.OS === 'android') {
        try {
          // Alternative: Share as plain text URL that opens in browser
          const base64Content = toBase64(htmlContent);
          const dataUrl = `data:text/html;base64,${base64Content}`;
          
          await Share.open({
            title: 'Download All Enquiries PDF',
            message: `Enquiries List - ${enquiries.length} enquiries\n\nOpen the link in a browser to view the report.`,
            url: dataUrl,
          });
          return { success: true };
        } catch (fallbackError) {
          throw shareError; // Throw original error
        }
      }
      throw shareError;
    }
  } catch (error) {
    if (error.message !== 'User did not share') {
      console.error('Error generating PDF:', error);
      throw error;
    }
    return { success: false, cancelled: true };
  }
};

// Debug: Verify export is available
if (__DEV__) {
  console.log('pdfGenerator.js module fully loaded. Exports available:', {
    downloadAllEnquiriesPDF: typeof downloadAllEnquiriesPDF !== 'undefined' ? 'YES' : 'NO',
    downloadEnquiryPDF: typeof downloadEnquiryPDF !== 'undefined' ? 'YES' : 'NO',
    generateEnquiryHTML: typeof generateEnquiryHTML !== 'undefined' ? 'YES' : 'NO',
    generateEnquiriesListHTML: typeof generateEnquiriesListHTML !== 'undefined' ? 'YES' : 'NO',
  });
}

