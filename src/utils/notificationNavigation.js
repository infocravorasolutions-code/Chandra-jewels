import { navigationRef } from '../navigation/navigationRef';

/**
 * Navigate to the appropriate screen based on notification data
 * Supports both link-based and type-based navigation
 * 
 * @param {Object} notificationData - The notification data object
 * @param {string} notificationData.link - Link path (e.g., 'enquiries/123', 'chats/456')
 * @param {string} notificationData.type - Notification type (e.g., 'enquiry', 'chat', 'design')
 * @param {string} notificationData.enquiryId - Enquiry ID
 * @param {string} notificationData.chatId - Chat ID
 * @param {string} notificationData.clientId - Client ID
 * @param {string} notificationData.designType - Design type ('cad' or 'coral')
 * @param {string} notificationData.chatType - Chat type
 * @param {string} notificationData.clientName - Client name
 * @param {number} notificationData.versionIndex - Design version index
 */
export const navigateFromNotification = (notificationData) => {
  try {
    // Log notification received (works in production too for debugging)
    console.log('[Notification Navigation] ========================================');
    console.log('[Notification Navigation] Notification received at:', new Date().toISOString());
    console.log('[Notification Navigation] Full notification data:', JSON.stringify(notificationData, null, 2));
    
    if (!navigationRef.isReady()) {
      if (__DEV__) {
        console.warn('[Notification Navigation] Navigation not ready, will retry...');
      }
      // Retry after a short delay
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigateFromNotification(notificationData);
        }
      }, 500);
      return;
    }

    const data = notificationData?.data || notificationData || {};
    const link = data.link || data.Link || data.url || data.Url;
    const notificationType = data.type || data.Type || data.notificationType || data.NotificationType;
    
    console.log('[Notification Navigation] Extracted link:', link);
    console.log('[Notification Navigation] Extracted type:', notificationType);

    // If no link or type, navigate to notifications screen
    if (!link && !notificationType) {
      navigationRef.navigate('Notifications');
      return;
    }

    // Helper function to extract ID from path
    // For "enquiries/123", returns "123" (the ID part after the prefix)
    const extractId = (path, prefix = '') => {
      if (!path) return null;
      const parts = path.split('/').filter(Boolean);
      
      // If prefix is provided, find the part after the prefix
      if (prefix) {
        const prefixIndex = parts.findIndex(part => part === prefix);
        if (prefixIndex >= 0 && parts[prefixIndex + 1]) {
          return parts[prefixIndex + 1];
        }
      }
      
      // Otherwise, return the last part (usually the ID)
      return parts[parts.length - 1] || null;
    };

    // Helper function to parse query parameters
    const parseQueryParams = (url) => {
      const params = {};
      const queryString = url.split('?')[1];
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
      return params;
    };

    // Process link if available
    if (link) {
      const normalizedLink = link.replace(/^\//, '').split('?')[0]; // Remove leading slash and query string
      const queryParams = parseQueryParams(link);
      
      // Merge query params with data
      const allParams = { ...data, ...queryParams };

      if (normalizedLink.startsWith('notifications') || normalizedLink === 'notifications') {
        console.log('[Notification Navigation] ✅ Navigating to: Notifications screen');
        navigationRef.navigate('Notifications');
        return;
      } 
      else if (normalizedLink.startsWith('enquiries/')) {
        // Extract ID from "enquiries/123" -> "123"
        const enquiryId = extractId(normalizedLink, 'enquiries') || allParams.enquiryId || allParams.EnquiryId || allParams.id || allParams.Id;
        if (enquiryId && enquiryId !== 'enquiries') { // Safety check: ensure we got an actual ID, not the prefix
          console.log('[Notification Navigation] ✅ Navigating to: SingleEnquiry screen with enquiryId:', enquiryId);
          console.log('[Notification Navigation] 📋 Full notification data:', JSON.stringify(allParams, null, 2));
          navigationRef.navigate('SingleEnquiry', { enquiryId });
          return;
        } else {
          console.error('[Notification Navigation] ❌ Invalid enquiryId extracted:', enquiryId, 'from link:', normalizedLink);
        }
      } 
      else if (normalizedLink.startsWith('chats/') || normalizedLink.startsWith('chat/')) {
        const prefix = normalizedLink.startsWith('chats/') ? 'chats' : 'chat';
        const chatId = extractId(normalizedLink, prefix) || allParams.chatId || allParams.ChatId;
        const enquiryId = allParams.enquiryId || allParams.EnquiryId;
        const chatType = allParams.chatType || allParams.ChatType;
        
        if (chatId && chatId !== 'chats' && chatId !== 'chat') {
          navigationRef.navigate('ChatDetail', {
            chatId: chatId,
            enquiryId: enquiryId,
            chatType: chatType,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('chat-groups') || normalizedLink === 'chat-groups') {
        navigationRef.navigate('ChatGroups');
        return;
      }
      else if (normalizedLink.startsWith('designs/') || normalizedLink.startsWith('design/')) {
        const prefix = normalizedLink.startsWith('designs/') ? 'designs' : 'design';
        const enquiryId = extractId(normalizedLink, prefix) || allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        const versionIndex = allParams.versionIndex ? parseInt(allParams.versionIndex) : undefined;
        
        if (enquiryId && enquiryId !== 'designs' && enquiryId !== 'design') {
          navigationRef.navigate('DesignViewer', {
            enquiryId,
            designType,
            versionIndex,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('pricing/')) {
        const enquiryId = extractId(normalizedLink, 'pricing') || allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        
        if (enquiryId && enquiryId !== 'pricing') {
          navigationRef.navigate('Pricing', {
            enquiryId,
            designType,
          });
          return;
        }
      }
      else if (normalizedLink.startsWith('upload-design') || normalizedLink === 'upload-design') {
        const enquiryId = allParams.enquiryId || allParams.EnquiryId;
        const designType = allParams.designType || allParams.DesignType || 'cad';
        
        navigationRef.navigate('UploadDesign', {
          enquiryId,
          designType,
        });
        return;
      }
      else if (normalizedLink.startsWith('metal-prices') || normalizedLink === 'metal-prices') {
        navigationRef.navigate('MetalPrices');
        return;
      }
      else if (normalizedLink.startsWith('clients/')) {
        const clientId = extractId(normalizedLink, 'clients') || allParams.clientId || allParams.ClientId;
        const clientName = allParams.clientName || allParams.ClientName;
        
        if (clientId && clientId !== 'clients') {
          // Navigate to client pricing if clientId provided
          navigationRef.navigate('ClientPricing', {
            clientId,
            clientName,
          });
          return;
        } else {
          // Navigate to clients list
          navigationRef.navigate('ClientsList');
          return;
        }
      }
      else if (normalizedLink.startsWith('clients') || normalizedLink === 'clients') {
        navigationRef.navigate('ClientsList');
        return;
      }
      else if (normalizedLink.startsWith('create-client') || normalizedLink === 'create-client') {
        navigationRef.navigate('CreateClient');
        return;
      }
      else if (normalizedLink.startsWith('dashboard') || normalizedLink === 'dashboard') {
        navigationRef.navigate('MainTabs', { screen: 'Dashboard' });
        return;
      }
      else if (normalizedLink.startsWith('enquiries') || normalizedLink === 'enquiries') {
        navigationRef.navigate('MainTabs', { screen: 'Enquiries' });
        return;
      }
    }

    // Handle notification type as fallback or primary method
    if (notificationType) {
      const type = notificationType.toLowerCase();
      const enquiryId = data.enquiryId || data.EnquiryId || data.id || data.Id;
      const chatId = data.chatId || data.ChatId;
      const clientId = data.clientId || data.ClientId;
      const clientName = data.clientName || data.ClientName;
      const designType = data.designType || data.DesignType || 'cad';
      const chatType = data.chatType || data.ChatType;

      switch (type) {
        case 'enquiry':
        case 'enquiry_update':
        case 'enquiry_created':
          if (enquiryId) {
            navigationRef.navigate('SingleEnquiry', { enquiryId });
            return;
          }
          break;
        case 'chat':
        case 'message':
        case 'chat_message':
          if (chatId) {
            navigationRef.navigate('ChatDetail', {
              chatId,
              enquiryId: enquiryId,
              chatType: chatType,
            });
            return;
          } else {
            navigationRef.navigate('MainTabs', { screen: 'Chats' });
            return;
          }
        case 'design':
        case 'design_uploaded':
        case 'design_updated':
          if (enquiryId) {
            navigationRef.navigate('DesignViewer', {
              enquiryId,
              designType,
            });
            return;
          }
          break;
        case 'pricing':
        case 'pricing_update':
          if (enquiryId) {
            navigationRef.navigate('Pricing', {
              enquiryId,
              designType,
            });
            return;
          }
          break;
        case 'client':
        case 'client_created':
        case 'client_updated':
          if (clientId) {
            navigationRef.navigate('ClientPricing', {
              clientId,
              clientName,
            });
            return;
          } else {
            navigationRef.navigate('ClientsList');
            return;
          }
        case 'metal_price':
        case 'metal_price_update':
          navigationRef.navigate('MetalPrices');
          return;
        default:
          break;
      }
    }

    // Default fallback to notifications screen
    console.log('[Notification Navigation] ✅ Navigating to: Notifications screen (fallback)');
    navigationRef.navigate('Notifications');
    console.log('[Notification Navigation] ========================================');
  } catch (error) {
    console.error('[Notification Navigation] ❌ Error navigating from notification:', error);
    if (__DEV__) {
      console.error('[Notification] Error navigating from notification:', error);
    }
    // Fallback to notifications screen on error
    try {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    } catch (fallbackError) {
      if (__DEV__) {
        console.error('[Notification] Error in fallback navigation:', fallbackError);
      }
    }
  }
};

