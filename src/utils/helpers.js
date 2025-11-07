import { colors, fonts } from '../constants';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

export const formatDate = (dateString) => {
  if (!dateString) {
    return 'No date';
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid date';
  }
};

export const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status) => {
  const statusColors = {
    pending: colors.warning,
    in_progress: colors.info,
    completed: colors.success,
    rejected: colors.error,
  };
  return statusColors[status] || colors.textSecondary;
};

export const getPriorityColor = (priority) => {
  const priorityLower = (priority || '').toLowerCase();
  const priorityColors = {
    'normal': colors.success,
    'high': colors.warning,
    'super high': colors.error,
    // Legacy support
    'low': colors.success,
    'medium': colors.success,
    'urgent': colors.warning,
    'super urgent': colors.error,
  };
  return priorityColors[priorityLower] || colors.textSecondary;
};

export const getRoleDisplayName = (role) => {
  const roleNames = {
    admin: 'Administrator',
    client: 'Client',
    coral: 'Coral Designer',
    cad: 'CAD Designer',
  };
  return roleNames[role] || role;
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
};

export const formatCount = (count) => {
  const num = parseInt(count) || 0;
  
  if (num >= 10000000) { // 1 Crore
    return (num / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  } else if (num >= 100000) { // 1 Lac
    return (num / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  } else if (num >= 1000) { // 1 Thousand
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  
  return num.toString();
};

// Base64 decode function for React Native (no atob available)
const base64Decode = (str) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3);
    }
  }
  
  return output;
};

// Decode JWT token without verification (client-side only)
export const decodeJWT = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const base64Url = parts[1];
    if (!base64Url) {
      throw new Error('Invalid token format');
    }
    
    // Replace URL-safe base64 characters
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    // Decode base64
    const decoded = base64Decode(padded);
    
    // Convert to JSON
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

// Map role number from API to role string
export const mapRoleNumberToString = (roleNumber) => {
  const roleMap = {
    1: 'admin',
    2: 'coral',
    3: 'cad',
    4: 'client',
    // Add more role mappings as needed
  };
  return roleMap[roleNumber] || null;
};
