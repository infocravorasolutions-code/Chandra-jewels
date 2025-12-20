import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Text,
  Dimensions,
  StatusBar,
  ImageBackground,
  Keyboard,
  Image,
  Linking,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useGetClientsQuery, useGetEnquiryByIdQuery } from '../../store/api';
import { useChat } from '../../hooks/useChat';
import { useAlert } from '../../context/AlertContext';
import socketService from '../../services/socketService';
import { Card } from '../../components/cards/Cards';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, spacing, responsivePadding } from '../../utils';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { FILE_BASE_URL } from '../../config/apiConfig';
import { getUserName } from '../../utils/userUtils';
import { SwipeableMessage, EmptyState, ChatHeader } from '../../components/chat';
import { useMessageScroll } from '../../hooks/useMessageScroll';
import { formatMessageTime, getMessageStatusIcon, getMessageStatusColor, getSenderColor, isMyMessage as checkIsMyMessage, formatReadTimestamp } from '../../utils/messageUtils';

// Safely get window dimensions
let width = 375; // Default width
try {
  const windowDimensions = Dimensions.get('window');
  width = windowDimensions?.width || 375;
} catch (error) {
  if (__DEV__) {
    console.warn('Failed to get window dimensions:', error);
  }
}

const ChatDetailScreen = ({ route, navigation }) => {
  // Hooks must be called unconditionally at the top level
  const authResult = useAuth();
  const user = authResult?.user;
  const alert = useAlert();
  
  // Early return if critical dependencies are missing
  if (!route) {
    if (__DEV__) {
      console.error('ChatDetailScreen: route is missing');
    }
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors?.background || '#fff' }}>
        <Text style={{ color: colors?.textPrimary || '#000' }}>Error: Missing route parameters</Text>
      </SafeAreaView>
    );
  }

  const { chatId, chat: routeChat, enquiry, enquiryId: routeEnquiryId, chatType } = route?.params || {};
  
  const requestCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Allow access to your camera to take photos.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      if (__DEV__) {
        console.log('Camera permission request error', err);
      }
      return false;
    }
  }, []);

  // Get enquiryId from route params (fallback to chat or enquiry object)
  const enquiryId = routeEnquiryId || routeChat?.EnquiryId || routeChat?.enquiryId || enquiry?.id || enquiry?._id;
  
  // Get the specific chatId to use (prioritize direct chatId, then routeChat._id)
  const specificChatId = chatId || routeChat?._id || routeChat?.id;
  
  // Use the custom chat hook - this handles everything!
  // Pass routeChat as initialChat so it can be used immediately for message loading
  // Hooks must be called unconditionally - use default values for safety
  const chatHookResult = useChat(enquiryId, chatType, specificChatId, routeChat);
  
  const {
    chat: hookChat,
    messages = [],
    isLoadingChat = false,
    messagesLoading = false,
    chatError,
    isTyping = false,
    isUploading = false,
    sendMessage: sendChatMessage = () => false,
    sendMedia = () => false,
    sendTyping = () => {},
    refetchMessages = () => Promise.resolve(),
    refetchChat = () => Promise.resolve(),
  } = chatHookResult || {};
  
  // Use routeChat if it has an _id and hook hasn't loaded yet, otherwise use hookChat
  // This ensures messages can load immediately using routeChat's chatId
  const chat = (hookChat?._id || hookChat?.id) ? hookChat : (routeChat?._id || routeChat?.id ? routeChat : hookChat);
  
  // Get original chat data if available (for accessing ClientId from _originalData)
  const originalChatData = chat?._originalData || routeChat?._originalData || chat || routeChat;

  // Force refetch when screen is focused (user revisits) and mark messages as read
  useFocusEffect(
    React.useCallback(() => {
      if (chat?._id && !messagesLoading) {
        
        // Small delay to ensure screen is fully mounted
        const timer = setTimeout(() => {
          refetchMessages();
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [chat?._id, refetchMessages, messagesLoading])
  );

  // ⚠️ IMPORTANT: Don't mark messages as read immediately when screen opens
  // This should only happen when user actually scrolls to bottom and views messages
  // The current implementation marks as read too early, which resets unread count
  // 
  // TODO: Change this to only mark as read when:
  // 1. User scrolls to bottom of chat
  // 2. User has been viewing messages for a few seconds
  // 3. User explicitly marks as read
  //
  // NOTE: Backend's joinChat also auto-marks as read, which is a separate issue
  // Backend fix needed: Remove auto-mark-as-read from joinChat handler in utils/socket.js
  //
  // For now, we delay marking as read to give user time to see unread count
  // But ideally, this should be triggered by scroll-to-bottom event
  useFocusEffect(
    React.useCallback(() => {
      if (chat?._id && messages.length > 0 && !messagesLoading) {
        // ⚠️ DELAYED: Mark messages as read after user has had time to see them
        // This is a workaround - ideally should only mark when user scrolls to bottom
        const markReadTimer = setTimeout(() => {
          // Get unread messages (messages not sent by current user)
          const unreadMessages = messages.filter(msg => {
            const senderId = msg.SenderId || msg.senderId;
            const isMyMessage = user && String(senderId).trim() === String(user.id).trim();
            const isRead = msg.IsRead || msg.isRead || false;
            const readBy = msg.ReadBy || msg.readBy || [];
            const isReadByMe = Array.isArray(readBy) && readBy.some(item => {
              const readerId = typeof item === 'object' && item !== null && !Array.isArray(item)
                ? String(item.userId || item.user_id || item.id || item.UserId || item.Id || '').trim()
                : String(item).trim();
              return readerId === String(user.id).trim();
            });
            
            // Mark as read if: not my message, not already read, and not already read by me
            return !isMyMessage && !isRead && !isReadByMe;
          });

          if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map(msg => msg._id || msg.id).filter(Boolean);
            if (messageIds.length > 0 && socketService.isConnected()) {
              if (__DEV__) {
                console.log('📖 [ChatDetailScreen] Marking messages as read (delayed)', {
                  chatId: chat?._id,
                  messageCount: messageIds.length,
                  note: 'This should ideally only happen when user scrolls to bottom',
                });
              }
              socketService.markMessagesRead(chat?._id || chat?.id, user?.id, messageIds);
            }
          }
        }, 3000); // Increased delay to 3 seconds - gives user time to see unread count before it disappears
        
        return () => clearTimeout(markReadTimer);
      }
    }, [chat?._id, messages, messagesLoading, user])
  );

  const [newMessage, setNewMessage] = useState('');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showReadReceiptModal, setShowReadReceiptModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const scrollViewRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const swipeAnimations = useRef({});
  const isUserScrollingRef = useRef(false);
  const isUserAtBottomRef = useRef(true); // Track if user is at bottom
  const lastMessageCountRef = useRef(0);
  const scrollPositionRef = useRef({ y: 0, contentHeight: 0, layoutHeight: 0 });

  const loading = isLoadingChat || messagesLoading;
  const messagesError = chatError;

  // REMOVED: Unconditional scroll effect that was causing forceful scroll to bottom
  // Auto-scrolling is now handled by the smart scroll logic below (lines 419-482)

  // Fetch clients to resolve sender names
  const { data: clients = [] } = useGetClientsQuery(undefined, {
    skip: !user,
  });

  // Always fetch enquiry data if we have enquiryId to ensure we have complete client information
  const { data: fetchedEnquiryData, isLoading: isLoadingEnquiry } = useGetEnquiryByIdQuery(enquiryId, {
    skip: !enquiryId,
  });
  
  // Use fetched enquiry if available, otherwise use route enquiry
  const finalEnquiry = fetchedEnquiryData?._originalData || fetchedEnquiryData || enquiry;
  
  // Helper function to check if a value is a valid client name (not "Unknown Client" or empty)
  const isValidClientName = (name) => {
    return name && 
           typeof name === 'string' && 
           name.trim() !== '' && 
           name.trim().toLowerCase() !== 'unknown client' &&
           name.trim() !== 'Unknown Client';
  };

  // Create sender lookup map (senderId -> { name, role })
  const senderMap = useMemo(() => {
    const map = new Map();
    clients.forEach(client => {
      const idStr = String(client.id).trim();
      map.set(idStr, { name: client.name, role: 'client' });
    });
    // Add current user to map
    if (user) {
      const userIdStr = String(user.id).trim();
      map.set(userIdStr, { 
        name: user.name || user.email || 'You', 
        role: user.role || 'user' 
      });
    }
    return map;
  }, [clients, user]);

  // Enrich messages with sender names from senderMap
  // Optimized: Cache current time to avoid creating new Date() on every message
  const enrichedMessages = useMemo(() => {
    if (!messages || messages.length === 0) {
      return [];
    }
    
    // Cache current time once for all messages (performance optimization)
    const now = new Date();
    
    return messages.map(msg => {
      // Calculate status based on read receipts (for user's own messages)
      const senderId = msg.SenderId || msg.senderId;
      const isMyMessage = user && String(senderId).trim() === String(user.id).trim();
      const readByArray = msg.ReadBy || msg.readBy || msg.read_by || [];
      const isReadFlag = msg.IsRead || msg.isRead || false;
      
      // Always default to 'sent' for user's messages, or keep original status
      let messageStatus = msg.status || msg.Status || (isMyMessage ? 'sent' : undefined);
      
      // For user's own messages, determine status based on read receipts
      if (isMyMessage && user) {
        // If no status at all, default to 'sent'
        if (!messageStatus) {
          messageStatus = 'sent';
        }
        
        // CRITICAL: Only mark as "read" if someone OTHER than the sender has read it
        // Check ReadBy array - must contain at least one ID that is NOT the sender
        const senderIdStr = String(senderId).trim();
        const userIdStr = String(user?.id || user?._id || user?.Id || '').trim();
        
        let hasReadByOthers = false;
        if (Array.isArray(readByArray) && readByArray.length > 0) {
          // Filter out the sender's ID and check if any OTHER users have read it
          const otherReaders = readByArray.filter(id => {
            const readerId = String(id).trim();
            return readerId !== senderIdStr && 
                   readerId !== userIdStr && 
                   readerId !== '';
          });
          hasReadByOthers = otherReaders.length > 0;
        }
        
        // SAFEGUARD: Check message age - very new messages can't be read yet
        // Optimized: Only calculate if needed (when hasReadByOthers is true)
        const messageTime = msg.Timestamp || msg.timestamp;
        let isVeryNewMessage = false;
        if (hasReadByOthers && messageTime) {
          try {
            const msgDate = new Date(messageTime);
            const ageSeconds = (now - msgDate) / 1000;
            isVeryNewMessage = ageSeconds < 2; // Less than 2 seconds old
          } catch {
            isVeryNewMessage = false;
          }
        }
        
        // IMPORTANT: Don't trust isReadFlag alone - verify ReadBy contains others
        // Only mark as "read" if we have confirmed that others have read it
        // AND the message is not brand new (just sent)
        if (isVeryNewMessage) {
          // Very new messages should always be 'sent', never 'read'
          messageStatus = 'sent';
        } else if (hasReadByOthers) {
          // Confirmed others have read it - mark as 'read'
          messageStatus = 'read';
        } else if (messageStatus === 'sending' || messageStatus === 'failed') {
          // Keep sending/failed status
          messageStatus = messageStatus;
        } else {
          // Default to 'sent' - NOT 'read' unless confirmed
          messageStatus = 'sent';
        }
      } else {
        // For other people's messages, we don't need status
        messageStatus = messageStatus || undefined;
      }
      
      // Normalize message format (handle both API and WebSocket formats)
      const normalizedMsg = {
        ...msg, // Preserve all original fields first
        id: msg._id || msg.id,
        text: msg.Message || msg.message || msg.text || '',
        senderId: msg.SenderId || msg.senderId,
        senderName: msg.SenderName || msg.senderName,
        senderRole: msg.SenderRole || msg.senderRole,
        timestamp: msg.Timestamp || msg.timestamp,
        messageType: msg.MessageType || msg.messageType || 'text',
        mediaKey: msg.Media?.Url || msg.media?.url || msg.mediaKey,
        mediaName: msg.Media?.Name || msg.media?.name || msg.mediaName,
        mediaUrl: msg.Media?.Url || msg.media?.url || msg.mediaUrl,
        isRead: msg.IsRead || msg.isRead || false,
        replyTo: msg.ReplyTo || msg.replyTo || null,
        ReadBy: msg.ReadBy || msg.readBy || msg.read_by || [],
        readBy: msg.ReadBy || msg.readBy || msg.read_by || [],
        status: messageStatus, // Override with calculated status - ALWAYS set
      };
      
      // REMOVED: Excessive console.log that was causing lag
      // Debug logging removed for performance

      // If senderName is already present and not 'Unknown', use it
      if (normalizedMsg.senderName && normalizedMsg.senderName !== 'Unknown') {
        return normalizedMsg;
      }
      
      // Otherwise, try to resolve from senderMap
      const senderIdStr = String(normalizedMsg.senderId).trim();
      const senderInfo = senderMap.get(senderIdStr);
      
      if (senderInfo) {
        return {
          ...normalizedMsg,
          senderName: senderInfo.name,
          senderRole: senderInfo.role,
        };
      }
      
      // Fallback to current user if senderId matches
      if (user && String(user.id).trim() === senderIdStr) {
        return {
          ...normalizedMsg,
          senderName: user.name || user.email || 'You',
          senderRole: user.role || 'user',
        };
      }
      
      // Default fallback
      return {
        ...normalizedMsg,
        senderName: normalizedMsg.senderName || 'Unknown',
        senderRole: normalizedMsg.senderRole || 'user',
      };
    });
  }, [messages, senderMap, user]);

  // Initialize scroll hook after enrichedMessages is defined
  const { scrollToMessage, storeMessagePosition } = useMessageScroll(enrichedMessages, scrollViewRef);

  // Track scroll position to determine if user is at bottom
  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Only update if we have valid dimensions
    if (contentSize.height > 0 && layoutMeasurement.height > 0) {
      scrollPositionRef.current = {
        y: contentOffset.y,
        contentHeight: contentSize.height,
        layoutHeight: layoutMeasurement.height,
      };
      
      // Check if user is near bottom (within 10px for EXTREMELY strict check)
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const isNearBottom = distanceFromBottom <= 10;
      
      // Update if user is at bottom - be EXTREMELY strict
      isUserAtBottomRef.current = isNearBottom;
      
      // AGGRESSIVE blocking: If user scrolls more than 50px from bottom, IMMEDIATELY block auto-scroll
      // This prevents any accidental scrolling when user is viewing older messages
      if (distanceFromBottom > 50) {
        isUserAtBottomRef.current = false;
        // Also set scrolling flag to prevent any auto-scroll attempts
        isUserScrollingRef.current = true;
      }
    }
  }, []);

  // Track when user starts scrolling
  const handleScrollBeginDrag = useCallback(() => {
    // IMMEDIATELY set scrolling flag to block all auto-scroll
    isUserScrollingRef.current = true;
    
    // When user starts scrolling, check if they're at bottom
    // If not, disable auto-scroll IMMEDIATELY
    const { y, contentHeight, layoutHeight } = scrollPositionRef.current;
    if (contentHeight > 0 && layoutHeight > 0) {
      const distanceFromBottom = contentHeight - (y + layoutHeight);
      // If user is more than 30px from bottom, they're clearly viewing older messages
      if (distanceFromBottom > 30) {
        isUserAtBottomRef.current = false;
      }
    }
  }, []);

  // Track when user stops scrolling
  const handleScrollEndDrag = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const isNearBottom = distanceFromBottom <= 10; // EXTREMELY strict threshold
    
    // Update bottom status when user stops scrolling
    isUserAtBottomRef.current = isNearBottom;
    
    // LONGER delayed clearing of scroll flag to prevent immediate auto-scroll
    // Increased delay to 500ms to ensure user has finished scrolling
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 500);
  }, []);

  // Track when momentum scrolling ends (iOS)
  const handleMomentumScrollEnd = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const isNearBottom = distanceFromBottom <= 10; // EXTREMELY strict threshold
    
    // Update bottom status when momentum scrolling ends
    isUserAtBottomRef.current = isNearBottom;
    
    // LONGER delayed clearing of scroll flag to prevent immediate auto-scroll
    // Increased delay to 500ms to ensure momentum scrolling has fully completed
    setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 500);
  }, []);

  // Scroll to bottom only when new messages arrive AND user is at bottom
  useEffect(() => {
    if (!messages || messages.length === 0) {
      lastMessageCountRef.current = 0;
      return;
    }

    const currentMessageCount = messages.length;
    const previousMessageCount = lastMessageCountRef.current;
    const hasNewMessages = currentMessageCount > previousMessageCount;
    
    // Update message count
    lastMessageCountRef.current = currentMessageCount;

    // Only auto-scroll if:
    // 1. New messages were added (not just updated)
    // 2. User is at or near the bottom (not scrolling up)
    if (hasNewMessages) {
      // CRITICAL: Check if user is ACTUALLY scrolling or has scrolled up
      // If user is actively scrolling, NEVER auto-scroll
      if (isUserScrollingRef.current) {
        return;
      }
      
      // Check if user is at bottom using stored scroll position
      const { y, contentHeight, layoutHeight } = scrollPositionRef.current;
      
      // If we don't have valid dimensions yet, it's safe to scroll (initial load)
      if (contentHeight === 0 || layoutHeight === 0) {
        // Only scroll on initial load, not on every message update
        if (previousMessageCount === 0 && enrichedMessages.length > 0) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToIndex({ 
              index: enrichedMessages.length - 1, 
              animated: true,
              viewPosition: 1 
            });
          }, 100);
        }
        return;
      }
      
      // Calculate distance from bottom FIRST (don't trust the ref alone)
      const distanceFromBottom = contentHeight - (y + layoutHeight);
      
      // VERY STRICT: Only scroll if distance is EXTREMELY close (10px instead of 20px)
      // This prevents auto-scroll when user has scrolled up even slightly
      const isActuallyAtBottom = distanceFromBottom <= 10;
      
      // ALSO check the ref for additional safety
      const refSaysAtBottom = isUserAtBottomRef.current;
      
      // REMOVED: Excessive logging for performance
      
      // Only scroll if BOTH conditions are met:
      // 1. User is ACTUALLY at bottom (calculated distance <= 10px)
      // 2. Ref also says user is at bottom (double-check)
      if (isActuallyAtBottom && refSaysAtBottom && enrichedMessages.length > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToIndex({ 
            index: enrichedMessages.length - 1, 
            animated: true,
            viewPosition: 1 
          });
        }, 100);
      }
    }
  }, [messages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // Only scroll to bottom when keyboard shows if user is near bottom
      // Use the ref to check if user is at bottom (more reliable)
      if (isUserAtBottomRef.current && enrichedMessages.length > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToIndex({ 
            index: enrichedMessages.length - 1, 
            animated: true,
            viewPosition: 1 
          });
        }, 100);
      }
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !chat) return;

    const messageText = newMessage.trim();
    // Get reply target before clearing state
    // IMPORTANT: You can reply to ANY message - your own or others (like WhatsApp)
    const replyToMessage = replyingTo ? {
      _id: replyingTo._id || replyingTo.id,
      id: replyingTo._id || replyingTo.id,
      text: replyingTo.text || replyingTo.Message || replyingTo.message || '',
      Message: replyingTo.text || replyingTo.Message || replyingTo.message || '',
      senderName: replyingTo.senderName || replyingTo.SenderName || 'Unknown',
      SenderName: replyingTo.senderName || replyingTo.SenderName || 'Unknown',
      messageType: replyingTo.messageType || replyingTo.MessageType || 'text',
      MessageType: replyingTo.messageType || replyingTo.MessageType || 'text',
      mediaUrl: replyingTo.mediaUrl || replyingTo.MediaUrl,
      MediaUrl: replyingTo.mediaUrl || replyingTo.MediaUrl,
      myMessage: isMyMessage(replyingTo),
    } : null;
    
    if (__DEV__ && replyToMessage) {
      console.log('📤 [Send] Sending message with reply:', {
        hasReply: true,
        replyToId: replyToMessage._id || replyToMessage.id,
        replyToText: (replyToMessage.text || replyToMessage.Message || '').substring(0, 30),
        messageText: messageText.substring(0, 30),
        isReplyingToMyMessage: replyToMessage.myMessage || false,
      });
    }
    
    setNewMessage('');
    setReplyingTo(null); // Clear reply after sending
    
    // When user sends a message, always scroll to bottom
    isUserScrollingRef.current = false;
    isUserAtBottomRef.current = true;

    // Send via the hook (now async) with replyTo
    const sent = await sendChatMessage(messageText, replyToMessage);
    
    if (!sent) {
      alert.error('Error', 'Failed to send message. Please check your connection and try again.');
      setNewMessage(messageText); // Restore message on error
      setReplyingTo(replyToMessage); // Restore reply on error
    } else {
      // Scroll to bottom after sending
      setTimeout(() => {
        if (enrichedMessages.length > 0) {
          scrollViewRef.current?.scrollToIndex({ 
            index: enrichedMessages.length - 1, 
            animated: true,
            viewPosition: 1 
          });
        }
      }, 200);
      
      if (__DEV__) {
        console.log('✅ [Send] Message sent successfully, reply cleared');
      }
    }
  };

  const handleReplyToMessage = (message) => {
    if (__DEV__) {
      console.log('💬 [Reply] Setting reply target:', {
        messageId: message._id || message.id,
        messageText: (message.text || message.Message || '').substring(0, 30),
        currentReplyingTo: replyingTo?._id || replyingTo?.id,
        isMyMessage: isMyMessage(message),
      });
    }
    
    // IMPORTANT: You can reply to ANY message - your own or others (like WhatsApp)
    // Always set the reply target, even if it's the same message
    // This allows replying to the same message multiple times
    
    // Force state update by creating a new object reference
    // This ensures React detects the change even if it's the same message
    const replyTarget = {
      ...message,
      _replyTimestamp: Date.now(), // Add timestamp to force state update
    };
    
    // Always set the reply target (no restrictions on own messages)
    setReplyingTo(replyTarget);
    
    if (__DEV__) {
      console.log('✅ [Reply] Reply target set:', {
        messageId: replyTarget._id || replyTarget.id,
        replyTimestamp: replyTarget._replyTimestamp,
      });
    }
    
    // Focus on input after a small delay to ensure state is updated
    setTimeout(() => {
      Keyboard.dismiss();
    }, 50);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleTyping = (text) => {
    setNewMessage(text);
    
    // Send typing indicator
    if (text.trim() && chat) {
      sendTyping(true);
      
      // Clear typing indicator after 2 seconds of no typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    }
  };

  const handleAttachFile = () => {
    setShowMediaModal(true);
  };

  const handleCloseMediaModal = () => {
    setShowMediaModal(false);
  };

  const handleShowReadReceipts = (message) => {
    // Removed excessive logging for performance
    setSelectedMessage(message);
    setShowReadReceiptModal(true);
  };

  const handleCloseReadReceiptModal = () => {
    setShowReadReceiptModal(false);
    setSelectedMessage(null);
  };

  const handleMediaOption = (source, mediaType) => {
    setShowMediaModal(false);
    // Small delay to ensure modal closes smoothly
    setTimeout(() => {
      handleImagePicker(source, mediaType);
    }, 300);
  };

  const handleImagePicker = (source, mediaType = 'photo') => {
    const options = {
      mediaType: mediaType === 'video' ? 'video' : 'photo',
      quality: mediaType === 'video' ? 0.7 : 0.8,
      includeBase64: false,
      videoQuality: 'high',
      durationLimit: 300, // 5 minutes max for videos
      maxWidth: 1920,
      maxHeight: 1920,
      allowsEditing: false,
    };

    const picker = source === 'camera' ? launchCamera : launchImageLibrary;

    // For camera, ensure permission
    if (source === 'camera') {
      requestCameraPermission().then((granted) => {
        if (!granted) {
          alert.error('Permission denied', 'Camera permission is required to take photos.');
          return;
        }
        picker(options, (response) => {
          handlePickerResponse(response, mediaType);
        });
      });
      return;
    }

    picker(options, async (response) => {
      handlePickerResponse(response, mediaType);
    });
  };

  const handlePickerResponse = async (response, mediaType) => {
    if (response.didCancel) {
      
      return;
    }

    if (response.errorCode) {
      alert.error('Error', response.errorMessage || 'Failed to pick media');
      return;
    }

    const asset = response.assets?.[0];
    if (!asset || !chat) {
      
      return;
    }

    // Validate file size (50 MB max)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (asset.fileSize && asset.fileSize > maxSize) {
      alert.warning(
        'File Too Large',
        'File size exceeds 50 MB limit. Please choose a smaller file.'
      );
      return;
    }

    try {
      if (__DEV__) {
        console.log('📤 Sending media:', {
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName,
          size: asset.fileSize,
          mediaType: mediaType,
        });
      }

      // Determine message type
      let messageType = 'file';
      if (asset.type?.startsWith('image/')) {
        messageType = 'image';
      } else if (asset.type?.startsWith('video/')) {
        messageType = 'video';
      }

      // Send media via the hook
      const sent = await sendMedia({
        uri: asset.uri,
        type: asset.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || asset.uri.split('/').pop() || `${mediaType}_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
        size: asset.fileSize || 0,
        messageType: messageType,
      });

      if (!sent) {
        alert.error('Error', 'Failed to send media. Please try again.');
      } else {
        
      }
    } catch (error) {
      alert.error(
        'Error',
        error.message || 'Failed to send media. Please try again.'
      );
    }
  };

  // Helper functions for message styling - using extracted utilities
  const isMyMessage = useCallback((message) => checkIsMyMessage(message, user), [user]);

  const getMediaUrl = useCallback((mediaKey) => {
    if (!mediaKey) return null;
    if (typeof mediaKey === 'string' && (mediaKey.startsWith('http://') || mediaKey.startsWith('https://'))) {
      return mediaKey;
    }
    // Default to legacy files path; backend may expose via /api/files/:key
    return `${FILE_BASE_URL}/api/files/${encodeURIComponent(mediaKey)}`;
  }, []);

  const handleFilePress = async (mediaKey, mediaName) => {
    const url = getMediaUrl(mediaKey);
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          alert.error('Error', 'Cannot open this file');
        }
      } catch (error) {
        alert.error('Error', 'Failed to open file');
      }
    }
  };


  // Memoize renderMessage to prevent unnecessary re-renders
  const renderMessage = useCallback((message, index) => {
    // Safety check - ensure message exists
    if (!message) {
      return null;
    }
    
    const myMessage = isMyMessage(message);
    const previousMessage = index > 0 ? enrichedMessages[index - 1] : null;
    // In group chats, always show sender name below message bubble
    // This helps identify who sent each message when multiple admins/users are reading
    const isGroupChat = true; // All chats are group chats (admin-client or admin-designer)
    const showSenderName = isGroupChat;
    
    const messageType = message.messageType || message.MessageType;
    const mediaKey = message.mediaKey || message.MediaKey;
    const mediaUrl = message.mediaUrl || message.MediaUrl;
    const mediaName = message.mediaName || message.MediaName;

    const isImage = messageType === 'image';
    const isVideo = messageType === 'video';
    const isFile = messageType === 'file';
    
    // Handle replyTo from multiple possible fields (backend might use different formats)
    const replyTo = message.replyTo || message.ReplyTo || message.ParentMessageId || message.parentMessageId;
    
    // Find the replied message if it exists
    let repliedMessage = null;
    if (replyTo) {
      // Handle different replyTo formats: object, string ID, or nested object
      let replyToId = null;
      let replyToData = null;
      
      if (typeof replyTo === 'string') {
        // Direct string ID
        replyToId = replyTo.trim();
      } else if (replyTo && typeof replyTo === 'object') {
        // Object with _id or id property, or MongoDB ObjectId format
        replyToId = (replyTo._id?.$oid || replyTo._id || replyTo.id || '').toString().trim();
        // If replyTo is an object with message data, use it directly
        if (replyTo.Message || replyTo.message || replyTo.text) {
          replyToData = replyTo;
        }
      } else if (replyTo) {
        // Fallback: try to convert to string
        replyToId = String(replyTo).trim();
      }
      
      if (replyToId && replyToId !== 'null' && replyToId !== 'undefined' && replyToId !== '') {
        // First, try to find in enriched messages
        repliedMessage = enrichedMessages.find(m => {
          const messageId = String(m._id || m.id || '').trim();
          return messageId && messageId === replyToId;
        });
        
        // If not found in enriched messages, use the replyTo object data if available
        if (!repliedMessage && replyToData) {
          const extractedId = replyToData._id?.$oid || replyToData._id || replyToData.id || replyToId;
          repliedMessage = {
            _id: extractedId,
            id: extractedId,
            text: replyToData.Message || replyToData.message || replyToData.text || '',
            Message: replyToData.Message || replyToData.message || replyToData.text || '',
            message: replyToData.Message || replyToData.message || replyToData.text || '',
            senderName: replyToData.SenderName || replyToData.senderName || replyToData.sender?.name || 'Unknown',
            SenderName: replyToData.SenderName || replyToData.senderName || replyToData.sender?.name || 'Unknown',
            senderRole: replyToData.SenderRole || replyToData.senderRole || replyToData.sender?.role || 'user',
            senderRole: replyToData.SenderRole || replyToData.senderRole || replyToData.sender?.role || 'user',
            messageType: replyToData.MessageType || replyToData.messageType || 'text',
            MessageType: replyToData.MessageType || replyToData.messageType || 'text',
            mediaUrl: replyToData.MediaUrl || replyToData.mediaUrl || replyToData.media?.url,
            MediaUrl: replyToData.MediaUrl || replyToData.mediaUrl || replyToData.media?.url,
            mediaKey: replyToData.MediaKey || replyToData.mediaKey || replyToData.media?.key,
            MediaKey: replyToData.MediaKey || replyToData.mediaKey || replyToData.media?.key,
          };
        } else if (!repliedMessage && typeof replyTo === 'object' && (replyTo.Message || replyTo.message || replyTo.text)) {
          // Fallback: create from replyTo object even if it doesn't have all fields
          repliedMessage = {
            _id: replyToId,
            id: replyToId,
            text: replyTo.Message || replyTo.message || replyTo.text || '',
            Message: replyTo.Message || replyTo.message || replyTo.text || '',
            message: replyTo.Message || replyTo.message || replyTo.text || '',
            senderName: replyTo.SenderName || replyTo.senderName || replyTo.sender?.name || 'Unknown',
            SenderName: replyTo.SenderName || replyTo.senderName || replyTo.sender?.name || 'Unknown',
            messageType: replyTo.MessageType || replyTo.messageType || 'text',
            MessageType: replyTo.MessageType || replyTo.messageType || 'text',
            mediaUrl: replyTo.MediaUrl || replyTo.mediaUrl || replyTo.media?.url,
            MediaUrl: replyTo.MediaUrl || replyTo.mediaUrl || replyTo.media?.url,
          };
        }
        
        // Debug log only when reply is not found (helps identify issues)
        if (__DEV__ && !repliedMessage) {
          console.log('🔗 [Reply] Message not found in list:', {
            replyToId: replyToId,
            messageId: message._id || message.id,
            replyToType: typeof replyTo,
            replyToKeys: typeof replyTo === 'object' ? Object.keys(replyTo) : null,
            totalMessages: enrichedMessages.length,
          });
        }
      }
    }
    
    // Check if this message should be highlighted
    const isHighlighted = highlightedMessageId && (
      String(message._id || message.id || '').trim() === String(highlightedMessageId).trim()
    );
    
    // Store message position for accurate scrolling
    const messageId = String(message._id || message.id || '').trim();
    
    return (
      <View 
        key={message.id} 
        style={[
          styles.messageWrapper,
          isHighlighted && styles.highlightedMessageWrapper
        ]}
        onLayout={(event) => {
          // Store actual message position for accurate scrolling
          if (messageId && event.nativeEvent.layout) {
            const y = event.nativeEvent.layout.y;
            storeMessagePosition(messageId, y);
            if (__DEV__ && isHighlighted) {
              console.log('🔴 [Message Layout] Stored position for highlighted message:', {
                messageId,
                y,
              });
            }
          }
        }}
      >
        <SwipeableMessage
          message={message}
          myMessage={myMessage}
          onSwipeRight={() => handleReplyToMessage(message)}
          onLongPress={() => handleShowReadReceipts(message)}
        >
          <View style={[
            styles.messageBubble,
            myMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            isImage && styles.imageMessageBubble,
            isVideo && styles.videoMessageBubble,
            isFile && styles.fileMessageBubble,
            isHighlighted && styles.highlightedMessageBubble, // Add highlight to bubble
          ]}>
            {/* Reply Preview */}
            {repliedMessage && (
              <TouchableOpacity
                style={[
                  styles.replyPreview,
                  myMessage ? styles.replyPreviewMy : styles.replyPreviewOther,
                ]}
                onPress={() => {
                  const messageId = repliedMessage._id || repliedMessage.id;
                  if (messageId) {
                    const messageIdStr = String(messageId).trim();
                    scrollToMessage(messageIdStr, setHighlightedMessageId);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.replyPreviewLine,
                  myMessage ? styles.replyPreviewLineMy : styles.replyPreviewLineOther,
                ]} />
                {/* Reply Icon */}
                <Icon
                  name="reply"
                  size={16}
                  color={myMessage ? colors.textWhite : colors.primary}
                  style={styles.replyPreviewIcon}
                />
                <View style={styles.replyPreviewContent}>
                  <Text style={[
                    styles.replyPreviewName,
                    myMessage ? styles.replyPreviewNameMy : styles.replyPreviewNameOther,
                  ]}>
                    {repliedMessage.senderName || 'Unknown'}
                  </Text>
                  {/* Show media thumbnail if replying to image/video */}
                  {(repliedMessage.messageType === 'image' || repliedMessage.messageType === 'video') && repliedMessage.mediaUrl ? (
                    <View style={styles.replyPreviewMedia}>
                      <Image
                        source={{ uri: repliedMessage.mediaUrl }}
                        style={styles.replyPreviewThumbnail}
                        resizeMode="cover"
                      />
                      <Text 
                        style={[
                          styles.replyPreviewText,
                          myMessage ? styles.replyPreviewTextMy : styles.replyPreviewTextOther,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {repliedMessage.text || repliedMessage.Message || repliedMessage.message || (repliedMessage.messageType === 'image' ? 'Photo' : 'Video')}
                      </Text>
                    </View>
                  ) : (
                    <Text 
                      style={[
                        styles.replyPreviewText,
                        myMessage ? styles.replyPreviewTextMy : styles.replyPreviewTextOther,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {repliedMessage.text || repliedMessage.Message || repliedMessage.message || 'Message'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            
            {/* Add small spacing between reply preview and message content for better visual separation */}
            {repliedMessage && (
              <View style={{ height: 4 }} />
            )}
            
            {isImage && mediaKey ? (
              <TouchableOpacity 
                onPress={() => handleFilePress(mediaKey, mediaName)}
                activeOpacity={0.8}>
                <Image
                  source={{ uri: mediaUrl || getMediaUrl(mediaKey) }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
                {message.text && (
                  <Text style={[
                    styles.messageText,
                    myMessage ? styles.myMessageText : styles.otherMessageText,
                    styles.imageCaption,
                  ]}>
                    {message.text}
                  </Text>
                )}
              </TouchableOpacity>
            ) : isVideo && mediaKey ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: mediaUrl || getMediaUrl(mediaKey) }}
                  style={styles.messageVideo}
                  controls={true}
                  resizeMode="contain"
                  paused={false}
                />
                {message.text && (
                  <Text style={[
                    styles.messageText,
                    myMessage ? styles.myMessageText : styles.otherMessageText,
                    styles.videoCaption,
                  ]}>
                    {message.text}
                  </Text>
                )}
              </View>
            ) : isFile && mediaKey ? (
              <TouchableOpacity 
                onPress={() => handleFilePress(mediaKey, mediaName)}
                style={styles.fileMessageContainer}
                activeOpacity={0.8}>
                <Icon name="insert-drive-file" size={24} color={myMessage ? colors.textWhite : colors.primary} />
                <View style={styles.fileMessageInfo}>
                  <Text style={[
                    styles.fileMessageName,
                    myMessage ? styles.myMessageText : styles.otherMessageText,
                  ]} numberOfLines={1}>
                    {mediaName || 'File'}
                  </Text>
                  <Text style={[
                    styles.fileMessageSize,
                    myMessage ? styles.myMessageTime : styles.otherMessageTime,
                  ]}>
                    Tap to download
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={[
                styles.messageText,
                myMessage ? styles.myMessageText : styles.otherMessageText,
                repliedMessage && styles.messageTextWithReply, // Add style when there's a reply
              ]}>
                {message.text || message.Message || message.message || ''}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                myMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}>
                {formatMessageTime(message.timestamp || message.Timestamp)}
              </Text>
              
              {/* Show icon for user's messages */}
              {myMessage ? (
                <View style={styles.messageStatusContainer}>
                  <Icon
                    name={getMessageStatusIcon(message.status || 'sent')}
                    size={16}
                    color={getMessageStatusColor(message.status || 'sent', true, colors)}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </SwipeableMessage>
        
        {/* Sender name below message bubble for group chats */}
        {showSenderName && (
          <View style={[
            styles.senderNameBelow,
            myMessage ? styles.senderNameBelowMy : styles.senderNameBelowOther
          ]}>
            <Text style={[
              styles.senderNameText,
              myMessage ? styles.senderNameTextMy : styles.senderNameTextOther
            ]}>
              {myMessage ? 'You' : (message?.senderName || message?.SenderName || 'Unknown')}
            </Text>
          </View>
        )}
      </View>
    );
  }, [enrichedMessages, user, isMyMessage, handleReplyToMessage, handleShowReadReceipts, handleFilePress, getMediaUrl, scrollViewRef, highlightedMessageId, storeMessagePosition, scrollToMessage, setHighlightedMessageId]);

  // Prepare header props
  const enquiryTitle = finalEnquiry?.title || finalEnquiry?.Name || finalEnquiry?.name || enquiry?.title || enquiry?.Name || enquiry?.name;
  const chatTitle = chat?.EnquiryName || chat?.enquiryTitle || chat?.enquiryName;
  const title = enquiryTitle || chatTitle || 'New Chat';
  
  const clientId = originalChatData?.ClientId || originalChatData?.clientId || originalChatData?.Client?.Id || originalChatData?.Client?.id ||
                   chat?.ClientId || chat?.clientId || chat?.Client?.Id || chat?.Client?.id ||
                   finalEnquiry?.ClientId || finalEnquiry?.clientId || finalEnquiry?.Client?.Id || finalEnquiry?.Client?.id || 
                   enquiry?.ClientId || enquiry?.clientId || enquiry?.Client?.Id || enquiry?.Client?.id;
  
  let clientName = null;
  if (clientId && clients.length > 0) {
    const foundClient = clients.find(c => {
      const cId = String(c.id || c._id).trim();
      const searchId = String(clientId).trim();
      return cId === searchId;
    });
    if (foundClient?.name && isValidClientName(foundClient.name)) {
      clientName = foundClient.name;
    }
  }
  
  if (!clientName) {
    const possibleNames = [
      chat?.ClientName,
      chat?.clientName,
      finalEnquiry?.clientName,
      finalEnquiry?.client?.name,
      finalEnquiry?.Client?.Name,
      finalEnquiry?.Client?.name,
      enquiry?.clientName,
      enquiry?.client?.name,
      enquiry?.Client?.Name,
      enquiry?.Client?.name,
    ];
    clientName = possibleNames.find(name => isValidClientName(name)) || 'Client';
  }
  
  if (!isValidClientName(clientName)) {
    clientName = 'Client';
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ImageBackground 
        source={require('../../assets/images/doodle.png')} 
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
          <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
          <ChatHeader
            title={title}
            clientName={clientName}
            isLoadingEnquiry={isLoadingEnquiry}
            onBack={() => navigation?.goBack?.()}
            onInfo={() => alert.info('Chat Info', `Chat: ${title}\nClient: ${clientName}`)}
            isValidClientName={isValidClientName}
          />

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

          {loading && enrichedMessages.length === 0 ? (
            <EmptyState loading={loading} error={null} />
          ) : !loading && enrichedMessages.length === 0 && !messagesError ? (
            <EmptyState loading={false} error={null} />
          ) : enrichedMessages.length > 0 ? (
            <FlatList
              ref={scrollViewRef}
              data={enrichedMessages}
              keyExtractor={(item, index) => `msg-${item.id || item._id || index}`}
              renderItem={({ item, index }) => renderMessage(item, index)}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onScroll={handleScroll}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              scrollEventThrottle={16}
              inverted={false}
              removeClippedSubviews={Platform.OS === 'android'} // Better performance on Android
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={15}
              windowSize={10}
              scrollEnabled={true}
              directionalLockEnabled={false} // Allow horizontal gestures within FlatList
              onScrollToIndexFailed={(info) => {
                // Fallback if scrollToIndex fails
                if (__DEV__) {
                  console.log('⚠️ [FlatList] scrollToIndexFailed:', {
                    index: info.index,
                    highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
                    averageItemLength: info.averageItemLength,
                  });
                }
                setTimeout(() => {
                  if (scrollViewRef.current) {
                    // Use averageItemLength if available, otherwise estimate
                    const itemHeight = info.averageItemLength || 110;
                    const offset = itemHeight * info.index;
                    // Ensure offset is never too small (prevents scrolling to top)
                    scrollViewRef.current.scrollToOffset({
                      offset: Math.max(100, offset - 150),
                      animated: true,
                    });
                  }
                }, 100);
              }}
              ListFooterComponent={
                isTyping ? (
                  <View style={styles.typingIndicator}>
                    <Text style={styles.typingText}>Someone is typing...</Text>
                  </View>
                ) : null
              }
            />
          ) : (
            <EmptyState loading={loading} error={messagesError} />
          )}

          <View style={styles.inputContainer}>
            {/* Reply Preview */}
            {replyingTo && (
              <View style={styles.replyPreviewBar}>
                <View style={styles.replyPreviewBarContent}>
                  <View style={styles.replyPreviewBarLeft}>
                    <View style={[
                      styles.replyPreviewBarLine,
                      isMyMessage(replyingTo) ? styles.replyPreviewBarLineMy : styles.replyPreviewBarLineOther,
                    ]} />
                    <View style={styles.replyPreviewBarText}>
                      <Text style={styles.replyPreviewBarName}>
                        Replying to {replyingTo.senderName || 'Unknown'}
                      </Text>
                      <Text 
                        style={styles.replyPreviewBarMessage}
                        numberOfLines={1}
                      >
                        {replyingTo.text || replyingTo.Message || replyingTo.message || 'Message'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={cancelReply}
                    style={styles.replyPreviewBarClose}
                  >
                    <Icon name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            <View style={styles.inputWrapper}>
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={handleAttachFile}
                disabled={isUploading}>
                <Icon 
                  name={isUploading ? "hourglass-empty" : "attach-file"} 
                  size={20} 
                  color={isUploading ? colors.textLight : colors.textSecondary} 
                />
              </TouchableOpacity>
              
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={replyingTo ? "Type a reply..." : "Type a message..."}
                  placeholderTextColor={colors.textLight}
                  value={newMessage}
                  onChangeText={handleTyping}
                  multiline
                  maxLength={500}
                />
              </View>
              
              {newMessage.trim() ? (
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                  <Icon name="send" size={20} color={colors.textWhite} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micButton}>
                  <Icon name="mic" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Custom Media Selection Modal */}
      <Modal
        visible={showMediaModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseMediaModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseMediaModal}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Attach Media</Text>
                  <TouchableOpacity
                    onPress={handleCloseMediaModal}
                    style={styles.modalCloseButton}
                  >
                    <Icon name="close" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Modal Options */}
                <View style={styles.modalOptions}>
                  {/* Camera Option */}
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleMediaOption('camera', 'photo')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: colors.primary + '15' }]}>
                      <Icon name="camera" size={32} color={colors.primary} />
                    </View>
                    <Text style={styles.modalOptionText}>Camera</Text>
                    <Text style={styles.modalOptionSubtext}>Take a photo</Text>
                  </TouchableOpacity>

                  {/* Photo from Gallery */}
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleMediaOption('gallery', 'photo')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: colors.accent + '15' }]}>
                      <Icon name="image" size={32} color={colors.accent} />
                    </View>
                    <Text style={styles.modalOptionText}>Photo</Text>
                    <Text style={styles.modalOptionSubtext}>Choose from gallery</Text>
                  </TouchableOpacity>

                  {/* Video from Gallery */}
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => handleMediaOption('gallery', 'video')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                      <Icon name="video-library" size={32} color={colors.primaryLight} />
                    </View>
                    <Text style={styles.modalOptionText}>Video</Text>
                    <Text style={styles.modalOptionSubtext}>Choose from gallery</Text>
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleCloseMediaModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Read Receipt Modal - Shows who has read the message */}
      <Modal
        visible={showReadReceiptModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseReadReceiptModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseReadReceiptModal}
        >
          <View style={styles.readReceiptModalContainer}>
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View style={styles.readReceiptModalContent}>
                {/* Modal Header */}
                <View style={styles.readReceiptModalHeader}>
                  <Text style={styles.readReceiptModalTitle}>
                    {selectedMessage && (() => {
                      const senderId = selectedMessage.SenderId || selectedMessage.senderId;
                      const isMyMsg = user && String(senderId).trim() === String(user.id).trim();
                      return isMyMsg ? 'Read by' : 'Seen by';
                    })()}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCloseReadReceiptModal}
                    style={styles.modalCloseButton}
                  >
                    <Icon name="close" size={24} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Message Preview */}
                {selectedMessage && (
                  <View style={styles.readReceiptMessagePreview}>
                    <Text style={styles.readReceiptMessageText} numberOfLines={2}>
                      {selectedMessage.text || selectedMessage.Message || selectedMessage.message || 'Message'}
                    </Text>
                    <Text style={styles.readReceiptMessageTime}>
                      {formatMessageTime(selectedMessage.timestamp || selectedMessage.Timestamp)}
                    </Text>
                  </View>
                )}

                {/* List of Users */}
                <ScrollView 
                  style={styles.readReceiptList}
                  contentContainerStyle={styles.readReceiptListContent}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                  scrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedMessage && (() => {
                    const readByArray = selectedMessage.ReadBy || selectedMessage.readBy || selectedMessage.read_by || [];
                    const readByTimestamps = selectedMessage.ReadByTimestamps || selectedMessage.readByTimestamps || selectedMessage.read_by_timestamps || {};
                    const senderId = selectedMessage.SenderId || selectedMessage.senderId;
                    const isMyMsg = user && String(senderId).trim() === String(user.id).trim();
                    
                    // Removed excessive logging for performance
                    
                    // Process ReadBy array - handle multiple formats from backend:
                    // 1. Array of objects: [{ userId: '123', readAt: '2024-01-01T00:00:00Z' }, ...]
                    // 2. Array of IDs with separate ReadByTimestamps: ['123', '456'] + { '123': '2024-01-01T00:00:00Z', ... }
                    // 3. Mixed format: [{ userId: '123', readAt: '...' }, '456', '789'] - need to merge
                    const processReadBy = () => {
                      const processed = [];
                      const timestampMap = new Map(); // Store timestamps by userId for merging
                      
                      if (!Array.isArray(readByArray)) {
                        return processed;
                      }
                      
                      // First pass: Extract all timestamps from objects and store in map
                      readByArray.forEach((item) => {
                        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                          const userId = String(item.userId || item.user_id || item.id || item.UserId || item.Id || '').trim();
                          const timestamp = item.readAt || item.ReadAt || item.read_at || 
                                           item.timestamp || item.Timestamp || 
                                           item.readTimestamp || item.ReadTimestamp ||
                                           null;
                          
                          if (userId && timestamp) {
                            timestampMap.set(userId, timestamp);
                          }
                        }
                      });
                      
                      // Second pass: Process all items and use stored timestamps
                      readByArray.forEach((item) => {
                        let userId, timestamp;
                        
                        // Check if item is an object with userId and timestamp
                        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                          // Format: { userId: '123', readAt: '...' } or { id: '123', timestamp: '...' }
                          userId = item.userId || item.user_id || item.id || item.UserId || item.Id || item.userId;
                          timestamp = item.readAt || item.ReadAt || item.read_at || 
                                     item.timestamp || item.Timestamp || 
                                     item.readTimestamp || item.ReadTimestamp ||
                                     null;
                          
                          // If timestamp not found in item, check our map (might have been set by another object)
                          if (!timestamp && userId) {
                            timestamp = timestampMap.get(String(userId).trim()) || null;
                          }
                        } else {
                          // Item is just a user ID string/number
                          userId = item;
                          const userIdStr = String(userId).trim();
                          
                          // First check our timestamp map (from objects in first pass)
                          timestamp = timestampMap.get(userIdStr) || null;
                          
                          // If not in map, try to get timestamp from ReadByTimestamps object
                          if (!timestamp && readByTimestamps && typeof readByTimestamps === 'object') {
                            // Try different key formats in ReadByTimestamps
                            timestamp = readByTimestamps[userIdStr] || 
                                       readByTimestamps[userId] || 
                                       readByTimestamps[String(userId)] ||
                                       readByTimestamps[Number(userId)] ||
                                       null;
                            
                            // If still not found, try case-insensitive key matching
                            if (!timestamp) {
                              const matchingKey = Object.keys(readByTimestamps).find(key => 
                                String(key).trim().toLowerCase() === userIdStr.toLowerCase()
                              );
                              if (matchingKey) {
                                timestamp = readByTimestamps[matchingKey];
                              }
                            }
                          }
                        }
                        
                        if (userId) {
                          const userIdStr = String(userId).trim();
                          const processedItem = { 
                            userId: userIdStr, 
                            timestamp: timestamp || null
                          };
                          
                          // Only add if not already added (avoid duplicates)
                          const alreadyExists = processed.some(p => p.userId === userIdStr);
                          if (!alreadyExists) {
                            processed.push(processedItem);
                          }
                        }
                      });
                      
                      return processed;
                    };
                    
                    const processedReaders = processReadBy();
                    
                    // For sent messages: filter out the sender (you can't read your own message)
                    // For received messages: show all readers including yourself if you read it
                    let readers = [];
                    if (isMyMsg) {
                      // This is my sent message - show who has read it (excluding me)
                      const senderIdStr = String(senderId).trim();
                      readers = processedReaders.filter(reader => {
                        const readerId = reader.userId;
                        return readerId !== senderIdStr && readerId !== '';
                      });
                    } else {
                      // This is a received message - show all readers (including me if I read it)
                      readers = processedReaders.filter(reader => {
                        const readerId = reader.userId;
                        return readerId !== '';
                      });
                    }

                    // Removed excessive logging for performance

                    if (readers.length === 0) {
                      return (
                        <View style={styles.readReceiptEmpty}>
                          <Icon name="info-outline" size={48} color={colors.textLight} />
                          <Text style={styles.readReceiptEmptyText}>
                            {isMyMsg 
                              ? 'No one has read this message yet'
                              : 'No one has seen this message yet'}
                          </Text>
                          <Text style={styles.readReceiptEmptySubtext}>
                            {isMyMsg
                              ? 'The message will show as read once someone views it'
                              : 'The message will show as seen once someone views it'}
                          </Text>
                        </View>
                      );
                    }

                    return readers.map((reader, index) => {
                      const userId = reader.userId;
                      const readTimestamp = reader.timestamp;
                      const userName = getUserName(userId);
                      const userInitial = userName?.charAt(0)?.toUpperCase() || '?';
                      const isCurrentUser = user && String(userId).trim() === String(user.id).trim();
                      
                      // Format the read timestamp - prioritize individual user's read timestamp from backend
                      let timestampText = '';
                      
                      if (readTimestamp) {
                        // Use the actual read timestamp from backend for this specific user
                        try {
                          timestampText = formatReadTimestamp(readTimestamp);
                        } catch (error) {
                          // If formatting fails, try to show raw timestamp or fallback
                          try {
                            const date = new Date(readTimestamp);
                            if (!isNaN(date.getTime())) {
                              timestampText = formatReadTimestamp(date.toISOString());
                            }
                          } catch {
                            timestampText = 'Recently';
                          }
                        }
                      } else {
                        // Fallback: If no timestamp available, show "Recently" so user knows message was read
                        // This handles cases where backend sends user ID without timestamp (legacy data)
                        timestampText = 'Recently';
                      }
                      
                      return (
                        <View key={`reader-${userId}-${index}`} style={styles.readReceiptItem}>
                          <View style={[
                            styles.readReceiptAvatar,
                            isCurrentUser && { backgroundColor: colors.primary }
                          ]}>
                            <Text style={styles.readReceiptAvatarText}>{userInitial}</Text>
                          </View>
                          <View style={styles.readReceiptItemContent}>
                            <Text style={styles.readReceiptItemName}>
                              {isCurrentUser ? 'You' : userName}
                            </Text>
                            <Text style={styles.readReceiptItemSubtext}>
                              {isMyMsg ? 'Read this message' : 'Seen this message'}
                            </Text>
                            <Text style={styles.readReceiptItemTime}>
                              {timestampText || 'Recently'}
                            </Text>
                          </View>
                          <Icon name="done-all" size={20} color={colors.primary} />
                        </View>
                      );
                    });
                  })()}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // White overlay with 40% opacity
  },
  keyboardContainer: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textWhite + '30',
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textWhite,
    opacity: 0.85,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerIconButton: {
    padding: 8,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  messageContainer: {
    marginBottom: 16,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.75, // 75% of screen width
    minWidth: 60, // Ensure minimum width for short messages
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    flexShrink: 1,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  otherMessageBubble: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 4,
    marginRight: 'auto',
  },
  highlightedMessageBubble: {
    borderWidth: 3,
    borderColor: colors.primary, // Theme color border
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6, // Android shadow
    // Slight theme color tint on bubble (10% opacity: rgba(16, 53, 52, 0.1))
    backgroundColor: 'rgba(16, 53, 52, 0.1)',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  messageTextWithReply: {
    marginTop: 2, // Small margin when there's a reply preview above for better spacing
  },
  myMessageText: {
    color: colors.textWhite,
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  messageInfo: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTime: {
    marginRight: 8,
    fontSize: 10,
  },
  senderName: {
    fontWeight: '500',
    flexShrink: 1,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 16 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 50,
  },
  textInput: {
    flex: 1,
    fontSize: fonts.base,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  
  // New styles for modern chat design
  messageWrapper: {
    marginBottom: 8,
  },
  highlightedMessageWrapper: {
    backgroundColor: 'rgba(16, 53, 52, 0.2)', // Theme color background (20% opacity)
    borderRadius: 8,
    padding: 4,
    marginHorizontal: -4,
    marginVertical: 2,
    borderWidth: 3,
    borderColor: colors.primary, // Theme color border
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 8,
  },
  senderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  senderInitial: {
    fontSize: fonts.xs,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  // Sender name below message bubble (for group chats)
  senderNameBelow: {
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  senderNameBelowMy: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  senderNameBelowOther: {
    alignItems: 'flex-start',
    marginLeft: 12,
  },
  senderNameText: {
    fontSize: 10,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
  },
  senderNameTextMy: {
    color: colors.textSecondary,
    opacity: 0.8,
  },
  senderNameTextOther: {
    color: colors.primary, // Use theme color for other users' names
    opacity: 0.9,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageStatusContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: 16,
    height: 16,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // Image message styles
  imageMessageBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  messageImage: {
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  videoMessageBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  videoContainer: {
    width: width * 0.65,
    maxHeight: width * 0.8,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  messageVideo: {
    width: '100%',
    height: width * 0.65,
    backgroundColor: colors.backgroundSecondary,
  },
  videoCaption: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  imageCaption: {
    padding: 8,
    marginTop: 4,
  },
  // File message styles
  fileMessageBubble: {
    padding: 12,
  },
  fileMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  fileMessageInfo: {
    marginLeft: 12,
    flex: 1,
  },
  fileMessageName: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    marginBottom: 4,
  },
  fileMessageSize: {
    fontSize: fonts.sm,
    opacity: 0.7,
  },
  loadMoreButton: {
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
  },
  typingIndicator: {
    padding: 8,
    marginLeft: 8,
  },
  typingText: {
    color: colors.textLight,
    fontSize: fonts.sm,
    fontStyle: 'italic',
  },
  // Media Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fonts.xl,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalOption: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  modalOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalOptionText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalOptionSubtext: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalCancelButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  // Read Receipt Modal Styles
  readReceiptModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  readReceiptModalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    width: width * 0.92, // Increased from 0.85 to 0.92 (92% width)
    maxHeight: '85%', // Increased from 70% to 85%
    minHeight: 450, // Increased minimum height for better visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden', // Ensure content doesn't overflow
    flexDirection: 'column', // Ensure flex layout for proper scrolling
  },
  readReceiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  readReceiptModalTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  readReceiptMessagePreview: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  readReceiptMessageText: {
    fontSize: fonts.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  readReceiptMessageTime: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginTop: 4,
  },
  readReceiptList: {
    flex: 1, // Use flex to take available space
    paddingVertical: 8,
    minHeight: 250, // Increased minimum height for better scrolling
  },
  readReceiptListContent: {
    paddingBottom: 20, // Extra padding at bottom for better scrolling
    paddingTop: 4,
    flexGrow: 1, // Allow content to grow
  },
  readReceiptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  readReceiptAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  readReceiptAvatarText: {
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.textWhite,
  },
  readReceiptItemContent: {
    flex: 1,
  },
  readReceiptItemName: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  readReceiptItemSubtext: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginBottom: 2,
  },
  readReceiptItemTime: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textLight,
    marginTop: 2,
    opacity: 0.8,
  },
  readReceiptEmpty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readReceiptEmptyText: {
    fontSize: fonts.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  readReceiptEmptySubtext: {
    fontSize: fonts.sm,
    fontFamily: fonts.regular,
    color: colors.textLight,
    textAlign: 'center',
  },
  // Reply Preview Styles
  replyPreview: {
    flexDirection: 'row',
    marginBottom: 4, // Reduced further for better proportions with short messages
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 5, // Reduced further for compact display
    paddingBottom: 5, // Reduced further for compact display
    borderLeftWidth: 3,
    borderRadius: 6,
    marginHorizontal: 4,
    minHeight: 36, // Reduced minimum height for better proportions
    maxHeight: 50, // Reduced maximum height to prevent it from dominating short messages
    overflow: 'hidden', // Ensure content doesn't overflow
  },
  replyPreviewIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  replyPreviewMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  replyPreviewThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.backgroundSecondary,
  },
  swipeableContainer: {
    position: 'relative',
  },
  replyIconBackground: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  replyPreviewMy: {
    borderLeftColor: colors.textWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  replyPreviewOther: {
    borderLeftColor: colors.primary,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  replyPreviewLine: {
    width: 3,
    marginRight: 8,
    borderRadius: 2,
  },
  replyPreviewLineMy: {
    backgroundColor: colors.textWhite,
  },
  replyPreviewLineOther: {
    backgroundColor: colors.primary,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewName: {
    fontSize: fonts.sm,
    fontFamily: fonts.medium,
    marginBottom: 1, // Reduced from 2 for tighter spacing
  },
  replyPreviewNameMy: {
    color: colors.textWhite,
    opacity: 0.9,
  },
  replyPreviewNameOther: {
    color: colors.primary,
  },
  replyPreviewText: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    lineHeight: 14, // Tighter line height for more compact display
  },
  replyPreviewTextMy: {
    color: colors.textWhite,
    opacity: 0.7,
  },
  replyPreviewTextOther: {
    color: colors.textSecondary,
  },
  replyPreviewBar: {
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyPreviewBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyPreviewBarLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  replyPreviewBarLine: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewBarLineMy: {
    backgroundColor: colors.primary,
  },
  replyPreviewBarLineOther: {
    backgroundColor: colors.primary,
  },
  replyPreviewBarText: {
    flex: 1,
  },
  replyPreviewBarName: {
    fontSize: fonts.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 2,
  },
  replyPreviewBarMessage: {
    fontSize: fonts.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  replyPreviewBarClose: {
    padding: 4,
    marginLeft: 8,
  },
});

export default ChatDetailScreen;