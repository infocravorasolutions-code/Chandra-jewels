/**
 * PDF Generator Utility
 * Generates HTML content for enquiry PDFs that can be saved/shared
 */

import Share from 'react-native-share';
import { Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FILE_BASE_URL } from '../config/apiConfig';
import { getUserName } from './userUtils';

// Import PDF generation library
let generatePDF = null;
try {
  // Import the generatePDF function from react-native-html-to-pdf
  // The library exports { generatePDF } as a named export
  const htmlToPdfModule = require('react-native-html-to-pdf');
  
  // Try different ways to get the function
  generatePDF = htmlToPdfModule.generatePDF 
    || htmlToPdfModule.default?.generatePDF
    || htmlToPdfModule.default;
  
  // Debug: Log library status
  if (__DEV__) {
    console.log('========== PDF LIBRARY STATUS ==========');
    console.log('Module loaded:', !!htmlToPdfModule);
    console.log('Module type:', typeof htmlToPdfModule);
    console.log('Module keys:', htmlToPdfModule ? Object.keys(htmlToPdfModule) : 'no module');
    console.log('generatePDF available:', !!generatePDF);
    console.log('generatePDF type:', typeof generatePDF);
    console.log('Full module:', htmlToPdfModule);
    console.log('========================================');
  }
} catch (error) {
  console.error('react-native-html-to-pdf import error:', error);
  console.error('Error stack:', error.stack);
  console.warn('Will use HTML fallback');
}

// Debug: Log when module loads
if (__DEV__) {
  console.log('pdfGenerator.js module loaded');
}

// Helper to convert string to base64 (for data URLs)
// Improved version that handles large strings and special characters better
const toBase64 = (str) => {
  try {
    if (!str || str.length === 0) {
      return '';
    }
    
    // For large strings, use chunked encoding to avoid memory issues
    const CHUNK_SIZE = 8192; // Process in 8KB chunks
    let result = '';
    
    // First, try btoa if available (some React Native environments have it)
    if (typeof btoa !== 'undefined') {
      try {
        // For large strings, encode in chunks
        if (str.length > CHUNK_SIZE) {
          for (let i = 0; i < str.length; i += CHUNK_SIZE) {
            const chunk = str.substring(i, Math.min(i + CHUNK_SIZE, str.length));
            const utf8Bytes = unescape(encodeURIComponent(chunk));
            result += btoa(utf8Bytes);
          }
          return result;
        } else {
          // Small string - encode directly
          const utf8Bytes = unescape(encodeURIComponent(str));
          return btoa(utf8Bytes);
        }
      } catch (e) {
        console.warn('btoa failed, using fallback:', e);
      }
    }
    
    // More reliable manual implementation for large strings
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    result = '';
    
    // Convert string to UTF-8 bytes in chunks to avoid memory issues
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
        if (i + 1 < str.length) {
          i++;
          const code2 = str.charCodeAt(i);
          const codePoint = 0x10000 + (((code & 0x3ff) << 10) | (code2 & 0x3ff));
          utf8Bytes.push(0xf0 | (codePoint >> 18));
          utf8Bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
          utf8Bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
          utf8Bytes.push(0x80 | (codePoint & 0x3f));
        } else {
          // Invalid surrogate pair - skip
          utf8Bytes.push(0xef, 0xbf, 0xbd); // Replacement character
        }
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
    console.error('String length:', str?.length || 0);
    throw new Error(`Failed to encode to base64: ${error.message}`);
  }
};

/**
 * Fetch image and convert to base64 data URL
 * This is needed because PDF libraries can't load authenticated images
 */
const fetchImageAsBase64 = async (imageUrl) => {
  if (!imageUrl) {
    if (__DEV__) {
      console.warn('fetchImageAsBase64: No image URL provided');
    }
    return '';
  }
  
  try {
    if (__DEV__) {
      console.log('🖼️ Fetching image for PDF:', imageUrl.substring(0, 100));
    }
    
    // Get auth token
    const token = await AsyncStorage.getItem('token');
    
    // Fetch image with auth headers
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: token ? {
        'Authorization': `Bearer ${token}`,
      } : {},
    });
    
    if (!response.ok) {
      if (__DEV__) {
        console.warn('❌ Failed to fetch image for PDF:', imageUrl, 'Status:', response.status);
      }
      return '';
    }
    
    // Check if response is JSON (API might return URL object)
    const contentType = response.headers.get('content-type') || '';
    if (__DEV__) {
      console.log('📄 Image content-type:', contentType);
    }
    
    if (contentType.includes('application/json')) {
      const jsonData = await response.json();
      const actualImageUrl = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
      if (actualImageUrl) {
        if (__DEV__) {
          console.log('🔄 Found S3 URL in JSON response:', actualImageUrl.substring(0, 100));
        }
        // Return the S3 URL directly - PDF library can load it
        // S3 presigned URLs are publicly accessible, so we can use them directly
        return actualImageUrl;
      }
      if (__DEV__) {
        console.warn('❌ No image URL found in JSON response');
      }
      return '';
    }
    
    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    if (__DEV__) {
      console.log('📦 Image bytes length:', bytes.length);
    }
    
    // Convert to base64 string - improved method
    let base64 = '';
    
    // Try using Buffer if available (React Native polyfill)
    if (typeof Buffer !== 'undefined') {
      try {
        base64 = Buffer.from(bytes).toString('base64');
        if (__DEV__) {
          console.log('✅ Base64 conversion successful using Buffer');
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('Buffer conversion failed, trying manual method:', e);
        }
      }
    }
    
    // Fallback: manual conversion
    if (!base64) {
      try {
        // Convert bytes to binary string in chunks
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          // Use Array.from to avoid "Maximum call stack size exceeded" error
          binary += String.fromCharCode(...Array.from(chunk));
        }
        
        // Try btoa first
        if (typeof btoa !== 'undefined') {
          try {
            base64 = btoa(binary);
            if (__DEV__) {
              console.log('✅ Base64 conversion successful using btoa');
            }
          } catch (e) {
            if (__DEV__) {
              console.warn('btoa failed, using manual base64:', e);
            }
            base64 = toBase64(binary);
          }
        } else {
          base64 = toBase64(binary);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Error converting to base64:', error);
        }
        return '';
      }
    }
    
    if (!base64) {
      if (__DEV__) {
        console.error('❌ Failed to generate base64 string');
      }
      return '';
    }
    
    // Determine image type
    const imageType = contentType.split('/')[1] || 'jpeg';
    // Normalize image type
    const normalizedType = imageType.split(';')[0].toLowerCase();
    
    const dataUrl = `data:image/${normalizedType};base64,${base64}`;
    
    if (__DEV__) {
      console.log('✅ Image converted to base64 data URL');
      console.log('📏 Data URL length:', dataUrl.length);
      console.log('🖼️ Image type:', normalizedType);
      console.log('📊 Base64 length:', base64.length);
    }
    
    return dataUrl;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Error fetching image as base64:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        url: imageUrl.substring(0, 100),
      });
    }
    return '';
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
 * Now async to fetch images as base64
 */
export const generateEnquiryHTML = async (enquiry) => {
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

  // Get images (first image URL if available) - improved to check all sources
  const getFirstImageUrlForSingle = (enquiry) => {
    if (!enquiry) return '';
    
    let referenceImages = [];
    
    // Priority 1: Check original data structure (before normalization) - most reliable
    if (enquiry?._originalData?.ReferenceImages && Array.isArray(enquiry._originalData.ReferenceImages)) {
      referenceImages = enquiry._originalData.ReferenceImages;
    }
    // Priority 2: Check direct ReferenceImages property
    else if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages)) {
      referenceImages = enquiry.ReferenceImages;
    }
    // Priority 3: Check normalized images (from API transform)
    else if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      referenceImages = enquiry.images;
    }
    // Priority 4: Check Images property (fallback)
    else if (enquiry?.Images && Array.isArray(enquiry.Images)) {
      referenceImages = enquiry.Images;
    }
    
    if (referenceImages.length === 0) {
      return '';
    }
    
    const firstImage = referenceImages[0];
    
    // Handle string format
    if (typeof firstImage === 'string') {
      // If it's already a full URL, use it directly
      if (firstImage.startsWith('http://') || firstImage.startsWith('https://')) {
        return firstImage;
      }
      // If it starts with /, construct full URL
      if (firstImage.startsWith('/')) {
        return `${FILE_BASE_URL}${firstImage}`;
      }
      // Otherwise, treat as file key and construct URL
      return `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(firstImage)}`;
    }
    
    // Handle object format
    if (typeof firstImage === 'object' && firstImage !== null) {
      // Priority 1: Use Key property (most reliable)
      const imageKey = firstImage.Key || firstImage.key || firstImage.KeyName || firstImage.keyName || '';
      if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        return `${FILE_BASE_URL}/api/enquiries/files/${encodedKey}`;
      }
      
      // Priority 2: Use Id property as fallback
      const imageId = firstImage.Id || firstImage.id || firstImage._id || firstImage.FileId || firstImage.fileId || '';
      if (imageId) {
        return `${FILE_BASE_URL}/api/enquiries/files/${imageId}`;
      }
      
      // Priority 3: Check for URL properties
      const imageUrl = firstImage.Url || firstImage.url || firstImage.URI || firstImage.uri || 
                      firstImage.Location || firstImage.location || firstImage.UrlPath || firstImage.urlPath || '';
      if (imageUrl) {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          return imageUrl;
        }
        if (imageUrl.startsWith('/')) {
          return `${FILE_BASE_URL}${imageUrl}`;
        }
        return `${FILE_BASE_URL}/${imageUrl}`;
      }
    }
    
    return '';
  };
  
  let imageUrl = getFirstImageUrlForSingle(enquiry);
  
  // Resolve API endpoint to S3 URL if needed
  let finalImageUrl = imageUrl;
  if (imageUrl && !imageUrl.includes('amazonaws.com') && !imageUrl.includes('s3.')) {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const jsonData = await response.json();
          const s3Url = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
          if (s3Url) {
            finalImageUrl = s3Url;
            if (__DEV__) {
              console.log('✅ Resolved single enquiry image to S3 URL');
            }
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to resolve image URL for single enquiry PDF:', error);
      }
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

  ${finalImageUrl ? `
  <div class="image-section">
    <img src="${finalImageUrl}" alt="Enquiry Image" class="enquiry-image" />
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
      <div class="info-value">${getUserName(enquiry.AssignedTo)}</div>
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
    // Generate HTML content (now async to fetch images)
    const htmlContent = await generateEnquiryHTML(enquiry);

    // Create filename
    const enquiryName = (enquiry?.title || enquiry?.Name || 'Enquiry')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${enquiryName}_${timestamp}`;
    
    // Try to generate PDF using react-native-html-to-pdf
    if (generatePDF && typeof generatePDF === 'function') {
      try {
        if (__DEV__) {
          console.log('========== ATTEMPTING PDF GENERATION (SINGLE) ==========');
          console.log('HTML content length:', htmlContent.length);
          console.log('Filename:', filename);
          console.log('Platform:', Platform.OS);
        }
        
        // Don't specify directory - let library use its default
        // Or use a simple string like "Documents" to avoid path issues
        const options = {
          html: htmlContent,
          fileName: filename,
          // Don't specify directory on Android - library handles it better
          base64: false,
          width: 595, // A4 width in points
          height: 842, // A4 height in points
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 10,
          paddingBottom: 10,
        };
        
        if (__DEV__) {
          console.log('PDF options:', JSON.stringify({ ...options, html: '[HTML content]' }, null, 2));
        }
        
        const file = await generatePDF(options);
        
        if (__DEV__) {
          console.log('========== PDF GENERATION SUCCESS (SINGLE) ==========');
          console.log('PDF file path:', file.filePath);
          console.log('File exists:', file.filePath ? await RNFS.exists(file.filePath) : 'no path');
          console.log('====================================================');
        }
        
        // Verify file exists and is not empty
        if (file && file.filePath) {
          let originalFilePath = file.filePath;
          
          // Fix malformed paths - the library sometimes creates paths like:
          // /storage/emulated/0/Android/data/.../files/data/user/0/.../cache/file.pdf
          // Extract the actual file location
          if (originalFilePath.includes('/data/user/0/')) {
            // Extract the cache path part
            const cacheMatch = originalFilePath.match(/\/data\/user\/0\/[^/]+\/cache\/([^/]+\.pdf)$/);
            if (cacheMatch) {
              // Use the app's cache directory
              originalFilePath = `${RNFS.CachesDirectoryPath}/${cacheMatch[1]}`;
            }
          }
          
          // Copy file to Downloads for easier access and sharing
          const downloadPath = `${RNFS.DownloadDirectoryPath}/${filename}.pdf`;
          let finalFilePath = downloadPath;
          
          try {
            // Verify original file exists
            if (await RNFS.exists(originalFilePath)) {
              // Copy to Downloads
              await RNFS.copyFile(originalFilePath, downloadPath);
              
              if (__DEV__) {
                console.log('PDF copied to Downloads:', downloadPath);
              }
            } else {
              // If original doesn't exist, try the file path as-is
              if (await RNFS.exists(file.filePath)) {
                await RNFS.copyFile(file.filePath, downloadPath);
              } else {
                throw new Error('Original PDF file not found');
              }
            }
          } catch (copyError) {
            console.warn('Failed to copy to Downloads, using original path:', copyError);
            // Use original path if copy fails
            finalFilePath = originalFilePath;
          }
          
          // Verify final file exists
          if (await RNFS.exists(finalFilePath)) {
            const fileStats = await RNFS.stat(finalFilePath);
            if (fileStats.size > 0) {
              if (__DEV__) {
                console.log('Sharing PDF with path:', finalFilePath);
              }
              
              // Share the PDF file - use content URI for Android
              await Share.open({
                title: 'Download Enquiry PDF',
                message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
                url: `file://${finalFilePath}`,
                type: 'application/pdf',
                filename: `${filename}.pdf`,
                subject: `Enquiry - ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
              });
              
              return { success: true, filePath: finalFilePath, isPDF: true };
            } else {
              throw new Error('Generated PDF file is empty');
            }
          } else {
            throw new Error(`PDF file was not created at: ${finalFilePath}`);
          }
        } else {
          throw new Error('PDF generation returned invalid file path');
        }
      } catch (pdfError) {
        console.error('========== PDF GENERATION ERROR (SINGLE) ==========');
        console.error('Error details:', pdfError);
        console.error('Error message:', pdfError.message);
        console.error('Error stack:', pdfError.stack);
        console.error('===================================================');
        // Fall through to HTML fallback
      }
    } else {
      if (__DEV__) {
        console.warn('PDF library not available or generatePDF function missing (single)');
        console.warn('generatePDF:', generatePDF);
        console.warn('Type:', typeof generatePDF);
      }
    }
    
    // Fallback: Save as HTML if PDF generation fails or library not available
    const htmlFilename = `${filename}.html`;
    const htmlFilePath = `${RNFS.DownloadDirectoryPath}/${htmlFilename}`;
    
    if (__DEV__) {
      console.log('Saving as HTML file (fallback):', htmlFilePath);
    }
    
    await RNFS.writeFile(htmlFilePath, htmlContent, 'utf8');
    
    const fileExists = await RNFS.exists(htmlFilePath);
    if (!fileExists) {
      throw new Error('Failed to save HTML file');
    }
    
    const fileStats = await RNFS.stat(htmlFilePath);
    if (fileStats.size === 0) {
      throw new Error('Saved HTML file is empty');
    }
    
    // Share the HTML file with instructions
    await Share.open({
      title: 'Download Enquiry',
      message: `Enquiry: ${enquiry?.title || enquiry?.Name || 'Untitled'}\n\n` +
               `File saved as HTML. To convert to PDF:\n` +
               `1. Open the file in a browser\n` +
               `2. Use browser's Print function\n` +
               `3. Choose "Save as PDF" as the destination`,
      url: `file://${htmlFilePath}`,
      type: 'text/html',
      filename: htmlFilename,
      subject: `Enquiry - ${enquiry?.title || enquiry?.Name || 'Untitled'}`,
    });
    
    return { success: true, filePath: htmlFilePath, isHTML: true };
  } catch (error) {
    if (error.message !== 'User did not share') {
      console.error('Error generating PDF:', error);
      throw error;
    }
    return { success: false, cancelled: true };
  }
};

// Helper function to generate empty HTML (defined outside to be accessible)
const generateEmptyHTML = (message) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enquiries List - No Data</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      text-align: center;
      color: #666;
    }
    .error-message {
      font-size: 18px;
      color: #F44336;
      margin-top: 100px;
    }
  </style>
</head>
<body>
  <div class="error-message">${message}</div>
</body>
</html>
  `;
};

/**
 * Generate HTML content for multiple enquiries PDF (table format)
 * Now async to fetch images as base64
 */
export const generateEnquiriesListHTML = async (enquiries) => {
  // Validate input
  if (!enquiries) {
    console.error('generateEnquiriesListHTML: enquiries is null or undefined');
    return generateEmptyHTML('No enquiries data provided');
  }
  
  if (!Array.isArray(enquiries)) {
    console.error('generateEnquiriesListHTML: enquiries is not an array', typeof enquiries);
    return generateEmptyHTML('Invalid enquiries data format');
  }
  
  if (enquiries.length === 0) {
    console.warn('generateEnquiriesListHTML: enquiries array is empty');
    return generateEmptyHTML('No enquiries available');
  }
  
  // Debug: Log enquiry data structure
  if (__DEV__) {
    console.log('========== GENERATING ENQUIRIES LIST HTML ==========');
    console.log('Total enquiries:', enquiries.length);
    console.log('Enquiries type:', typeof enquiries);
    console.log('Is array:', Array.isArray(enquiries));
    if (enquiries.length > 0) {
      console.log('First enquiry structure:', {
        keys: Object.keys(enquiries[0]),
        hasOriginalData: !!enquiries[0]._originalData,
        title: enquiries[0].title || enquiries[0].Name,
        clientName: enquiries[0].clientName || enquiries[0].client,
        status: enquiries[0].status || enquiries[0].Status,
        category: enquiries[0].category || enquiries[0].Category,
        fullEnquiry: JSON.stringify(enquiries[0]).substring(0, 500),
      });
      if (enquiries[0]._originalData) {
        console.log('Original data keys:', Object.keys(enquiries[0]._originalData));
        console.log('Original data sample:', JSON.stringify(enquiries[0]._originalData).substring(0, 500));
      }
    }
    console.log('===================================================');
  }
  // Get first image URL for each enquiry - improved to check all sources
  const getFirstImageUrl = (enquiry) => {
    if (!enquiry) return '';
    
    let referenceImages = [];
    
    // Priority 1: Check original data structure (before normalization) - most reliable
    if (enquiry?._originalData?.ReferenceImages && Array.isArray(enquiry._originalData.ReferenceImages)) {
      referenceImages = enquiry._originalData.ReferenceImages;
    }
    // Priority 2: Check direct ReferenceImages property
    else if (enquiry?.ReferenceImages && Array.isArray(enquiry.ReferenceImages)) {
      referenceImages = enquiry.ReferenceImages;
    }
    // Priority 3: Check normalized images (from API transform)
    else if (enquiry?.images && Array.isArray(enquiry.images) && enquiry.images.length > 0) {
      referenceImages = enquiry.images;
    }
    // Priority 4: Check Images property (fallback)
    else if (enquiry?.Images && Array.isArray(enquiry.Images)) {
      referenceImages = enquiry.Images;
    }
    
    if (referenceImages.length === 0) {
      return '';
    }
    
    // Get the first image (or latest if preferred)
    const firstImage = referenceImages[0];
    
    // Handle string format
    if (typeof firstImage === 'string') {
      // If it's already a full URL, use it directly
      if (firstImage.startsWith('http://') || firstImage.startsWith('https://')) {
        return firstImage;
      }
      // If it starts with /, construct full URL
      if (firstImage.startsWith('/')) {
        return `${FILE_BASE_URL}${firstImage}`;
      }
      // Otherwise, treat as file key and construct URL
      return `${FILE_BASE_URL}/api/enquiries/files/${encodeURIComponent(firstImage)}`;
    }
    
    // Handle object format
    if (typeof firstImage === 'object' && firstImage !== null) {
      // Priority 1: Use Key property (most reliable)
      const imageKey = firstImage.Key || firstImage.key || firstImage.KeyName || firstImage.keyName || '';
      if (imageKey) {
        const encodedKey = encodeURIComponent(imageKey);
        return `${FILE_BASE_URL}/api/enquiries/files/${encodedKey}`;
      }
      
      // Priority 2: Use Id property as fallback
      const imageId = firstImage.Id || firstImage.id || firstImage._id || firstImage.FileId || firstImage.fileId || '';
      if (imageId) {
        return `${FILE_BASE_URL}/api/enquiries/files/${imageId}`;
      }
      
      // Priority 3: Check for URL properties
      const imageUrl = firstImage.Url || firstImage.url || firstImage.URI || firstImage.uri || 
                      firstImage.Location || firstImage.location || firstImage.UrlPath || firstImage.urlPath || '';
      if (imageUrl) {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          return imageUrl;
        }
        if (imageUrl.startsWith('/')) {
          return `${FILE_BASE_URL}${imageUrl}`;
        }
        return `${FILE_BASE_URL}/${imageUrl}`;
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
      ${await (async () => {
        // Generate table rows with async image fetching
        if (!enquiries || enquiries.length === 0) {
          return '<tr><td colspan="13" style="text-align: center; padding: 20px;">No enquiries data available</td></tr>';
        }
        
        // Helper function to escape HTML
        const escapeHtml = (text) => {
          if (!text) return '';
          return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        };
        
        // Get image URLs (S3 URLs) - use them directly instead of converting to base64
        if (__DEV__) {
          console.log('🔄 Getting image URLs for PDF...');
        }
        
        const imageUrls = enquiries.map((enquiry, idx) => {
          const originalData = enquiry?._originalData || {};
          const normalizedEnquiry = enquiry || {};
          const imageUrl = getFirstImageUrl(normalizedEnquiry) || getFirstImageUrl(originalData);
          
          if (imageUrl) {
            if (__DEV__) {
              console.log(`📸 [${idx + 1}/${enquiries.length}] Image URL:`, imageUrl.substring(0, 80));
            }
            // Fetch to get S3 URL if API endpoint
            return imageUrl;
          } else {
            if (__DEV__) {
              console.log(`⚠️ [${idx + 1}/${enquiries.length}] No image URL found`);
            }
          }
          return '';
        });
        
        // Resolve API endpoints to S3 URLs
        const resolvedImageUrls = await Promise.all(imageUrls.map(async (imageUrl, idx) => {
          if (!imageUrl) return '';
          
          // If it's already an S3 URL, use it directly
          if (imageUrl.includes('amazonaws.com') || imageUrl.includes('s3.')) {
            if (__DEV__) {
              console.log(`✅ [${idx + 1}/${imageUrls.length}] Already S3 URL`);
            }
            return imageUrl;
          }
          
          // If it's an API endpoint, fetch to get S3 URL
          try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(imageUrl, {
              method: 'GET',
              headers: token ? {
                'Authorization': `Bearer ${token}`,
              } : {},
            });
            
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const jsonData = await response.json();
                const s3Url = jsonData.url || jsonData.imageUrl || jsonData.src || jsonData.location;
                if (s3Url) {
                  if (__DEV__) {
                    console.log(`✅ [${idx + 1}/${imageUrls.length}] Resolved to S3 URL`);
                  }
                  return s3Url;
                }
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.warn(`⚠️ [${idx + 1}/${imageUrls.length}] Failed to resolve URL:`, error.message);
            }
          }
          
          return imageUrl; // Fallback to original URL
        }));
        
        if (__DEV__) {
          const successCount = resolvedImageUrls.filter(img => img !== '').length;
          console.log(`📊 Image URL resolution complete: ${successCount}/${enquiries.length} URLs resolved`);
        }
        
        let rowsGenerated = 0;
        const rows = enquiries.map((enquiry, index) => {
          // Safety check: skip invalid enquiries
          if (!enquiry || typeof enquiry !== 'object') {
            if (__DEV__) {
              console.warn(`Skipping invalid enquiry at index ${index}:`, enquiry);
            }
            return '';
          }
          
          try {
            // Handle both normalized and original data structures
            const originalData = enquiry?._originalData || {};
            const normalizedEnquiry = enquiry || {};
            
            // Get metal info - check both structures
            const metal = normalizedEnquiry?.Metal || originalData?.Metal || normalizedEnquiry?.metal || originalData?.metal || {};
            const metalColor = metal.Color || metal.color || '';
            const metalQuality = metal.Quality || metal.quality || '';
            const metalType = metalColor ? `${metalColor}${metalQuality ? ` (${metalQuality})` : ''}` : 'N/A';
            
            // Get status - check both structures
            const statusValue = normalizedEnquiry?.status || originalData?.Status || normalizedEnquiry?.Status || 'pending';
            const status = (statusValue || 'pending').toString().toUpperCase();
            const statusColor = getStatusColor(statusValue);
            
            // Get priority - check both structures
            const priorityValue = normalizedEnquiry?.priority || originalData?.Priority || normalizedEnquiry?.Priority || 'medium';
            const priority = (priorityValue || 'medium').toString().toUpperCase();
            const priorityColor = getPriorityColor(priorityValue);
            
            // Get title/name - check both structures
            const title = normalizedEnquiry?.title || originalData?.Name || normalizedEnquiry?.Name || 'Untitled';
            
            // Get category - check both structures
            const category = normalizedEnquiry?.category || originalData?.Category || normalizedEnquiry?.Category || 'N/A';
            
            // Get client name - check both structures
            const clientName = normalizedEnquiry?.clientName || originalData?.ClientName || normalizedEnquiry?.client || 'Unknown';
            
            // Get stone type - check both structures
            const stoneType = normalizedEnquiry?.stoneType || originalData?.StoneType || normalizedEnquiry?.StoneType || 'N/A';
            
            // Get dates - check both structures
            const createdAt = normalizedEnquiry?.createdAt || originalData?.createdAt || originalData?.CreatedDate || '';
            const shippingDate = normalizedEnquiry?.deadline || normalizedEnquiry?.ShippingDate || originalData?.ShippingDate || originalData?.deadline || '';
            
            const imageUrl = resolvedImageUrls[index] || '';
            const assignedDate = getAssignedDate(normalizedEnquiry) || getAssignedDate(originalData);
            const assignedToId = normalizedEnquiry?.AssignedTo || originalData?.AssignedTo || normalizedEnquiry?.assignedTo || '';
            // Resolve user ID to name
            const assignedToName = assignedToId ? getUserName(assignedToId) : 'N/A';
            
            rowsGenerated++;
            
            return `
        <tr>
          <td>${index + 1}</td>
          <td class="text-truncate">${escapeHtml(title)}</td>
          <td>${escapeHtml(category)}</td>
          <td>
            <span class="badge status-badge" style="background-color: ${statusColor}">${escapeHtml(status)}</span>
          </td>
          <td>${escapeHtml(clientName)}</td>
          <td class="image-cell">
            ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Enquiry Image" class="enquiry-image" />` : '-'}
          </td>
          <td>${escapeHtml(assignedToName)}</td>
          <td>${escapeHtml(assignedDate) || 'N/A'}</td>
          <td>${formatDate(createdAt)}</td>
          <td>
            <span class="badge priority-badge" style="background-color: ${priorityColor}">${escapeHtml(priority)}</span>
          </td>
          <td class="text-truncate">${escapeHtml(metalType)}</td>
          <td>${escapeHtml(stoneType)}</td>
          <td>${shippingDate ? formatDate(shippingDate) : 'Not set'}</td>
        </tr>
            `;
          } catch (rowError) {
            if (__DEV__) {
              console.error(`Error generating row for enquiry ${index}:`, rowError);
            }
            return ''; // Skip this row if there's an error
          }
        }).filter(row => row !== '').join('');
        
        if (__DEV__) {
          console.log(`Generated ${rowsGenerated} table rows out of ${enquiries.length} enquiries`);
          console.log(`Total row HTML length: ${rows.length} characters`);
        }
        
        if (rows.length === 0) {
          return '<tr><td colspan="13" style="text-align: center; padding: 20px; color: red;">Error: Failed to generate table rows from enquiry data</td></tr>';
        }
        
        return rows;
      })()}
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
    // Generate HTML content (now async to fetch images)
    const htmlContent = await generateEnquiriesListHTML(enquiries);
    
    if (__DEV__) {
      console.log('Generated HTML content length:', htmlContent.length);
      console.log('HTML preview (first 500 chars):', htmlContent.substring(0, 500));
      // Check if table has rows
      const tableRowsMatch = htmlContent.match(/<tr>/g);
      console.log('Number of table rows found:', tableRowsMatch ? tableRowsMatch.length : 0);
    }

    // Create filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `All_Enquiries_${timestamp}`;
    
    // Try to generate PDF using react-native-html-to-pdf
    if (generatePDF && typeof generatePDF === 'function') {
      try {
        if (__DEV__) {
          console.log('========== ATTEMPTING PDF GENERATION ==========');
          console.log('HTML content length:', htmlContent.length);
          console.log('Filename:', filename);
          console.log('Platform:', Platform.OS);
        }
        
        // Don't specify directory - let library use its default
        // Or use a simple string like "Documents" to avoid path issues
        const options = {
          html: htmlContent,
          fileName: filename,
          // Don't specify directory on Android - library handles it better
          base64: false,
          width: 595, // A4 width in points
          height: 842, // A4 height in points
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 10,
          paddingBottom: 10,
        };
        
        if (__DEV__) {
          console.log('PDF options:', JSON.stringify({ ...options, html: '[HTML content]' }, null, 2));
        }
        
        const file = await generatePDF(options);
        
        if (__DEV__) {
          console.log('========== PDF GENERATION SUCCESS ==========');
          console.log('PDF file path:', file.filePath);
          console.log('File exists:', file.filePath ? await RNFS.exists(file.filePath) : 'no path');
          console.log('============================================');
        }
        
        // Verify file exists and is not empty
        if (file && file.filePath) {
          let originalFilePath = file.filePath;
          
          // Fix malformed paths - the library sometimes creates paths like:
          // /storage/emulated/0/Android/data/.../files/data/user/0/.../cache/file.pdf
          // Extract the actual file location
          if (originalFilePath.includes('/data/user/0/')) {
            // Extract the cache path part
            const cacheMatch = originalFilePath.match(/\/data\/user\/0\/[^/]+\/cache\/([^/]+\.pdf)$/);
            if (cacheMatch) {
              // Use the app's cache directory
              originalFilePath = `${RNFS.CachesDirectoryPath}/${cacheMatch[1]}`;
            }
          }
          
          // Copy file to Downloads for easier access and sharing
          const downloadPath = `${RNFS.DownloadDirectoryPath}/${filename}.pdf`;
          let finalFilePath = downloadPath;
          
          try {
            // Verify original file exists
            if (await RNFS.exists(originalFilePath)) {
              // Copy to Downloads
              await RNFS.copyFile(originalFilePath, downloadPath);
              
              if (__DEV__) {
                console.log('PDF copied to Downloads:', downloadPath);
              }
            } else {
              // If original doesn't exist, try the file path as-is
              if (await RNFS.exists(file.filePath)) {
                await RNFS.copyFile(file.filePath, downloadPath);
              } else {
                throw new Error('Original PDF file not found');
              }
            }
          } catch (copyError) {
            console.warn('Failed to copy to Downloads, using original path:', copyError);
            // Use original path if copy fails
            finalFilePath = originalFilePath;
          }
          
          // Verify final file exists
          if (await RNFS.exists(finalFilePath)) {
            const fileStats = await RNFS.stat(finalFilePath);
            if (fileStats.size > 0) {
              if (__DEV__) {
                console.log('Sharing PDF with path:', finalFilePath);
              }
              
              // Share the PDF file - use content URI for Android
              await Share.open({
                title: 'Download All Enquiries PDF',
                message: `Enquiries List - ${enquiries.length} enquiries`,
                url: `file://${finalFilePath}`,
                type: 'application/pdf',
                filename: `${filename}.pdf`,
                subject: `All Enquiries - ${timestamp}`,
              });
              
              return { success: true, filePath: finalFilePath, isPDF: true };
            } else {
              throw new Error('Generated PDF file is empty');
            }
          } else {
            throw new Error(`PDF file was not created at: ${finalFilePath}`);
          }
        } else {
          throw new Error('PDF generation returned invalid file path');
        }
      } catch (pdfError) {
        console.error('========== PDF GENERATION ERROR ==========');
        console.error('Error details:', pdfError);
        console.error('Error message:', pdfError.message);
        console.error('Error stack:', pdfError.stack);
        console.error('==========================================');
        // Fall through to HTML fallback
      }
    } else {
      if (__DEV__) {
        console.warn('PDF library not available or generatePDF function missing');
        console.warn('generatePDF:', generatePDF);
        console.warn('Type:', typeof generatePDF);
      }
    }
    
    // Fallback: Save as HTML if PDF generation fails or library not available
    const htmlFilename = `${filename}.html`;
    const htmlFilePath = `${RNFS.DownloadDirectoryPath}/${htmlFilename}`;
    
    try {
      if (__DEV__) {
        console.log('Saving as HTML file (fallback):', htmlFilePath);
        console.log('HTML content length:', htmlContent.length);
      }
      
      await RNFS.writeFile(htmlFilePath, htmlContent, 'utf8');
      
      const fileExists = await RNFS.exists(htmlFilePath);
      if (!fileExists) {
        throw new Error('Failed to save HTML file');
      }
      
      const fileStats = await RNFS.stat(htmlFilePath);
      if (fileStats.size === 0) {
        throw new Error('Saved HTML file is empty');
      }
      
      // Share the HTML file with instructions
      await Share.open({
        title: 'Download All Enquiries',
        message: `Enquiries List - ${enquiries.length} enquiries\n\n` +
                 `File saved as HTML. To convert to PDF:\n` +
                 `1. Open the file in a browser\n` +
                 `2. Use browser's Print function\n` +
                 `3. Choose "Save as PDF" as the destination`,
        url: `file://${htmlFilePath}`,
        type: 'text/html',
        filename: htmlFilename,
        subject: `All Enquiries - ${timestamp}`,
      });
      
      return { success: true, filePath: htmlFilePath, isHTML: true };
    } catch (error) {
      console.error('Error saving HTML file:', error);
      throw error;
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

