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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Card } from '../../components/cards/Cards';
import { Button } from '../../components/common';
import { colors } from '../../constants/colors';
import { fonts } from '../../constants/fonts';
import Icon from '../../components/common/Icon';
import { formatDateTime } from '../../utils/helpers';

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
      const enquiryId = chat?.enquiryId || enquiry?.id;
      const messageData = await api.getChatMessages(enquiryId);
      setMessages(messageData);
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
      sender: user.name,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isClient: user.role === 'client',
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Simulate response after 2 seconds
    setTimeout(() => {
      const response = {
        id: (Date.now() + 1).toString(),
        sender: user.role === 'client' ? 'Designer' : 'Client',
        message: 'Thank you for your message. We will get back to you soon.',
        timestamp: new Date().toISOString(),
        isClient: user.role !== 'client',
      };
      setMessages(prev => [...prev, response]);
    }, 2000);
  };

  const renderMessage = (message) => {
    const isMyMessage = message.isClient === (user.role === 'client');
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}>
        
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}>
          <Text style={[styles.messageText, { color: isMyMessage ? colors.textWhite : colors.textPrimary, fontSize: fonts.base }]}>
            {message.message}
          </Text>
        </View>

        <View style={styles.messageInfo}>
          <Text style={[styles.messageTime, { color: colors.textLight, fontSize: fonts.sm }]}>
            {formatDateTime(message.timestamp)}
          </Text>
          {!isMyMessage && (
            <Text style={[styles.senderName, { color: colors.textSecondary, fontSize: fonts.sm }]}>
              {message.sender}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderChatHeader = () => {
    const title = chat?.enquiryTitle || enquiry?.title || 'Chat';
    const clientName = chat?.clientName || enquiry?.client || 'Client';

    return (
      <Card style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerAvatar}>
            <Icon name="account" size={20} color={colors.textWhite} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { fontSize: fonts.xl, fontFamily: fonts.bold, color: colors.textPrimary }]}>
              {title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: fonts.sm }}>
              {clientName}
            </Text>
          </View>
        </View>
      </Card>
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
    <SafeAreaView style={styles.container}>
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
          messages.map(renderMessage)
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textLight}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !newMessage.trim() && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}>
            <Text style={{ fontSize: 16, color: newMessage.trim() ? colors.textWhite : colors.textLight }}>
              ➤
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerCard: {
    margin: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    marginBottom: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
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
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    flexShrink: 1,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: fonts.base,
    lineHeight: 20,
    flexWrap: 'wrap',
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
    alignItems: 'flex-end',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: fonts.base,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 8,
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
});

export default ChatDetailScreen;
