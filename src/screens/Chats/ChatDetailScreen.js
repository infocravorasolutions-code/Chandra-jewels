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
  Alert,
  StatusBar,
  ImageBackground,
  Keyboard,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useGetChatMessagesQuery, useGetClientsQuery } from '../../store/api';
import { Card } from '../../components/cards/Cards';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime, spacing, responsivePadding } from '../../utils';

const { width } = Dimensions.get('window');

const ChatDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { chat, enquiry } = route.params || {};
  const [newMessage, setNewMessage] = useState('');
  const scrollViewRef = useRef(null);

  // Get enquiryId from either chat or enquiry params
  const enquiryId = chat?.enquiryId || enquiry?.id || enquiry?._id;
  
  // Debug logs
  useEffect(() => {
    if (__DEV__) {
      console.log('========== CHAT DETAIL SCREEN DEBUG ==========');
      console.log('Chat param:', chat);
      console.log('Enquiry param:', enquiry);
      console.log('Extracted enquiryId:', enquiryId);
      console.log('=============================================');
    }
  }, [chat, enquiry, enquiryId]);
  
  // Fetch chat messages for this enquiry
  const { data: rawMessages = [], isLoading: loading, error: messagesError, refetch } = useGetChatMessagesQuery(enquiryId, {
    skip: !enquiryId,
    refetchOnFocus: true,
    pollingInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Debug messages
  useEffect(() => {
    if (__DEV__) {
      console.log('========== MESSAGES DEBUG ==========');
      console.log('Loading:', loading);
      console.log('Error:', messagesError);
      console.log('Raw Messages:', rawMessages);
      console.log('Raw Messages Count:', rawMessages.length);
      console.log('First Message:', rawMessages[0]);
      console.log('====================================');
    }
  }, [rawMessages, loading, messagesError]);

  // Fetch clients to resolve sender names
  const { data: clients = [] } = useGetClientsQuery(undefined, {
    skip: !user,
  });

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
  const messages = useMemo(() => {
    if (!rawMessages || rawMessages.length === 0) {
      return [];
    }
    
    const enriched = rawMessages.map(msg => {
      // If senderName is already present, use it
      if (msg.senderName && msg.senderName !== 'Unknown') {
        return msg;
      }
      
      // Otherwise, try to resolve from senderMap
      const senderIdStr = String(msg.senderId).trim();
      const senderInfo = senderMap.get(senderIdStr);
      
      if (senderInfo) {
        return {
          ...msg,
          senderName: senderInfo.name,
          senderRole: senderInfo.role,
        };
      }
      
      // Fallback to current user if senderId matches
      if (user && String(user.id).trim() === senderIdStr) {
        return {
          ...msg,
          senderName: user.name || user.email || 'You',
          senderRole: user.role || 'user',
        };
      }
      
      // Default fallback
      return {
        ...msg,
        senderName: msg.senderName || 'Unknown',
        senderRole: msg.senderRole || 'user',
      };
    });
    
    if (__DEV__) {
      console.log('Enriched Messages:', enriched);
      console.log('Enriched Messages Count:', enriched.length);
    }
    
    return enriched;
  }, [rawMessages, senderMap, user]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      keyboardDidShowListener?.remove();
    };
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !enquiryId) return;

    // TODO: Add sendMessage mutation when backend endpoint is ready
    // For now, just clear the input - messages will appear via polling
    // const [sendChatMessage] = useSendChatMessageMutation();
    // await sendChatMessage({ enquiryId, message: newMessage.trim() });
    
    setNewMessage('');
    
    // Refetch messages to show the new one (when backend is ready)
    // await refetch();
    
    Alert.alert('Info', 'Send message functionality will be implemented when backend endpoint is ready');
  };

  // Helper functions for message styling
  const isMyMessage = (message) => {
    if (!user || !message.senderId) return false;
    return String(message.senderId).trim() === String(user.id).trim();
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
    // Get base URL from API configuration
    // Default to common patterns - this will be handled by the backend
    // Using localhost for development
    const baseUrl = __DEV__ && Platform.OS === 'android' 
      ? 'http://10.0.2.2:3000' 
      : 'http://localhost:3000';
    // Try common file serving patterns
    return `${baseUrl}/api/files/${encodeURIComponent(mediaKey)}`;
  };

  const handleFilePress = async (mediaKey, mediaName) => {
    const url = getMediaUrl(mediaKey);
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open this file');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open file');
      }
    }
  };

  const renderMessage = (message, index) => {
    const myMessage = isMyMessage(message);
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showSenderName = message.isGroup && !myMessage && 
      (!previousMessage || previousMessage.senderId !== message.senderId);
    
    const isImage = message.messageType === 'image';
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
            isFile && styles.fileMessageBubble,
          ]}>
            {isImage && message.mediaKey ? (
              <TouchableOpacity 
                onPress={() => handleFilePress(message.mediaKey, message.mediaName)}
                activeOpacity={0.8}>
                <Image
                  source={{ uri: getMediaUrl(message.mediaKey) }}
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
                {message.text || message.message}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                myMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}>
                {formatMessageTime(message.timestamp)}
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
  };

  const renderChatHeader = () => {
    const title = chat?.enquiryTitle || enquiry?.title || 'Chat';
    const clientName = chat?.clientName || enquiry?.client || 'Client';

    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textWhite} />
        </TouchableOpacity>
        
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {clientName?.charAt(0)?.toUpperCase() || 'C'}
          </Text>
        </View>
        
        <View style={styles.headerText}>
          <Text style={styles.chatTitle}>
            {title}
          </Text>
          <Text style={styles.clientName}>
            {clientName}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerMenuButton}>
          <Icon name="dots-vertical" size={20} color={colors.textWhite} />
        </TouchableOpacity>
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
    <ImageBackground 
      source={require('../../assets/images/doodle.png')} 
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.backgroundOverlay}>
        <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
        {renderChatHeader()}

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}>
            
            {loading && messages.length === 0 ? (
              renderEmptyState()
            ) : !loading && messages.length === 0 && !messagesError ? (
              renderEmptyState()
            ) : messages.length > 0 ? (
              messages.map((message, index) => renderMessage(message, index))
            ) : (
              renderEmptyState()
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.attachButton}>
                <Icon name="attach-file" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.textLight}
                  value={newMessage}
                  onChangeText={setNewMessage}
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
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
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
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 2,
  },
  clientName: {
    fontSize: 13,
    color: colors.textWhite,
    opacity: 0.8,
  },
  headerMenuButton: {
    padding: 8,
    marginLeft: 8,
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
});

export default ChatDetailScreen;
