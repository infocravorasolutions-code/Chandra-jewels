import { colors, fonts } from '../constants';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
  const priorityColors = {
    high: colors.error,
    medium: colors.warning,
    low: colors.success,
  };
  return priorityColors[priority] || colors.textSecondary;
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
