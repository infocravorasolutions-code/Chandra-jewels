import { store } from '../store';
import { useSelector } from 'react-redux';

/**
 * Get user name from user ID
 * Uses cached users from Redux store
 * @param {string} userId - User ID to resolve
 * @returns {string} User name or fallback display
 */
export const getUserName = (userId) => {
  if (!userId) return '-';
  
  const state = store.getState();
  const usersMap = state.users?.usersMap || {};
  
  const idStr = String(userId).trim();
  
  // Try exact match
  if (usersMap[idStr]) {
    return usersMap[idStr].name || usersMap[idStr].email || `User ${idStr.substring(0, 8)}...`;
  }
  
  // Try with spaces removed
  const noSpacesId = idStr.replace(/\s/g, '');
  if (usersMap[noSpacesId]) {
    return usersMap[noSpacesId].name || usersMap[noSpacesId].email || `User ${noSpacesId.substring(0, 8)}...`;
  }
  
  // Try ObjectId format cleanup
  const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
  if (usersMap[cleanId]) {
    return usersMap[cleanId].name || usersMap[cleanId].email || `User ${cleanId.substring(0, 8)}...`;
  }
  
  // If it looks like an ObjectId but we don't have a name, return a truncated version
  if (noSpacesId.length > 12) {
    return `User ${noSpacesId.substring(0, 8)}...`;
  }
  
  return userId; // Fallback to original ID if short
};

/**
 * Get full user object from user ID
 * @param {string} userId - User ID to resolve
 * @returns {object|null} User object or null
 */
export const getUserById = (userId) => {
  if (!userId) return null;
  
  const state = store.getState();
  const usersMap = state.users?.usersMap || {};
  
  const idStr = String(userId).trim();
  
  // Try exact match
  if (usersMap[idStr]) {
    return usersMap[idStr];
  }
  
  // Try with spaces removed
  const noSpacesId = idStr.replace(/\s/g, '');
  if (usersMap[noSpacesId]) {
    return usersMap[noSpacesId];
  }
  
  // Try ObjectId format cleanup
  const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
  if (usersMap[cleanId]) {
    return usersMap[cleanId];
  }
  
  return null;
};

/**
 * React hook to get user name from ID
 * Automatically subscribes to store updates
 * Must be used inside a React component
 */
export const useUserName = (userId) => {
  return useSelector(state => {
    if (!userId) return '-';
    
    const usersMap = state.users?.usersMap || {};
    const idStr = String(userId).trim();
    
    // Try exact match
    if (usersMap[idStr]) {
      return usersMap[idStr].name || usersMap[idStr].email || `User ${idStr.substring(0, 8)}...`;
    }
    
    // Try with spaces removed
    const noSpacesId = idStr.replace(/\s/g, '');
    if (usersMap[noSpacesId]) {
      return usersMap[noSpacesId].name || usersMap[noSpacesId].email || `User ${noSpacesId.substring(0, 8)}...`;
    }
    
    // Try ObjectId format cleanup
    const cleanId = idStr.replace(/^ObjectId\(/, '').replace(/\)$/, '').replace(/\s/g, '');
    if (usersMap[cleanId]) {
      return usersMap[cleanId].name || usersMap[cleanId].email || `User ${cleanId.substring(0, 8)}...`;
    }
    
    // If it looks like an ObjectId but we don't have a name, return a truncated version
    if (noSpacesId.length > 12) {
      return `User ${noSpacesId.substring(0, 8)}...`;
    }
    
    return userId; // Fallback to original ID if short
  });
};

