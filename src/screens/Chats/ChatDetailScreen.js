import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
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
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      // Enhanced dummy data for group chats
      const dummyMessages = [
        {
          id: '1',
          text: 'Hello! I have some questions about my diamond ring design.',
          senderId: 'client1',
          senderName: 'John Smith',
          senderRole: 'client',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          status: 'delivered',
          isGroup: true,
        },
        {
          id: '2',
          text: 'Hi John! I\'m Sarah, your design consultant. I\'d be happy to help with your diamond ring design. What specific questions do you have?',
          senderId: 'admin1',
          senderName: 'Sarah Johnson',
          senderRole: 'admin',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(), // 1.5 hours ago
          status: 'read',
          isGroup: true,
        },
        {
          id: '3',
          text: 'I\'m working on the initial sketches for your ring. Should be ready by tomorrow.',
          senderId: 'designer1',
          senderName: 'Mike Designer',
          senderRole: 'coral',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          status: 'delivered',
          isGroup: true,
        },
        {
          id: '4',
          text: 'Perfect! I\'m looking forward to seeing the designs. Can you make sure to include the vintage style elements we discussed?',
          senderId: 'client1',
          senderName: 'John Smith',
          senderRole: 'client',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
          status: 'sent',
          isGroup: true,
        },
        {
          id: '5',
          text: 'Absolutely! I\'ve noted the vintage elements. I\'ll make sure to incorporate them into the design.',
          senderId: 'designer1',
          senderName: 'Mike Designer',
          senderRole: 'coral',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
          status: 'delivered',
          isGroup: true,
        },
        {
          id: '6',
          text: 'Great! Let me know if you need any additional information or references.',
          senderId: 'admin1',
          senderName: 'Sarah Johnson',
          senderRole: 'admin',
          timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 minutes ago
          status: 'read',
          isGroup: true,
        },
      ];
      
      setMessages(dummyMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      timestamp: new Date().toISOString(),
      status: 'sending',
      isGroup: true,
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Simulate message delivery
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === message.id ? { ...msg, status: 'delivered' } : msg
        )
      );
    }, 1000);
  };

  // Helper functions for message styling
  const isMyMessage = (message) => message.senderId === user.id;
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

  const renderMessage = (message, index) => {
    const myMessage = isMyMessage(message);
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showSenderName = message.isGroup && !myMessage && 
      (!previousMessage || previousMessage.senderId !== message.senderId);
    
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
          ]}>
            <Text style={[
              styles.messageText,
              myMessage ? styles.myMessageText : styles.otherMessageText,
            ]}>
              {message.text || message.message}
            </Text>
            
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="chat" size={20} color={colors.textLight} />
      <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fonts.base }]}>
        Start the conversation
      </Text>
      <Text style={{ color: colors.textLight, fontSize: fonts.sm }}>
        Send a message to begin chatting about this enquiry
      </Text>
    </View>
  );

  return (
    <ImageBackground 
      source={require('../../assets/images/doodle.png')} 
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.backgroundOverlay}>
        <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {renderChatHeader()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}>
        
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          messages.map((message, index) => renderMessage(message, index))
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
    fontSize: fonts.base,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
  },
  chatTitle: {
    fontSize: fonts.lg,
    fontFamily: fonts.bold,
    color: colors.textWhite,
    marginBottom: 2,
  },
  clientName: {
    fontSize: fonts.sm,
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
    fontSize: fonts.base,
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
  },
  senderName: {
    fontWeight: '500',
    flexShrink: 1,
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
});

export default ChatDetailScreen;
