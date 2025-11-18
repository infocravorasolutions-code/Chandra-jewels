import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
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
} from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../features/clients/clientsHooks';
import { useChat } from '../../hooks/useChat';
import { useAlert } from '../../context/AlertContext';
import { Card } from '../../components/cards/Cards';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, spacing, responsivePadding } from '../../utils';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { FILE_BASE_URL } from '../../config/apiConfig';

const { width } = Dimensions.get('window');

const ChatDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { chatId, chat: routeChat, enquiry, enquiryId: routeEnquiryId, chatType } = route.params || {};
  const alert = useAlert();
  
  // Only log once on mount, not on every render
  React.useEffect(() => {
    if (__DEV__) {
      console.log('routeChat params:', { chatId, routeChat, enquiry, routeEnquiryId, chatType });
    }
  }, []); // Empty deps - only log once
  
  // Get enquiryId from route params (fallback to chat or enquiry object)
  const enquiryId = routeEnquiryId || routeChat?.EnquiryId || routeChat?.enquiryId || enquiry?.id || enquiry?._id;
  
  // Get the specific chatId to use (prioritize direct chatId, then routeChat._id)
  const specificChatId = chatId || routeChat?._id || routeChat?.id;
  
  // Use the custom chat hook - this handles everything!
  // If we have a chatId, we should use it directly, otherwise fall back to enquiryId search
  const {
    chat: hookChat,
    messages,
    isLoadingChat,
    messagesLoading,
    chatError,
    isTyping,
    isUploading,
    sendMessage: sendChatMessage,
    sendMedia,
    sendTyping,
    refetchMessages,
    refetchChat,
    loadMoreMessages,
    hasMore,
    isLoadingMore,
  } = useChat(enquiryId, chatType, specificChatId);
  
  // Use routeChat if it has an _id and hook hasn't loaded yet, otherwise use hookChat
  const chat = (hookChat?._id || hookChat?.id) ? hookChat : (routeChat?._id || routeChat?.id ? routeChat : hookChat);

  // Track last refetch time to prevent excessive refetching
  const lastRefetchTimeRef = React.useRef(0);
  const REFETCH_COOLDOWN = 2000; // 2 seconds cooldown between refetches
  
  // Force refetch when screen is focused (user revisits or opens chat)
  useFocusEffect(
    React.useCallback(() => {
      if (chat?._id) {
        const now = Date.now();
        // Only refetch if enough time has passed since last refetch
        if (now - lastRefetchTimeRef.current > REFETCH_COOLDOWN) {
          if (__DEV__) {
            console.log('🔄 Screen focused - refetching messages for chat:', chat._id);
          }
          lastRefetchTimeRef.current = now;
          
          // Function to attempt refetch with retry logic
          const timers = [];
          const attemptRefetch = (retryCount = 0) => {
            const maxRetries = 5;
            const retryDelay = 300;
            
            // Small delay to ensure screen is fully mounted and query is initialized
            const timer = setTimeout(() => {
              try {
                if (refetchMessages && typeof refetchMessages === 'function') {
                  refetchMessages().catch(err => {
                    if (__DEV__) {
                      console.warn('⚠️ Refetch failed, will retry:', err.message);
                    }
                    // Retry if query wasn't ready yet
                    if (retryCount < maxRetries) {
                      attemptRefetch(retryCount + 1);
                    }
                  });
                } else if (retryCount < maxRetries) {
                  // Query not initialized yet, retry
                  attemptRefetch(retryCount + 1);
                }
              } catch (error) {
                if (__DEV__) {
                  console.warn('⚠️ Could not refetch messages (query not initialized yet):', error.message);
                }
                // Retry if query wasn't ready yet
                if (retryCount < maxRetries) {
                  attemptRefetch(retryCount + 1);
                }
              }
            }, 300);
            
            timers.push(timer);
          };
          
          attemptRefetch();
          return () => {
            timers.forEach(timer => clearTimeout(timer));
          };
        }
      }
    }, [chat?._id, refetchMessages])
  );

  const [newMessage, setNewMessage] = useState('');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const scrollViewRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const previousMessageCountRef = useRef(0);

  // Fetch clients to resolve sender names (using cached hook)
  // MUST be called before any hooks that depend on enrichedMessages
  const { clients = [] } = useClients({
    skip: !user,
  });

  const loading = isLoadingChat || messagesLoading;
  const messagesError = chatError;

  // Scroll to bottom function
  const scrollToBottom = React.useCallback(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, []);

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
  const enrichedMessages = useMemo(() => {
    if (__DEV__) {
      console.log('🔍 Enriching messages:', {
        messagesLength: messages?.length || 0,
        messagesType: typeof messages,
        messagesIsArray: Array.isArray(messages),
      });
    }
    
    if (!messages || messages.length === 0) {
      if (__DEV__) {
        console.log('⚠️ No messages to enrich');
      }
      return [];
    }
    
    return messages.map(msg => {
      // Normalize message format (handle both API and WebSocket formats)
      const normalizedMsg = {
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
        ...msg, // Preserve any other fields
      };

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

  // Handle loading more messages - maintain scroll position
  const handleLoadMore = React.useCallback(async () => {
    if (!hasMore || isLoadingMore || loading) return;
    
    // Store current scroll position
    scrollPositionRef.current = scrollPositionRef.current || 0;
    previousMessageCountRef.current = (enrichedMessages && enrichedMessages.length) || 0;
    
    // Load more messages
    await loadMoreMessages();
  }, [hasMore, isLoadingMore, loading, loadMoreMessages, enrichedMessages]);

  // Maintain scroll position when new messages are loaded from top
  useEffect(() => {
    const currentLength = (enrichedMessages && enrichedMessages.length) || 0;
    if (previousMessageCountRef.current > 0 && currentLength > previousMessageCountRef.current) {
      // New messages were added to the top
      // Maintain scroll position by scrolling to the same relative position
      setTimeout(() => {
        if (scrollViewRef.current && scrollPositionRef.current > 0) {
          // Calculate new scroll position
          const newMessageCount = currentLength - previousMessageCountRef.current;
          // Scroll to maintain position (approximate)
          scrollViewRef.current.scrollTo({
            y: scrollPositionRef.current + (newMessageCount * 100), // Approximate message height
            animated: false,
          });
        }
      }, 100);
    }
  }, [enrichedMessages]);

  // Scroll to bottom when new messages arrive (at the end)
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Only auto-scroll if user is near bottom (within 500px)
      if (scrollPositionRef.current < 500) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, [scrollToBottom]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !chat) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    // Send via the hook (now async)
    const sent = await sendChatMessage(messageText);
    
    if (!sent) {
      alert.error('Error', 'Failed to send message. Please check your connection and try again.');
      setNewMessage(messageText); // Restore message on error
    }
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

    picker(options, async (response) => {
      if (response.didCancel) {
        if (__DEV__) {
          console.log('User cancelled media picker');
        }
        return;
      }

      if (response.errorCode) {
        console.error('ImagePicker Error:', response.errorMessage);
        alert.error('Error', response.errorMessage || 'Failed to pick media');
        return;
      }

      const asset = response.assets?.[0];
      if (!asset || !chat) {
        if (__DEV__) {
          console.warn('No asset selected or chat not available');
        }
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
          if (__DEV__) {
            console.log('✅ Media sent successfully');
          }
        }
      } catch (error) {
        console.error('Error sending media:', error);
        alert.error(
          'Error',
          error.message || 'Failed to send media. Please try again.'
        );
      }
    });
  };

  // Helper functions for message styling
  const isMyMessage = (message) => {
    if (!user || !message.SenderId && !message.senderId) return false;
    const senderId = message.SenderId || message.senderId;
    return String(senderId).trim() === String(user.id).trim();
  };
  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sending': return 'schedule';
      case 'sent': return 'check';
      case 'delivered': return 'done-all';
      case 'read': return 'done-all';
      case 'failed': return 'error';
      default: return 'schedule';
    }
  };

  const getMessageStatusColor = (status) => {
    switch (status) {
      case 'sending': return colors.textLight;
      case 'sent': return colors.textLight;
      case 'delivered': return colors.textLight;
      case 'read': return colors.primary;
      case 'failed': return colors.error;
      default: return colors.textLight;
    }
  };

  const getSenderColor = (role) => {
    switch (role) {
      case 'admin': return colors.primary;
      case 'client': return colors.success;
      case 'coral': return colors.warning;
      case 'cad': return colors.info;
      default: return colors.textSecondary;
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
    return date.toLocaleDateString();
  };

  const getMediaUrl = (mediaKey) => {
    if (!mediaKey) return null;
    // If mediaKey is already a full URL (from S3), return it directly
    if (typeof mediaKey === 'string' && (mediaKey.startsWith('http://') || mediaKey.startsWith('https://'))) {
      return mediaKey;
    }
    // Use centralized file base URL
    return `${FILE_BASE_URL}/api/files/${encodeURIComponent(mediaKey)}`;
  };

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

  // Memoize renderMessage to prevent recreation on every render
  const renderMessage = React.useCallback((message, index) => {
    const myMessage = isMyMessage(message);
    const previousMessage = index > 0 ? enrichedMessages[index - 1] : null;
    const showSenderName = message.isGroup && !myMessage && 
      (!previousMessage || previousMessage.senderId !== message.senderId);
    
    const isImage = message.messageType === 'image';
    const isVideo = message.messageType === 'video';
    const isFile = message.messageType === 'file';
    
    return (
      <View key={message.id} style={styles.messageWrapper}>
        {showSenderName && (
          <View style={styles.senderInfo}>
            <View style={[styles.senderAvatar, { backgroundColor: getSenderColor(message.senderRole) }]}>
              <Text style={styles.senderInitial}>
                {message.senderName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={[styles.senderName, { color: getSenderColor(message.senderRole) }]}>
              {message.senderName}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          myMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}>
          <View style={[
            styles.messageBubble,
            myMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            isImage && styles.imageMessageBubble,
            isVideo && styles.videoMessageBubble,
            isFile && styles.fileMessageBubble,
          ]}>
            {isImage && message.mediaKey ? (
              <TouchableOpacity 
                onPress={() => handleFilePress(message.mediaKey, message.mediaName)}
                activeOpacity={0.8}>
                <Image
                  source={{ uri: message.mediaUrl || getMediaUrl(message.mediaKey) }}
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
            ) : isVideo && message.mediaKey ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: message.mediaUrl || getMediaUrl(message.mediaKey) }}
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
            ) : isFile && message.mediaKey ? (
              <TouchableOpacity 
                onPress={() => handleFilePress(message.mediaKey, message.mediaName)}
                style={styles.fileMessageContainer}
                activeOpacity={0.8}>
                <Icon name="insert-drive-file" size={24} color={myMessage ? colors.textWhite : colors.primary} />
                <View style={styles.fileMessageInfo}>
                  <Text style={[
                    styles.fileMessageName,
                    myMessage ? styles.myMessageText : styles.otherMessageText,
                  ]} numberOfLines={1}>
                    {message.mediaName || 'File'}
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
              
              {myMessage && (
                <Icon
                  name={getMessageStatusIcon(message.status)}
                  size={12}
                  color={getMessageStatusColor(message.status)}
                  style={styles.messageStatus}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [enrichedMessages, isMyMessage, handleFilePress, getMediaUrl, formatMessageTime, getMessageStatusIcon, getMessageStatusColor, user]);

  const renderChatHeader = () => {
    // Get chat/enquiry title - prioritize actual enquiry name
    const enquiryTitle = enquiry?.title || enquiry?.Name || enquiry?.name;
    const chatTitle = chat?.EnquiryName || chat?.enquiryTitle || chat?.enquiryName;
    const title = enquiryTitle || chatTitle || 'New Chat';
    
    // Get client name - try multiple sources
    const clientName = 
      chat?.ClientName || 
      chat?.clientName || 
      enquiry?.clientName || 
      enquiry?.client?.name || 
      enquiry?.Client?.Name ||
      enquiry?.Client?.name ||
      'Client';

    // Get client initial for avatar
    const clientInitial = clientName?.charAt(0)?.toUpperCase() || 'C';

    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={24} color={colors.textWhite} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerAvatarContainer}
          activeOpacity={0.7}
        >
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {clientInitial}
            </Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerText}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.clientName} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => {
              // TODO: Add chat info/options
              alert.info('Chat Info', `Chat: ${title}\nClient: ${clientName}`);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="info" size={20} color={colors.textWhite} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    // Show different states based on loading/error
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
            Loading messages...
          </Text>
        </View>
      );
    }
    
    if (messagesError) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error" size={40} color={colors.error} />
          <Text style={[styles.emptyText, { color: colors.error, fontSize: fonts.base }]}>
            Error loading messages
          </Text>
          <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
            {messagesError?.data?.error || messagesError?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <Icon name="chat" size={40} color={colors.textLight} />
        <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
          Start the conversation
        </Text>
        <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
          Send a message to begin chatting about this enquiry
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      enabled={true}>
      <ImageBackground 
        source={require('../../assets/images/doodle.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
          <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
          {renderChatHeader()}

          <View style={styles.keyboardContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={(event) => {
                // Track scroll position for maintaining position when loading more
                scrollPositionRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              onContentSizeChange={React.useCallback(() => {
                // Only auto-scroll if user is near bottom
                if (scrollPositionRef.current < 500) {
                  scrollToBottom();
                }
              }, [scrollToBottom])}>
              
              {(() => {
                // Debug what we're rendering
                if (__DEV__) {
                  console.log('🎨 RENDERING CHECK:', {
                    loading,
                    enrichedMessagesLength: enrichedMessages?.length || 0,
                    messagesLength: messages?.length || 0,
                    messagesError: !!messagesError,
                    willShowEmpty: loading && (!enrichedMessages || enrichedMessages.length === 0),
                    willShowMessages: enrichedMessages && enrichedMessages.length > 0,
                  });
                }
                
                if (loading && (!enrichedMessages || enrichedMessages.length === 0)) {
                  return renderEmptyState();
                }
                if (!loading && (!enrichedMessages || enrichedMessages.length === 0) && !messagesError) {
                  return renderEmptyState();
                }
                if (enrichedMessages && enrichedMessages.length > 0) {
                  return (
                <>
                  {/* Load More Button */}
                  {hasMore && (
                    <View style={styles.loadMoreContainer}>
                      <TouchableOpacity
                        style={styles.loadMoreButton}
                        onPress={handleLoadMore}
                        disabled={isLoadingMore || loading}>
                        {isLoadingMore ? (
                          <View style={styles.loadMoreLoading}>
                            <Icon name="hourglass-empty" size={16} color={colors.primary} />
                            <Text style={styles.loadMoreText}>Loading older messages...</Text>
                          </View>
                        ) : (
                          <Text style={styles.loadMoreText}>Load Older Messages</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  
                    {enrichedMessages.map((message, index) => renderMessage(message, index))}
                    {isTyping && (
                      <View style={styles.typingIndicator}>
                        <Text style={styles.typingText}>Someone is typing...</Text>
                      </View>
                    )}
                  </>
                  );
                }
                return renderEmptyState();
              })()}
            </ScrollView>

            <View style={styles.inputContainer}>
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
                    placeholder="Type a message..."
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
          </View>
        </View>
      </ImageBackground>

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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  messageText: {
    fontSize: 13,
    lineHeight: 20,
    flexWrap: 'wrap',
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
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  messageStatus: {
    marginLeft: 4,
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
  loadMoreContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  loadMoreLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
});

export default ChatDetailScreen;
