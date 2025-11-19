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
 * @param {object} initialChat - Optional: Initial chat object (e.g., routeChat) to use immediately
 * @returns {object} Chat state and methods
 */
export const useChat = (enquiryId, chatType, chatId = null, initialChat = null) => {
  const { user } = useAuth();
  // Initialize chat state with initialChat or chatId if provided (for immediate message loading)
  const [chat, setChat] = useState(() => {
    // If we have initialChat with an ID, use it immediately
    if (initialChat && (initialChat._id || initialChat.id)) {
      const chatIdValue = initialChat._id || initialChat.id;
      if (__DEV__) {
        console.log('✅ Using initialChat:', chatIdValue);
      }
      return {
        ...initialChat,
        _id: chatIdValue,
        id: chatIdValue,
      };
    }
    // Otherwise, create minimal chat object with chatId if provided
    if (chatId) {
      if (__DEV__) {
        console.log('✅ Initializing chat with chatId:', chatId);
      }
      return {
        _id: chatId,
        id: chatId,
        EnquiryId: enquiryId,
        Type: chatType,
      };
    }
    return null;
  });
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
    
    if (role === 'client') {
      return 'admin-client';
    }
    
    if (role === 'coral' || role === 'cad' || role === 'worker' || role === 'designer') {
      return 'admin-designer';
    }
    
    if (role === 'admin') {
      return chatType || 'admin-client';
    }
    
    return chatType || 'admin-client';
  }, [user, chatType]);

  // Fetch chat by enquiry ID
  const fetchChat = useCallback(async () => {
    if (!enquiryId || !user) {
      if (__DEV__) {
        console.log('⚠️ fetchChat skipped - missing enquiryId or user:', { enquiryId, hasUser: !!user });
      }
      return;
    }
    
    // Use getChatType() to determine type if chatType is not provided
    const type = chatType || getChatType();
    if (!type) {
      if (__DEV__) {
        console.warn('⚠️ fetchChat skipped - could not determine chat type');
      }
      return;
    }

    if (__DEV__) {
      console.log('🔍 fetchChat called:', { enquiryId, chatId, chatType, resolvedType: type });
    }

    setIsLoadingChat(true);
    setChatError(null);

    try {
      const token = await AsyncStorage.getItem('token');

      // If we have a direct chatId, fetch that specific chat first
      if (chatId) {
        try {
          if (__DEV__) {
            console.log('🔍 Fetching chat by ID:', chatId);
          }
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
              const chatIdValue = foundChat._id || foundChat.id;
              if (__DEV__) {
                console.log('✅ Chat found by ID:', { chatId: chatIdValue, chat: foundChat });
              }
              // Ensure _id is set
              setChat({ ...foundChat, _id: chatIdValue, id: chatIdValue });
              setIsLoadingChat(false);
              return;
            } else {
              if (__DEV__) {
                console.warn('⚠️ Chat response OK but no _id found:', foundChat);
              }
            }
          } else {
            if (__DEV__) {
              console.warn('⚠️ Chat fetch by ID failed:', chatResponse.status, chatResponse.statusText);
            }
          }
        } catch (chatIdError) {
          if (__DEV__) {
            console.warn('⚠️ Error fetching chat by ID:', chatIdError.message);
          }
        }
      }

      // Search for chat by enquiry ID
      const searchParams = new URLSearchParams({
        type: type,
        search: enquiryId,
        limit: '50',
      });

      if (__DEV__) {
        console.log('🔍 Searching chats by enquiry ID:', { type, enquiryId });
      }

      const response = await fetch(`${API_BASE_URL}/api/chats?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        const chats = result.Data || result.data || result;
        
        if (__DEV__) {
          console.log('📋 Chats search result:', { 
            chatsCount: Array.isArray(chats) ? chats.length : 'not array',
            chats: Array.isArray(chats) ? chats.map(c => ({ id: c._id || c.id, type: c.Type || c.type })) : chats
          });
        }
        
        let foundChat = null;
        
        // Try to find by chatId first
        if (chatId && Array.isArray(chats)) {
          foundChat = chats.find(chat => {
            const cId = chat._id || chat.id;
            return String(cId).trim() === String(chatId).trim();
          });
          if (foundChat && __DEV__) {
            console.log('✅ Found chat by chatId in search results');
          }
        }
        
        // Fallback to finding by enquiryId
        if (!foundChat && Array.isArray(chats)) {
          foundChat = chats.find(chat => {
            const chatEnquiryId = chat.EnquiryId || chat.enquiryId;
            const chatTypeValue = chat.Type || chat.type;
            return String(chatEnquiryId).trim() === String(enquiryId).trim() &&
                   String(chatTypeValue).trim() === String(type).trim();
          });
          if (foundChat && __DEV__) {
            console.log('✅ Found chat by enquiryId and type in search results');
          }
        }

        if (foundChat) {
          const chatIdValue = foundChat._id || foundChat.id;
          if (__DEV__) {
            console.log('✅ Chat found by enquiry ID:', { chatId: chatIdValue, chat: foundChat });
          }
          // Ensure _id is set
          setChat({ ...foundChat, _id: chatIdValue, id: chatIdValue });
          setIsLoadingChat(false);
          return;
        } else {
          if (__DEV__) {
            console.warn('⚠️ No chat found in search results');
          }
        }
      } else {
        if (__DEV__) {
          console.warn('⚠️ Chat search failed:', response.status, response.statusText);
        }
      }

      // Create virtual chat if not found (but only if we have a chatId)
      // Without a real chatId, we can't load messages anyway
      if (chatId) {
        if (__DEV__) {
          console.log('📝 Creating virtual chat with chatId:', chatId);
        }
        const virtualChat = {
          _id: chatId,
          id: chatId,
          EnquiryId: enquiryId,
          EnquiryName: 'New Chat',
          Type: type,
          CreatedAt: new Date().toISOString(),
        };
        setChat(virtualChat);
        setChatError(null);
      } else {
        if (__DEV__) {
          console.warn('⚠️ Cannot create virtual chat - no chatId provided');
        }
        setChat(null);
        setChatError('Chat not found and no chatId provided');
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error fetching chat:', error);
      }
      // Only create fallback if we have a chatId
      if (chatId) {
        const fallbackChat = {
          _id: chatId,
          id: chatId,
          EnquiryId: enquiryId,
          EnquiryName: 'Chat',
          Type: type,
          CreatedAt: new Date().toISOString(),
        };
        setChat(fallbackChat);
      } else {
        setChat(null);
      }
      setChatError(error.message || 'Failed to fetch chat');
    } finally {
      setIsLoadingChat(false);
    }
  }, [enquiryId, user, chatId, chatType, getChatType]);

  // Load messages from API - RTK Query handles caching automatically
  // Use both _id and id to handle different response formats
  // Also use chatId parameter directly if chat state isn't ready yet (for immediate loading)
  const chatIdForQuery = chat?._id || chat?.id || chatId || (initialChat?._id || initialChat?.id);
  const { data: apiMessages, isLoading: messagesLoading, refetch: refetchMessages, error: messagesError } = useGetChatMessagesQuery(
    { chatId: chatIdForQuery, limit: 20 },
    {
      skip: !chatIdForQuery,
      refetchOnFocus: true, // Refetch when screen is focused
      refetchOnMountOrArgChange: true, // Refetch when chatId changes
    }
  );

  // Debug logging for messages query
  useEffect(() => {
    if (__DEV__) {
      console.log('📨 Messages Query State:', {
        chatId: chatIdForQuery,
        chatIdForQuery,
        chatHasId: !!chat?._id,
        chatHasIdAlt: !!chat?.id,
        skip: !chatIdForQuery,
        isLoading: messagesLoading,
        messagesCount: apiMessages?.length || 0,
        error: messagesError ? { message: messagesError.message, data: messagesError.data } : null,
      });
    }
  }, [chatIdForQuery, messagesLoading, apiMessages?.length, messagesError]);

  const refetchMessagesRef = useRef(refetchMessages);
  useEffect(() => {
    refetchMessagesRef.current = refetchMessages;
  }, [refetchMessages]);

  // Track last processed API messages to prevent unnecessary updates
  const lastApiMessagesRef = useRef(null);
  const lastChatIdRef = useRef(null);
  
  // SIMPLIFIED: Always show messages when API provides them
  useEffect(() => {
    // Debug logging
      if (__DEV__) {
      console.log('🔍 Message Effect Trigger:', {
        chatId: chatIdForQuery,
        chatIdForQuery,
        apiMessagesType: typeof apiMessages,
        apiMessagesIsArray: Array.isArray(apiMessages),
        apiMessagesLength: apiMessages?.length || 0,
        currentMessagesLength: messages.length,
        messagesLoading,
        lastChatId: lastChatIdRef.current,
        lastApiIds: lastApiMessagesRef.current?.substring(0, 50),
      });
    }

    if (!chatIdForQuery) {
      if (messages.length > 0) {
        setMessages([]);
      }
      lastChatIdRef.current = null;
      lastApiMessagesRef.current = null;
      return;
    }

    // Track chat changes
    const chatChanged = lastChatIdRef.current !== chatIdForQuery;
    if (chatChanged) {
      lastChatIdRef.current = chatIdForQuery;
      lastApiMessagesRef.current = null; // Always reset on chat change
      if (__DEV__) {
        console.log('🔄 Chat changed:', chatIdForQuery);
      }
    }

    // Process API messages - SIMPLIFIED LOGIC
    if (apiMessages && Array.isArray(apiMessages)) {
      const apiMessagesIds = apiMessages.length > 0
        ? apiMessages.map(msg => msg._id || msg.id).filter(Boolean).join(',')
        : 'empty';
      
      // ALWAYS update if:
      // - Chat changed
      // - Messages are empty  
      // - API messages IDs changed
      const shouldUpdate = chatChanged || messages.length === 0 || apiMessagesIds !== lastApiMessagesRef.current;
      
      if (shouldUpdate) {
        if (__DEV__) {
          console.log('✅ UPDATING MESSAGES:', {
            apiCount: apiMessages.length,
            currentCount: messages.length,
            reason: chatChanged ? 'chat changed' : messages.length === 0 ? 'empty state' : 'api changed',
            firstMessage: apiMessages[0] || null,
          });
        }

        setMessages(prevMessages => {
          const messageMap = new Map();
          
          // Add API messages first (source of truth)
          apiMessages.forEach(msg => {
            const id = msg._id || msg.id;
            if (id && !String(id).startsWith('temp-')) {
              messageMap.set(id, msg);
            }
          });

          // Add WebSocket messages that aren't in API
          prevMessages.forEach(msg => {
            const id = msg._id || msg.id;
            if (id && String(id).startsWith('temp-')) {
              messageMap.set(id, msg); // Keep optimistic
            } else if (id && !messageMap.has(id)) {
              messageMap.set(id, msg); // Keep WebSocket-only
            }
          });
          
          const merged = Array.from(messageMap.values()).sort((a, b) => {
            const timeA = new Date(a.Timestamp || a.timestamp || 0);
            const timeB = new Date(b.Timestamp || b.timestamp || 0);
            return timeA - timeB;
          });
          
          if (__DEV__) {
            console.log('✅ Messages set:', merged.length, 'messages');
          }
          
          return merged;
        });
        
        lastApiMessagesRef.current = apiMessagesIds;
        
        // Set cursor
        if (apiMessages[0]?._nextCursor !== undefined) {
          setNextCursor(apiMessages[0]._nextCursor || null);
        } else if (apiMessages.length > 0) {
          const timestamp = apiMessages[0].Timestamp || apiMessages[0].timestamp;
          if (timestamp) setNextCursor(timestamp);
          else setNextCursor(null);
        } else {
          setNextCursor(null);
        }
      } else {
        if (__DEV__) {
          console.log('⏭️ Skipping - no change needed');
        }
      }
    } else if (Array.isArray(apiMessages) && apiMessages.length === 0) {
      // Empty response - only clear temp messages
      if (lastApiMessagesRef.current !== 'empty') {
        setMessages(prev => prev.filter(msg => {
          const id = msg._id || msg.id;
          return !id || !String(id).startsWith('temp-');
        }));
        lastApiMessagesRef.current = 'empty';
        setNextCursor(null);
      }
    }
  }, [apiMessages, chatIdForQuery]);

  // Socket connection and event handlers
  useEffect(() => {
    if (!chatIdForQuery || !user) return;

    const setupSocket = async () => {
    if (!socketService.isConnected()) {
      try {
          if (__DEV__) {
            console.log('🔌 Connecting to socket for chat:', chatIdForQuery);
          }
          await socketService.connect(user.id);
          if (__DEV__) {
            console.log('✅ Socket connected');
          }
      } catch (err) {
        if (__DEV__) {
            console.warn('⚠️ Socket connection failed:', err.message);
        }
      }
    }

      if (socketService.isConnected() && chatIdForQuery) {
        if (__DEV__) {
          console.log('🚪 Joining chat room:', chatIdForQuery);
        }
    socketService.joinChat(chatIdForQuery, user.id);
      }
    };

    setupSocket();

    const handleNewMessage = (message) => {
      if (__DEV__) {
        console.log('📨 WebSocket message received:', message);
      }
      
      const messageChatId = String(message.ChatId || message.chatId || message.EnquiryId || message.enquiryId || '').trim();
      const currentChatId = String(chatIdForQuery || '').trim();
      
      if (messageChatId !== currentChatId) {
      if (__DEV__) {
          console.log('⚠️ Message ignored - chatId mismatch:', messageChatId, 'vs', currentChatId);
        }
        return;
      }

      // Normalize message format
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
        status: 'sent',
        };

        setMessages(prev => {
          const newMsgId = normalizedMessage._id || normalizedMessage.id;
          
        if (!newMsgId) {
          return prev; // Invalid message, skip
        }

        // Check if message already exists (by ID)
          const existingIndex = prev.findIndex(msg => {
            const msgId = msg._id || msg.id;
          return String(msgId) === String(newMsgId);
          });
          
          if (existingIndex !== -1) {
          // Update existing message (WebSocket might have newer data)
          return prev.map((msg, index) => 
            index === existingIndex ? normalizedMessage : msg
          );
        }
        
        // Check for optimistic message to replace
          const optimisticIndex = prev.findIndex(msg => {
            const msgId = msg._id || msg.id;
          return String(msgId).startsWith('temp-') && 
                   msg.Message === normalizedMessage.Message &&
                 String(msg.SenderId) === String(normalizedMessage.SenderId);
          });
          
          if (optimisticIndex !== -1) {
            // Replace optimistic message with real one
          return prev.map((msg, index) => 
            index === optimisticIndex ? normalizedMessage : msg
          ).sort((a, b) => {
              const timeA = new Date(a.Timestamp || a.timestamp || 0);
              const timeB = new Date(b.Timestamp || b.timestamp || 0);
              return timeA - timeB;
            });
          }
          
        // Add new message (from WebSocket)
        const updated = [...prev, normalizedMessage];
          return updated.sort((a, b) => {
            const timeA = new Date(a.Timestamp || a.timestamp || 0);
            const timeB = new Date(b.Timestamp || b.timestamp || 0);
            return timeA - timeB;
          });
        });

      // Trigger refetch to sync with API (but don't wait for it)
      // This ensures API and WebSocket stay in sync
      setTimeout(() => {
        try {
          const refetchFn = refetchMessagesRef.current;
          if (refetchFn && typeof refetchFn === 'function') {
            refetchFn();
          }
        } catch (error) {
        if (__DEV__) {
            console.warn('⚠️ Could not refetch after WebSocket message:', error.message);
        }
      }
      }, 500);
    };

    const handleMessagesRead = (data) => {
      if (data.chatId === chatIdForQuery) {
        setMessages(prev => prev.map(msg => {
          if (data.userIds && data.userIds.includes(msg.SenderId || msg.senderId)) {
            return { ...msg, IsRead: true, isRead: true };
          }
          return msg;
        }));
      }
    };

    const handleUserTyping = (data) => {
      if (data.userId !== user.id && data.chatId === chatIdForQuery) {
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

    // Register event listeners
    socketService.on('newMessage', handleNewMessage);
    socketService.on('messagesRead', handleMessagesRead);
    socketService.on('userTyping', handleUserTyping);
    
    if (__DEV__) {
      console.log('✅ Registered WebSocket listeners for chat:', chatIdForQuery);
    }

    // Cleanup
    return () => {
      socketService.off('newMessage', handleNewMessage);
      socketService.off('messagesRead', handleMessagesRead);
      socketService.off('userTyping', handleUserTyping);
      
      if (chatIdForQuery) {
        socketService.leaveChat(chatIdForQuery, user.id);
      }
    };
  }, [chatIdForQuery, user]);

  // Send message
  const sendMessage = useCallback(async (messageText, replyTo = null) => {
    if (!messageText?.trim() || !chat || !user) {
      return false;
    }

    let actualChatId = chatIdForQuery;
    
    // If chat doesn't exist yet, try to find/create it
    if (!actualChatId) {
      try {
        const token = await AsyncStorage.getItem('token');
        const type = chatType;
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
            setChat(prev => ({
              ...prev,
              _id: foundChat._id,
              EnquiryName: foundChat.EnquiryName || foundChat.enquiryTitle || prev.EnquiryName,
            }));
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Error fetching chat:', error);
        }
      }

      if (!actualChatId) {
        if (__DEV__) {
          console.error('❌ Cannot send message: chat not found');
        }
        return false;
      }
    }

    // Create optimistic message
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

    // Send via WebSocket
    const sent = socketService.sendMessage({
      chatId: actualChatId,
      userId: user.id,
      message: messageText.trim(),
      messageType: 'text',
      parentMessageId: replyTo?._id || replyTo?.id || null,
    });

    if (!sent) {
      // Mark message as failed
      setMessages(prev => prev.map(msg => 
        msg._id === tempMessageId 
          ? { ...msg, status: 'failed' }
          : msg
      ));
      return false;
    }

    // Refetch as backup after delay
    setTimeout(() => {
      try {
        const refetchFn = refetchMessagesRef.current;
        if (refetchFn && typeof refetchFn === 'function') {
          refetchFn();
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('⚠️ Could not refetch after sending:', error.message);
        }
      }
    }, 2000);

    return true;
  }, [chat, chatIdForQuery, user, enquiryId, chatType]);

  // Send media
  const sendMedia = useCallback(async (file) => {
    if (!file || !chatIdForQuery || !user) {
      return false;
    }

    try {
      const uploadResult = await uploadChatMedia({
        uri: file.uri,
        type: file.type || 'image/jpeg',
        name: file.name || `file_${Date.now()}.jpg`,
      }).unwrap();

      let messageType = file.messageType || 'file';
      if (!messageType) {
        if (file.type?.startsWith('image/')) {
          messageType = 'image';
        } else if (file.type?.startsWith('video/')) {
          messageType = 'video';
        }
      }

      const mediaUrl = uploadResult.Url || uploadResult.url || uploadResult.key;
      const mediaName = uploadResult.name || file.name || 'Media file';
      const mediaKey = uploadResult.key || uploadResult.Key || mediaUrl;

      const sent = socketService.sendMessage({
        chatId: chatIdForQuery,
        userId: user.id,
        message: mediaName,
        messageType: messageType,
        parentMessageId: null,
        mediaUrl: mediaUrl,
        mediaName: mediaName,
        mediaKey: mediaKey,
        mediaSize: uploadResult.size || file.size || 0,
      });

      if (sent) {
        // Refetch after delay to ensure message appears
        setTimeout(() => {
          try {
            const refetchFn = refetchMessagesRef.current;
            if (refetchFn && typeof refetchFn === 'function') {
              refetchFn();
            }
          } catch (error) {
        if (__DEV__) {
              console.warn('⚠️ Could not refetch after sending media:', error.message);
        }
      }
      }, 1500);
      }

      return sent;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error sending media:', error);
      }
      return false;
    }
  }, [chatIdForQuery, user, uploadChatMedia]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    if (!chatIdForQuery || !user) return;
    socketService.sendTyping(chatIdForQuery, user.id, isTyping);
  }, [chatIdForQuery, user]);

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!chatIdForQuery || !nextCursor || isLoadingMore || messagesLoading) {
      return false;
    }

    setIsLoadingMore(true);
    
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/message/${chatIdForQuery}/messages?before=${nextCursor}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const messagesArray = data.Data || data.data || data;

      if (Array.isArray(messagesArray) && messagesArray.length > 0) {
        setMessages(prev => {
          // Merge old messages with new ones (deduplicate)
          const messageMap = new Map();
          
          // Add existing messages
          prev.forEach(msg => {
            const id = msg._id || msg.id;
            if (id) messageMap.set(id, msg);
          });
          
          // Add new messages (older messages)
          messagesArray.forEach(msg => {
            const id = msg._id || msg.id;
            if (id) messageMap.set(id, msg);
          });
          
          return Array.from(messageMap.values()).sort((a, b) => {
            const timeA = new Date(a.Timestamp || a.timestamp || 0);
            const timeB = new Date(b.Timestamp || b.timestamp || 0);
            return timeA - timeB;
          });
        });

        setNextCursor(data.NextCursor || null);
        setIsLoadingMore(false);
        return true;
      }
      
        // No more messages
        setNextCursor(null);
        setIsLoadingMore(false);
        return false;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error loading more messages:', error);
      }
      setIsLoadingMore(false);
      return false;
    }
  }, [chatIdForQuery, nextCursor, isLoadingMore, messagesLoading]);

  // Update chat when chatId or initialChat changes (e.g., when navigating with routeChat)
  useEffect(() => {
    // If initialChat is provided and different from current chat, use it
    if (initialChat && (initialChat._id || initialChat.id)) {
      const initialChatId = initialChat._id || initialChat.id;
      if (!chat?._id || chat._id !== initialChatId) {
        if (__DEV__) {
          console.log('🔄 initialChat changed, updating chat state:', initialChatId);
        }
        setChat({
          ...initialChat,
          _id: initialChatId,
          id: initialChatId,
        });
        return;
      }
    }
    
    // Otherwise, update chat with chatId if it changed
    if (chatId && (!chat?._id || chat._id !== chatId)) {
      if (__DEV__) {
        console.log('🔄 chatId changed, updating chat state:', chatId);
      }
      // Update chat with chatId immediately so messages can load
      setChat(prev => ({
        ...prev,
        _id: chatId,
        id: chatId,
        EnquiryId: enquiryId || prev?.EnquiryId,
        Type: chatType || prev?.Type,
      }));
    }
  }, [chatId, initialChat, enquiryId, chatType, chat?._id]);

  // Load chat on mount
  useEffect(() => {
    if (enquiryId && user) {
      fetchChat();
    }
  }, [enquiryId, chatId, user, fetchChat]);

  // Force refetch when chat is loaded and messages are empty (remount scenario)
  const forceRefetchDoneRef = useRef(null);
  useEffect(() => {
    if (!chatIdForQuery) return;
    
    // Reset ref when chat changes
    if (forceRefetchDoneRef.current !== chatIdForQuery && forceRefetchDoneRef.current !== null) {
      forceRefetchDoneRef.current = null;
    }
    
    // Force refetch if messages are empty and query is not loading
    // This handles the remount scenario where component remounts with empty state
    if (messages.length === 0 && !messagesLoading && forceRefetchDoneRef.current !== chatIdForQuery) {
      if (__DEV__) {
        console.log('🔄 Force refetch triggered - empty messages detected:', {
          chatId: chatIdForQuery,
          messagesLoading,
          apiMessages: apiMessages?.length || 0,
        });
      }
      
      // Small delay to ensure query is ready
      const timer = setTimeout(() => {
        try {
          const refetchFn = refetchMessagesRef.current;
          if (refetchFn && typeof refetchFn === 'function') {
            if (__DEV__) {
              console.log('🔄 Executing force refetch for chat:', chatIdForQuery);
            }
            refetchFn().then(() => {
              if (__DEV__) {
                console.log('✅ Force refetch completed');
              }
            }).catch(err => {
              if (__DEV__) {
                console.warn('⚠️ Force refetch failed:', err.message);
              }
            });
            forceRefetchDoneRef.current = chatIdForQuery; // Mark as done for this chat
          } else {
            if (__DEV__) {
              console.warn('⚠️ Refetch function not available');
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('⚠️ Could not force refetch:', error.message);
          }
        }
      }, 500); // Increased delay to ensure query is initialized
      return () => clearTimeout(timer);
    }
  }, [chatIdForQuery, messages.length, messagesLoading, apiMessages]);

  // Debug: Log messages state changes
  useEffect(() => {
    if (__DEV__) {
      console.log('📊 MESSAGES STATE:', {
        count: messages.length,
        chatId: chatIdForQuery,
        apiMessagesCount: apiMessages?.length || 0,
        messagesLoading,
        sample: messages.length > 0 ? messages[0] : null,
      });
    }
  }, [messages.length, chatIdForQuery, apiMessages?.length, messagesLoading]);

  return {
    chat,
    messages,
    isLoadingChat,
    messagesLoading,
    chatError: chatError || messagesError,
    isTyping,
    isUploading,
    nextCursor,
    isLoadingMore,
    hasMore: nextCursor !== null && nextCursor !== undefined,
    sendMessage,
    sendMedia,
    sendTyping,
    refetchChat: fetchChat,
    refetchMessages,
    loadMoreMessages,
  };
};
