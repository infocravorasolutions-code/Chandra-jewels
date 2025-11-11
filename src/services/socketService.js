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
    if (this.socket?.connected) {
      if (__DEV__) {
        console.log('Socket already connected');
      }
      return;
    }

    if (this.isConnecting) {
      if (__DEV__) {
        console.log('Socket connection already in progress');
      }
      return;
    }

    try {
      this.isConnecting = true;
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      
      if (__DEV__) {
        console.log('========== SOCKET CONNECTION ==========');
        console.log('Connecting to:', SOCKET_URL);
        console.log('User ID:', userId);
        console.log('Token available:', !!token);
        console.log('========================================');
      }

      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
        auth: {
          token: token ? `Bearer ${token}` : null,
        },
      });

      // Connection events
      this.socket.on('connect', () => {
        if (__DEV__) {
          console.log('✅ Connected to chat server');
        }
        
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
            console.error('Error in connect listener:', error);
          }
        });
      });

      // Reconnection events
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        if (__DEV__) {
          console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        if (__DEV__) {
          console.log(`✅ Reconnected to chat server after ${attemptNumber} attempts`);
        }
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
        if (__DEV__) {
          console.warn('⚠️ Reconnection failed. Please check your network connection.');
        }
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
            console.warn('⚠️ Server disconnected WebSocket:', reason);
          } else {
            console.log('❌ Disconnected from chat server:', reason);
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
            console.error('Error in disconnect listener:', error);
          }
        });
        
        // For transport errors, socket.io will automatically attempt to reconnect
        // No need to manually reconnect unless it's a server disconnect
        if (isServerDisconnect) {
          // Server disconnected - don't auto-reconnect
          // User will need to manually reconnect or refresh
          if (__DEV__) {
            console.warn('Server disconnected. Reconnection may be needed.');
          }
        }
      });

      this.socket.on('connect_error', (error) => {
        if (__DEV__) {
          console.warn('⚠️ Socket connection error (this is OK if WebSocket server is not running):', error.message);
          console.warn('Chat will work without real-time updates. Make sure WebSocket server is running on:', SOCKET_URL);
        }
        
        // Don't throw error, just log it - chat can work without WebSocket
        this.isConnecting = false;
        
        // Notify listeners
        this.listeners.error.forEach(callback => {
          try {
            callback(error);
          } catch (err) {
            console.error('Error in error listener:', err);
          }
        });
      });

      // Chat events
      this.socket.on('newMessage', (message) => {
        if (__DEV__) {
          console.log('📨 New message received:', message);
        }
        
        this.listeners.newMessage.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error('Error in newMessage listener:', error);
          }
        });
      });

      this.socket.on('messagesRead', (data) => {
        if (__DEV__) {
          console.log('✅ Messages read:', data);
        }
        
        this.listeners.messagesRead.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in messagesRead listener:', error);
          }
        });
      });

      this.socket.on('userTyping', (data) => {
        if (__DEV__) {
          console.log('⌨️ User typing:', data);
        }
        
        this.listeners.userTyping.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in userTyping listener:', error);
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
            if (__DEV__) {
              console.warn('⚠️ Socket reported send error, but connection is active. Message may have been sent.');
            }
          } else {
            if (__DEV__) {
              console.error('Socket error: Failed to send message (socket not connected)');
            }
          }
        } else {
          if (__DEV__) {
            console.error('Socket error:', error);
            console.error('This might be a backend error. Check backend logs for Chat model issues.');
          }
        }
        
        this.listeners.error.forEach(callback => {
          try {
            callback(error);
          } catch (err) {
            console.error('Error in error listener:', err);
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
      if (__DEV__) {
        console.log('Disconnecting socket...');
      }
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
      if (__DEV__) {
        console.warn('Cannot join chat: socket not connected');
      }
      return;
    }

    if (__DEV__) {
      console.log(`Joining chat: ${chatId} for user: ${userId}`);
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

    if (__DEV__) {
      console.log(`Leaving chat: ${chatId} for user: ${userId}`);
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
      if (__DEV__) {
        console.warn('⚠️ Cannot send message: socket not connected. Message will not be sent in real-time.');
      }
      return false;
    }

    if (__DEV__) {
      console.log('📤 Sending message:', data);
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
   * Subscribe to an event
   * @param {string} event - Event name ('newMessage', 'messagesRead', 'userTyping', 'error', 'connect', 'disconnect')
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      console.warn(`Unknown event: ${event}`);
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

