import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_BASE_URL } from '../config/apiConfig';

const SOCKET_URL = SOCKET_BASE_URL;

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.isConnecting = false;
    this.listeners = {
      newMessage: [],
      messagesRead: [],
      userTyping: [],
      error: [],
      connect: [],
      disconnect: [],
    };
  }

  /**
   * Connect to WebSocket server
   * @param {string} userId - Current user ID
   */
  async connect(userId) {
    // Prevent multiple connection attempts
    if (this.socket?.connected) {
      
      return;
    }

    if (this.isConnecting) {
      
      return;
    }

    // Clean up any existing socket before creating a new one
    if (this.socket && !this.socket.connected) {
      
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (error) {
        
      }
      this.socket = null;
    }

    try {
      this.isConnecting = true;
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      
      

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'], // Use only websocket to avoid polling overhead
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000, // Max 10 seconds between attempts
        reconnectionAttempts: 5, // Limit to 5 attempts to prevent resource exhaustion
        timeout: 20000,
        auth: {
          token: token ? `Bearer ${token}` : null,
        },
      });

      // Connection events
      this.socket.on('connect', () => {
        
        
        this.connected = true;
        this.isConnecting = false;
        
        // Join notification room for offline push notifications
        if (userId) {
          this.socket.emit('joinNotificationRoom', userId);
        }
        
        // Notify listeners
        this.listeners.connect.forEach(callback => {
          try {
            callback();
          } catch (error) {
          }
        });
      });

      // Reconnection events
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        
      });

      this.socket.on('reconnect', (attemptNumber) => {
        
        this.connected = true;
        this.isConnecting = false;
        
        // Rejoin notification room after reconnection
        if (userId) {
          this.socket.emit('joinNotificationRoom', userId);
        }
      });

      this.socket.on('reconnect_error', (error) => {
        if (__DEV__) {
          console.warn('⚠️ Reconnection error (will keep trying):', error.message);
        }
      });

      this.socket.on('reconnect_failed', () => {
        
        this.connected = false;
        this.isConnecting = false;
      });

      this.socket.on('disconnect', (reason) => {
        // Transport errors are often temporary network issues
        const isTransportError = reason === 'transport error' || reason === 'transport close';
        const isServerDisconnect = reason === 'io server disconnect';
        
        if (__DEV__) {
          if (isTransportError) {
            console.warn('⚠️ WebSocket transport error (network issue, will auto-reconnect):', reason);
          } else if (isServerDisconnect) {
          } else {
          }
        }
        
        // Reset connection state
        this.connected = false;
        this.isConnecting = false;
        
        // Notify listeners
        this.listeners.disconnect.forEach(callback => {
          try {
            callback(reason);
          } catch (error) {
          }
        });
        
        // For transport errors, socket.io will automatically attempt to reconnect
        // No need to manually reconnect unless it's a server disconnect
        if (isServerDisconnect) {
          // Server disconnected - don't auto-reconnect
          // User will need to manually reconnect or refresh
          
        }
      });

      this.socket.on('connect_error', (error) => {
        if (__DEV__) {
          console.warn('⚠️ Socket connection error (this is OK if WebSocket server is not running):', error.message);
        }
        
        // Don't throw error, just log it - chat can work without WebSocket
        this.isConnecting = false;
        
        // Notify listeners
        this.listeners.error.forEach(callback => {
          try {
            callback(error);
          } catch (err) {
          }
        });
      });

      // Chat events
      this.socket.on('newMessage', (message) => {
        
        
        this.listeners.newMessage.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
          }
        });
      });

      this.socket.on('messagesRead', (data) => {
        
        
        this.listeners.messagesRead.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
          }
        });
      });

      this.socket.on('userTyping', (data) => {
        
        
        this.listeners.userTyping.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
          }
        });
      });

      this.socket.on('error', (error) => {
        // Only log if it's a real error, not a "Failed to send message" when message actually worked
        const errorMessage = error?.message || error?.toString() || '';
        if (errorMessage.includes('Failed to send message')) {
          // This might be a false error - message could have been sent successfully
          // Check if we're actually connected and receiving messages
          if (this.socket?.connected) {
            
          } else {
            if (__DEV__) {
              console.error('Socket error: Failed to send message (socket not connected)');
            }
          }
        } else {
          
        }
        
        this.listeners.error.forEach(callback => {
          try {
            callback(error);
          } catch (err) {
          }
        });
      });

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      if (__DEV__) {
        console.warn('⚠️ Socket connection failed (chat will work without real-time):', error.message);
      }
      // Don't throw - allow app to continue without WebSocket
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }

  /**
   * Join a chat room
   * @param {string} chatId - Chat ID (enquiryId)
   * @param {string} userId - User ID
   */
  joinChat(chatId, userId) {
    if (!this.socket?.connected) {
      
      return;
    }

    

    this.socket.emit('joinChat', { chatId, userId });
  }

  /**
   * Leave a chat room
   * @param {string} chatId - Chat ID (enquiryId)
   * @param {string} userId - User ID
   */
  leaveChat(chatId, userId) {
    if (!this.socket?.connected) {
      return;
    }

    

    this.socket.emit('leaveChat', { chatId, userId });
  }

  /**
   * Send a message
   * @param {object} data - Message data
   * @param {string} data.chatId - Chat ID (enquiryId)
   * @param {string} data.userId - User ID
   * @param {string} data.message - Message text
   * @param {string} data.messageType - 'text' | 'image' | 'video' | 'file'
   * @param {string} [data.parentMessageId] - Parent message ID for replies
   * @param {string} [data.mediaKey] - Media key from upload
   * @param {string} [data.mediaName] - Media file name
   * @param {string} [data.mediaUrl] - Media URL
   * @param {number} [data.mediaSize] - Media file size
   */
  sendMessage(data) {
    if (!this.socket?.connected) {
      
      return false;
    }

    

    this.socket.emit('sendMessage', data);
    return true;
  }

  /**
   * Send typing indicator
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   * @param {boolean} isTyping - Whether user is typing
   */
  sendTyping(chatId, userId, isTyping) {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('typing', { chatId, userId, isTyping });
  }

  /**
   * Mark messages as read
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   * @param {string[]} [messageIds] - Optional array of specific message IDs to mark as read. If not provided, marks all unread messages in the chat.
   */
  markMessagesRead(chatId, userId, messageIds = null) {
    if (!this.socket?.connected) {
      if (__DEV__) {
        console.log('⚠️ Cannot mark messages as read: socket not connected');
      }
      return false;
    }

    if (__DEV__) {
      console.log('📖 Marking messages as read:', { chatId, userId, messageIds });
    }

    this.socket.emit('markMessagesRead', { chatId, userId, messageIds });
    return true;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name ('newMessage', 'messagesRead', 'userTyping', 'error', 'connect', 'disconnect')
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      return () => {};
    }

    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.listeners[event]) {
      return;
    }

    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Check if socket is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance (for advanced usage)
   * @returns {Socket|null}
   */
  getSocket() {
    return this.socket;
  }
}

// Export singleton instance
export default new SocketService();

