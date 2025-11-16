import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socketService';
import { useGetChatMessagesQuery, useUploadChatMediaMutation } from '../store/api';
import { API_BASE_URL } from '../config/apiConfig';

/**
 * Custom hook for managing chat functionality
 * @param {string} enquiryId - The enquiry ID
 * @param {string} chatType - 'admin-client' or 'admin-designer'
 * @param {string} chatId - Optional: Direct chat ID to use (if available, skips search)
 * @returns {object} Chat state and methods
 */
export const useChat = (enquiryId, chatType, chatId = null) => {
  const { user } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [chatError, setChatError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Upload media mutation
  const [uploadChatMedia, { isLoading: isUploading }] = useUploadChatMediaMutation();

  // Determine chat type based on user role
  const getChatType = useCallback(() => {
    if (!user) return null;
    
    const role = user.role?.toLowerCase();
    
    // Client always uses admin-client
    if (role === 'client') {
      return 'admin-client';
    }
    
    // Worker/Designer (coral/cad) uses admin-designer
    if (role === 'coral' || role === 'cad' || role === 'worker' || role === 'designer') {
      return 'admin-designer';
    }
    
    // Admin can use either, default to admin-client
    if (role === 'admin') {
      return chatType || 'admin-client';
    }
    
    return chatType || 'admin-client';
  }, [user, chatType]);

  // Step 1: Get chat by enquiry ID and type from chats list
  // Backend creates chat automatically when first message is sent
  // So we search the chats list for this enquiry, or create a virtual chat
  const fetchChat = useCallback(async () => {
    if (!enquiryId || !user) return;

    const type = getChatType();
    if (!type) return;

    setIsLoadingChat(true);
    setChatError(null);

    try {
      const token = await AsyncStorage.getItem('token');

      // If we have a direct chatId, fetch that specific chat first
      if (chatId) {
        if (__DEV__) {
          console.log('🔍 Fetching chat directly by chatId:', chatId);
        }
        
        try {
          // Try to get the specific chat by ID
          const chatResponse = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            const foundChat = chatData.Data || chatData.data || chatData;
            
            if (foundChat && (foundChat._id || foundChat.id)) {
              if (__DEV__) {
                console.log('✅ Chat found by ID:', foundChat);
              }
              setChat(foundChat);
              setIsLoadingChat(false);
              return;
            }
          }
        } catch (chatIdError) {
          if (__DEV__) {
            console.warn('⚠️ Error fetching chat by ID, falling back to search:', chatIdError.message);
          }
          // Fall through to search by enquiryId
        }
      }

      // Search for chat in the chats list by enquiryId and type
      // Backend filters chats by type and user participation
      const searchParams = new URLSearchParams({
        type: type,
        search: enquiryId, // Search by enquiryId
        limit: '50', // Get enough to find our chat
      });

      const response = await fetch(`${API_BASE_URL}/api/chats?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const chats = result.Data || result.data || result;
        
        // If we have a chatId, find that specific chat, otherwise find by enquiryId
        let foundChat = null;
        if (chatId && Array.isArray(chats)) {
          foundChat = chats.find(chat => {
            const cId = chat._id || chat.id;
            return String(cId).trim() === String(chatId).trim();
          });
        }
        
        // If not found by chatId, fall back to finding by enquiryId
        if (!foundChat && Array.isArray(chats)) {
          foundChat = chats.find(chat => {
            const chatEnquiryId = chat.EnquiryId || chat.enquiryId;
            return String(chatEnquiryId).trim() === String(enquiryId).trim() &&
                   (chat.Type || chat.type) === type;
          });
        }

        if (foundChat) {
          if (__DEV__) {
            console.log('✅ Chat found in list:', foundChat);
          }
          setChat(foundChat);
          setIsLoadingChat(false);
          return;
        }
      }

      // Chat doesn't exist yet - backend will create it when first message is sent
      // Create a virtual chat object for now
      if (__DEV__) {
        console.log('ℹ️ Chat not found, will be created when first message is sent');
      }
      
      // We need to get the enquiry name if possible, but for now use a placeholder
      // The chat will be created with proper name when first message is sent
      const virtualChat = {
        _id: chatId || null, // Use provided chatId if available
        EnquiryId: enquiryId,
        EnquiryName: 'New Chat', // Will be updated when chat is created
        Type: type,
        CreatedAt: new Date().toISOString(),
      };
      setChat(virtualChat);
      setChatError(null);
      
    } catch (error) {
      if (__DEV__) {
        console.warn('⚠️ Error fetching chat, using virtual chat:', error.message);
      }
      // Fallback: use virtual chat (backend will create real chat on first message)
      const fallbackChat = {
        _id: chatId || null,
        EnquiryId: enquiryId,
        EnquiryName: 'Chat',
        Type: getChatType(),
        CreatedAt: new Date().toISOString(),
      };
      setChat(fallbackChat);
      setChatError(null);
    } finally {
      setIsLoadingChat(false);
    }
  }, [enquiryId, user, getChatType, chatId]);

  // Step 2 & 3: Connect to socket and join chat
  // Note: If chat._id is null (virtual chat), we'll join after chat is created
  useEffect(() => {
    if (!chat || !user) return;
    
    // If chat doesn't have an _id yet (virtual chat), wait for it to be created
    // The chat will be created when first message is sent
    if (!chat._id) {
      if (__DEV__) {
        console.log('ℹ️ Virtual chat - will join room after first message creates chat');
      }
      return;
    }

    // Try to connect to socket (but don't fail if it doesn't work)
    if (!socketService.isConnected()) {
      try {
        socketService.connect(user.id).catch(err => {
          if (__DEV__) {
            console.warn('⚠️ Socket connection failed, continuing without real-time updates:', err.message);
          }
        });
      } catch (err) {
        if (__DEV__) {
          console.warn('⚠️ Socket connection error, continuing without real-time updates:', err.message);
        }
      }
    }

    // Join chat room (only if chat._id exists)
    socketService.joinChat(chat._id, user.id);

    // Set up event listeners
    const handleNewMessage = (message) => {
      if (__DEV__) {
        console.log('📨 New message received:', message);
        console.log('📨 Current chat._id:', chat._id);
      }
      
      // Check if message belongs to current chat
      const messageChatId = message.ChatId || message.chatId || message.EnquiryId || message.enquiryId;
      
      // Normalize both IDs to strings for comparison (handle ObjectId vs string)
      const normalizedMessageChatId = String(messageChatId || '').trim();
      const normalizedChatId = String(chat._id || '').trim();
      
      if (__DEV__) {
        console.log('📨 Comparing chatIds:', {
          messageChatId: normalizedMessageChatId,
          currentChatId: normalizedChatId,
          match: normalizedMessageChatId === normalizedChatId
        });
      }
      
      if (normalizedMessageChatId === normalizedChatId) {
        // Normalize message format to match what the UI expects
        const normalizedMessage = {
          _id: message._id || message.id,
          id: message._id || message.id,
          Message: message.Message || message.message || message.text || '',
          message: message.Message || message.message || message.text || '',
          text: message.Message || message.message || message.text || '',
          SenderId: message.SenderId || message.senderId,
          senderId: message.SenderId || message.senderId,
          SenderName: message.SenderName || message.senderName,
          senderName: message.SenderName || message.senderName,
          SenderRole: message.SenderRole || message.senderRole,
          senderRole: message.SenderRole || message.senderRole,
          Timestamp: message.Timestamp || message.timestamp,
          timestamp: message.Timestamp || message.timestamp,
          MessageType: message.MessageType || message.messageType || 'text',
          messageType: message.MessageType || message.messageType || 'text',
          IsRead: message.IsRead || message.isRead || false,
          isRead: message.IsRead || message.isRead || false,
          Media: message.Media || message.media,
          media: message.Media || message.media,
          ChatId: messageChatId,
          chatId: messageChatId,
          ...message, // Preserve any other fields
        };

        setMessages(prev => {
          const newMsgId = normalizedMessage._id || normalizedMessage.id;
          
          // Check if message already exists by ID
          const existingIndex = prev.findIndex(msg => {
            const msgId = msg._id || msg.id;
            return msgId === newMsgId;
          });
          
          if (existingIndex !== -1) {
            // Update existing message
            return prev.map((msg, index) => {
              if (index === existingIndex) {
                return { ...normalizedMessage, status: 'sent' };
              }
              return msg;
            });
          }
          
          // Check if there's an optimistic message with same content to replace
          const optimisticIndex = prev.findIndex(msg => {
            const msgId = msg._id || msg.id;
            return msgId?.toString().startsWith('temp-') && 
                   msg.Message === normalizedMessage.Message &&
                   msg.SenderId === normalizedMessage.SenderId &&
                   msg.status === 'sending';
          });
          
          if (optimisticIndex !== -1) {
            // Clear the refetch timeout since we got the WebSocket event
            const optimisticMsg = prev[optimisticIndex];
            if (optimisticMsg._refetchTimeout) {
              clearTimeout(optimisticMsg._refetchTimeout);
            }
            
            // Replace optimistic message with real one
            return prev.map((msg, index) => {
              if (index === optimisticIndex) {
                return { ...normalizedMessage, status: 'sent' };
              }
              return msg;
            }).sort((a, b) => {
              const timeA = new Date(a.Timestamp || a.timestamp || 0);
              const timeB = new Date(b.Timestamp || b.timestamp || 0);
              return timeA - timeB;
            });
          }
          
          // Add new message and sort by timestamp
          const updated = [...prev, { ...normalizedMessage, status: 'sent' }];
          return updated.sort((a, b) => {
            const timeA = new Date(a.Timestamp || a.timestamp || 0);
            const timeB = new Date(b.Timestamp || b.timestamp || 0);
            return timeA - timeB;
          });
        });
      } else {
        if (__DEV__) {
          console.log('⚠️ Message ignored - chatId mismatch:', {
            messageChatId: normalizedMessageChatId,
            currentChatId: normalizedChatId
          });
        }
      }
    };

    const handleMessagesRead = (data) => {
      if (data.chatId === chat._id) {
        setMessages(prev => prev.map(msg => {
          if (data.userIds && data.userIds.includes(msg.SenderId || msg.senderId)) {
            return { ...msg, IsRead: true, isRead: true };
          }
          return msg;
        }));
      }
    };

    const handleUserTyping = (data) => {
      if (data.userId !== user.id && data.chatId === chat._id) {
        setIsTyping(data.isTyping);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      }
    };

    // Subscribe to events
    // Register listeners
    socketService.on('newMessage', handleNewMessage);
    socketService.on('messagesRead', handleMessagesRead);
    socketService.on('userTyping', handleUserTyping);
    
    if (__DEV__) {
      console.log('✅ Registered WebSocket listeners for chat:', chat._id);
      console.log('✅ Socket connected:', socketService.isConnected());
    }

    // Cleanup
    return () => {
      socketService.off('newMessage', handleNewMessage);
      socketService.off('messagesRead', handleMessagesRead);
      socketService.off('userTyping', handleUserTyping);
      
      // Leave chat room (only if chat._id exists)
      if (chat?._id) {
        socketService.leaveChat(chat._id, user.id);
      }
    };
  }, [chat?._id, chat, user]);

  // Step 4: Load old messages
  const { data: initialMessages = [], isLoading: messagesLoading, refetch: refetchMessages, error: messagesError } = useGetChatMessagesQuery(
    { chatId: chat?._id, limit: 20 },
    {
      skip: !chat?._id,
      refetchOnFocus: true, // Refetch when screen is focused (when user revisits)
      refetchOnMountOrArgChange: true, // Refetch when chatId changes
    }
  );

  // Log API response for debugging
  useEffect(() => {
    if (__DEV__ && chat?._id) {
      if (messagesError) {
        console.error('❌ Error fetching messages:', messagesError);
      } else if (initialMessages) {
        console.log('📥 API Messages received:', {
          count: Array.isArray(initialMessages) ? initialMessages.length : 0,
          chatId: chat._id,
          isArray: Array.isArray(initialMessages),
          sample: Array.isArray(initialMessages) && initialMessages.length > 0 ? initialMessages[0] : null
        });
      }
    }
  }, [initialMessages, messagesError, chat?._id]);

  // Track last processed messages to prevent infinite loops
  const lastProcessedMessagesRef = useRef(null);
  
  // Create a stable reference for initialMessages to prevent unnecessary re-renders
  const initialMessagesIds = useMemo(() => {
    if (!initialMessages || !Array.isArray(initialMessages)) return null;
    return initialMessages.map(msg => msg._id || msg.id).filter(Boolean).join(',');
  }, [initialMessages]);

  // Initialize messages from API (merge with existing WebSocket messages)
  useEffect(() => {
    // Skip if we've already processed these messages
    if (initialMessagesIds === lastProcessedMessagesRef.current) {
      if (__DEV__) {
        console.log('⏭️ Skipping message merge - already processed');
      }
      return;
    }

    if (initialMessages && Array.isArray(initialMessages) && initialMessages.length > 0) {
      if (__DEV__) {
        console.log('🔄 Merging API messages with existing messages:', {
          apiCount: initialMessages.length,
          existingCount: messages.length
        });
      }
      setMessages(prev => {
        // Merge API messages with WebSocket messages
        // Create a map of existing messages by ID
        const existingMap = new Map();
        
        // First, add all existing messages (WebSocket messages)
        prev.forEach(msg => {
          const id = msg._id || msg.id;
          if (id && !id.toString().startsWith('temp-')) {
            // Don't keep temporary optimistic messages if we have real data
            existingMap.set(id, msg);
          }
        });

        // Then, add/update with API messages (these are the source of truth)
        initialMessages.forEach(apiMsg => {
          const id = apiMsg._id || apiMsg.id;
          if (id) {
            // API messages take precedence (they're persisted)
            existingMap.set(id, apiMsg);
          }
        });

        // Convert back to array and sort by timestamp
        const merged = Array.from(existingMap.values());
        const sorted = merged.sort((a, b) => {
          const timeA = new Date(a.Timestamp || a.timestamp || 0);
          const timeB = new Date(b.Timestamp || b.timestamp || 0);
          return timeA - timeB;
        });
        
        // Only update if messages actually changed
        const prevIds = prev.map(msg => msg._id || msg.id).filter(Boolean).join(',');
        const newIds = sorted.map(msg => msg._id || msg.id).filter(Boolean).join(',');
        
        if (prevIds === newIds && prev.length === sorted.length) {
          return prev; // No change, return previous state
        }
        
        return sorted;
      });
      
      // Extract nextCursor from first message (for pagination)
      const firstMessage = initialMessages[0];
      if (firstMessage && firstMessage._nextCursor !== undefined) {
        setNextCursor(firstMessage._nextCursor || null);
        if (__DEV__) {
          console.log('📄 NextCursor extracted:', firstMessage._nextCursor);
        }
      }
      
      // Mark as processed
      lastProcessedMessagesRef.current = initialMessagesIds;
    } else if (initialMessages && Array.isArray(initialMessages) && initialMessages.length === 0) {
      // If API returns empty array, only clear temporary messages if we haven't already
      if (lastProcessedMessagesRef.current !== 'empty') {
        if (__DEV__) {
          console.log('📭 API returned empty array, keeping non-temporary messages');
        }
        setMessages(prev => {
          // Keep non-temporary messages
          const realMessages = prev.filter(msg => {
            const id = msg._id || msg.id;
            return id && !id.toString().startsWith('temp-');
          });
          
          // Only update if we actually removed messages
          if (realMessages.length === prev.length) {
            return prev;
          }
          
          return realMessages;
        });
        
        lastProcessedMessagesRef.current = 'empty';
      }
    } else if (!initialMessages || !Array.isArray(initialMessages)) {
      if (__DEV__) {
        console.warn('⚠️ initialMessages is not a valid array:', initialMessages);
      }
    }
  }, [initialMessages, initialMessagesIds]);

  // Step 6: Send message
  // Backend requires chatId - if chat doesn't exist, we need to create it first
  // For now, if chat._id is null, we'll try to create/find the chat before sending
  const sendMessage = useCallback(async (messageText, replyTo = null) => {
    if (!messageText?.trim() || !chat || !user) {
      return false;
    }

    // If chat doesn't have an _id yet, we need to create it first
    // Backend creates chat automatically, but we need to find it or create it
    let actualChatId = chat._id;
    
    if (!actualChatId) {
      if (__DEV__) {
        console.log('⚠️ Chat not created yet, need to create it first');
      }
      
      // Try to create the chat by fetching it from the list again
      // Or we can try to send with enquiryId and let backend handle it
      // For now, we'll refetch the chat list to see if it was created
      try {
        const token = await AsyncStorage.getItem('token');
        const type = getChatType();
        const searchParams = new URLSearchParams({
          type: type,
          search: enquiryId,
          limit: '10',
        });

        const response = await fetch(`${API_BASE_URL}/api/chats?${searchParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          const chats = result.Data || result.data || result;
          const foundChat = Array.isArray(chats) 
            ? chats.find(c => String(c.EnquiryId || c.enquiryId).trim() === String(enquiryId).trim())
            : null;
          
          if (foundChat?._id) {
            actualChatId = foundChat._id;
            // Update chat state
            setChat(prev => ({
              ...prev,
              _id: foundChat._id,
              EnquiryName: foundChat.EnquiryName || foundChat.enquiryTitle || prev.EnquiryName,
            }));
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Error fetching chat before sending message:', error);
        }
      }

      // If still no chatId, we can't send the message
      if (!actualChatId) {
        if (__DEV__) {
          console.error('❌ Cannot send message: chat not found and cannot be created');
        }
        return false;
      }
    }

    // Optimistically add message to local state (will be replaced by server response)
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      _id: tempMessageId,
      id: tempMessageId,
      Message: messageText.trim(),
      message: messageText.trim(),
      text: messageText.trim(),
      SenderId: user.id,
      senderId: user.id,
      SenderName: user.name || user.email || 'You',
      senderName: user.name || user.email || 'You',
      Timestamp: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      MessageType: 'text',
      messageType: 'text',
      IsRead: false,
      isRead: false,
      ChatId: actualChatId,
      chatId: actualChatId,
      status: 'sending',
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);

    // Send via WebSocket (backend only accepts WebSocket messages)
    const sent = socketService.sendMessage({
      chatId: actualChatId,
      userId: user.id,
      message: messageText.trim(),
      messageType: 'text',
      parentMessageId: replyTo?._id || replyTo?.id || null,
    });

    if (!sent) {
      if (__DEV__) {
        console.error('❌ Cannot send message: WebSocket not connected');
      }
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessageId 
          ? { ...msg, status: 'failed' }
          : msg
      ));
      return false;
    }

    // Always refetch from API after sending to ensure UI updates
    // This is a fallback in case WebSocket event is not received
    const refetchDelay = 2000; // Wait for WebSocket event first
    
    const refetchTimeout = setTimeout(() => {
      if (__DEV__) {
        console.log('🔄 Refetching messages after send (ensuring UI updates)');
      }
      refetchMessages().then(() => {
        if (__DEV__) {
          console.log('✅ Messages refetched successfully');
        }
      }).catch(err => {
        if (__DEV__) {
          console.warn('⚠️ Failed to refetch messages after sending:', err);
        }
      });
    }, refetchDelay);
    
    // Store timeout ID so we can clear it if WebSocket event is received
    optimisticMessage._refetchTimeout = refetchTimeout;

    if (__DEV__) {
      console.log('✅ Message sent via WebSocket, will refetch from API as fallback');
    }

    return true;
  }, [chat, user, refetchMessages, enquiryId, getChatType]);

  // Step 7: Send media
  const sendMedia = useCallback(async (file) => {
    if (!file || !chat?._id || !user) {
      if (__DEV__) {
        console.warn('⚠️ Cannot send media: missing file, chat, or user', {
          hasFile: !!file,
          hasChat: !!chat?._id,
          hasUser: !!user,
        });
      }
      return false;
    }

    try {
      if (__DEV__) {
        console.log('📤 Starting media upload:', {
          name: file.name,
          type: file.type,
          size: file.size,
          messageType: file.messageType,
        });
      }

      // Upload media first
      const uploadResult = await uploadChatMedia({
        uri: file.uri,
        type: file.type || 'image/jpeg',
        name: file.name || `file_${Date.now()}.jpg`,
      }).unwrap();

      if (__DEV__) {
        console.log('✅ Media upload result:', uploadResult);
      }

      // Determine message type from file or upload result
      let messageType = file.messageType || 'file';
      if (!messageType) {
        // Fallback: determine from file type
        if (file.type?.startsWith('image/')) {
          messageType = 'image';
        } else if (file.type?.startsWith('video/')) {
          messageType = 'video';
        } else {
          messageType = 'file';
        }
      }

      // Extract media metadata from upload result
      const mediaUrl = uploadResult.Url || uploadResult.url || uploadResult.key;
      const mediaName = uploadResult.name || file.name || 'Media file';
      const mediaKey = uploadResult.key || uploadResult.Key || mediaUrl;
      const mediaSize = uploadResult.size || file.size || 0;

      if (__DEV__) {
        console.log('📨 Sending message with media:', {
          chatId: chat._id,
          messageType,
          mediaName,
          mediaUrl,
          mediaKey,
          mediaSize,
        });
      }

      // Send message with media via WebSocket
      const sent = socketService.sendMessage({
        chatId: chat._id,
        userId: user.id,
        message: mediaName, // Use file name as message text
        messageType: messageType,
        parentMessageId: null,
        mediaUrl: mediaUrl,
        mediaName: mediaName,
        mediaKey: mediaKey,
        mediaSize: mediaSize,
      });

      if (!sent) {
        if (__DEV__) {
          console.warn('⚠️ WebSocket not connected, media sent but may not appear in real-time');
        }
        // Still return true - media was uploaded successfully
        // The message will appear when messages are refetched from API
      } else {
        if (__DEV__) {
          console.log('✅ Media message sent via WebSocket');
        }
      }

      // Refetch messages after a delay to ensure the new message appears
      setTimeout(() => {
        refetchMessages();
      }, 1500);

      return true;
    } catch (error) {
      console.error('❌ Error sending media:', error);
      if (__DEV__) {
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          data: error.data,
        });
      }
      return false;
    }
  }, [chat?._id, user, uploadChatMedia, refetchMessages]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    if (!chat?._id || !user) return;
    socketService.sendTyping(chat._id, user.id, isTyping);
  }, [chat?._id, user]);

  // Load chat on mount or when enquiryId or chatId changes
  useEffect(() => {
    if (enquiryId && user) {
      fetchChat();
    }
  }, [enquiryId, chatId, user, fetchChat]);

  // Refetch messages when chat is loaded or screen is revisited
  const chatIdRef = useRef(null);
  useEffect(() => {
    // Only refetch if chatId actually changed (not on every render)
    if (chat?._id && chat._id !== chatIdRef.current && !messagesLoading) {
      chatIdRef.current = chat._id;
      // Reset processed messages ref and cursor when chat changes
      lastProcessedMessagesRef.current = null;
      setNextCursor(null);
      // Refetch messages when chat is first loaded or when user revisits
      // This ensures we have the latest persisted messages from the database
      const timer = setTimeout(() => {
        if (__DEV__) {
          console.log('🔄 Refetching messages for chat:', chat._id);
        }
        refetchMessages();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chat?._id, messagesLoading]); // Removed refetchMessages from deps to prevent loops

  // Load more messages (older messages) using pagination
  const loadMoreMessages = useCallback(async () => {
    if (!chat?._id || !nextCursor || isLoadingMore || messagesLoading) {
      if (__DEV__) {
        console.log('⏭️ Skipping loadMoreMessages:', {
          hasChat: !!chat?._id,
          hasCursor: !!nextCursor,
          isLoadingMore,
          messagesLoading
        });
      }
      return false;
    }

    setIsLoadingMore(true);
    
    try {
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(
        `${API_BASE_URL}/api/message/${chat._id}/messages?before=${nextCursor}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const responseText = await response.text();
      
      // Check if response is HTML (404 page or error page)
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html') || responseText.includes('Cannot GET')) {
        if (__DEV__) {
          console.warn('⚠️ Backend returned HTML when loading more messages');
        }
        setIsLoadingMore(false);
        return false;
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        if (__DEV__) {
          console.error('❌ Failed to parse response as JSON:', parseError);
        }
        setIsLoadingMore(false);
        return false;
      }

      // Extract messages array
      let messagesArray = [];
      let newNextCursor = null;
      
      if (data && data.Data && Array.isArray(data.Data)) {
        messagesArray = data.Data;
        newNextCursor = data.NextCursor || null;
      } else if (Array.isArray(data)) {
        messagesArray = data;
      }

      if (messagesArray.length > 0) {
        // Transform messages to match our format
        const transformedMessages = messagesArray.map((message) => {
          const messageId = message._id?.$oid || message._id || message.id;
          const senderId = message.senderId?.$oid || message.senderId || message.SenderId;
          
          let timestamp = message.timestamp;
          if (timestamp?.$date) {
            timestamp = timestamp.$date;
          } else if (timestamp?.Timestamp) {
            timestamp = timestamp.Timestamp;
          } else if (typeof timestamp === 'string') {
            timestamp = timestamp;
          } else {
            timestamp = new Date().toISOString();
          }

          const messageType = message.messageType || message.MessageType || message.type || 'text';
          let text = message.message || message.Message || message.text || '';

          return {
            _id: messageId,
            id: messageId,
            Message: text,
            message: text,
            text: text,
            SenderId: senderId,
            senderId: senderId,
            SenderName: message.senderName || message.SenderName || message.sender?.name || 'Unknown',
            senderName: message.senderName || message.SenderName || message.sender?.name || 'Unknown',
            SenderRole: message.senderRole || message.SenderRole || message.sender?.role || 'user',
            senderRole: message.senderRole || message.SenderRole || message.sender?.role || 'user',
            Timestamp: timestamp,
            timestamp: timestamp,
            MessageType: messageType,
            messageType: messageType,
            Media: message.Media || null,
            media: message.Media || null,
            mediaUrl: message.Media?.Url || message.media?.url || message.mediaUrl,
            mediaSize: message.Media?.Size || message.media?.size || message.mediaSize,
            IsRead: message.IsRead || message.isRead || false,
            isRead: message.IsRead || message.isRead || false,
            ReplyTo: message.ReplyTo || message.replyTo || null,
            replyTo: message.ReplyTo || message.replyTo || null,
            ChatId: message.ChatId || message.chatId || chat._id,
            chatId: message.ChatId || message.chatId || chat._id,
            status: message.status || message.Status || 'sent',
            isGroup: message.isGroup || message.IsGroup || false,
            _originalData: message,
          };
        });

        // Prepend older messages to the beginning of the array
        setMessages(prev => {
          const existingMap = new Map();
          // Add existing messages
          prev.forEach(msg => {
            const id = msg._id || msg.id;
            if (id) existingMap.set(id, msg);
          });
          // Add new older messages (they should be older, so prepend)
          transformedMessages.forEach(msg => {
            const id = msg._id || msg.id;
            if (id) existingMap.set(id, msg);
          });
          
          const merged = Array.from(existingMap.values());
          const sorted = merged.sort((a, b) => {
            const timeA = new Date(a.Timestamp || a.timestamp || 0);
            const timeB = new Date(b.Timestamp || b.timestamp || 0);
            return timeA - timeB;
          });
          
          return sorted;
        });

        // Update cursor
        setNextCursor(newNextCursor);
        
        if (__DEV__) {
          console.log('✅ Loaded more messages:', {
            count: messagesArray.length,
            newNextCursor,
            hasMore: newNextCursor !== null
          });
        }
        
        setIsLoadingMore(false);
        return true;
      } else {
        // No more messages
        setNextCursor(null);
        setIsLoadingMore(false);
        if (__DEV__) {
          console.log('📭 No more messages to load');
        }
        return false;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error loading more messages:', error);
      }
      setIsLoadingMore(false);
      return false;
    }
  }, [chat?._id, nextCursor, isLoadingMore, messagesLoading]);

  return {
    // State
    chat,
    messages,
    isLoadingChat,
    messagesLoading,
    chatError,
    isTyping,
    isUploading,
    nextCursor, // Cursor for pagination (null when no more messages)
    isLoadingMore, // Loading state for pagination
    hasMore: nextCursor !== null && nextCursor !== undefined, // Whether more messages are available
    
    // Methods
    sendMessage,
    sendMedia,
    sendTyping,
    refetchChat: fetchChat,
    refetchMessages,
    loadMoreMessages, // Load older messages using pagination
  };
};

